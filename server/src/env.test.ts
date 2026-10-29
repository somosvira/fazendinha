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

it("mantém o modelo econômico como padrão e recusa modelo vazio", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://ci:ci@localhost:5432/ci");
  const { envSchema } = await import("./env.js");
  const base = { DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "test", R2_SECRET_ACCESS_KEY: "test", R2_BUCKET_NOTAS: "test", STORAGE_NAMESPACE: "test" };
  expect(envSchema.parse(base).OPENAI_MODEL).toBe("gpt-5-nano");
  expect(envSchema.safeParse({ ...base, OPENAI_MODEL: " " }).success).toBe(false);
  expect(envSchema.parse(base).OPENAI_SPEECH_MODEL).toBe("gpt-4o-mini-tts");
  expect(envSchema.safeParse({ ...base, OPENAI_SPEECH_MODEL: "tts-1-hd" }).success).toBe(false);
});
