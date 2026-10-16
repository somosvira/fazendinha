import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Upload, RotateCcw, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { consultarAssistente, statusAssistente, transcreverAudio, type ContextoAssistente, type RespostaAssistente } from "../api/assistente";
import { useGravacao } from "./assistente/useGravacao";

type Mensagem = { pergunta: string; resposta: RespostaAssistente };
const SUGESTOES = ["Quanto saiu e quanto entrou este mês?", "Com o que mais gastamos este mês?", "Quanto ainda temos a pagar?", "Qual o saldo das contas?"];

export function IA({ onNavegar }: { onNavegar?: (url: string) => void }) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [contexto, setContexto] = useState<ContextoAssistente | null>(null);
  const [estado, setEstado] = useState<"pronto" | "consultando" | "transcrevendo">("pronto");
  const [configurado, setConfigurado] = useState<boolean | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [revisarAudio, setRevisarAudio] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const controle = useRef<AbortController | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const arquivoInput = useRef<HTMLInputElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ocupado = estado !== "pronto";

  useEffect(() => {
    const c = new AbortController(); setErro(null); setConfigurado(null);
    statusAssistente(c.signal).then(r => { if (!c.signal.aborted) setConfigurado(r.configurado); }).catch(e => {
      if (!c.signal.aborted) { setErro(e instanceof Error ? e.message : "Não foi possível verificar o assistente."); setConfigurado(false); }
    });
    return () => { c.abort(); controle.current?.abort(); };
  }, [tentativa]);
  useEffect(() => { fim.current?.scrollIntoView?.({ behavior: "smooth", block: "end" }); }, [mensagens, estado]);
  useEffect(() => { if (estado === "pronto" && revisarAudio && configurado) campo.current?.focus(); }, [estado, revisarAudio, configurado]);

  async function receberAudio(arquivo: File) {
    if (!arquivo.size || arquivo.size > 10 * 1024 * 1024) { setErro("Envie um áudio com até 10 MB."); return; }
    controle.current?.abort(); const c = new AbortController(); controle.current = c;
    setErro(null); setEstado("transcrevendo");
    try {
      const r = await transcreverAudio(arquivo, c.signal);
      if (!c.signal.aborted) { setPergunta(r.texto); setRevisarAudio(true); campo.current?.focus(); }
    } catch (e) { if (!c.signal.aborted) setErro(e instanceof Error ? e.message : "Não consegui entender o áudio."); }
    finally { if (!c.signal.aborted) setEstado("pronto"); }
  }
  const gravacao = useGravacao(receberAudio, setErro);
  const bloqueado = ocupado || gravacao.gravando || gravacao.solicitando || !configurado;

  async function enviar(texto = pergunta) {
    if (!texto.trim() || bloqueado) return;
    controle.current?.abort(); const c = new AbortController(); controle.current = c;
    setErro(null); setEstado("consultando");
    try {
      const resposta = await consultarAssistente(texto.trim(), contexto, c.signal);
      if (!c.signal.aborted) {
        setMensagens(m => [...m, { pergunta: texto.trim(), resposta }]);
        setContexto(resposta.contexto); setPergunta(""); setRevisarAudio(false);
      }
    } catch (e) { if (!c.signal.aborted) setErro(e instanceof Error ? e.message : "Não foi possível consultar."); }
    finally { if (!c.signal.aborted) { setEstado("pronto"); campo.current?.focus(); } }
  }
  function novaConversa() {
    controle.current?.abort(); gravacao.cancelar(); setEstado("pronto"); setMensagens([]);
    setContexto(null); setPergunta(""); setErro(null); setRevisarAudio(false); campo.current?.focus();
  }
  return <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-8 pt-20 min-[901px]:pt-8 sm:px-8" aria-labelledby="assistente-titulo">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Financeiro · Primeira versão</p><h1 id="assistente-titulo" className="font-serif text-3xl">Pergunte sobre a fazenda</h1><p className="mt-2 max-w-xl text-base text-muted-foreground">Escreva ou grave sua pergunta. Vou consultar os registros do sítio selecionado.</p></div>
      <Button variant="outline" disabled={!configurado} onClick={novaConversa}><RotateCcw className="h-4 w-4" /> Nova conversa</Button>
    </header>
    {configurado === null && <p role="status">Preparando o assistente…</p>}
    {configurado === false && <div className="rounded-xl border border-border bg-card p-5"><p>{erro ?? "O assistente ainda precisa ser configurado pelo responsável pelo sistema. Assim que estiver pronto, você poderá perguntar por texto ou áudio."}</p><Button className="mt-3" variant="outline" onClick={() => setTentativa(t => t + 1)}>Verificar novamente</Button></div>}
    {!mensagens.length && <div className="grid gap-3 sm:grid-cols-2" aria-label="Sugestões de perguntas">{SUGESTOES.map(s => <Button key={s} variant="outline" disabled={bloqueado} className="h-auto min-h-16 justify-start gap-3 whitespace-normal px-4 py-4 text-left text-base" onClick={() => { setPergunta(s); void enviar(s); }}><MessageCircle className="h-5 w-5 shrink-0" />{s}</Button>)}</div>}
    <div className="flex flex-col gap-6" aria-label="Conversa com o assistente">
      {mensagens.map((m, i) => <article key={i} className="space-y-3">
        <div className="ml-8 rounded-2xl bg-muted px-5 py-4"><p className="mb-1 text-xs font-semibold text-muted-foreground">Você</p><p className="whitespace-pre-wrap text-lg">{m.pergunta}</p></div>
        <div className="rounded-2xl border border-border bg-card px-5 py-5"><p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assistente financeiro</p><p className="whitespace-pre-wrap text-base leading-relaxed sm:text-lg">{m.resposta.resposta}</p>
          {!!m.resposta.fontes.length && <div className="mt-4 flex flex-wrap gap-2">{m.resposta.fontes.map((f, j) => <Button key={j} variant="outline" className="h-auto whitespace-normal text-left" onClick={() => onNavegar?.(f.url)}>{f.titulo}</Button>)}</div>}
        </div>
      </article>)}
      {ocupado && <p role="status" className="rounded-xl bg-muted p-4">{estado === "transcrevendo" ? "Ouvindo seu áudio…" : "Consultando os registros financeiros…"}</p>}
      <div ref={fim} />
    </div>
    <form className="rounded-2xl border border-border bg-card p-4 sm:p-5" onSubmit={e => { e.preventDefault(); void enviar(); }}>
      <label htmlFor="pergunta-financeira" className="mb-2 block text-base font-medium">O que você quer saber?</label>
      {revisarAudio && <p role="status" className="mb-2 text-sm text-muted-foreground">Confira o que eu ouvi. Você pode corrigir o texto antes de perguntar.</p>}
      <Textarea ref={campo} id="pergunta-financeira" value={pergunta} maxLength={2000} disabled={ocupado || gravacao.gravando || gravacao.solicitando || !configurado} onChange={e => setPergunta(e.target.value)} className="min-h-28 text-lg" placeholder="Ex.: quanto gastamos este mês?" />
      {gravacao.gravando && <p role="status" className="mt-3 text-base">Gravando… Fale sua pergunta e toque em “Concluir áudio”. Limite de um minuto.</p>}
      {gravacao.solicitando && <p role="status" className="mt-3">Aguardando acesso ao microfone…</p>}
      {erro && configurado && <p role="alert" className="mt-3 text-destructive">{erro}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        {gravacao.gravando ? <><Button type="button" size="lg" onClick={gravacao.parar}><Square className="h-5 w-5" /> Concluir áudio</Button><Button type="button" variant="outline" size="lg" onClick={gravacao.cancelar}>Descartar áudio</Button></>
          : <Button type="button" variant="outline" size="lg" disabled={bloqueado || !gravacao.suportado} onClick={() => { setErro(null); void gravacao.iniciar(); }}><Mic className="h-5 w-5" /> Gravar pergunta</Button>}
        <input ref={arquivoInput} type="file" accept="audio/*,.webm,.m4a,.mp4" aria-label="Arquivo de áudio" className="sr-only" disabled={bloqueado} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void receberAudio(f); }} />
        <Button type="button" variant="outline" size="lg" disabled={bloqueado} onClick={() => arquivoInput.current?.click()}><Upload className="h-5 w-5" /> Enviar áudio</Button>
        <Button type="submit" size="lg" disabled={bloqueado || !pergunta.trim()} className="sm:ml-auto"><Send className="h-5 w-5" /> Perguntar</Button>
      </div>
      {!gravacao.suportado && <p className="mt-3 text-sm text-muted-foreground">A gravação não está disponível neste navegador. Você pode enviar um arquivo de áudio ou digitar.</p>}
      <p className="mt-4 text-sm text-muted-foreground">Consultas de caixa, contas e compromissos. O áudio é enviado para transcrição; não fica salvo no Fazendinha. A conversa é temporária e recomeça ao sair desta tela ou trocar de sítio.</p>
    </form>
  </section>;
}
