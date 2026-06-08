import type { Config } from "tailwindcss";

/**
 * Tailwind is wired to the CSS-variable design-token layer defined in
 * src/app/globals.css. Tokens encode the Polaris-inspired palette, radii,
 * borders, and spacing scale (Requirements 14.3, 16.5).
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces and structure
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-subdued": "rgb(var(--color-surface-subdued) / <alpha-value>)",
        "surface-hovered": "rgb(var(--color-surface-hovered) / <alpha-value>)",
        "surface-selected": "rgb(var(--color-surface-selected) / <alpha-value>)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        "border-subdued": "rgb(var(--color-border-subdued) / <alpha-value>)",
        // Text
        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-subdued": "rgb(var(--color-text-subdued) / <alpha-value>)",
        "text-on-primary": "rgb(var(--color-text-on-primary) / <alpha-value>)",
        // Brand / interactive
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-hovered": "rgb(var(--color-primary-hovered) / <alpha-value>)",
        focus: "rgb(var(--color-focus) / <alpha-value>)",
        // Status palette (status presentation map: design.md R14.4)
        "status-grey": "rgb(var(--color-status-grey) / <alpha-value>)",
        "status-blue": "rgb(var(--color-status-blue) / <alpha-value>)",
        "status-indigo": "rgb(var(--color-status-indigo) / <alpha-value>)",
        "status-amber": "rgb(var(--color-status-amber) / <alpha-value>)",
        "status-green": "rgb(var(--color-status-green) / <alpha-value>)",
        "status-teal": "rgb(var(--color-status-teal) / <alpha-value>)",
        "status-red": "rgb(var(--color-status-red) / <alpha-value>)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-base)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      borderColor: {
        DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
      },
      spacing: {
        "token-1": "var(--space-1)",
        "token-2": "var(--space-2)",
        "token-3": "var(--space-3)",
        "token-4": "var(--space-4)",
        "token-5": "var(--space-5)",
        "token-6": "var(--space-6)",
        "token-8": "var(--space-8)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        "card-hovered": "var(--shadow-card-hovered)",
        overlay: "var(--shadow-overlay)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
