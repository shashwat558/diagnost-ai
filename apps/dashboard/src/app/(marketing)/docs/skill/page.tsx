import { H1, Lead, H2, P, Code, Inline, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Agent skill — Diagnost AI Docs" };

export default function SkillPage() {
  return (
    <div>
      <H1>Agent skill: auto-instrument any codebase</H1>
      <Lead>
        The <Inline>agent-analytics</Inline> skill teaches an AI coding agent to instrument a target
        codebase with Diagnost in one shot.
      </Lead>

      <H2>Install</H2>
      <Code>{`npx skills add shashwat558/diagnost-ai --skill agent-analytics`}</Code>

      <H2>What the agent does</H2>
      <P>
        <strong>1. Installs the SDK</strong> (<Inline>@diagnost/sdk-ts</Inline> + OTel) →{" "}
        <strong>2. Wires the exporter</strong> at the app entrypoint (existing LangChain / Vercel AI
        SDK / LlamaIndex / MCP instrumentations only need the exporter swap) →{" "}
        <strong>3. Adds checkpoints</strong> at the 3–5 most important decision points with a shared{" "}
        <Inline>conversationId</Inline> per user session → <strong>4. Configures env</strong> (
        <Inline>DIAGNOST_ENDPOINT</Inline> / <Inline>DIAGNOST_API_KEY</Inline>, zero-PII mode for
        strict deployments) → <strong>5. Verifies</strong> with one test request and confirms it in
        Conversations.
      </P>
      <P>
        It reports back: which entrypoint was instrumented, which checkpoints were added, and how to
        open the dashboard. Full instruction set: <Inline>skills/agent-analytics/SKILL.md</Inline> in
        the repo.
      </P>

      <PrevNext prev={{ href: "/docs/api-reference", label: "API reference" }} />
    </div>
  );
}
