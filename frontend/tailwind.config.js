/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--color-void)",
        deep: "var(--color-deep)",
        surface: "var(--color-surface)",
        edge: "var(--color-edge)",
        parchment: "var(--color-parchment)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        ember: {
          DEFAULT: "var(--color-ember)",
          glow: "var(--color-ember-glow)",
          100: "#fef3c7",
        },
        indigo: {
          DEFAULT: "var(--color-indigo)",
          500: "#4F46E5", // Keep for backward compat
        },
        success: "var(--color-success)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        serif: ["DM Serif Display", "serif"],
      },
    },
  },
  plugins: [],
};
