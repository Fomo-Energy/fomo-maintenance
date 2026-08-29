import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        peach: "#fff6f2",
        brand: {
          DEFAULT: "#fc7e40",
          dark: "#e65e1e",
          glow: "#ff9f43",
        },
        ink: "#0f172a",
      },
      fontFamily: {
        sans: ["var(--font-jost)", "Jost", "system-ui", "sans-serif"],
      },
      boxShadow: {
        brand: "0 15px 30px -5px rgba(252, 126, 64, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
