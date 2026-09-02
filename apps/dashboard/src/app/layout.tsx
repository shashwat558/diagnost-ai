import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diagnost AI",
  description: "Production analytics & self-improvement for AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
