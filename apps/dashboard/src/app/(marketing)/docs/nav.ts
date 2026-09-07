export const DOC_NAV: Array<{ section: string; links: Array<{ href: string; label: string }> }> = [
  {
    section: "Getting started",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/quickstart", label: "Quickstart" },
      { href: "/docs/instrumentation", label: "Instrument your agent" },
    ],
  },
  {
    section: "Product",
    links: [
      { href: "/docs/concepts", label: "Core concepts" },
      { href: "/docs/dashboard-tour", label: "Dashboard tour" },
      { href: "/docs/alerts", label: "Alerts & notifications" },
      { href: "/docs/billing", label: "Plans & billing" },
    ],
  },
  {
    section: "Deploy & extend",
    links: [
      { href: "/docs/self-host", label: "Self-hosting" },
      { href: "/docs/api-reference", label: "API reference" },
      { href: "/docs/skill", label: "Agent skill" },
    ],
  },
];
