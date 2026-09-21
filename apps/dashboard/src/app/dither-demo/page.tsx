import type { Metadata } from "next";
import { DitherWave } from "@/components/dither-wave";

export const metadata: Metadata = {
  title: "DitherWave demo",
};

/*
 * DitherWave demo — renders the shader at full viewport size, no text.
 *
 * Usage:
 *   import { DitherWave } from "@/components/dither-wave";
 *
 *   // Full-bleed hero background (defaults: orange #FF6A00 on #0B0F1A):
 *   <div className="relative h-[100dvh]">
 *     <DitherWave />
 *     <div className="absolute inset-0 flex items-center justify-center">
 *       ...foreground content...
 *     </div>
 *   </div>
 *
 *   // Customized, frozen:
 *   <DitherWave
 *     colorFront="#7c3aed"
 *     colorBack="#0b0f1a"
 *     pixelSize={8}
 *     waveAmplitude={0.2}
 *     speed={0.1}
 *     paused
 *   />
 */
export default function DitherWaveDemoPage() {
  return (
    <main className="h-dvh w-full">
      <DitherWave />
    </main>
  );
}
