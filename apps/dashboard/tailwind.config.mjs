/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        panel: "#111832",
        edge: "#1f2a4d",
        accent: "#5eead4",
      },
    },
  },
  plugins: [],
};
