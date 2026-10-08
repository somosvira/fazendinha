import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/seedatev3/**/*.test.ts"],
    setupFiles: ["src/test.setup.ts"],
  },
});
