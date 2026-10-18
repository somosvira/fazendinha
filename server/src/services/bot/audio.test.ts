import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("./openai.js", () => ({ criarClienteOpenAI: () => ({ audio: { transcriptions: { create: m.create } } }) }));
import { transcreverAudio, validarAudio } from "./audio.js";
beforeEach(() => { vi.clearAllMocks(); m.create.mockResolvedValue({ text: " Quanto gastamos? " }); });
it("envia áudio em português e retorna texto para revisão", async () => {
  const file = new File(["som"], "pergunta.webm", { type: "audio/webm;codecs=opus" });
  expect(await transcreverAudio(file)).toBe("Quanto gastamos?");
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ file, language: "pt", response_format: "json" }));
});
it("não envia arquivo vazio, formato estranho ou maior que o limite", () => {
  expect(() => validarAudio(new File([], "vazio.mp3", { type: "audio/mpeg" }))).toThrow();
  expect(() => validarAudio(new File(["x"], "arquivo.txt", { type: "text/plain" }))).toThrow();
  expect(() => validarAudio(new File([new Uint8Array(10 * 1024 * 1024 + 1)], "longo.mp3", { type: "audio/mpeg" }))).toThrow();
  expect(m.create).not.toHaveBeenCalled();
});
it("silêncio não vira uma pergunta fictícia", async () => {
  m.create.mockResolvedValue({ text: " " });
  await expect(transcreverAudio(new File(["x"], "som.mp3", { type: "audio/mpeg" }))).rejects.toThrow("Não consegui ouvir");
});
