/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Theme tokens — flip automatically via the .dark class on <html>.
        // Defined as RGB triplets so opacity modifiers (bg-brand/20) work.
        canvas: "rgb(var(--canvas-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        "ink-muted": "rgb(var(--ink-muted-rgb) / <alpha-value>)",
        "ink-subtle": "rgb(var(--ink-subtle-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong-rgb) / <alpha-value>)",
        "control-line": "rgb(var(--control-line-rgb) / <alpha-value>)",
        hover: "rgb(var(--hover-rgb) / <alpha-value>)",
        brand: "rgb(var(--brand-rgb) / <alpha-value>)",
        "brand-soft": "rgb(var(--brand-soft-rgb) / <alpha-value>)",
        accent: {
          DEFAULT: "#ea580c",
          soft: "#ffedd5",
        },
      },
      fontSize: {
        "2xs": ["11px", "14px"],
      },
      fontFamily: {
        display: ["Karrik", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
