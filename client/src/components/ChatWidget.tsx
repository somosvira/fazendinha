/* Chat flutuante do assistente — botão no canto que abre uma janelinha de
 * conversa com a IA. Gera um id de sessão aleatório (mantém contexto entre
 * perguntas) e tem um botão de resetar a sessão ao lado. Fala com POST /api/bot/ask.
 *
 * Fase 4 (IA/Chat) slice A: migrado p/ Tailwind + ui/Textarea. Estética própria
 * do chat preservada 1:1 (cantos arredondados, gradiente do masthead, bolhas
 * brass/creme, transição compacto↔drawer). chat.css aposentado inteiro. */

import { useEffect, useRef, useState } from "react";
import { askBot } from "../api";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "bot"; content: string; tools?: string[] };

const novaSessao = () =>
  `web-${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8)}`;

const SUGESTOES = [
  "Qual o saldo das contas?",
  "Gastos de maio/2026 por categoria",
  "Por que meu custo com pessoal varia?",
];

const ICON_BTN =
  "grid h-7 w-7 place-items-center rounded-lg border border-[rgba(168,160,137,0.25)] bg-transparent text-sm text-[color:var(--mast-ink-2)] transition-colors hover:border-leite hover:bg-[rgba(184,154,92,0.12)] hover:text-[color:var(--mast-ink)]";

// Deep-link inline da IA: botão com cara de link (não é <a href> — recarregaria a página).
const LINK_INLINE =
  "cursor-pointer border-0 bg-transparent p-0 font-[inherit] text-[color:var(--leite,#c8a24a)] underline underline-offset-2 hover:no-underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--leite,#c8a24a)]";

// Formata **negrito** e deep-links [rótulo](/caminho?filtros) de forma segura (sem
// innerHTML), preservando quebras de linha. Links internos viram botões que chamam
// onNavegar (navegação in-app + filtros).
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)]+\))/g;
const LINK = /^\[([^\]]+)\]\((\/[^)]+)\)$/;

export function Formatado({ texto, onNavegar }: { texto: string; onNavegar?: (url: string) => void }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <span key={i} className="block min-h-px">
          {linha.split(TOKEN).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return <strong key={j}>{parte.slice(2, -2)}</strong>;
            }
            const link = LINK.exec(parte);
            if (link) {
              const [, rotulo, url] = link;
              return onNavegar ? (
                <button key={j} type="button" className={LINK_INLINE} onClick={() => onNavegar(url)}>
                  {rotulo}
                </button>
              ) : (
                <span key={j}>{rotulo}</span>
              );
            }
            return <span key={j}>{parte}</span>;
          })}
        </span>
      ))}
    </>
  );
}

