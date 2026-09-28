import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Runs mobile/src/lib/*.test.ts with vitest. Lives at mobile/vitest.config.ts
 * and is executed with the backend's vitest install because the mobile
 * package has no test runner of its own:
 *   npx --prefix ../backend vitest run
 * (or `npm test -w mobile` once a workspace root owns these runner deps).
 * `@/` aliases to mobile/src like the app's tsconfig does.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
