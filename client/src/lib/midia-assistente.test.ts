import { expect, it } from "vitest";
import { codificarWav } from "./midia-assistente";
it("gera PCM mono/16-bit/16kHz com duração real e amostras limitadas", async () => {
  const blob = codificarWav([new Float32Array(48000).fill(0.5), new Float32Array(48000).fill(-0.5)], 48000);
  const view = new DataView(await blob.arrayBuffer());
  expect(blob.size).toBe(32044); expect(blob.type).toBe("audio/wav");
  expect(view.getUint32(24, true)).toBe(16000); expect(view.getUint16(22, true)).toBe(1); expect(view.getInt16(44, true)).toBe(0);
});
it("não cobra áudio além do limite, nem corta upload silenciosamente", () => {
  const longo = new Float32Array(16000 * 61);
  expect(() => codificarWav([longo], 16000)).toThrow("60 segundos");
  expect(codificarWav([longo], 16000, true).size).toBe(1920044);
});
