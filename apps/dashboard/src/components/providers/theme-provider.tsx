"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      // Suppress CSS transitions while the class flips, otherwise every
      // themed element animates its colour and the switch looks like a smear.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
