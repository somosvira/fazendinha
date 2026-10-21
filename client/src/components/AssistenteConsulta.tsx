import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Loader2, MessageCircle, Send, RotateCcw, ImagePlus, Mic, Square, X, AudioLines } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { consultarAssistente, obterConfiguracaoAssistente, type ConfiguracaoAssistente, type EntradaAssistente, type RespostaAssistente, type VisaoAssistente } from "../api/assistente";
import { navegarPara } from "../router";
import { prepararPrint } from "../lib/midia-assistente";
import { useAudioAssistente } from "./useAudioAssistente";

type Print = { dataUrl: string; nome: string };
type Mensagem = { pergunta: string; print?: Print; resposta?: RespostaAssistente; erro?: string };
const CONSULTAS: { visao: VisaoAssistente; titulo: string; pergunta: string }[] = [
  { visao: "resumo", titulo: "Resumo do mês", pergunta: "Como está o financeiro deste mês?" },
  { visao: "saldo", titulo: "Saldo atual", pergunta: "Qual é o saldo atual das contas?" },
  { visao: "pagar", titulo: "A pagar no mês", pergunta: "Quanto temos a pagar neste mês?" },
  { visao: "receber", titulo: "A receber no mês", pergunta: "Quanto temos a receber neste mês?" },
  { visao: "despesas_categoria", titulo: "Despesas por categoria", pergunta: "Quais são as despesas por categoria neste mês?" },
];

