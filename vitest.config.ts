import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest configuration for the Client Sign-Off Dashboard.
 *
 * - Runs once (no watch mode); the `test` npm script uses `vitest run`.
 * - Domain property/unit tests run fully in-memory with the Node environment.
 * - Component tests (.tsx) use jsdom via per-file `@vitest-environment jsdom` comments.
 * - Resolves the `@/*` path alias to mirror tsconfig.json.
 * - Loads a shared setup file that exposes in-memory repository fake helpers.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test/setup.ts", "./src/test/setup-dom.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // fast-check property tests run >= 100 iterations; allow generous per-test time.
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
