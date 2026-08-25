/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "#7c3aed",
          soft: "#f3eefe",
        },
      },
      fontSize: {
        "2xs": ["11px", "14px"],
      },
    },
  },
  plugins: [],
};
