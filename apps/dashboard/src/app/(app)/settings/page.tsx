import { pgQuery } from "@/lib/pg";
import { Icon } from "@/components/icon";
import { requireAdmin } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { PortalButton } from "@/components/billing/portal-button";

export const dynamic = "force-dynamic";

interface WsRow {
  id: string;
  name: string;
  plan: string;
  created_at: string;
}
interface UsageRow {
  events: string;
  period: string;
}
interface UserRow {
  id: string;
  email: string | null;
  role: string;
}

const TIER_ORDER = ["free", "starter", "pro", "enterprise"] as const;
const TIER_INFO: Record<string, { price: string; events: string; retention: string }> = {
  free: { price: "$0", events: "50k events/mo", retention: "7-day retention" },
  starter: { price: "$49/mo", events: "250k events/mo", retention: "30-day retention" },
  pro: { price: "$299/mo", events: "2M events/mo", retention: "90-day retention" },
  enterprise: { price: "Custom", events: "Unlimited events", retention: "1-year retention" },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const user = await requireAdmin();
  const wsId = user.workspaceId;
  const [ws] = await pgQuery<WsRow>(
    "SELECT id, name, plan, created_at FROM workspaces WHERE id=$1",
    [wsId]
  );
  const usage = await pgQuery<UsageRow>(
    "SELECT events, period FROM usage_monthly WHERE workspace_id=$1 ORDER BY period DESC LIMIT 1",
    [wsId]
  );
  const users = await pgQuery<UserRow>(
    "SELECT id, email, role FROM users WHERE workspace_id=$1 ORDER BY role",
    [wsId]
  );

  const plan = ws?.plan ?? "free";
  const used = Number(usage?.[0]?.events ?? 0);
  const limits: Record<string, number> = { free: 50_000, starter: 250_000, pro: 2_000_000, enterprise: 5_000_000 };
  const limit = limits[plan] ?? 50_000;
  const pct = Math.min(100, (used / limit) * 100);

  return (
    <div className="px-6 pt-5">
      <h1 className="text-[15px] font-semibold text-gray-900">Settings</h1>
      {sp?.checkout === "success" && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
          Checkout completed — your plan will update shortly. If Stripe is configured, the webhook will flip the plan; in dev mode it’s already active.
        </div>
      )}
      {sp?.checkout === "cancel" && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          Checkout canceled.
        </div>
      )}

      {/* plan + usage */}
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-semibold text-gray-900">
              Billing — <span className="capitalize">{plan}</span> plan
            </h2>
            <p className="mt-0.5 text-[12px] text-gray-500">
              {TIER_INFO[plan]?.events} · {TIER_INFO[plan]?.retention}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{TIER_INFO[plan]?.price}</Badge>
            {plan !== "free" && <PortalButton />}
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-gray-500">
            <span>Events this period ({usage?.[0]?.period ?? "—"})</span>
            <span className="tabular-nums">
              {used.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${pct > 90 ? "bg-red-500" : "bg-accent"}`}
              style={{ width: `${Math.max(1, pct)}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {TIER_ORDER.map((t) => (
            <div
              key={t}
              className={`rounded-md border p-3 ${
                t === plan ? "border-accent/50 bg-accent-soft/50" : "border-gray-200"
              }`}
            >
              <div className="text-[13px] font-medium capitalize text-gray-900">{t}</div>
              <div className="mt-0.5 text-[12px] text-gray-500">{TIER_INFO[t].price}</div>
              <div className="text-[11px] text-gray-400">{TIER_INFO[t].events}</div>
              <UpgradeButton plan={t as "free" | "starter" | "pro" | "enterprise"} current={t === plan} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          Plan changes are owner/admin actions and are recorded in the audit log.
        </p>
      </Card>

      {/* api key */}
      <Card className="mt-4">
        <h2 className="text-[13px] font-semibold text-gray-900">API credentials</h2>
        <div className="mt-2 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-[12px] text-gray-600">
          <Icon name="database" className="h-3.5 w-3.5 text-gray-400" />
          dw_local_••••••••••••0000
          <span className="ml-auto text-[11px] text-gray-400">created {ws ? String(ws.created_at).slice(0, 10) : "—"}</span>
        </div>
      </Card>

      {/* roles */}
      <Card className="mt-4">
        <h2 className="text-[13px] font-semibold text-gray-900">Members & roles</h2>
        <table className="mt-2 w-full text-[13px]">
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 last:border-0">
                <td className="py-2 text-gray-800">{u.email ?? u.id}</td>
                <td className="py-2 text-right">
                  <Badge variant="secondary" className="capitalize">
                    {u.role}
                  </Badge>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="py-2 text-gray-400">No members yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-gray-400">
          Roles: owner &gt; admin &gt; member &gt; viewer. SSO via OIDC is available
          (<code className="font-mono">OIDC_ISSUER_URL</code> env) and maps IdP groups to roles.
        </p>
      </Card>
    </div>
  );
}
