import { afterEach, expect, it, vi } from "vitest";
import { exigirBancoIntegracaoPecuaria } from "./banco-pecuaria-integration.fixture.js";
afterEach(() => vi.unstubAllEnvs());
it("recusa qualquer banco local diferente do seedatev3 mesmo com CI genérico", () => {
  vi.stubEnv("CI", "true"); vi.stubEnv("GITHUB_ACTIONS", "false");
  for (const banco of ["fazendinha_test", "postgres", "outro"]) {
    vi.stubEnv("DATABASE_URL", `postgresql://teste:teste@localhost:55432/${banco}`);
    expect(exigirBancoIntegracaoPecuaria).toThrow();
  }
  vi.stubEnv("DATABASE_URL", "postgresql://teste:teste@localhost:55432/fazendinha_seedatev3");
  expect(exigirBancoIntegracaoPecuaria()).toBe("fazendinha_seedatev3");
});
it("recusa host remoto inclusive quando o nome coincide", () => {
  vi.stubEnv("CI", "false"); vi.stubEnv("GITHUB_ACTIONS", "false");
  vi.stubEnv("DATABASE_URL", "postgresql://teste:teste@remoto.invalid/fazendinha_seedatev3");
  expect(exigirBancoIntegracaoPecuaria).toThrow();
});
it("permite o banco efêmero configurado exclusivamente no CI externo", () => {
  vi.stubEnv("CI", "true"); vi.stubEnv("GITHUB_ACTIONS", "true");
  vi.stubEnv("DATABASE_URL", "postgresql://ci:ci@localhost:5432/fazendinha_test");
  expect(exigirBancoIntegracaoPecuaria()).toBe("fazendinha_test");
});
