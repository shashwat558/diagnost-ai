import { H1, Lead, H2, P, Code, Inline, DocTable, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Plans & billing — Diagnost AI Docs" };

export default function BillingPage() {
  return (
    <div>
      <H1>Plans & billing</H1>
      <Lead>Usage-based tiers. Pay for events, self-host any tier, cancel anytime.</Lead>

      <H2>Tiers</H2>
      <DocTable
        head={["Plan", "Price", "Events/mo", "Retention", "Seats"]}
        rows={[
          ["Free", "$0", "50k", "7 days", "3"],
          ["Starter", "$49", "250k", "30 days", "10"],
          ["Pro", "$299", "2M", "90 days", "50"],
          ["Enterprise", "Custom", "Unlimited", "365 days", "Unlimited"],
        ]}
      />

      <H2>Quotas</H2>
      <P>
        Usage is metered per workspace (monthly ingested events, visible as the meter in Settings).
        Quotas are enforced at the ingestion edge: over-quota workspaces receive{" "}
        <strong>HTTP 402</strong> until upgraded. Reads, dashboards and exports are never blocked.
        Every quota hit and plan change lands in the audit log.
      </P>

      <H2>Upgrading (DodoPayments)</H2>
      <P>
        Click <strong>Upgrade</strong> on any tier in Settings (owner/admin only). Without payment
        keys configured you stay in dev-mode: the plan flips immediately so quotas and retention
        can be tested for free. With keys, you go through Dodo hosted checkout and a webhook flips
        the plan on <Inline>payment.succeeded</Inline>; cancellations drop you back to Free.
        Manage or cancel anytime via <strong>Manage billing</strong> (customer portal).
      </P>

      <H2>Going live with payments</H2>
      <P>Create recurring Starter/Pro products in Dodo, then set:</P>
      <Code>{`DODO_PAYMENTS_API_KEY=dodo_live_...
DODO_PAYMENTS_WEBHOOK_KEY=whsec_...
DODO_PAYMENTS_ENVIRONMENT=live_mode
DODO_PAYMENTS_PRODUCT_STARTER=pdt_...
DODO_PAYMENTS_PRODUCT_PRO=pdt_...
DODO_PAYMENTS_RETURN_URL=https://your-domain.com/settings?checkout=success`}</Code>
      <P>
        Webhook URL in the Dodo dashboard:{" "}
        <Inline>https://your-domain.com/api/billing/webhook</Inline>. Dodo supports cards plus
        local methods (UPI, Pix, SEPA, …).
      </P>

      <PrevNext
        prev={{ href: "/docs/alerts", label: "Alerts & notifications" }}
        next={{ href: "/docs/self-host", label: "Self-hosting" }}
      />
    </div>
  );
}
