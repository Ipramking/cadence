import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        surface2: "var(--surface-2)",
        border: "var(--border)",
        ink: "var(--foreground)",
        foreground: "var(--foreground)",
        muted: "var(--muted)",
        primary: "var(--primary)",
        primary2: "var(--primary-2)",
        "primary-soft": "var(--primary-soft)",
        success: "var(--success)",
        warn: "var(--warn)",
        danger: "var(--danger)",
        // legacy aliases (kept until every page is migrated)
        accent: "var(--primary)",
        "accent-soft": "var(--primary-soft)",
        dollar: "var(--primary)",
        naira: "var(--primary)",
        gold: "var(--primary)",
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
