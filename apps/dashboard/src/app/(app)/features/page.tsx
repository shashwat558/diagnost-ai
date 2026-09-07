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
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {features.length} feature requests
        </h1>
        <span className="text-sm text-gray-400 dark:text-gray-500">unmet asks, aggregated by frequency</span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
            <th className="border-b border-gray-200 dark:border-gray-800 py-2 pr-4 font-normal">Request</th>
            <th className="w-48 border-b border-gray-200 dark:border-gray-800 py-2 pr-4 font-normal">Frequency</th>
            <th className="border-b border-gray-200 dark:border-gray-800 py-2 pr-4 font-normal">Examples</th>
            <th className="border-b border-gray-200 dark:border-gray-800 py-2 font-normal">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {features.map((f) => (
            <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td className="border-b border-gray-100 dark:border-gray-800 py-2.5 pr-4">
                <span className="font-medium text-gray-900 dark:text-gray-100">{f.slug.replace(/_/g, " ")}</span>
                <span className="mt-0.5 block max-w-xl truncate text-sm text-gray-500 dark:text-gray-400">
                  {f.description}
                </span>
              </td>
              <td className="border-b border-gray-100 dark:border-gray-800 py-2.5 pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(Number(f.frequency) / maxFreq) * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-gray-700 dark:text-gray-300">×{Number(f.frequency)}</span>
                </div>
              </td>
              <td className="border-b border-gray-100 dark:border-gray-800 py-2.5 pr-4">
                <div className="flex flex-wrap gap-1">
                  {(f.example_conversation_ids ?? []).slice(0, 3).map((cid) => (
                    <Link
                      key={cid}
                      href={`/traces/${encodeURIComponent(cid)}`}
                      className="rounded border border-gray-200 dark:border-gray-800 px-1.5 py-0.5 font-mono text-xs text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:text-gray-900"
                    >
                      {cid.slice(-8)}
                    </Link>
                  ))}
                  {(f.example_conversation_ids?.length ?? 0) > 3 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      +{(f.example_conversation_ids?.length ?? 0) - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="border-b border-gray-100 dark:border-gray-800 py-2.5 text-gray-500 dark:text-gray-400">
                {f.last_seen_at ? String(f.last_seen_at).slice(0, 10) : "—"}
              </td>
            </tr>
          ))}
          {features.length === 0 && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-gray-400 dark:text-gray-500">
                No feature requests extracted yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
