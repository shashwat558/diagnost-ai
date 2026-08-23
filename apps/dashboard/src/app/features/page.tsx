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
    `SELECT id, slug, description, frequency, example_conversation_ids, last_seen_at
     FROM feature_requests WHERE workspace_id='ws_dev'
     ORDER BY frequency DESC LIMIT 50`
  );
  const maxFreq = Math.max(1, ...features.map((f) => Number(f.frequency)));

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Feature requests</h1>
        <span className="text-xs text-slate-500">
          unmet asks aggregated by frequency · LLM/rule-based extraction
        </span>
      </header>

      <div className="space-y-2">
        {features.map((f, i) => (
          <div key={f.id} className="rounded-lg border border-edge bg-panel/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-8 shrink-0 text-center text-lg font-bold text-accent">
                #{i + 1}
              </span>
              <div className="min-w-[200px] flex-1">
                <div className="font-mono text-sm font-semibold text-slate-100">{f.slug}</div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-slate-400">{f.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-edge">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${(Number(f.frequency) / maxFreq) * 100}%` }}
                  />
                </div>
                <span className="w-14 text-right text-sm font-semibold text-slate-200">
                  ×{Number(f.frequency)}
                </span>
              </div>
            </div>
            {(f.example_conversation_ids ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-600">examples:</span>
                {(f.example_conversation_ids ?? []).slice(0, 5).map((cid) => (
                  <Link
                    key={cid}
                    href={`/traces/${encodeURIComponent(cid)}`}
                    className="rounded bg-edge/60 px-1.5 py-0.5 font-mono text-[10px] text-accent hover:bg-edge"
                  >
                    {cid}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
        {features.length === 0 && (
          <p className="rounded-lg border border-edge bg-panel/70 p-8 text-center text-sm text-slate-500">
            No feature requests extracted yet — run <code className="text-accent">run_features.py</code>.
          </p>
        )}
      </div>
    </div>
  );
}
