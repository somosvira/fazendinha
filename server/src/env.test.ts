import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("APP_BASE_URL", () => {
  it.each([
    ["terrano.app", "https://terrano.app"],
    ["https://terrano.app/", "https://terrano.app"],
    ["http://localhost:41875", "http://localhost:41875"],
  ])("normaliza %s para %s", async (entrada, esperado) => {
    vi.stubEnv("DATABASE_URL", "postgresql://ci:ci@localhost:5432/ci");
    vi.stubEnv("APP_BASE_URL", entrada);

    const { env } = await import("./env.js");
    expect(env.APP_BASE_URL).toBe(esperado);
  });
});
