/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        ghost: "rgb(var(--ghost) / <alpha-value>)",
        ink: "rgb(var(--text) / <alpha-value>)",
        /** Tinta fija (no cambia con el tema): texto sobre los 8 colores de hábito, todos suficientemente claros para que el blanco no pase AA. */
        habitink: "#0d0e13",
        muted: "rgb(var(--text-secondary) / <alpha-value>)",
        faint: "rgb(var(--text-faint) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "20px",
        block: "14px",
        pill: "10px",
      },
      boxShadow: {
        elevated: "0 8px 24px rgb(0 0 0 / 0.22)",
        "elevated-sm": "0 6px 16px rgb(0 0 0 / 0.18)",
      },
    },
  },
  plugins: [],
};
