/* Rio Novo — IA conversacional (chat + voz + memória + simulador) */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney, MiniBarChart } from "./charts";
import { ActivityPill } from "./Gastos";
import { Simulador } from "./Simulador";
import { buildFolego, buildProjecaoLeite } from "../data/projecao";
import * as memoria from "../data/memoria";
import type { Conversa } from "../data/memoria";

/* ===== Reconhecimento de voz (Web Speech API, pt-BR) ===== */
function useSpeechRecognition({ onResult, onFinal }: { onResult?: (t: string) => void; onFinal?: (t: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supported = !!SR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const [listening, setListening] = useState(false);

  const start = () => {
    if (!supported) return;
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      onResult && onResult((finalText + " " + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) onFinal && onFinal(finalText.trim());
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stop = () => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    setListening(false);
  };

  return { supported, listening, start, stop };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseTopGasto({ resp }: { resp: any }) {
  return (
    <div className="ai-card">
      <div className="ai-card-title">{resp.table.title}</div>
      <table className="ai-mini-table">
        <thead>
          <tr>
            {resp.table.cols.map((c: string, i: number) => (
              <th key={i} className={i === resp.table.cols.length - 1 ? "r" : ""}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resp.table.rows.map((row: string[], i: number) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={j === row.length - 1 ? "r" : ""}>
                  {j === 1 && cell.includes("*invest.*") ? (
                    <>
                      {cell.replace(" *invest.*", "")} <span className="invest-tag">Invest.</span>
                    </>
                  ) : j === 2 ? (
                    <ActivityPill
                      atv={
                        cell.toLowerCase() === "café"
                          ? "cafe"
                          : cell.toLowerCase() === "leite"
                            ? "leite"
                            : "outros"
                      }
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {resp.foot && <div className="caption" style={{ fontStyle: "italic" }}>{resp.foot}</div>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseKpi({ resp }: { resp: any }) {
  return (
    <div className="ai-card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32, alignItems: "center" }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {resp.kpi.caption}
          </div>
          <div
            style={{ fontFamily: "var(--serif)", fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}
            className="mono-nums"
          >
            {resp.kpi.value}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--neg)" }}>{resp.kpi.delta}</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Distribuição mensal
          </div>
          <MiniBarChart data={resp.chartData} color="var(--cafe)" />
        </div>
      </div>
      {resp.foot && (
        <div className="caption" style={{ fontStyle: "italic", marginTop: 8 }}>
          {resp.foot}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseYesNo({ resp }: { resp: any }) {
  return (
    <div className="ai-card">
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
        <div style={{ paddingRight: 24, borderRight: "1px solid var(--rule)" }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Veredito
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1, color: "var(--pos)" }}>
            {resp.yesno.verdict}
          </div>
          <div
            style={{ fontFamily: "var(--serif)", fontSize: 24, color: "var(--pos)", marginTop: 8 }}
            className="mono-nums"
          >
            {resp.yesno.folga}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {resp.yesno.caption}
          </div>
          <table className="ai-mini-table">
            <tbody>
              {resp.breakdown.map(([label, val]: [string, number], i: number) => (
                <tr key={i}>
                  <td>{label}</td>
                  <td
                    className="r"
                    style={{
                      color: val < 0 ? "var(--neg)" : "var(--ink)",
                      fontWeight: i === resp.breakdown.length - 1 ? 500 : 400,
                      fontSize: i === resp.breakdown.length - 1 ? 18 : 14,
                    }}
                  >
                    {val < 0 ? "−" : "+"}
                    {fmtMoney(Math.abs(val))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseCompare({ resp }: { resp: any }) {
  return (
    <div className="ai-card">
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto", gap: 24, alignItems: "end" }}>
        {resp.compare.map(
          (c: { label: string; value: string; sub: string }, i: number) => (
            <Fragment key={i}>
              {i > 0 && (
                <div
                  style={{
                    paddingBottom: 18,
                    fontFamily: "var(--serif)",
                    fontStyle: "italic",
                    color: "var(--ink-mute)",
                  }}
                >
                  →
                </div>
              )}
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>
                  {c.label}
                </div>
                <div
                  style={{ fontFamily: "var(--serif)", fontSize: 32, lineHeight: 1, letterSpacing: "-0.01em" }}
                  className="mono-nums"
                >
                  {c.value}
                </div>
                <div className="caption" style={{ marginTop: 6 }}>
                  {c.sub}
                </div>
              </div>
            </Fragment>
          ),
        )}
        <div style={{ paddingBottom: 4 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Variação
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--neg)" }}>{resp.delta}</div>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseSplit({ resp }: { resp: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const total = Math.abs(resp.split.reduce((s: number, x: any) => s + x.value, 0));
  return (
    <div className="ai-card">
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        Fluxo líquido YTD 2026: −R$ 4,00 mi
      </div>
      <div style={{ display: "flex", height: 56, border: "1px solid var(--rule)" }}>
        {resp.split.map(
          (s: { share: number; value: number }, i: number) => (
            <div
              key={i}
              style={{
                width: `${(Math.abs(s.value) / total) * 100}%`,
                background: i === 0 ? "var(--cafe)" : "var(--outros)",
                opacity: i === 1 ? 0.6 : 1,
                color: "var(--mast-ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--serif)",
                fontSize: 16,
                position: "relative",
              }}
            >
              <span style={{ color: "var(--mast-ink)", textShadow: "0 1px 1px rgba(0,0,0,0.2)" }}>{s.share}%</span>
            </div>
          ),
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 16 }}>
        {resp.split.map((s: { label: string; value: number }, i: number) => (
          <div key={i}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              <span
                className="legend-dot"
                style={{
                  background: i === 0 ? "var(--cafe)" : "var(--outros)",
                  opacity: i === 1 ? 0.6 : 1,
                }}
              ></span>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 28 }} className="mono-nums">
              {fmtMoney(s.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseVet({ resp }: { resp: any }) {
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="ai-card">
        <div className="ai-card-title">Protocolo de triagem — bezerro abatido</div>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.6, color: "var(--ink)" }}>
          {resp.triagem.map((t: string, i: number) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {t}
            </li>
          ))}
        </ol>
      </div>
      <div className="ai-card">
        <div className="ai-card-title">Conduta por cenário</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {resp.cenarios.map(
            (c: { quando: string; protocolo: string }, i: number) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "180px 1fr",
                  gap: 18,
                  paddingBottom: 14,
                  borderBottom: i < resp.cenarios.length - 1 ? "1px solid var(--rule-soft)" : "none",
                }}
              >
                <div style={{ fontFamily: "var(--serif)", fontSize: 15, color: "var(--ink)" }}>{c.quando}</div>
                <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.55 }}>{c.protocolo}</div>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="alert-card pos" style={{ background: "var(--bg-card)" }}>
        <div className="stripe"></div>
        <div className="body-col">
          <span className="eyebrow">Estoque consultado</span>
          <div
            className="alert-title"
            style={{ fontSize: 15, fontFamily: "var(--sans)", fontWeight: 400 }}
          >
            {resp.estoque}
          </div>
        </div>
        <button className="alert-cta">Registrar uso →</button>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponse({ resp }: { resp: any }) {
  return (
    <>
      <div className="ai-signature">
        <span className="dot"></span>
        <span>Rio Novo · IA analista</span>
        <span style={{ color: "var(--ink-mute)" }}>· 0,8 s</span>
      </div>
      <div className="ai-narrative">{resp.narrative}</div>
      {resp.kind === "topGasto" && <AIResponseTopGasto resp={resp} />}
      {resp.kind === "kpi" && <AIResponseKpi resp={resp} />}
      {resp.kind === "yesno" && <AIResponseYesNo resp={resp} />}
      {resp.kind === "compare" && <AIResponseCompare resp={resp} />}
      {resp.kind === "split" && <AIResponseSplit resp={resp} />}
      {resp.kind === "vet" && <AIResponseVet resp={resp} />}
    </>
  );
}

type Msg =
  | { role: "user"; content: string }
  | { role: "ai"; kind: "intro" | "text"; content: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { role: "ai"; kind: "response"; resp: any }
  | { role: "ai"; kind: "recall"; recall: Conversa };

export function IA() {
  const [iaMode, setIaMode] = useState<"conversa" | "simulador">("conversa");
  const mem = useRef(memoria.load());
  const [, setMemTick] = useState(0); // força re-render ao mudar memória
  // R augmentado com os derivados que o Simulador usa (folego, projecaoLeite)
  const simR = useMemo(() => ({ ...R, folego: buildFolego(R), projecaoLeite: buildProjecaoLeite(R) }), []);

  const [thread, setThread] = useState<Msg[]>(() => {
    const m = mem.current;
    const pend = m.pendencias && m.pendencias[0];
    return [
      {
        role: "ai",
        kind: "intro",
        content: `Bem-vindo de volta, Marco. Lembro das nossas últimas conversas — leite, a reforma do curral e a folha. ${
          pend ? `Ainda ficou pendente: ${pend.texto.toLowerCase()}.` : ""
        } Pode continuar de onde paramos ou perguntar algo novo.`,
      },
    ];
  });
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const baseInputRef = useRef("");

  const speech = useSpeechRecognition({
    onResult: (text) => setInput((baseInputRef.current ? baseInputRef.current + " " : "") + text),
    onFinal: (text) => {
      const full = ((baseInputRef.current ? baseInputRef.current + " " : "") + text).trim();
      baseInputRef.current = "";
      if (full) setTimeout(() => ask(full), 250);
    },
  });

  const toggleMic = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      baseInputRef.current = input.trim();
      speech.start();
    }
  };

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread, typing]);

  const ask = (q: string) => {
    setThread((t) => [...t, { role: "user", content: q }]);
    setInput("");
    setTyping(true);

    // memória: a IA lembra de conversa anterior relacionada
    const lembrada = memoria.recall(mem.current, q);

    setTimeout(() => {
      if (lembrada) {
        setThread((t) => [...t, { role: "ai", kind: "recall", recall: lembrada }]);
      }
      const resp = R.iaRespostas[q];
      if (resp) {
        setThread((t) => [...t, { role: "ai", kind: "response", resp }]);
      } else {
        setThread((t) => [
          ...t,
          {
            role: "ai",
            kind: "text",
            content: lembrada
              ? "Seguindo a linha da nossa conversa anterior, vou cruzar os lançamentos atualizados e te trago o número."
              : "Captei a pergunta. Vou voltar com os números relevantes — me dê um instante para cruzar os lançamentos.",
          },
        ]);
      }
      // registra a nova conversa na memória
      const novaConv: Conversa = {
        id: "c" + mem.current.conversas.length + "-" + q.slice(0, 8),
        data: "hoje",
        titulo: q.length > 42 ? q.slice(0, 42) + "…" : q,
        resumo: "Pergunta registrada nesta sessão.",
        topicos: ["leite", "custeio", "curral", "café", "ração", "investimento", "pessoal"].filter((tp) => q.toLowerCase().includes(tp)),
      };
      mem.current.conversas = [novaConv, ...mem.current.conversas].slice(0, 12);
      memoria.save(mem.current);
      setMemTick((x) => x + 1);
      setTyping(false);
    }, 700);
  };

  const limparMemoria = () => {
    mem.current = memoria.reset();
    setMemTick((x) => x + 1);
  };

  return (
    <div className="shell-wide">
      <ReportHeader subtitle="IA — pergunte sobre seus números" updatedAt={R.UPDATED_AT} />

      <div className="ia-mode-switch">
        <button className={"ia-mode-btn " + (iaMode === "conversa" ? "active" : "")} onClick={() => setIaMode("conversa")}>
          Conversa
        </button>
        <button className={"ia-mode-btn " + (iaMode === "simulador" ? "active" : "")} onClick={() => setIaMode("simulador")}>
          Simulador de cenários
        </button>
      </div>

      {iaMode === "simulador" ? (
        <Simulador R={simR} />
      ) : (
        <div className="ia-layout">
          {/* Esquerda: perguntas frequentes + conversas */}
          <aside className="ia-sidebar">
            <h4>Perguntas frequentes</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {R.promptsSugeridos.map((p: string, i: number) => (
                <button key={i} className="ia-prompt" onClick={() => ask(p)}>
                  "{p}"
                </button>
              ))}
            </div>
            <div style={{ marginTop: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h4 style={{ marginBottom: 10 }}>Conversas anteriores</h4>
                <button className="mem-clear" onClick={limparMemoria} title="Limpar memória">
                  limpar
                </button>
              </div>
              <div className="mem-convos">
                {mem.current.conversas.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    className="mem-convo"
                    onClick={() => c.topicos[0] && ask(`Sobre ${c.topicos[0]}, o que ficou da nossa conversa?`)}
                  >
                    <span className="mc-data">{c.data}</span>
                    <span className="mc-titulo">{c.titulo}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Centro: thread */}
          <div className="ia-main">
            <div className="ia-thread" ref={threadRef}>
              {thread.map((m, i) => (
                <div key={i} className={"msg " + m.role}>
                  {m.role === "user" && <div className="bubble">{m.content}</div>}
                  {m.role === "ai" && m.kind === "intro" && (
                    <>
                      <div className="ai-signature">
                        <span className="dot"></span>
                        <span>Rio Novo · IA analista</span>
                      </div>
                      <p>{m.content}</p>
                    </>
                  )}
                  {m.role === "ai" && m.kind === "text" && (
                    <>
                      <div className="ai-signature">
                        <span className="dot"></span>
                        <span>Rio Novo · IA analista</span>
                      </div>
                      <p>{m.content}</p>
                    </>
                  )}
                  {m.role === "ai" && m.kind === "recall" && (
                    <div className="mem-recall">
                      <div className="mem-recall-head">
                        <span className="mem-recall-icon">↺</span>Lembrando de {m.recall.data}
                      </div>
                      <div className="mem-recall-titulo">{m.recall.titulo}</div>
                      <div className="mem-recall-resumo">{m.recall.resumo}</div>
                    </div>
                  )}
                  {m.role === "ai" && m.kind === "response" && <AIResponse resp={m.resp} />}
                </div>
              ))}
              {typing && (
                <div className="msg ai">
                  <div className="ai-signature" style={{ color: "var(--ink-mute)" }}>
                    <span className="dot" style={{ background: "var(--ink-mute)" }}></span>
                    <span>Cruzando lançamentos…</span>
                  </div>
                </div>
              )}
            </div>

            <div className="ia-composer">
              <div className={"ia-composer-inner " + (speech.listening ? "is-listening" : "")}>
                <textarea
                  className="ia-input"
                  placeholder={speech.listening ? "Ouvindo… pode falar" : "Pergunte sobre os números da fazenda…"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim()) ask(input.trim());
                    }
                  }}
                  rows={1}
                />
                <div className="ia-composer-row">
                  <div className="ia-scope-pill">
                    <span className="dot"></span>
                    Escopo: tudo · {R.iaScope.periodo}
                  </div>
                  {speech.supported && (
                    <button
                      className={"ia-mic " + (speech.listening ? "listening" : "")}
                      onClick={toggleMic}
                      title={speech.listening ? "Parar de gravar" : "Falar com a IA"}
                      aria-label={speech.listening ? "Parar de gravar" : "Falar com a IA"}
                    >
                      {speech.listening ? (
                        <span className="mic-eq" aria-hidden="true">
                          <i></i>
                          <i></i>
                          <i></i>
                          <i></i>
                        </span>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <rect x="9" y="2" width="6" height="12" rx="3"></rect>
                          <path d="M5 11a7 7 0 0 0 14 0"></path>
                          <line x1="12" y1="18" x2="12" y2="22"></line>
                          <line x1="8" y1="22" x2="16" y2="22"></line>
                        </svg>
                      )}
                    </button>
                  )}
                  <button className="ia-send" disabled={!input.trim()} onClick={() => input.trim() && ask(input.trim())}>
                    {speech.listening ? "Ouvindo…" : "Perguntar"}
                  </button>
                </div>
              </div>
              {speech.listening && (
                <div className="ia-mic-hint">
                  <span className="rec-dot"></span> Gravando — falo e a pergunta é enviada quando você parar.
                </div>
              )}
            </div>
          </div>

          {/* Direita: memória + escopo de dados */}
          <aside className="ia-context">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h4>O que a IA lembra de você</h4>
              </div>
              <div className="mem-fatos">
                {mem.current.fatos.map((f) => (
                  <div key={f.id} className="mem-fato">
                    <span className="mf-dot"></span>
                    <span className="mf-txt">{f.texto}</span>
                  </div>
                ))}
              </div>
              {mem.current.pendencias.length > 0 && (
                <div className="mem-pend">
                  <span className="mem-pend-head">Acompanhamentos pendentes</span>
                  {mem.current.pendencias.map((p) => (
                    <button key={p.id} className="mem-pend-item" onClick={() => ask(p.texto)}>
                      <span className="mp-icon">↻</span>
                      <span className="mp-txt">
                        {p.texto}
                        <small>{p.deOnde}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18 }}>
              <h4>Escopo de dados</h4>
              <div className="ctx-list" style={{ marginTop: 12 }}>
                <div className="row">
                  <span>Período</span>
                  <span className="v" style={{ marginLeft: "auto" }}>{R.iaScope.periodo}</span>
                </div>
                <div className="row">
                  <span>Lançamentos</span>
                  <span className="v" style={{ marginLeft: "auto" }}>8.412</span>
                </div>
                <div className="row">
                  <span>Notas fiscais</span>
                  <span className="v" style={{ marginLeft: "auto" }}>6.130</span>
                </div>
                <div className="row">
                  <span>Categorias</span>
                  <span className="v" style={{ marginLeft: "auto" }}>184</span>
                </div>
                <div className="row">
                  <span>Fornecedores</span>
                  <span className="v" style={{ marginLeft: "auto" }}>312</span>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18 }}>
              <h4>Filtros ativos</h4>
              <div className="row-wrap" style={{ marginTop: 10 }}>
                <span className="filter-chip">
                  <span className="chip-label">Período</span> Tudo
                </span>
                <span className="filter-chip">
                  <span className="chip-label">Atividade</span> Todas
                </span>
                <span className="filter-chip">
                  <span className="chip-label">Pilha</span> Tudo
                </span>
              </div>
              <div className="caption" style={{ marginTop: 12, lineHeight: 1.55, fontStyle: "italic" }}>
                A IA usa todos os dados visíveis acima. Restringir o escopo aqui afeta as respostas.
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18 }}>
              <h4>Conhecimento adicional</h4>
              <div className="ctx-list" style={{ marginTop: 10, gap: 6 }}>
                <div>· Protocolos veterinários (gado leiteiro)</div>
                <div>· Manejo café arábica</div>
                <div>· Cotação leite + saca CEPEA</div>
                <div>· Calendário fiscal rural</div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
