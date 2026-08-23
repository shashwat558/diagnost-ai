"""Phase-2 pipeline: embed → cluster → judge-label → persist → drift-alert.

Idempotent: processed conversations are checkpointed in Postgres, alerts are
deduped by (cluster, type, window).
"""

from __future__ import annotations

import uuid
from datetime import datetime

import numpy as np

from .cluster import run_hdbscan, top_terms
from .config import Config, load_config
from .drift import bucket_conversations, detect_spike
from .embeddings import make_embedder
from .judge import ClusterInput, make_judge
from .stores import ClickHouseReader, PostgresWriter


def analyze(cfg: Config | None = None) -> dict:
    cfg = cfg or load_config()
    ch = ClickHouseReader(cfg)
    pg = PostgresWriter(cfg.database_url)
    embedder = make_embedder(cfg)
    judge = make_judge(cfg)

    try:
        known = {
            row[0] for row in pg.fetchall("SELECT conversation_id FROM processed_conversations")
        }
        convos = [c for c in ch.fetch_unprocessed_conversations() if c.conversation_id not in known]
        if not convos:
            print("[analysis] nothing new to process")
            return {"conversations": 0, "clusters": 0, "alerts": 0}

        print(f"[analysis] processing {len(convos)} conversations "
              f"(embedding={embedder.mode}, judge={judge.mode})")

        # Pattern discovery embeds USER-side text: users describe problems
        # consistently, assistant replies are template boilerplate that would
        # fragment clusters along response variants.
        vectors = np.array(embedder.embed_batch([c.user_text or "(empty)" for c in convos]))
        result = run_hdbscan(
            vectors,
            min_cluster_size=cfg.hdbscan_min_cluster_size,
            min_samples=cfg.hdbscan_min_samples,
        )
        all_texts = [c.text for c in convos]

        # ── per-cluster persistence + labeling ────────────────────────
        clusters_created = 0
        members_by_cluster: dict[int, list[int]] = {}
        for i, label in enumerate(result.labels):
            if label >= 0:
                members_by_cluster.setdefault(int(label), []).append(i)

        cluster_rows: list[tuple] = []
        member_rows: list[tuple] = []
        cluster_meta: dict[int, tuple[str, float]] = {}

        for label, idxs in sorted(members_by_cluster.items(), key=lambda kv: -len(kv[1])):
            texts = [convos[i].text for i in idxs]
            errors = sum(1 for i in idxs if convos[i].has_error)
            error_rate = errors / len(idxs)
            terms = top_terms(texts, all_texts)
            cid = f"cl_{uuid.uuid4().hex[:12]}"

            judged = judge.label_cluster(
                ClusterInput(cluster_id=cid, texts=texts, top_terms=terms, error_rate=error_rate)
            )

            cluster_rows.append(
                (
                    cid,
                    cfg.workspace_id,
                    judged.intent,
                    judged.intent,
                    judged.summary,
                    judged.sentiment,
                    judged.frustration,
                    len(idxs),
                    error_rate,
                    terms,
                    judge.mode,
                    embedder.mode,
                )
            )
            member_rows.extend(
            (cid, convos[i].conversation_id, bool(convos[i].has_error)) for i in idxs
        )
            cluster_meta[label] = (cid, error_rate)
            clusters_created += 1

        pg.executemany(
            """
            INSERT INTO clusters (id, workspace_id, label, intent, summary, sentiment,
                                  frustration, size, error_rate, top_terms, judge_mode,
                                  embedding_mode)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            cluster_rows,
        )
        pg.executemany(
            """
            INSERT INTO cluster_members (cluster_id, conversation_id, has_error)
            VALUES (%s,%s,%s) ON CONFLICT DO NOTHING
            """,
            member_rows,
        )

        # ── drift detection per new cluster + global baseline ─────────
        alerts = _run_drift(cfg, ch, pg, cluster_meta)

        pg.executemany(
            "INSERT INTO processed_conversations (conversation_id) VALUES (%s) ON CONFLICT DO NOTHING",
            [(c.conversation_id,) for c in convos],
        )

        print(f"[analysis] clusters={clusters_created} alerts={alerts} "
              f"noise={int((result.labels == -1).sum())}")
        return {"conversations": len(convos), "clusters": clusters_created, "alerts": alerts}
    finally:
        ch.close()
        pg.close()


def _adaptive_bucket_minutes(items: list[tuple[datetime, bool]],
                             configured: int,
                             target_n_per_bucket: int = 20) -> int:
    """Pick a bucket size so each bucket holds ~target_n members — per-hour
    buckets on a 278-member cluster average n≈6 and binomial clumps read as
    'spikes'. Returns at least the configured granularity, at most 8h."""
    if not items:
        return configured
    span_min = (max(t for t, _ in items) - min(t for t, _ in items)).total_seconds() / 60
    if span_min <= 0:
        return configured
    raw = span_min * target_n_per_bucket / len(items)
    return int(max(configured, min(raw, 480)))


def _run_drift(cfg: Config, ch: ClickHouseReader, pg: PostgresWriter,
               cluster_meta: dict[int, tuple[str, float]]) -> int:
    """EWMA/CUSUM over failure rates for each fresh cluster; also re-checks the
    most recent window globally so spikes on existing clusters still fire."""
    fired = 0
    now = datetime.utcnow()

    # pull per-conversation failure flags for every cluster we know about
    rows = pg.fetchall(
        """
        SELECT cm.cluster_id, cm.conversation_id
        FROM cluster_members cm
        JOIN clusters c ON c.id = cm.cluster_id
        WHERE c.workspace_id = %s
        """,
        (cfg.workspace_id,),
    )
    if not rows:
        return 0

    conv_ids = [r[1] for r in rows]
    id_list = ",".join("'" + c.replace("'", "") + "'" for c in conv_ids)
    flags = ch.query(
        f"""
        SELECT conversation_id, max(timestamp) AS ended_at,
               countIf(status='error') > 0 AS failed
        FROM {cfg.clickhouse_db}.events
        WHERE conversation_id IN ({id_list})
        GROUP BY conversation_id
        """
    )
    flag_map = {
        str(r["conversation_id"]): (str(r["ended_at"]), bool(r["failed"])) for r in flags
    }

    by_cluster: dict[str, list[tuple[datetime, bool]]] = {}
    for cid, convo_id in rows:
        info = flag_map.get(convo_id)
        if not info:
            continue
        ended = datetime.fromisoformat(info[0].replace("Z", "+00:00")).replace(tzinfo=None)
        by_cluster.setdefault(cid, []).append((ended, info[1]))

    for cid, items in by_cluster.items():
        bucket_minutes = _adaptive_bucket_minutes(items, cfg.drift_bucket_minutes)
        buckets = bucket_conversations(items, bucket_minutes=bucket_minutes)
        verdict = detect_spike(buckets)
        if not verdict.drifted:
            continue

        dedupe_key = f"{cid}:failure_rate_spike:{now.strftime('%Y%m%d%H')}"
        exists = pg.fetchall("SELECT 1 FROM alerts WHERE dedupe_key = %s", (dedupe_key,))
        if exists:
            continue

        alert_id = f"al_{uuid.uuid4().hex[:12]}"
        pg.execute(
            """
            INSERT INTO alerts (id, workspace_id, cluster_id, type, severity, message, evidence, dedupe_key)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            (
                alert_id,
                cfg.workspace_id,
                cid,
                "failure_rate_spike",
                "critical" if verdict.recent_rate > 2 * max(verdict.baseline_rate, 0.01) else "warning",
                (
                    f"Sustained failure-rate rise detected (z={verdict.evidence.get('z')}≥3, "
                    f"CUSUM {verdict.cusum} ≥ h {verdict.threshold}): "
                    f"{verdict.baseline_rate:.1%} → {verdict.recent_rate:.1%} "
                    f"over recent {bucket_minutes}-min buckets."
                ),
                _json_evidence(verdict),
                dedupe_key,
            ),
        )
        fired += 1
        print(f"[drift] ALERT {alert_id} on {cid}: "
              f"{verdict.baseline_rate:.1%} → {verdict.recent_rate:.1%}")

    return fired


def _json_evidence(verdict) -> str:
    import json

    return json.dumps({
        "baseline_rate": verdict.baseline_rate,
        "recent_rate": verdict.recent_rate,
        "cusum": verdict.cusum,
        "threshold": verdict.threshold,
        **verdict.evidence,
    })


def main() -> None:
    analyze()


if __name__ == "__main__":
    main()
