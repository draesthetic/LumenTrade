import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        panel: "hsl(var(--panel))",
        panel2: "hsl(var(--panel-2))",
        text: "hsl(var(--text))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        accent2: "hsl(var(--accent-2))",
        border: "hsl(var(--border))"
      },
      boxShadow: {
        glass: "0 20px 80px rgba(0, 0, 0, 0.35)",
        glow: "0 0 40px rgba(200, 230, 52, 0.25)"
      },
      borderRadius: {
        xl: "18px",
        "2xl": "24px",
        "3xl": "32px"
      }
    }
  },
  plugins: []
};

export default config;
