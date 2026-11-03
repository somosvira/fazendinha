// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useConversaVoz } from "./useConversaVoz";
import { transcreverAudioAssistente } from "../api/assistente";
vi.mock("../api/assistente", () => ({ transcreverAudioAssistente: vi.fn() }));
vi.mock("../lib/midia-assistente", () => ({ prepararAudio: vi.fn(async () => new Blob(["wav"])) }));
const stop = vi.fn(); const close = vi.fn(); const perguntar = vi.fn(); const erro = vi.fn();
let nivel = 0;
let player: { onended: (() => void) | null; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> };
let tracks: { stop: typeof stop; enabled: boolean }[];
class Recorder {
  static isTypeSupported() { return true; }
  state = "inactive"; mimeType = "audio/webm";
  onstop: (() => void) | null = null;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); nivel = 0;
  tracks = [{ stop, enabled: true }];
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("Audio", class {
    onended = null; onerror = null; pause = vi.fn(); play = vi.fn(async () => {}); removeAttribute = vi.fn(); load = vi.fn();
    constructor() { player = this; }
  });
  vi.stubGlobal("AudioContext", class {
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createAnalyser() { return { fftSize: 512, getFloatTimeDomainData: (b: Float32Array) => b.fill(nivel), disconnect: vi.fn() }; }
    resume() { return Promise.resolve(); }
    close() { close(); return Promise.resolve(); }
  });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => tracks })) } });
  vi.mocked(transcreverAudioAssistente).mockResolvedValue({ texto: "Saldo atual?" });
  perguntar.mockResolvedValue({ modo: "ajuda", resposta: "Resposta escrita", fontes: [], audio: null, avisoVoz: "Voz indisponível" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it("não pede microfone antes do clique e libera uma permissão concedida após encerrar", async () => {
  let liberar!: (stream: MediaStream) => void;
  vi.mocked(navigator.mediaDevices.getUserMedia).mockReturnValue(new Promise(resolve => { liberar = resolve; }));
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  let inicio!: Promise<void>; act(() => { inicio = result.current.iniciar(); });
  act(() => result.current.encerrar());
  await act(async () => { liberar({ getTracks: () => tracks } as unknown as MediaStream); await inicio; });
  expect(stop).toHaveBeenCalledTimes(1); expect(result.current.estado).toBe("inativa");
});
it("silêncio não chama a IA e desmontagem libera microfone e contexto de áudio", async () => {
  const { result, unmount } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  await act(async () => { await vi.advanceTimersByTimeAsync(35_000); });
  expect(transcreverAudioAssistente).not.toHaveBeenCalled(); expect(perguntar).not.toHaveBeenCalled();
  unmount(); expect(stop).toHaveBeenCalled(); expect(close).toHaveBeenCalled();
});
it("silenciar interrompe a captura e reativar retoma sem enviar o trecho incompleto", async () => {
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  act(() => result.current.alternarMicrofone());
  expect(result.current.silenciado).toBe(true); expect(tracks[0].enabled).toBe(false);
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(2000); });
  expect(transcreverAudioAssistente).not.toHaveBeenCalled();
  act(() => result.current.alternarMicrofone());
  expect(tracks[0].enabled).toBe(true); expect(result.current.estado).toBe("ouvindo");
});
it("envia após pausa, conserva resposta escrita e encerra recursos quando falta áudio", async () => {
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(500); nivel = 0; await vi.advanceTimersByTimeAsync(1600); });
  expect(perguntar).toHaveBeenCalledWith("Saldo atual?", expect.any(AbortSignal));
  expect(erro).toHaveBeenCalledWith("Voz indisponível");
  expect(result.current.estado).toBe("inativa"); expect(stop).toHaveBeenCalled();
});
it("desativar aborta transcrição pendente e ignora a resposta tardia", async () => {
  let concluir!: (r: { texto: string }) => void;
  vi.mocked(transcreverAudioAssistente).mockReturnValue(new Promise(resolve => { concluir = resolve; }));
  const { result, rerender } = renderHook(({ ativo }) => useConversaVoz(ativo, perguntar, erro), { initialProps: { ativo: true } });
  await act(async () => result.current.iniciar());
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(500); nivel = 0; await vi.advanceTimersByTimeAsync(1600); });
  const signal = vi.mocked(transcreverAudioAssistente).mock.calls[0][1]!;
  rerender({ ativo: false }); expect(signal.aborted).toBe(true);
  await act(async () => concluir({ texto: "Pergunta antiga" }));
  expect(perguntar).not.toHaveBeenCalled();
});
it("pausa captura durante reprodução, permite interromper e volta a ouvir", async () => {
  perguntar.mockResolvedValue({ modo: "ajuda", resposta: "Resposta escrita", audio: "data:audio/mpeg;base64,YQ==" });
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(500); nivel = 0; await vi.advanceTimersByTimeAsync(1600); });
  expect(result.current.estado).toBe("falando"); expect(player.play).toHaveBeenCalled();
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(2000); });
  expect(perguntar).toHaveBeenCalledTimes(1);
  act(() => result.current.interromper());
  expect(player.pause).toHaveBeenCalled(); expect(result.current.estado).toBe("ouvindo");
  act(() => result.current.encerrar());
  expect(stop).toHaveBeenCalled();
});
it("encerra após dez minutos sem deixar timers nem captura", async () => {
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
  expect(result.current.estado).toBe("inativa"); expect(stop).toHaveBeenCalled();
  expect(erro).toHaveBeenCalledWith(expect.stringContaining("dez minutos"));
  expect(vi.getTimerCount()).toBe(0);
});
it("interromper ignora rejeição tardia de play e mantém a nova escuta", async () => {
  let rejeitar!: (erro: Error) => void;
  vi.stubGlobal("Audio", class {
    onended = null; onerror = null; pause() { rejeitar(new Error("Playback interrupted")); }
    play() { return new Promise<void>((_resolve, reject) => { rejeitar = reject; }); }
    removeAttribute() {} load() {}
  });
  perguntar.mockResolvedValue({ modo: "ajuda", resposta: "Resposta escrita", audio: "data:audio/mpeg;base64,YQ==" });
  const { result } = renderHook(() => useConversaVoz(true, perguntar, erro));
  await act(async () => result.current.iniciar());
  await act(async () => { nivel = .1; await vi.advanceTimersByTimeAsync(500); nivel = 0; await vi.advanceTimersByTimeAsync(1600); });
  expect(result.current.estado).toBe("falando");
  await act(async () => result.current.interromper());
  expect(result.current.estado).toBe("ouvindo"); expect(erro).not.toHaveBeenCalled();
});
