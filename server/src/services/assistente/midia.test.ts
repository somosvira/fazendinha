import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transcrever: vi.fn(), env: { OPENAI_API_KEY: "unit-key", OPENAI_TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe" } }));
vi.mock("../../env.js", () => ({ env: mocks.env }));
vi.mock("openai", async importar => ({ ...await importar<typeof import("openai")>(), default: class { audio = { transcriptions: { create: mocks.transcrever } }; } }));
import { validarAudio, validarImagem, transcreverAudio } from "./midia.js";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XTKsAAAAASUVORK5CYII=";
function wav(segundos = 1) {
  const b = Buffer.alloc(44 + 32000 * segundos);
  b.write("RIFF"); b.writeUInt32LE(b.length - 8, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(16000, 24); b.writeUInt32LE(32000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(b.length - 44, 40); return b;
}
beforeEach(() => { vi.clearAllMocks(); mocks.env.OPENAI_API_KEY = "unit-key"; });
it("confere bytes, duração real e tamanho do WAV, sem confiar em metadados do cliente", () => {
  expect(validarAudio(wav(1))).toBe(1); expect(validarAudio(wav(60))).toBe(60);
  expect(() => validarAudio(wav(61))).toThrow("60 segundos");
  const corrompido = wav(); corrompido.writeUInt32LE(999, 40);
  expect(() => validarAudio(corrompido)).toThrow("Áudio inválido");
  expect(() => validarAudio(Buffer.from("not audio"))).toThrow();
});
it("transcreve com o modelo econômico e usa nome neutro sem gravar arquivo", async () => {
  mocks.transcrever.mockResolvedValue({ text: "Como registro uma compra a prazo?" });
  expect(await transcreverAudio(wav())).toBe("Como registro uma compra a prazo?");
  const args = mocks.transcrever.mock.calls[0][0];
  expect(args).toMatchObject({ model: "gpt-4o-mini-transcribe", language: "pt", response_format: "json" });
  expect(args.file.name).toBe("pergunta.wav");
});
it("arquivo inválido e ausência de chave não chamam o provedor", async () => {
  await expect(transcreverAudio(Buffer.from("invalid"))).rejects.toThrow();
  mocks.env.OPENAI_API_KEY = "";
  await expect(transcreverAudio(wav())).rejects.toMatchObject({ code: "NAO_CONFIGURADO" });
  expect(mocks.transcrever).not.toHaveBeenCalled();
});
it("não inventa transcrição nem expõe erro cru do provedor", async () => {
  mocks.transcrever.mockResolvedValueOnce({ text: " " });
  await expect(transcreverAudio(wav())).rejects.toMatchObject({ code: "VALIDACAO" });
  mocks.transcrever.mockRejectedValueOnce(new Error("SECRET-PROVIDER-DETAIL"));
  await expect(transcreverAudio(wav())).rejects.toThrow("Não foi possível transcrever");
  expect(mocks.transcrever).toHaveBeenCalledTimes(2);
});
it("valida assinatura/dimensões e recusa URLs, SVG, MIME falso ou dimensões excessivas", () => {
  expect(validarImagem(PNG)).toBe(PNG);
  for (const imagem of ["https://example.test/private.jpg", "data:image/svg+xml;base64,PHN2Zz4=", PNG.replace("png", "jpeg"), "data:image/png;base64,dGVzdA=="]) expect(() => validarImagem(imagem)).toThrow();
  const grande = Buffer.from(PNG.split(",")[1], "base64"); grande.writeUInt32BE(1601, 16);
  expect(() => validarImagem(`data:image/png;base64,${grande.toString("base64")}`)).toThrow("1600");
});
