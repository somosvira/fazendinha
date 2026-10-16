import { useEffect, useRef, useState } from "react";

export function useGravacao(aoConcluir: (arquivo: File) => void, aoErro: (mensagem: string) => void) {
  const [gravando, setGravando] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const gravador = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geracao = useRef(0);
  const callbacks = useRef({ aoConcluir, aoErro });
  callbacks.current = { aoConcluir, aoErro };
  const suportado = typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  function liberar() {
    if (tempo.current) clearTimeout(tempo.current);
    tempo.current = null;
    stream.current?.getTracks().forEach(t => t.stop());
    stream.current = null;
  }
  function cancelar() {
    geracao.current++;
    if (gravador.current && gravador.current.state !== "inactive") {
      gravador.current.onstop = null;
      gravador.current.stop();
    }
    gravador.current = null;
    liberar(); setGravando(false); setSolicitando(false);
  }
  useEffect(() => () => {
    geracao.current++;
    if (gravador.current && gravador.current.state !== "inactive") { gravador.current.onstop = null; gravador.current.stop(); }
    liberar();
  }, []);

  async function iniciar() {
    if (!suportado || gravador.current || solicitando) return;
    const atual = ++geracao.current;
    setSolicitando(true);
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (atual !== geracao.current) { audio.getTracks().forEach(t => t.stop()); return; }
      stream.current = audio;
      const tipo = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(audio, tipo ? { mimeType: tipo } : undefined);
      gravador.current = rec;
      const partes: Blob[] = [];
      let tamanho = 0;
      rec.ondataavailable = e => {
        if (atual !== geracao.current) return;
        if (e.data.size) { partes.push(e.data); tamanho += e.data.size; }
        if (tamanho > 10 * 1024 * 1024) { cancelar(); callbacks.current.aoErro("O áudio ficou grande. Grave uma pergunta mais curta."); }
      };
      rec.onerror = () => { if (atual !== geracao.current) return; cancelar(); callbacks.current.aoErro("Não foi possível gravar. Tente novamente ou digite a pergunta."); };
      rec.onstop = () => {
        liberar(); gravador.current = null;
        if (atual !== geracao.current) return;
        setGravando(false);
        const mime = rec.mimeType || partes[0]?.type || "audio/webm";
        const arquivo = new File(partes, `pergunta.${mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm"}`, { type: mime });
        if (!arquivo.size) callbacks.current.aoErro("O áudio ficou vazio. Tente gravar novamente.");
        else callbacks.current.aoConcluir(arquivo);
      };
      rec.start(1000); setGravando(true);
      tempo.current = setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, 60_000);
    } catch {
      liberar(); gravador.current = null;
      if (atual === geracao.current) callbacks.current.aoErro("Não consegui acessar o microfone. Permita o acesso no navegador ou envie um arquivo de áudio.");
    } finally { if (atual === geracao.current) setSolicitando(false); }
  }
  return { gravando, solicitando, suportado, iniciar, cancelar, parar: () => { if (gravador.current?.state === "recording") gravador.current.stop(); } };
}
