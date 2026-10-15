import { useEffect, useRef, useState } from "react";
import { transcreverAudioAssistente } from "../api/assistente";
import { prepararAudio } from "../lib/midia-assistente";

export function useAudioAssistente(ativo: boolean, onTexto: (texto: string) => void, onErro: (texto: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const versao = useRef(0);
  const callbacks = useRef({ onTexto, onErro }); callbacks.current = { onTexto, onErro };
  const suportado = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  function liberarMicrofone() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
  }
  function cancelar() {
    versao.current++;
    controllerRef.current?.abort();
    const recorder = recorderRef.current; recorderRef.current = null;
    if (recorder?.state === "recording") recorder.stop();
    liberarMicrofone();
    setGravando(false); setPreparando(false); setTranscrevendo(false); setSegundos(0);
  }
  useEffect(() => {
    if (!ativo) cancelar();
    return () => {
      versao.current++; controllerRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      liberarMicrofone(); recorderRef.current = null;
    };
  }, [ativo]);

  async function transcrever(blob: Blob, cortar = false, token = ++versao.current) {
    if (!ativo) return;
    setTranscrevendo(true); setGravando(false);
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const wav = await prepararAudio(blob, cortar);
      if (controller.signal.aborted || token !== versao.current) return;
      const r = await transcreverAudioAssistente(wav, controller.signal);
      if (!controller.signal.aborted && token === versao.current) callbacks.current.onTexto(r.texto);
    } catch (e) {
      if (!controller.signal.aborted && token === versao.current) callbacks.current.onErro(e instanceof Error ? e.message : "Não foi possível transcrever o áudio.");
    } finally {
      if (token === versao.current) { setTranscrevendo(false); setPreparando(false); }
    }
  }
  async function iniciar() {
    if (!ativo || !suportado || gravando || transcrevendo || preparando) return;
    const token = ++versao.current;
    setPreparando(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== versao.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(tipo => MediaRecorder.isTypeSupported(tipo));
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      const partes: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
      recorder.onerror = () => { if (token === versao.current) { cancelar(); callbacks.current.onErro("A gravação falhou. Tente novamente ou envie um arquivo de áudio."); } };
      recorder.onstop = () => {
        if (token !== versao.current) { stream.getTracks().forEach(track => track.stop()); return; }
        liberarMicrofone(); recorderRef.current = null;
        if (token === versao.current) void transcrever(new Blob(partes, { type: recorder.mimeType }), true, token);
      };
      recorder.start(); setGravando(true); setPreparando(false); setSegundos(0);
      const inicio = Date.now();
      timerRef.current = setInterval(() => {
        const tempo = Math.floor((Date.now() - inicio) / 1000); setSegundos(Math.min(tempo, 60));
        if (tempo >= 60 && recorder.state === "recording") recorder.stop();
      }, 250);
    } catch {
      if (token === versao.current) { liberarMicrofone(); setPreparando(false); callbacks.current.onErro("Não foi possível acessar o microfone. Verifique a permissão do navegador ou envie um arquivo de áudio."); }
    }
  }
  function parar() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }
  return { gravando, preparando, transcrevendo, segundos, suportado, iniciar, parar, cancelar, enviarArquivo: (arquivo: File) => transcrever(arquivo), ocupado: gravando || preparando || transcrevendo };
}
