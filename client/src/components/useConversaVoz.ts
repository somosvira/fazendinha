import { useEffect, useRef, useState } from "react";
import { transcreverAudioAssistente, type RespostaAssistenteVoz } from "../api/assistente";
import { prepararAudio } from "../lib/midia-assistente";

type EstadoVoz = "inativa" | "conectando" | "ouvindo" | "processando" | "falando";
type Perguntar = (texto: string, signal: AbortSignal) => Promise<RespostaAssistenteVoz>;

/** Conversa por turnos: captura local, pausa, transcrição, consulta autorizada e locução. */
export function useConversaVoz(permitida: boolean, onPergunta: Perguntar, onErro: (mensagem: string) => void) {
  const [estado, setEstado] = useState<EstadoVoz>("inativa");
  const [silenciado, setSilenciado] = useState(false);
  const versao = useRef(0);
  const ligando = useRef(false);
  const mudo = useRef(false);
  const stream = useRef<MediaStream | null>(null);
  const contexto = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const limiteSessao = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const som = useRef<HTMLAudioElement | null>(null);
  const escutar = useRef<(() => void) | null>(null);
  const callbacks = useRef({ onPergunta, onErro, permitida }); callbacks.current = { onPergunta, onErro, permitida };
  const suportado = typeof MediaRecorder !== "undefined" && typeof AudioContext !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  function pararGravacao() {
    if (timer.current) clearInterval(timer.current); timer.current = null;
    const atual = recorder.current; recorder.current = null;
    if (atual) { atual.onstop = null; atual.ondataavailable = null; atual.onerror = null; if (atual.state !== "inactive") atual.stop(); }
  }
  function pararSom() {
    const atual = som.current; som.current = null;
    if (atual) { atual.onended = null; atual.onerror = null; atual.pause(); atual.removeAttribute("src"); atual.load(); }
  }
  function liberar() {
    versao.current++; ligando.current = false;
    request.current?.abort(); request.current = null;
    pararGravacao(); pararSom(); escutar.current = null;
    if (limiteSessao.current) clearTimeout(limiteSessao.current); limiteSessao.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    void contexto.current?.close().catch(() => {}); contexto.current = null;
    mudo.current = false;
  }
  function encerrar() { liberar(); setEstado("inativa"); setSilenciado(false); }
  function falhar(mensagem: string) { encerrar(); callbacks.current.onErro(mensagem); }
  useEffect(() => {
    if (!permitida) encerrar();
    return liberar;
  }, [permitida]);

  async function iniciar() {
    if (!callbacks.current.permitida || !suportado || stream.current || ligando.current) return;
    const token = ++versao.current; ligando.current = true; setEstado("conectando");
    try {
      const midia = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (token !== versao.current) { midia.getTracks().forEach(track => track.stop()); return; }
      stream.current = midia;
      const audioCtx = new AudioContext(); contexto.current = audioCtx;
      await audioCtx.resume();
      if (token !== versao.current) return;
      const entrada = audioCtx.createMediaStreamSource(midia);
      const analisador = audioCtx.createAnalyser(); analisador.fftSize = 512; entrada.connect(analisador);
      const amostras = new Float32Array(512);
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(tipo => MediaRecorder.isTypeSupported(tipo));

      async function processar(blob: Blob) {
        if (token !== versao.current) return;
        setEstado("processando");
        const controller = new AbortController(); request.current = controller;
        try {
          const wav = await prepararAudio(blob, true);
          if (controller.signal.aborted) return;
          const { texto } = await transcreverAudioAssistente(wav, controller.signal);
          if (controller.signal.aborted) return;
          const resposta = await callbacks.current.onPergunta(texto, controller.signal);
          if (controller.signal.aborted || token !== versao.current) return;
          if (resposta.modo === "acesso_negado") { encerrar(); return; }
          if (!resposta.audio) { falhar(resposta.avisoVoz ?? "Resposta disponível por escrito. Retome a conversa quando quiser."); return; }
          const player = new Audio(resposta.audio); som.current = player;
          player.onended = () => { if (token === versao.current) { pararSom(); comecarTrecho(); } };
          player.onerror = () => { if (token === versao.current && som.current === player) falhar("Não foi possível reproduzir a voz. Confira a resposta escrita."); };
          setEstado("falando");
          try { await player.play(); }
          catch { if (som.current === player) throw new Error("Não foi possível reproduzir a voz. Confira a resposta escrita."); }
        } catch (e) {
          if (!controller.signal.aborted && token === versao.current) falhar(e instanceof Error ? e.message : "A conversa foi interrompida. Tente novamente.");
        }
      }
      function comecarTrecho() {
        if (token !== versao.current) return;
        pararGravacao(); setEstado("ouvindo");
        if (mudo.current) return;
        const gravador = new MediaRecorder(midia, mime ? { mimeType: mime } : undefined);
        recorder.current = gravador;
        const partes: Blob[] = [];
        const inicio = Date.now(); let ultimaFala = inicio; let framesVoz = 0; let houveFala = false;
        gravador.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
        gravador.onerror = () => { if (token === versao.current) falhar("A gravação falhou. Verifique o microfone e tente novamente."); };
        gravador.onstop = () => {
          if (token !== versao.current) return;
          if (houveFala) void processar(new Blob(partes, { type: gravador.mimeType }));
          else comecarTrecho();
        };
        gravador.start(250);
        timer.current = setInterval(() => {
          analisador.getFloatTimeDomainData(amostras);
          const rms = Math.sqrt(amostras.reduce((soma, v) => soma + v * v, 0) / amostras.length);
          const agora = Date.now();
          if (rms > .025) { framesVoz++; if (framesVoz >= 3) houveFala = true; ultimaFala = agora; }
          else framesVoz = 0;
          // Renova o trecho silencioso localmente: não cobra dezenas de segundos
          // de espera quando a pessoa finalmente começar a falar.
          if ((!houveFala && framesVoz === 0 && agora - inicio >= 3000) || (houveFala && agora - ultimaFala >= 1200) || agora - inicio >= 59_000) {
            if (timer.current) clearInterval(timer.current); timer.current = null;
            recorder.current = null; gravador.stop();
          }
        }, 100);
      }
      escutar.current = comecarTrecho;
      limiteSessao.current = setTimeout(() => { if (token === versao.current) falhar("A conversa atingiu dez minutos. Inicie novamente para continuar."); }, 600_000);
      ligando.current = false; comecarTrecho();
    } catch {
      if (token === versao.current) falhar("Não foi possível acessar o microfone. Confira a permissão e tente novamente.");
    }
  }
  function alternarMicrofone() {
    if (!stream.current) return;
    mudo.current = !mudo.current; setSilenciado(mudo.current);
    stream.current.getTracks().forEach(track => { track.enabled = !mudo.current; });
    if (estado === "ouvindo") { pararGravacao(); if (!mudo.current) escutar.current?.(); }
  }
  function interromper() { if (estado === "falando") { pararSom(); escutar.current?.(); } }
  return { estado, silenciado, suportado, iniciar, encerrar, alternarMicrofone, interromper, ativa: estado !== "inativa" };
}
