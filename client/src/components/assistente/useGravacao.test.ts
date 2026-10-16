// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGravacao } from "./useGravacao";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
function preparar() {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  class Gravador {
    static isTypeSupported = () => true;
    state = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((e: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["som"], { type: this.mimeType }) }); this.onstop?.(); }
  }
  vi.stubGlobal("MediaRecorder", Gravador);
  return { stopTrack, getUserMedia, stream };
}
it("conclui gravação com arquivo e libera microfone", async () => {
  const { stopTrack } = preparar(); const concluir = vi.fn();
  const { result } = renderHook(() => useGravacao(concluir, vi.fn()));
  await act(async () => result.current.iniciar()); expect(result.current.gravando).toBe(true);
  act(() => result.current.parar());
  expect(result.current.gravando).toBe(false); expect(stopTrack).toHaveBeenCalled();
  expect(concluir.mock.calls[0][0]).toBeInstanceOf(File);
});
it("limita a gravação a um minuto", async () => {
  vi.useFakeTimers(); preparar(); const concluir = vi.fn();
  const { result } = renderHook(() => useGravacao(concluir, vi.fn()));
  await act(async () => result.current.iniciar()); act(() => vi.advanceTimersByTime(60_000));
  expect(concluir).toHaveBeenCalledOnce(); expect(result.current.gravando).toBe(false);
});
it("descarta áudio e libera microfone ao sair", async () => {
  const { stopTrack } = preparar(); const concluir = vi.fn();
  const { result, unmount } = renderHook(() => useGravacao(concluir, vi.fn()));
  await act(async () => result.current.iniciar()); unmount();
  expect(stopTrack).toHaveBeenCalled(); expect(concluir).not.toHaveBeenCalled();
});
it("libera permissão concedida depois de desmontar a tela", async () => {
  const { stopTrack, getUserMedia, stream } = preparar(); let resolver!: (s: MediaStream) => void;
  getUserMedia.mockReturnValue(new Promise(r => { resolver = r; }));
  const { result, unmount } = renderHook(() => useGravacao(vi.fn(), vi.fn()));
  let gravar!: Promise<void>; act(() => { gravar = result.current.iniciar(); }); unmount();
  await act(async () => { resolver(stream); await gravar; }); expect(stopTrack).toHaveBeenCalled();
});
