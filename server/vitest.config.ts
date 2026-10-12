import { defineConfig } from "vitest/config";

const integracaoComBanco = ["AUTH_DB_INTEGRATION", "FINANCE_DB_INTEGRATION", "PECUARIA_DB_INTEGRATION"]
  .some((flag) => process.env[flag] === "1");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/seedatev3/**/*.test.ts"],
    setupFiles: ["src/test.setup.ts"],
    // Suítes compartilham o banco; sua sobreposição provoca conflitos Serializable
    // entre cenários independentes. A concorrência explícita dentro dos casos permanece.
    fileParallelism: !integracaoComBanco,
  },
});
