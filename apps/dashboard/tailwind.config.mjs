/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
