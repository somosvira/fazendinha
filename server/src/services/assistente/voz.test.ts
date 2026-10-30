import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ falar: vi.fn(), criar: vi.fn(), env: { OPENAI_API_KEY: "unit-key", OPENAI_SPEECH_MODEL: "gpt-4o-mini-tts" } }));
vi.mock("../../env.js", () => ({ env: mocks.env }));
vi.mock("openai", () => ({ default: class { constructor(opcoes: unknown) { mocks.criar(opcoes); } audio = { speech: { create: mocks.falar } }; } }));
import { sintetizarResposta } from "./voz.js";
beforeEach(() => { vi.clearAllMocks(); mocks.env.OPENAI_API_KEY = "unit-key"; });
it("gera MP3 sem retry e com instrução de leitura fiel em português", async () => {
  mocks.falar.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  expect(await sintetizarResposta("Resposta autorizada")).toBe("data:audio/mpeg;base64,AQID");
  expect(mocks.criar).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0, timeout: 20_000 }));
  expect(mocks.falar).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-4o-mini-tts", input: "Resposta autorizada", response_format: "mp3" }), { signal: expect.any(AbortSignal) });
});
it("não chama o provedor sem chave ou com texto acima do limite", async () => {
  await expect(sintetizarResposta("x".repeat(4001))).rejects.toThrow();
  mocks.env.OPENAI_API_KEY = "";
  await expect(sintetizarResposta("Resposta")).rejects.toThrow();
  expect(mocks.falar).not.toHaveBeenCalled();
});
it("recusa áudio vazio e oculta detalhes do provedor", async () => {
  mocks.falar.mockResolvedValueOnce(new Response(new Uint8Array()));
  await expect(sintetizarResposta("Resposta")).rejects.toThrow();
  mocks.falar.mockRejectedValueOnce(new Error("PRIVATE"));
  await expect(sintetizarResposta("Resposta")).rejects.toThrow("Não foi possível gerar a voz");
});
it("limita também o tempo de leitura após os headers", async () => {
  vi.useFakeTimers();
  try {
    mocks.falar.mockResolvedValue(new Response(new ReadableStream({ start() {} })));
    const resultado = sintetizarResposta("Resposta");
    const rejeicao = expect(resultado).rejects.toThrow("Não foi possível gerar a voz");
    await vi.advanceTimersByTimeAsync(20_001);
    await rejeicao;
  } finally { vi.useRealTimers(); }
});