export function ChatWidget({
  oculto = false,
  onNavegar,
}: { oculto?: boolean; onNavegar?: (url: string) => void } = {}) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [sessao, setSessao] = useState(novaSessao);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (aberto) fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading, aberto]);

  useEffect(() => {
    if (aberto) inputRef.current?.focus();
  }, [aberto]);

  function resetar() {
    setSessao(novaSessao());
    setMsgs([]);
    setInput("");
    setLoading(false);
    inputRef.current?.focus();
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: texto }]);
    setLoading(true);
    try {
      const r = await askBot(texto, sessao);
      setMsgs((m) => [...m, { role: "bot", content: r.resposta, tools: r.toolsUsadas }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "bot", content: `⚠️ ${e instanceof Error ? e.message : "Erro ao falar com o assistente."}` }]);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  const bubbleBase = "rounded-2xl px-[13px] py-[9px] leading-[1.5]";

  // Na aba de IA já existe um chat em tela cheia; esconder o widget flutuante
  // evita dois assistentes competindo na mesma tela.
  if (oculto) return null;

  return (
    <>
      {!aberto && (
        <button
          className="fixed bottom-6 right-6 z-[1000] inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-[linear-gradient(160deg,var(--mast-bg-2),var(--mast-bg))] py-3 pl-3.5 pr-[18px] font-serif text-base text-[color:var(--mast-ink)] shadow-[0_6px_20px_rgba(14,19,17,0.28)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(14,19,17,0.34)] [&_svg]:text-leite-2"
          onClick={() => setAberto(true)}
          aria-label="Abrir chat com a IA"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
              fill="currentColor"
            />
          </svg>
          <span className="tracking-[0.02em]">Assistente</span>
        </button>
      )}

      {aberto && (
        <div
          className={cn(
            "fixed z-[1000] flex flex-col overflow-hidden border border-border bg-card transition-[width,height,border-radius] duration-[180ms]",
            expandido
              ? "inset-y-0 right-0 h-screen max-h-screen w-[clamp(420px,42vw,760px)] rounded-none border-y-0 border-r-0"
              : "bottom-6 right-6 h-[560px] max-h-[calc(100vh-48px)] w-[380px] max-w-[calc(100vw-32px)] rounded-2xl shadow-[0_18px_50px_rgba(14,19,17,0.30)]",
          )}
          role="dialog"
          aria-label="Chat com a IA da fazenda"
        >
          <header className="flex items-center justify-between bg-[linear-gradient(160deg,var(--mast-bg-2),var(--mast-bg))] px-3.5 py-3 text-[color:var(--mast-ink)]">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[19px] text-[color:var(--mast-ink)]">Assistente</span>
              <span
                className="font-sans text-[11px] tracking-[0.04em] text-[color:var(--mast-ink-2)]"
                title="Identificador da sessão (contexto da conversa)"
              >
                #{sessao.replace("web-", "")}
              </span>
            </div>
            <div className="flex gap-1.5">
              <button
                className={ICON_BTN}
                onClick={() => setExpandido((v) => !v)}
                title={expandido ? "Recolher" : "Expandir"}
                aria-label={expandido ? "Recolher chat" : "Expandir chat"}
              >
                {expandido ? "⤡" : "⤢"}
              </button>
              <button className={ICON_BTN} onClick={resetar} title="Resetar sessão (nova conversa)" aria-label="Resetar sessão">
                ↻
              </button>
              <button className={ICON_BTN} onClick={() => setAberto(false)} title="Fechar" aria-label="Fechar chat">
                ✕
              </button>
            </div>
          </header>

          <div className={cn("flex flex-1 flex-col gap-3 overflow-y-auto", expandido ? "px-[22px] py-5" : "px-3.5 py-4")}>
            {msgs.length === 0 && !loading && (
              <div className="my-auto p-2.5 text-center">
                <p className="m-0 mb-1 font-serif text-xl text-foreground">Oi! Sou o assistente 🐄</p>
                <p className="m-0 mb-3.5 text-[13px] text-ink-3">Pergunte sobre as finanças e o rebanho da fazenda.</p>
                <div className="flex flex-col gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      className="cursor-pointer rounded-[10px] border border-border bg-[color:var(--bg-card-2)] px-3 py-2 font-sans text-[13px] text-ink-2 transition-colors hover:border-leite hover:bg-[color:var(--leite-soft)]"
                      onClick={() => { setInput(s); inputRef.current?.focus(); }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div
                className={cn(
                  "flex flex-col",
                  expandido ? "max-w-[78%]" : "max-w-[88%]",
                  m.role === "user" ? "items-end self-end" : "items-start self-start",
                )}
                key={i}
              >
                <div
                  className={cn(
                    bubbleBase,
                    expandido ? "text-[14.5px]" : "text-sm",
                    m.role === "user"
                      ? "rounded-br-[4px] bg-leite text-white"
                      : "rounded-bl-[4px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] text-foreground",
                  )}
                >
                  <Formatado texto={m.content} onNavegar={onNavegar} />
                </div>
                {m.tools && m.tools.length > 0 && (
                  <div className="mt-1 text-[10.5px] tracking-[0.02em] text-[color:var(--ink-mute)]">
                    via {Array.from(new Set(m.tools)).join(" · ")}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex max-w-[88%] flex-col items-start self-start">
                <div className={cn(bubbleBase, "inline-flex items-center gap-1 border border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)]")}>
                  <span className="h-1.5 w-1.5 animate-[chat-bounce_1.2s_infinite_ease-in-out] rounded-full bg-[color:var(--ink-mute)]"></span>
                  <span className="h-1.5 w-1.5 animate-[chat-bounce_1.2s_infinite_ease-in-out] rounded-full bg-[color:var(--ink-mute)] [animation-delay:0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-[chat-bounce_1.2s_infinite_ease-in-out] rounded-full bg-[color:var(--ink-mute)] [animation-delay:0.3s]"></span>
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div className="flex items-end gap-2 border-t border-[color:var(--rule-soft)] bg-card px-3 py-2.5">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pergunte ao assistente…  (Enter envia, Shift+Enter quebra linha)"
              rows={1}
              className="max-h-[120px] min-h-0 resize-none rounded-[10px] border-border bg-background px-[11px] py-[9px] text-sm text-foreground focus-visible:border-leite focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm"
            />
            <button
              className="grid h-[38px] w-[38px] flex-shrink-0 cursor-pointer place-items-center rounded-[10px] border-0 bg-leite text-[15px] text-white transition-[background,opacity] hover:bg-leite-2 disabled:cursor-default disabled:opacity-45"
              onClick={enviar}
              disabled={loading || !input.trim()}
              aria-label="Enviar"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
