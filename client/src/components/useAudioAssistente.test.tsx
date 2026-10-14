// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAudioAssistente } from "./useAudioAssistente";
import { prepararAudio } from "../lib/midia-assistente";
import { transcreverAudioAssistente } from "../api/assistente";
vi.mock("../lib/midia-assistente", () => ({ prepararAudio: vi.fn() }));
vi.mock("../api/assistente", () => ({ transcreverAudioAssistente: vi.fn() }));
const pararTrack = vi.fn();
const microfone = vi.fn();
const originalMedia = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
class RecorderFixture {
  static isTypeSupported = () => true;
  state = "inactive"; mimeType = "audio/webm";
  ondataavailable?: (e: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("MediaRecorder", RecorderFixture);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: microfone } });
  microfone.mockResolvedValue({ getTracks: () => [{ stop: pararTrack }] });
  vi.mocked(prepararAudio).mockResolvedValue(new Blob(["wav"], { type: "audio/wav" }));
  vi.mocked(transcreverAudioAssistente).mockResolvedValue({ texto: "Como ficou setembro?" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); if (originalMedia) Object.defineProperty(navigator, "mediaDevices", originalMedia); else Reflect.deleteProperty(navigator, "mediaDevices"); });
it("pede microfone só após ação e devolve texto para revisão, sem enviar consulta", async () => {
  const onTexto = vi.fn(); const onErro = vi.fn();
  const hook = renderHook(() => useAudioAssistente(true, onTexto, onErro));
  expect(microfone).not.toHaveBeenCalled();
  await act(async () => hook.result.current.iniciar());
  expect(hook.result.current.gravando).toBe(true);
  act(() => hook.result.current.parar());
  await waitFor(() => expect(onTexto).toHaveBeenCalledWith("Como ficou setembro?"));
  expect(pararTrack).toHaveBeenCalled(); expect(onErro).not.toHaveBeenCalled();
  expect(transcreverAudioAssistente).toHaveBeenCalledTimes(1);
});
it("troca de contexto libera o microfone e não transcreve gravação descartada", async () => {
  const onTexto = vi.fn(); const hook = renderHook(({ ativo }) => useAudioAssistente(ativo, onTexto, vi.fn()), { initialProps: { ativo: true } });
  await act(async () => hook.result.current.iniciar());
  hook.rerender({ ativo: false });
  expect(pararTrack).toHaveBeenCalled(); expect(hook.result.current.gravando).toBe(false);
  expect(transcreverAudioAssistente).not.toHaveBeenCalled(); expect(onTexto).not.toHaveBeenCalled();
});
it("permissão tardia depois de fechar não inicia nem deixa microfone ativo", async () => {
  let liberar!: (stream: { getTracks: () => { stop: typeof pararTrack }[] }) => void;
  microfone.mockReturnValue(new Promise(resolve => { liberar = resolve; }));
  const hook = renderHook(({ ativo }) => useAudioAssistente(ativo, vi.fn(), vi.fn()), { initialProps: { ativo: true } });
  let iniciando!: Promise<void>;
  act(() => { iniciando = hook.result.current.iniciar(); });
  hook.rerender({ ativo: false });
  await act(async () => { liberar({ getTracks: () => [{ stop: pararTrack }] }); await iniciando; });
  expect(pararTrack).toHaveBeenCalled(); expect(hook.result.current.gravando).toBe(false);
  expect(transcreverAudioAssistente).not.toHaveBeenCalled();
});
it("erro de permissão fica explícito sem abrir chamada ao provedor", async () => {
  microfone.mockRejectedValue(new Error("not allowed"));
  const onErro = vi.fn(); const hook = renderHook(() => useAudioAssistente(true, vi.fn(), onErro));
  await act(async () => hook.result.current.iniciar());
  expect(onErro).toHaveBeenCalledWith(expect.stringContaining("permissão"));
  expect(transcreverAudioAssistente).not.toHaveBeenCalled();
});
