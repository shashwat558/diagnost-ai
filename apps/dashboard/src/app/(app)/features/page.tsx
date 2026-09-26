import Link from "next/link";
import { pgQuery } from "@/lib/pg";

export const dynamic = "force-dynamic";

interface FeatureRow {
  id: string;
  slug: string;
  description: string;
  frequency: number;
  example_conversation_ids: string[];
  last_seen_at: string | null;
}

export default async function FeaturesPage() {
  const features = await pgQuery<FeatureRow>(
    `SELECT id, slug, description, frequency,
            example_conversation_ids, last_seen_at
     FROM feature_requests WHERE workspace_id='ws_dev'
     ORDER BY frequency DESC LIMIT 50`
  );
  const maxFreq = Math.max(1, ...features.map((f) => Number(f.frequency)));

  return (
    <div className="px-6 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold text-ink">
          {features.length} feature requests
        </h1>
        <span className="text-sm text-ink-subtle">unmet asks, aggregated by frequency</span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-sm text-ink-muted">
            <th className="border-b border-line py-2 pr-4 font-normal">Request</th>
            <th className="w-48 border-b border-line py-2 pr-4 font-normal">Frequency</th>
            <th className="border-b border-line py-2 pr-4 font-normal">Examples</th>
            <th className="border-b border-line py-2 font-normal">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.id} className="hover:bg-hover">
              <td className="border-b border-line py-2.5 pr-4">
                <span className="font-medium text-ink">{f.slug.replace(/_/g, " ")}</span>
                <span className="mt-0.5 block max-w-xl truncate text-sm text-ink-muted">
                  {f.description}
                </span>
              </td>
              <td className="border-b border-line py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(Number(f.frequency) / maxFreq) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-ink">×{Number(f.frequency)}</span>
                </div>
              </td>
              <td className="border-b border-line py-2.5 pr-4">
                <div className="flex flex-wrap gap-1">
                  {(f.example_conversation_ids ?? []).slice(0, 3).map((cid) => (
                    <Link
                      key={cid}
                      href={`/traces/${encodeURIComponent(cid)}`}
                      className="rounded border border-line px-1.5 py-0.5 font-mono text-xs text-ink-muted hover:border-line-strong hover:text-ink"
                    >
                      {cid.slice(-8)}
                    </Link>
                  ))}
                  {(f.example_conversation_ids?.length ?? 0) > 3 && (
                    <span className="text-xs text-ink-subtle">
                      +{(f.example_conversation_ids?.length ?? 0) - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-line py-2.5 text-ink-muted">
                {f.last_seen_at ? String(f.last_seen_at).slice(0, 10) : "—"}
              </td>
            </tr>
          ))}
          {features.length === 0 && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-ink-subtle">
                No feature requests extracted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
