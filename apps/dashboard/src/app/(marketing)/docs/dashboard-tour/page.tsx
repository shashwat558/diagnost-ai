import { H1, Lead, H2, P, Inline, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Dashboard tour — Diagnost AI Docs" };

const pages: Array<[string, string]> = [
  ["Home (/dashboard)", "24h stats (events, error rate, typical/slowest-5% reply time, conversations), 6h volume and latency charts, top tools, live-events ticker. Hover any ? for definitions."],
  ["Intents (/clusters)", "Failure clusters ranked by impact. Search, filter persists across visits, Export CSV downloads the table, + New instruction creates a versioned prompt for an intent."],
  ["Intent detail (/clusters/:id)", "Summary, failure/frustration/mood stats, common words, and up to 200 example conversations with Passed/Failed outcomes. Short IDs with copy buttons."],
  ["Conversations (/traces)", "Most recent 50 sessions: step count, outcome, PII-redacted count, last seen."],
  ["Conversation detail (/traces/:id)", "Step-by-step timeline with a red “What happened” box on failures, per-step timing and token use, privacy badges, collapsible raw details."],
  ["Feature requests (/features)", "User asks aggregated by frequency with example conversations. Your evidence-backed roadmap."],
  ["Models (/models)", "Your specialist vs the frontier reference on fresh test data: correct-answer rate, slowest-5% latency, cost per 1k answers."],
  ["Audit (/audit, admin)", "Who did what: plan changes, quota hits, new instructions — plain sentences with collapsible technical details."],
  ["Settings (/settings, admin)", "Plan + usage meter, tier upgrades (Dodo checkout), API credentials, alert notification channels, members & roles."],
];

export default function DashboardTourPage() {
  return (
    <div>
      <H1>Dashboard tour</H1>
      <Lead>Every page, what it answers, and where to click next. Words are consistent everywhere: Intents, Conversations, failed/passed.</Lead>

      {pages.map(([title, body]) => (
        <div key={title}>
          <H2>{title}</H2>
          <P>{body}</P>
        </div>
      ))}

      <H2>Tips</H2>
      <P>
        Hover any <Inline>?</Inline> for a definition. Short IDs (…last 12 chars) always carry the
        full value in a tooltip plus a copy button. Charts show exact values on hover. Dark mode
        lives in the sidebar — your choice persists.
      </P>

      <PrevNext
        prev={{ href: "/docs/concepts", label: "Core concepts" }}
        next={{ href: "/docs/alerts", label: "Alerts & notifications" }}
      />
    </div>
  );
}