export function AssistenteConsulta() {
  const [aberto, setAberto] = useState(false);
  const [config, setConfig] = useState<ConfiguracaoAssistente | null>(null);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [carregandoConfig, setCarregandoConfig] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [input, setInput] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [revisaoConfig, setRevisaoConfig] = useState(0);
  const [print, setPrint] = useState<Print | null>(null);
  const [preparandoPrint, setPreparandoPrint] = useState(false);
  const [erroMidia, setErroMidia] = useState<string | null>(null);
  const emCurso = useRef<AbortController | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const trava = useRef(false);
  const configAnterior = useRef<string | null>(null);
  const printRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const versaoPrint = useRef(0);
  const audio = useAudioAssistente(aberto && !!config?.conversaDisponivel, texto => {
    const pergunta = [input.trim(), texto].filter(Boolean).join("\n");
    if (pergunta.length > 2000) { setErroMidia("O texto com a transcrição ultrapassa 2.000 caracteres. Reduza o texto digitado e transcreva novamente."); return; }
    setInput(pergunta); setErroMidia(null); inputRef.current?.focus();
  }, setErroMidia);
  const bloqueado = ocupado || preparandoPrint || audio.ocupado;

  useEffect(() => () => { emCurso.current?.abort(); versaoPrint.current++; }, []);
  useEffect(() => {
    if (!aberto) return;
    const controller = new AbortController();
    setCarregandoConfig(true); setErroConfig(null);
    obterConfiguracaoAssistente(controller.signal).then(c => {
      if (controller.signal.aborted) return;
      const assinatura = JSON.stringify([c.escopo, c.consultas, c.artigos]);
      if (configAnterior.current && configAnterior.current !== assinatura) { setMensagens([]); setInput(""); setPrint(null); versaoPrint.current++; setPreparandoPrint(false); emCurso.current?.abort(); trava.current = false; setOcupado(false); audio.cancelar(); }
      configAnterior.current = assinatura;
      setConfig(c);
    }).catch(e => { if (!controller.signal.aborted) { setConfig(null); setMensagens([]); setErroConfig(e instanceof Error ? e.message : "Não foi possível abrir o assistente."); } })
      .finally(() => { if (!controller.signal.aborted) setCarregandoConfig(false); });
    return () => controller.abort();
  }, [aberto, revisaoConfig]);
  useEffect(() => { if (aberto) fimRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }, [mensagens, ocupado, aberto]);

  async function enviar(entrada: EntradaAssistente, pergunta: string, anexo?: Print) {
    if (trava.current || bloqueado || !config || carregandoConfig) return;
    trava.current = true; setOcupado(true); setInput("");
    const controller = new AbortController(); emCurso.current = controller;
    if (anexo) setPrint(null);
    setErroMidia(null);
    setMensagens(m => [...m.slice(-19), { pergunta, ...(anexo ? { print: anexo } : {}) }]);
    try {
      const resposta = await consultarAssistente(entrada, controller.signal);
      if (controller.signal.aborted) return;
      setMensagens(m => resposta.modo === "acesso_negado" ? [{ pergunta, resposta }] : m.map((item, i) => i === m.length - 1 ? { ...item, resposta } : item));
    } catch (e) {
      if (!controller.signal.aborted) setMensagens(m => m.map((item, i) => i === m.length - 1 ? { ...item, erro: e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente." } : item));
    } finally {
      if (!controller.signal.aborted) { trava.current = false; setOcupado(false); }
    }
  }
  function enviarPergunta() {
    const pergunta = input.trim() || (print ? "Explique esta tela ou campo do Terrano." : "");
    if (!pergunta || !config?.conversaDisponivel) return;
    void enviar({ pergunta, historico: mensagens.filter(m => m.resposta).map(m => m.pergunta).slice(-6), pagina: window.location.pathname, ...(print ? { imagem: print.dataUrl } : {}) }, pergunta, print ?? undefined);
  }
  function novaConversa() { setMensagens([]); setInput(""); setPrint(null); setErroMidia(null); audio.cancelar(); versaoPrint.current++; inputRef.current?.focus(); }
  async function anexarPrint(arquivo: File) {
    if (bloqueado || !config?.conversaDisponivel) return;
    const token = ++versaoPrint.current;
    setPreparandoPrint(true); setErroMidia(null);
    try {
      const dataUrl = await prepararPrint(arquivo);
      if (token === versaoPrint.current) setPrint({ dataUrl, nome: arquivo.name || "Print colado" });
    } catch (e) { if (token === versaoPrint.current) setErroMidia(e instanceof Error ? e.message : "Não foi possível anexar o print."); }
    finally { if (token === versaoPrint.current) setPreparandoPrint(false); }
  }

  return <Sheet open={aberto} onOpenChange={setAberto}>
    <SheetTrigger asChild><Button className="fixed bottom-5 right-3 z-40 size-11 rounded-lg p-0 shadow-lg max-[900px]:bottom-auto max-[900px]:top-3" aria-label="Abrir assistente do Terrano" title="Assistente do Terrano"><MessageCircle size={18} aria-hidden /><span className="sr-only">Assistente</span></Button></SheetTrigger>
    <SheetContent className="financeiro-colorido h-[100dvh] w-full gap-0 p-0 sm:max-w-[480px]">
      <SheetHeader className="border-b border-border px-5 pb-4 pt-6 pr-12">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><MessageCircle size={15} aria-hidden />Terrano</div>
        <SheetTitle className="font-sans text-2xl font-semibold">Assistente de consulta</SheetTitle>
        <SheetDescription className="text-sm">Seu financeiro e ajuda para usar o sistema.</SheetDescription>
        {config && <p className="mt-1 text-xs text-muted-foreground">Sítio: <span className="font-medium text-foreground">{config.escopo.nome}</span></p>}
      </SheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        {carregandoConfig && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} />Abrindo assistente…</p>}
        {erroConfig && <div role="alert" className="rounded-xl border border-destructive/30 bg-muted p-4 text-sm"><p>{erroConfig}</p><Button variant="outline" className="mt-3" onClick={() => setRevisaoConfig(v => v + 1)}>Tentar novamente</Button></div>}
        {config && !carregandoConfig && <>
          {mensagens.length === 0 && <div className="mb-5"><h3 className="text-xl font-semibold">Como posso ajudar?</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Consulte os valores cadastrados ou entenda uma funcionalidade. Cada resposta mostra a fonte para você conferir.</p></div>}
          {config.consultas.length > 0 && <div className="mb-5"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consultas rápidas</h3><p className="mb-2 text-xs text-muted-foreground">No sítio {config.escopo.nome}, somente dados permitidos ao seu perfil.</p><div className="flex flex-wrap gap-2">{CONSULTAS.filter(c => config.consultas.includes(c.visao)).slice(0, 2).map(c => <Button key={c.visao} variant="outline" className="h-auto px-3 py-2 text-xs" disabled={bloqueado} onClick={() => { void enviar({ consulta: { visao: c.visao, inicio: null, fim: null } }, c.pergunta); }}>{c.titulo}</Button>)}</div>{config.consultas.length > 2 && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Mais consultas financeiras</summary><div className="mt-2 flex flex-wrap gap-2">{CONSULTAS.filter(c => config.consultas.includes(c.visao)).slice(2).map(c => <Button key={c.visao} variant="outline" className="h-auto px-3 py-2 text-xs" disabled={bloqueado} onClick={() => { void enviar({ consulta: { visao: c.visao, inicio: null, fim: null } }, c.pergunta); }}>{c.titulo}</Button>)}</div></details>}</div>}
          <details className="mb-5 rounded-xl border border-border p-3" open={mensagens.length === 0}><summary className="flex cursor-pointer items-center gap-2 text-sm font-medium"><BookOpen size={16} aria-hidden />Guias de uso</summary><div className="mt-3 grid gap-1">{config.artigos.map(a => <button key={a.id} type="button" disabled={bloqueado} className="rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={() => { void enviar({ artigoId: a.id }, a.titulo); }}>{a.titulo}</button>)}</div></details>
        </>}
        <div role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" className="space-y-5">
          {mensagens.map((m, i) => <div key={i} className="space-y-3">
            <p className="ml-8 whitespace-pre-wrap rounded-xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{m.pergunta}</p>
            {m.print && <img src={m.print.dataUrl} alt="Print enviado junto da pergunta" className="ml-auto max-h-40 max-w-[80%] rounded-xl border border-border object-contain" />}
            {m.resposta && <div className="rounded-xl rounded-bl-sm border border-border bg-muted/50 p-4"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.resposta.resposta}</p>
              {m.resposta.fontes.map(f => <button key={f.url} type="button" className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-xs font-medium transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setAberto(false); navegarPara(f.url); }}>{f.titulo}<ArrowUpRight size={15} aria-hidden /></button>)}
              <p className="mt-3 text-[11px] text-muted-foreground">{m.resposta.escopo.nome} · {m.resposta.modo === "dados" ? "Consultado" : "Respondido"} às {new Date(m.resposta.consultadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>}
            {m.erro && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{m.erro}</p>}
          </div>)}
          {ocupado && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} aria-hidden />Consultando…</p>}
          <div ref={fimRef} />
        </div>
      </div>
      <form className="border-t border-border bg-card px-5 py-4" onSubmit={e => { e.preventDefault(); enviarPergunta(); }}>
        {config && !config.conversaDisponivel && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">A conversa com IA ainda não está configurada. As consultas rápidas e os guias de uso já estão disponíveis.</p>}
        <label htmlFor="pergunta-assistente" className="sr-only">Sua pergunta sobre o Terrano</label>
        {print && <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted p-2"><img src={print.dataUrl} alt="Prévia do print" className="h-14 w-16 rounded object-contain" /><span className="min-w-0 flex-1 truncate text-xs">{print.nome}</span><Button type="button" variant="ghost" size="icon" disabled={bloqueado} aria-label="Remover print" onClick={() => setPrint(null)}><X size={16} /></Button></div>}
        {erroMidia && <p role="alert" className="mb-3 text-xs text-destructive">{erroMidia}</p>}
        {(audio.ocupado || preparandoPrint) && <div role="status" className="mb-3 flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{audio.gravando ? `Gravando · ${audio.segundos}s / 60s` : audio.transcrevendo ? "Transcrevendo áudio…" : audio.preparando ? "Aguardando microfone…" : "Preparando print…"}</span>{audio.ocupado && <Button type="button" variant="ghost" size="sm" onClick={audio.cancelar} aria-label="Descartar áudio">Descartar</Button>}</div>}
        <div className="flex items-end gap-2"><Textarea id="pergunta-assistente" ref={inputRef} value={input} maxLength={2000} rows={2} disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} onChange={e => setInput(e.target.value)} onPaste={e => {
          const arquivo = [...e.clipboardData.items].find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
          if (arquivo) { e.preventDefault(); void anexarPrint(arquivo); }
        }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarPergunta(); } }} placeholder="Digite, fale ou envie um print da sua dúvida…" className="min-h-20 resize-none rounded-xl text-sm" /><Button type="submit" size="icon" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig || (!input.trim() && !print)} aria-label="Enviar pergunta"><Send size={17} aria-hidden /></Button></div>
        <input ref={printRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Selecionar print" className="hidden" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void anexarPrint(arquivo); }} />
        <input ref={audioRef} type="file" accept="audio/*,.m4a,.webm" aria-label="Selecionar arquivo de áudio" className="hidden" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo && !bloqueado && config?.conversaDisponivel) { setErroMidia(null); void audio.enviarArquivo(arquivo); } }} />
        <div className="mt-2 flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} aria-label="Anexar print" onClick={() => printRef.current?.click()} className="gap-1.5 px-2 text-xs"><ImagePlus size={15} aria-hidden />Print</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || ocupado || carregandoConfig || preparandoPrint || audio.preparando || audio.transcrevendo || !audio.suportado} aria-label={audio.gravando ? "Parar e transcrever áudio" : "Gravar áudio"} onClick={() => { setErroMidia(null); if (audio.gravando) audio.parar(); else void audio.iniciar(); }} className="gap-1.5 px-2 text-xs">{audio.gravando ? <Square size={14} aria-hidden /> : <Mic size={15} aria-hidden />}{audio.gravando ? "Parar" : "Gravar"}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} aria-label="Enviar arquivo de áudio" onClick={() => audioRef.current?.click()} className="gap-1.5 px-2 text-xs"><AudioLines size={15} aria-hidden />Áudio</Button>
          <Button type="button" variant="ghost" size="sm" disabled={bloqueado || !mensagens.length} onClick={novaConversa} className="ml-auto h-7 gap-1.5 px-2 text-xs"><RotateCcw size={12} aria-hidden />Nova conversa</Button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Somente consulta · conversa não salva. Áudio e prints enviados são processados pela IA. Revise a transcrição antes de enviar a pergunta.</p>
      </form>
    </SheetContent>
  </Sheet>;
}
