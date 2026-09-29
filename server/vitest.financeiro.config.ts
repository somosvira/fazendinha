import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@rionovo/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url)) },
  },
  test: {
    environment: "node", include: ["tests/financeiro/**/*.test.ts"],
    fileParallelism: false, testTimeout: 15000, hookTimeout: 30000,
    setupFiles: ["src/test.setup.ts"],
  },
});
