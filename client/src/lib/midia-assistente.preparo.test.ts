// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { prepararAudio, prepararPrint } from "./midia-assistente";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const arquivo = (type: string, size = 10) => ({ type, size } as File);
function imagemFixture(largura = 2000, altura = 1000, corrompida = false) {
  const revogar = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:fixture"), revokeObjectURL: revogar });
  vi.stubGlobal("Image", class {
    naturalWidth = largura; naturalHeight = altura;
    onload?: () => void; onerror?: () => void;
    set src(_valor: string) { queueMicrotask(() => corrompida ? this.onerror?.() : this.onload?.()); }
  });
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ fillStyle: "", fillRect: vi.fn(), drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,fixture");
  return { revogar, drawImage };
}
it("recusa tipo/tamanho de print antes de decodificar ou criar URL", async () => {
  const criar = vi.fn(); vi.stubGlobal("URL", { createObjectURL: criar });
  await expect(prepararPrint(arquivo("image/svg+xml"))).rejects.toThrow("PNG, JPG ou WebP");
  await expect(prepararPrint(arquivo("image/png", 8 * 1024 * 1024 + 1))).rejects.toThrow("8 MB");
  expect(criar).not.toHaveBeenCalled();
});
it("reencoda print para JPEG reduzido e libera URL local", async () => {
  const { revogar, drawImage } = imagemFixture();
  expect(await prepararPrint(arquivo("image/png"))).toBe("data:image/jpeg;base64,fixture");
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 800);
  expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith("image/jpeg", 0.8);
  expect(revogar).toHaveBeenCalledWith("blob:fixture");
});
it.each(["corrompido", "dimensões", "saída grande"])("recusa print %s e sempre libera URL", async (caso) => {
  const { revogar } = imagemFixture(caso === "dimensões" ? 10000 : 100, caso === "dimensões" ? 10000 : 100, caso === "corrompido");
  if (caso === "saída grande") vi.mocked(HTMLCanvasElement.prototype.toDataURL).mockReturnValue("data:image/jpeg;base64," + "a".repeat(3 * 1024 * 1024));
  await expect(prepararPrint(arquivo("image/png"))).rejects.toThrow(caso === "corrompido" ? "abrir" : "muito grande");
  expect(revogar).toHaveBeenCalledWith("blob:fixture");
});
it("recusa áudio grande e navegador sem decodificador sem chamada externa", async () => {
  vi.stubGlobal("AudioContext", undefined);
  await expect(prepararAudio({ size: 8 * 1024 * 1024 + 1 } as Blob)).rejects.toThrow("8 MB");
  await expect(prepararAudio({ size: 1 } as Blob)).rejects.toThrow("Digite sua pergunta");
});
it("falha de decodificação de áudio é clara e fecha o contexto", async () => {
  const fechar = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("AudioContext", class { close = fechar; decodeAudioData = vi.fn().mockRejectedValue(new Error("decoder-private-detail")); });
  await expect(prepararAudio({ size: 1, arrayBuffer: async () => new ArrayBuffer(4) } as Blob)).rejects.toThrow("Não foi possível abrir esse áudio");
  expect(fechar).toHaveBeenCalledOnce();
});
