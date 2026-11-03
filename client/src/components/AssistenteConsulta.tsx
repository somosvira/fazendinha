import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BookOpen, Loader2, MessageCircle, Send, RotateCcw, ImagePlus, Mic, Square, X, AudioLines, MicOff, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { consultarAssistente, consultarAssistenteComVoz, obterConfiguracaoAssistente, type ConfiguracaoAssistente, type EntradaAssistente, type RespostaAssistente, type VisaoAssistente } from "../api/assistente";
import { navegarPara } from "../router";
import { prepararPrint } from "../lib/midia-assistente";
import { useAudioAssistente } from "./useAudioAssistente";
import { useConversaVoz } from "./useConversaVoz";
import "./assistente-consulta.css";

type Print = { dataUrl: string; nome: string };
type Mensagem = { pergunta: string; print?: Print; resposta?: RespostaAssistente; erro?: string };
const CONSULTAS: { visao: VisaoAssistente; titulo: string; pergunta: string }[] = [
  { visao: "resumo", titulo: "Resumo do mês", pergunta: "Como está o financeiro deste mês?" },
  { visao: "saldo", titulo: "Saldo atual", pergunta: "Qual é o saldo atual das contas?" },
  { visao: "pagar", titulo: "A pagar no mês", pergunta: "Quanto temos a pagar neste mês?" },
  { visao: "receber", titulo: "A receber no mês", pergunta: "Quanto temos a receber neste mês?" },
  { visao: "despesas_categoria", titulo: "Despesas por categoria", pergunta: "Quais são as despesas por categoria neste mês?" },
];
const acessoRevogado = (erro: unknown): erro is Error & { status: number } => erro instanceof Error && "status" in erro && [401, 403].includes(Number(erro.status));

