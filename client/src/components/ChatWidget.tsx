/* Chat flutuante do assistente — botão no canto que abre uma janelinha de
 * conversa com a IA. Gera um id de sessão aleatório (mantém contexto entre
 * perguntas) e tem um botão de resetar a sessão ao lado. Fala com POST /api/bot/ask.
 */

import { useEffect, useRef, useState } from "react";
import { askBot } from "../api";

type Msg = { role: "user" | "bot"; content: string; tools?: string[] };

const novaSessao = () =>
  `web-${(crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 8)}`;

const SUGESTOES = [
  "Qual o saldo das contas?",
  "Gastos de maio/2026 por categoria",
  "Por que meu custo com pessoal varia?",
];

// Formata **negrito** e deep-links [rótulo](/caminho?filtros) de forma segura (sem
// innerHTML), preservando quebras de linha. Os links internos viram botões que chamam
// onNavegar (navegação in-app + filtros) em vez de <a href> (que recarregaria a página).
const TOKEN = /(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)]+\))/g;
const LINK = /^\[([^\]]+)\]\((\/[^)]+)\)$/;

export function Formatado({ texto, onNavegar }: { texto: string; onNavegar?: (url: string) => void }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <span key={i} className="chat-line">
          {linha.split(TOKEN).map((parte, j) => {
            if (parte.startsWith("**") && parte.endsWith("**")) {
              return <strong key={j}>{parte.slice(2, -2)}</strong>;
            }
            const link = LINK.exec(parte);
            if (link) {
              const [, rotulo, url] = link;
              return onNavegar ? (
                <button key={j} type="button" className="chat-inline-link" onClick={() => onNavegar(url)}>
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

export function ChatWidget({ onNavegar }: { onNavegar?: (url: string) => void } = {}) {
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

  return (
    <>
      {!aberto && (
        <button className="chat-fab" onClick={() => setAberto(true)} aria-label="Abrir chat com a IA">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
              fill="currentColor"
            />
          </svg>
          <span className="chat-fab-label">Assistente</span>
        </button>
      )}

      {aberto && (
        <div className={`chat-panel${expandido ? " expandido" : ""}`} role="dialog" aria-label="Chat com a IA da fazenda">
          <header className="chat-head">
            <div className="chat-id">
              <span className="chat-title serif">Assistente</span>
              <span className="chat-session" title="Identificador da sessão (contexto da conversa)">
                #{sessao.replace("web-", "")}
              </span>
            </div>
            <div className="chat-head-actions">
              <button
                className="chat-icon-btn"
                onClick={() => setExpandido((v) => !v)}
                title={expandido ? "Recolher" : "Expandir"}
                aria-label={expandido ? "Recolher chat" : "Expandir chat"}
              >
                {expandido ? "⤡" : "⤢"}
              </button>
              <button className="chat-icon-btn" onClick={resetar} title="Resetar sessão (nova conversa)" aria-label="Resetar sessão">
                ↻
              </button>
              <button className="chat-icon-btn" onClick={() => setAberto(false)} title="Fechar" aria-label="Fechar chat">
                ✕
              </button>
            </div>
          </header>

          <div className="chat-msgs">
            {msgs.length === 0 && !loading && (
              <div className="chat-empty">
                <p className="chat-empty-h serif">Oi! Sou o assistente 🐄</p>
                <p className="chat-empty-s">Pergunte sobre as finanças e o rebanho da fazenda.</p>
                <div className="chat-suggest">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                <div className="chat-bubble">
                  <Formatado texto={m.content} onNavegar={onNavegar} />
                </div>
                {m.tools && m.tools.length > 0 && (
                  <div className="chat-tools">via {Array.from(new Set(m.tools)).join(" · ")}</div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-msg bot">
                <div className="chat-bubble chat-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div className="chat-input-row">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pergunte ao assistente…  (Enter envia, Shift+Enter quebra linha)"
              rows={1}
            />
            <button className="chat-send" onClick={enviar} disabled={loading || !input.trim()} aria-label="Enviar">
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
