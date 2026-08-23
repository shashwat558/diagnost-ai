"""Feature-request scan: extract, aggregate, checkpoint. Idempotent."""

from __future__ import annotations

import uuid

from .config import Config, load_config
from .features import make_feature_judge
from .stores import ClickHouseReader, PostgresWriter


def scan_features(cfg: Config | None = None) -> dict:
    cfg = cfg or load_config()
    ch = ClickHouseReader(cfg)
    pg = PostgresWriter(cfg.database_url)
    judge = make_feature_judge(cfg)

    try:
        scanned = {r[0] for r in pg.fetchall("SELECT conversation_id FROM feature_scans")}
        convos = [
            c for c in ch.fetch_unprocessed_conversations()
            if c.conversation_id not in scanned
        ]
        if not convos:
            print("[features] nothing new to scan")
            return {"scanned": 0, "requests": 0}

        existing = {
            row[0]: row
            for row in pg.fetchall(
                """
                SELECT slug, description, frequency, example_conversation_ids
                FROM feature_requests WHERE workspace_id = %s
                """,
                (cfg.workspace_id,),
            )
        }

        touched: dict[str, dict] = {}
        scanned_ids = 0

        for convo in convos:
            hits = judge.extract(convo.text)
            if not hits:
                pg.execute(
                    "INSERT INTO feature_scans (conversation_id) VALUES (%s) ON CONFLICT DO NOTHING",
                    (convo.conversation_id,),
                )
                continue
            scanned_ids += 1
            for hit in hits:
                slot = touched.setdefault(hit.slug, {"desc": hit.description, "convs": []})
                # one conversation counts once per slug even if repeated inside it
                if convo.conversation_id not in slot["convs"]:
                    slot["convs"].append(convo.conversation_id)
                    if len(slot["desc"]) < 10:
                        slot["desc"] = hit.description

            pg.execute(
                "INSERT INTO feature_scans (conversation_id) VALUES (%s) ON CONFLICT DO NOTHING",
                (convo.conversation_id,),
            )

        for slug, info in touched.items():
            add = len(info["convs"])
            row = existing.get(slug)
            if row:
                new_freq = int(row[2]) + add
                examples = list(row[3]) + [c for c in info["convs"] if c not in set(row[3])]
                pg.execute(
                    """
                    UPDATE feature_requests
                    SET frequency=%s, example_conversation_ids=%s, last_seen_at=now(),
                        description = CASE WHEN length(%s) > length(description) THEN %s ELSE description END
                    WHERE workspace_id=%s AND slug=%s
                    """,
                    (new_freq, examples[:20], info["desc"], info["desc"], cfg.workspace_id, slug),
                )
            else:
                pg.execute(
                    """
                    INSERT INTO feature_requests
                      (id, workspace_id, slug, description, frequency,
                       example_conversation_ids, first_seen_at, last_seen_at)
                    VALUES (%s,%s,%s,%s,%s,%s,now(),now())
                    """,
                    (
                        f"fr_{uuid.uuid4().hex[:12]}",
                        cfg.workspace_id,
                        slug,
                        info["desc"],
                        add,
                        info["convs"][:20],
                    ),
                )

        total_rows = len(existing) + sum(1 for s in touched if s not in existing)
        print(f"[features] scanned={len(convos)} slugs_touched={len(touched)} "
              f"total_known={total_rows}")
        return {"scanned": len(convos), "requests": total_rows}
    finally:
        ch.close()
        pg.close()


def main() -> None:
    scan_features()


if __name__ == "__main__":
    main()