export function AssistenteConsulta() {
  const [aberto, setAberto] = useState(false);
  const [modoVoz, setModoVoz] = useState(false);
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
  const [apoioAberto, setApoioAberto] = useState(false);
  const apoioToggleRef = useRef<HTMLButtonElement>(null);
  const versaoPrint = useRef(0);
  const audio = useAudioAssistente(aberto && !!config?.conversaDisponivel, texto => {
    const pergunta = [input.trim(), texto].filter(Boolean).join("\n");
    if (pergunta.length > 2000) { setErroMidia("O texto com a transcrição ultrapassa 2.000 caracteres. Reduza o texto digitado e transcreva novamente."); return; }
    setInput(pergunta); setErroMidia(null); inputRef.current?.focus();
  }, setErroMidia);
  const voz = useConversaVoz(aberto && modoVoz && !!config?.conversaDisponivel && !carregandoConfig, async (texto, signal) => {
    setErroMidia(null);
    setMensagens(m => [...m.slice(-19), { pergunta: texto }]);
    try {
      const resposta = await consultarAssistenteComVoz({ pergunta: texto, historico: mensagens.filter(m => m.resposta).map(m => m.pergunta).slice(-6), pagina: window.location.pathname }, signal);
      if (!signal.aborted) setMensagens(m => resposta.modo === "acesso_negado" ? [{ pergunta: texto, resposta }] : m.map((item, i) => i === m.length - 1 ? { ...item, resposta } : item));
      return resposta;
    } catch (e) {
      if (!signal.aborted) setMensagens(m => acessoRevogado(e) ? [] : m.map((item, i) => i === m.length - 1 ? { ...item, erro: e instanceof Error ? e.message : "Não foi possível concluir a consulta." } : item));
      throw e;
    }
  }, setErroMidia);
  const bloqueado = ocupado || preparandoPrint || audio.ocupado || voz.ativa;

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
    if (apoioAberto) apoioToggleRef.current?.focus();
    setApoioAberto(false);
    const controller = new AbortController(); emCurso.current = controller;
    if (anexo) setPrint(null);
    setErroMidia(null);
    setMensagens(m => [...m.slice(-19), { pergunta, ...(anexo ? { print: anexo } : {}) }]);
    try {
      const resposta = await consultarAssistente(entrada, controller.signal);
      if (controller.signal.aborted) return;
      setMensagens(m => resposta.modo === "acesso_negado" ? [{ pergunta, resposta }] : m.map((item, i) => i === m.length - 1 ? { ...item, resposta } : item));
    } catch (e) {
      if (!controller.signal.aborted) {
        if (acessoRevogado(e)) { setMensagens([]); setErroMidia(e.message); }
        else setMensagens(m => m.map((item, i) => i === m.length - 1 ? { ...item, erro: e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente." } : item));
      }
    } finally {
      if (!controller.signal.aborted) { trava.current = false; setOcupado(false); }
    }
  }
  function enviarPergunta() {
    const pergunta = input.trim() || (print ? "Explique esta tela ou campo do Terrano." : "");
    if (!pergunta || !config?.conversaDisponivel) return;
    void enviar({ pergunta, historico: mensagens.filter(m => m.resposta).map(m => m.pergunta).slice(-6), pagina: window.location.pathname, ...(print ? { imagem: print.dataUrl } : {}) }, pergunta, print ?? undefined);
  }
  function novaConversa() { setApoioAberto(false); voz.encerrar(); setModoVoz(false); setMensagens([]); setInput(""); setPrint(null); setErroMidia(null); audio.cancelar(); versaoPrint.current++; inputRef.current?.focus(); }
  function mudarAberto(valor: boolean) {
    if (!valor) { voz.encerrar(); audio.cancelar(); emCurso.current?.abort(); trava.current = false; setOcupado(false); }
    setAberto(valor);
  }
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

  return <Sheet open={aberto} onOpenChange={mudarAberto}>
    <SheetTrigger asChild><Button className="fixed bottom-5 right-3 z-40 size-11 rounded-lg p-0 shadow-lg max-[901px]:bottom-auto max-[901px]:top-3" aria-label="Abrir assistente do Terrano" title="Assistente do Terrano"><MessageCircle size={18} aria-hidden /><span className="sr-only">Assistente</span></Button></SheetTrigger>
    <SheetContent className="financeiro-colorido assistente-consulta w-full gap-0 p-0">
      <SheetHeader className="assistente-cabecalho">
        <div className="assistente-titulo"><SheetTitle>Assistente Terrano</SheetTitle><Button type="button" variant="outline" size="sm" disabled={ocupado || preparandoPrint} onClick={novaConversa}><RotateCcw size={14} aria-hidden />Nova conversa</Button></div>
        <SheetDescription className="sr-only">Seu financeiro e ajuda para usar o sistema. Converse por texto ou por voz.</SheetDescription>
        {config && <p className="assistente-contexto">{config.escopo.nome} · Somente consulta</p>}
        <div className="assistente-modos" aria-label="Forma de conversar">
          <Button type="button" variant="ghost" aria-label="Conversa por texto" aria-pressed={!modoVoz} onClick={() => { voz.encerrar(); setModoVoz(false); }}>Conversa</Button>
          <Button type="button" variant="ghost" aria-pressed={modoVoz} disabled={ocupado || audio.ocupado || preparandoPrint} onClick={() => { audio.cancelar(); setErroMidia(null); setModoVoz(true); }}><AudioLines size={16} aria-hidden />Conversar por voz</Button>
        </div>
      </SheetHeader>
      <div className="assistente-corpo min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {carregandoConfig && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} />Abrindo assistente…</p>}
        {erroConfig && <div role="alert" className="rounded-xl border border-destructive/30 bg-muted p-4 text-sm"><p>{erroConfig}</p><Button variant="outline" className="mt-3" onClick={() => setRevisaoConfig(v => v + 1)}>Tentar novamente</Button></div>}
        {modoVoz && <section className="assistente-voz" aria-label="Conversa por voz">
          <div className="assistente-onda" data-estado={voz.estado} aria-hidden>{[20, 38, 65, 46, 76, 42, 28].map((altura, i) => <span key={i} style={{ height: altura }} />)}</div>
          <h3 role="status">{voz.estado === "conectando" ? "Aguardando microfone…" : voz.estado === "processando" ? "Consultando…" : voz.estado === "falando" ? "Terrano está falando" : voz.ativa ? voz.silenciado ? "Microfone silenciado" : "Pode falar" : "Vamos conversar?"}</h3>
          <p>{carregandoConfig ? "Conferindo a disponibilidade da conversa…" : !config?.conversaDisponivel ? "A conversa por voz ainda não está configurada neste ambiente. Você pode usar as consultas rápidas e os guias na aba Conversa." : "Fale sua pergunta e faça uma pausa para ouvir a resposta. Use Interromper para voltar a falar."}</p>
          <div className="assistente-voz-controles">
            {!voz.ativa ? <Button type="button" disabled={!voz.suportado || !config?.conversaDisponivel || carregandoConfig} onClick={() => { setErroMidia(null); void voz.iniciar(); }}><Mic size={16} aria-hidden />Iniciar conversa</Button> : <>
              <Button type="button" variant="outline" disabled={voz.estado === "conectando"} aria-pressed={voz.silenciado} onClick={voz.alternarMicrofone}>{voz.silenciado ? <MicOff size={16} aria-hidden /> : <Mic size={16} aria-hidden />}{voz.silenciado ? "Ativar microfone" : "Silenciar microfone"}</Button>
              {voz.estado === "falando" && <Button type="button" variant="outline" onClick={voz.interromper}>Interromper</Button>}
              <Button type="button" variant="outline" className="assistente-encerrar" onClick={voz.encerrar}>Encerrar</Button>
            </>}
          </div>
          {!voz.suportado && <p>Este navegador não oferece gravação por voz. Use texto ou envie um arquivo de áudio.</p>}
          <p className="assistente-privacidade">Voz gerada por IA. Áudio e respostas faladas, inclusive valores autorizados, são processados pela OpenAI. Acesso ao microfone somente ao iniciar.</p>
          {erroMidia && <p role="alert" className="text-destructive">{erroMidia}</p>}
        </section>}
        {config && !carregandoConfig && !modoVoz && <>
          {mensagens.length === 0 && <div className="assistente-boas-vindas"><h3>O que você quer consultar?</h3><p>Escreva sua dúvida, envie um print ou converse por voz. Cada resposta mostra a fonte para conferir.</p>
            {config.consultas.length > 0 && <div className="assistente-sugestoes">{CONSULTAS.filter(c => config.consultas.includes(c.visao)).slice(0, 2).map(c => <Button key={c.visao} variant="outline" size="sm" disabled={bloqueado} onClick={() => { void enviar({ consulta: { visao: c.visao, inicio: null, fim: null } }, c.pergunta); }}>{c.titulo}</Button>)}</div>}
          </div>}
          <div className="assistente-apoio"><button ref={apoioToggleRef} type="button" className="assistente-apoio-toggle" aria-expanded={apoioAberto} aria-controls="assistente-catalogo" onClick={() => setApoioAberto(v => !v)}><BookOpen size={16} aria-hidden />Consultas e guias<ChevronDown size={14} aria-hidden /></button>
            <div id="assistente-catalogo" className="assistente-catalogo" hidden={!apoioAberto}><p>Somente consultas e guias permitidos ao seu perfil, no sítio {config.escopo.nome}.</p>
              {config.consultas.length > 0 && <section aria-label="Consultas rápidas"><h4>Consultas rápidas</h4><div className="assistente-sugestoes">{CONSULTAS.filter(c => config.consultas.includes(c.visao)).map(c => <Button key={c.visao} variant="outline" size="sm" disabled={bloqueado} onClick={() => { void enviar({ consulta: { visao: c.visao, inicio: null, fim: null } }, c.pergunta); }}>{c.titulo}</Button>)}</div></section>}
              {config.artigos.length > 0 && <section aria-label="Guias de uso"><h4>Guias de uso</h4><div className="assistente-lista-guias">{config.artigos.map(a => <Button key={a.id} type="button" variant="ghost" disabled={bloqueado} onClick={() => { void enviar({ artigoId: a.id }, a.titulo); }}>{a.titulo}</Button>)}</div></section>}
            </div>
          </div>
        </>}
        <div role="log" aria-label="Conversa com o assistente" aria-live="polite" aria-relevant="additions text" className="space-y-5">
          {mensagens.map((m, i) => <div key={i} className="space-y-3">
            <p className="assistente-pergunta">{m.pergunta}</p>
            {m.print && <img src={m.print.dataUrl} alt="Print enviado junto da pergunta" className="ml-auto max-h-40 max-w-[80%] rounded-xl border border-border object-contain" />}
            {m.resposta && <div className="assistente-resposta"><div className="assistente-autor"><MessageCircle size={16} aria-hidden />Terrano</div><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.resposta.resposta}</p>
              {m.resposta.fontes.length > 0 && <details className="assistente-fontes"><summary>Conferir fontes</summary><div>{m.resposta.fontes.map(f => <Button key={f.url} type="button" variant="ghost" onClick={() => { mudarAberto(false); navegarPara(f.url); }}>{f.titulo}<ArrowUpRight size={15} aria-hidden /></Button>)}</div></details>}
              <p className="mt-3 text-[11px] text-muted-foreground">{m.resposta.escopo.nome} · {m.resposta.modo === "dados" ? "Consultado" : "Respondido"} às {new Date(m.resposta.consultadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>}
            {m.erro && <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{m.erro}</p>}
          </div>)}
          {ocupado && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={16} aria-hidden />Consultando…</p>}
          <div ref={fimRef} />
        </div>
      </div>
      {!modoVoz && <form className="assistente-rodape" onSubmit={e => { e.preventDefault(); enviarPergunta(); }}>
        {config && !config.conversaDisponivel && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">A conversa com IA ainda não está configurada. As consultas rápidas e os guias de uso já estão disponíveis.</p>}
        <label htmlFor="pergunta-assistente" className="sr-only">Sua pergunta sobre o Terrano</label>
        {print && <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-muted p-2"><img src={print.dataUrl} alt="Prévia do print" className="h-14 w-16 rounded object-contain" /><span className="min-w-0 flex-1 truncate text-xs">{print.nome}</span><Button type="button" variant="ghost" size="icon" disabled={bloqueado} aria-label="Remover print" onClick={() => setPrint(null)}><X size={16} /></Button></div>}
        {erroMidia && <p role="alert" className="mb-3 text-xs text-destructive">{erroMidia}</p>}
        {(audio.ocupado || preparandoPrint) && <div role="status" className="mb-3 flex items-center justify-between gap-2 text-sm text-muted-foreground"><span>{audio.gravando ? `Gravando · ${audio.segundos}s / 60s` : audio.transcrevendo ? "Transcrevendo áudio…" : audio.preparando ? "Aguardando microfone…" : "Preparando print…"}</span>{audio.ocupado && <Button type="button" variant="ghost" size="sm" onClick={audio.cancelar} aria-label="Descartar áudio">Descartar</Button>}</div>}
        <div className="assistente-compositor"><Textarea id="pergunta-assistente" ref={inputRef} value={input} maxLength={2000} rows={2} disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} onChange={e => setInput(e.target.value)} onPaste={e => {
          const arquivo = [...e.clipboardData.items].find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
          if (arquivo) { e.preventDefault(); void anexarPrint(arquivo); }
        }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); enviarPergunta(); } }} placeholder="Pergunte sobre o Terrano…" className="min-h-16 resize-none text-sm" />
        <input ref={printRef} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Selecionar print" className="hidden" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void anexarPrint(arquivo); }} />
        <input ref={audioRef} type="file" accept="audio/*,.m4a,.webm" aria-label="Selecionar arquivo de áudio" className="hidden" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo && !bloqueado && config?.conversaDisponivel) { setErroMidia(null); void audio.enviarArquivo(arquivo); } }} />
        <div className="assistente-ferramentas">
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} aria-label="Anexar print" onClick={() => printRef.current?.click()} className="gap-1.5 px-2 text-xs"><ImagePlus size={15} aria-hidden />Anexar print</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || ocupado || carregandoConfig || preparandoPrint || audio.preparando || audio.transcrevendo || !audio.suportado} aria-label={audio.gravando ? "Parar e transcrever áudio" : "Gravar áudio"} onClick={() => { setErroMidia(null); if (audio.gravando) audio.parar(); else void audio.iniciar(); }} className="gap-1.5 px-2 text-xs">{audio.gravando ? <Square size={14} aria-hidden /> : <Mic size={15} aria-hidden />}{audio.gravando ? "Parar" : "Ditar"}</Button>
          <Button type="button" variant="ghost" size="sm" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig} aria-label="Enviar arquivo de áudio" onClick={() => audioRef.current?.click()} className="gap-1.5 px-2 text-xs"><AudioLines size={15} aria-hidden />Áudio</Button>
          <Button type="submit" size="sm" className="assistente-enviar" disabled={!config?.conversaDisponivel || bloqueado || carregandoConfig || (!input.trim() && !print)} aria-label="Enviar pergunta"><Send size={16} aria-hidden />Enviar</Button>
        </div></div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Somente consulta · conversa não salva. Áudio e prints enviados são processados pela IA. Revise a transcrição antes de enviar a pergunta.</p>
      </form>}
    </SheetContent>
  </Sheet>;
}
