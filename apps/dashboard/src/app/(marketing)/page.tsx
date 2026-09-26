import {
  DiagonalArrow,
  HeroBackdrop,
  SquareCta,
} from "@/components/landing-bits";
import { Reveal } from "@/components/reveal";
import FireflyBackground from "@/components/FireflyBackground";
import { Inter } from "next/font/google";

import { LiveEvidenceSection } from "@/components/landing/LiveEvidenceSection";
import { AccountabilityBento } from "@/components/landing/AccountabilityBento";
import { PipelineFlowSection } from "@/components/landing/PipelineFlowSection";
import { IntegrationSection } from "@/components/landing/IntegrationSection";
import { MetricsSection } from "@/components/landing/MetricsSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { BottomCtaSection } from "@/components/landing/BottomCtaSection";
import { FooterSection } from "@/components/landing/FooterSection";

const font = Inter({
  weight: "400",
  subsets: ["latin"],
});

export default function LandingPage() {
  return (
    <div className="bg-canvas text-ink relative overflow-hidden">
      {/* Background ambient fireflies */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
        <FireflyBackground />
      </div>

      {/* ================= HERO · 100svh (UNTOUCHED PERFECT HERO) ================= */}
      <section className="relative flex h-[100svh] min-h-[640px] flex-col justify-end overflow-hidden">
        <HeroBackdrop src="/hero-image.png" alt="" />

        <div className={`${font.className} relative z-10 mx-auto w-full max-w-7xl px-6 pb-16 md:pb-20`}>
          <Reveal>
            <h1 className="headline-fluid mt-4 max-w-[752px] font-display font-medium tracking-[-0.03em] text-ink">
              Agent work, held to account.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-6 text-[#e7e7e7]">
              Capture every agent conversation, surface the failures that matter, and ship verified
            </p>
            <div className="mt-7">
              <SquareCta href="/signup" className="!px-4 !py-2 !text-xl">
                Book a demo
                <DiagonalArrow className="h-3 w-3" />
              </SquareCta>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="relative z-10 space-y-24 py-16 md:py-28">
        {/* ================= LIVE EVIDENCE SECTION ================= */}
        <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-6">
          <Reveal>
            <LiveEvidenceSection />
          </Reveal>
        </section>

        {/* ================= ACCOUNTABILITY BENTO GRID ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <AccountabilityBento />
          </Reveal>
        </section>

        {/* ================= PIPELINE ARCHITECTURE ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <PipelineFlowSection />
          </Reveal>
        </section>

        {/* ================= DEVELOPER EXPERIENCE / SDK ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <IntegrationSection />
          </Reveal>
        </section>

        {/* ================= METRICS & TELEMETRY ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <MetricsSection />
        </section>

        {/* ================= PRICING ================= */}
        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6">
          <Reveal>
            <PricingSection />
          </Reveal>
        </section>

        {/* ================= FAQ SECTION ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <FaqSection />
          </Reveal>
        </section>

        {/* ================= BOTTOM CTA ================= */}
        <section className="mx-auto max-w-6xl px-6">
          <Reveal>
            <BottomCtaSection />
          </Reveal>
        </section>
      </div>

      {/* ================= FOOTER ================= */}
      <FooterSection />
    </div>
  );
}
