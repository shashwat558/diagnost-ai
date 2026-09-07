import { H1, Lead, H2, P, Inline, DocTable, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Core concepts — Diagnost AI Docs" };

export default function ConceptsPage() {
  return (
    <div>
      <H1>Core concepts</H1>
      <Lead>The mental model behind everything you see in the dashboard.</Lead>

      <H2>Events → Conversations → Intents</H2>
      <P>
        An <strong>event</strong> is one tracked step (agent reply, tool call, checkpoint) with a
        name, kind, status (<Inline>ok</Inline>/<Inline>error</Inline>), latency, tokens and
        attributes. Events sharing a <Inline>conversationId</Inline> form a{" "}
        <strong>conversation</strong> (one user session). Conversations with similar failures are
        clustered (HDBSCAN over embeddings + an LLM judge) into ranked <strong>intents</strong> —
        e.g. <Inline>date_format_error</Inline> — ordered by failure impact (size × error rate).
      </P>

      <H2>The numbers on every intent</H2>
      <DocTable
        head={["Metric", "Meaning"]}
        rows={[
          ["Conversations", "How many sessions belong to this intent."],
          ["Trend", "Daily volume, last 7 days. Red = high failure share."],
          ["vs Prior 1 day", "Volume change vs yesterday. Green = growing."],
          ["Error rate", "Failed ÷ total conversations in the intent."],
          ["Frustration", "Low user ratings ÷ rated conversations. ≥ 50% earns a “Needs instruction” badge."],
          ["Mood", "Average sentiment: Positive / Mixed / Negative."],
        ]}
      />

      <H2>Drift detection</H2>
      <P>
        Two layers, cheap first: a <strong>pooled-proportion z-gate</strong> (z ≥ 3 plus a minimum
        10-point rate jump) catches sudden spikes, and <strong>CUSUM</strong> confirms they persist
        instead of flickering. Only the spiking pattern alerts — flat failure rates, however high,
        stay quiet. That&apos;s why the demo fires exactly one alert.
      </P>

      <H2>Feature requests</H2>
      <P>
        The worker scans transcripts for ask-patterns (“I wish…”, “can you add…”) and aggregates
        them by frequency with example conversations attached — your roadmap, voted by users.
      </P>

      <H2>Instructions & auto-fix</H2>
      <P>
        An <strong>instruction</strong> is a versioned prompt artifact your workspace owns
        (v1 written by you). Remediation runs propose v2+ patches against it, gated by eval cases
        generated from your real failing conversations: accuracy must improve with{" "}
        <strong>zero regressions</strong>, or no PR opens.
      </P>

      <H2>Specialist models</H2>
      <P>
        With enough labeled traffic you can distill a small local model (TF-IDF + logistic
        regression today; SFT export to object storage for LLM fine-tunes). The Models page shows
        it against the frontier reference: it wins when accuracy matches-or-beats at lower latency
        and cost.
      </P>

      <H2>Retention & quotas</H2>
      <P>
        Raw events live per your plan (Free 7d → Enterprise 365d), enforced nightly. Ingestion
        quotas are enforced at the edge: over-quota workspaces get HTTP 402 until upgraded.
        Reads and dashboards are never blocked.
      </P>

      <PrevNext
        prev={{ href: "/docs/instrumentation", label: "Instrument your agent" }}
        next={{ href: "/docs/dashboard-tour", label: "Dashboard tour" }}
      />
    </div>
  );
}
