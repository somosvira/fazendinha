/* Rio Novo — IA conversacional (chat + voz + memória + simulador)
 *
 * Fase 4 (IA/Chat) slice B: layout, composer, mic, memória e cards de resposta
 * migrados p/ Tailwind. Classes ia-/msg/ai-/mic- (base.css) e
 * ia-mode-/mem- (simulador.css) aposentadas. Valores finais herdados da
 * typescale (ai-narrative 19, msg p/user 17, ia-input 17, mini-table 15).
 * Keyframes do mic (mic-pulse/mic-bar/mic-blink) ficam em base.css. */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import R from "../data/rionovo";
import { ReportHeader } from "./Shell";
import { fmtMoney, MiniBarChart } from "./charts";
import { ActivityPill } from "./Gastos";
import { Simulador } from "./Simulador";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { buildFolego, buildProjecaoLeite } from "../data/projecao";
import * as memoria from "../data/memoria";
import type { Conversa } from "../data/memoria";

const AI_CARD = "flex flex-col gap-4 border border-border bg-card px-6 py-[22px]";
const AI_CARD_TITLE = "font-serif text-xl tracking-[-0.005em]";
const AI_SIGNATURE = "flex items-center gap-2.5 text-[11px] uppercase tracking-[0.18em] text-ink-3";
const MINI_TABLE = "w-full border-collapse [&_td]:border-b [&_td]:border-[color:var(--rule-soft)] [&_td]:px-2.5 [&_td]:py-2 [&_td]:text-[15px] [&_th]:border-b [&_th]:border-[color:var(--rule-soft)] [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-ink-3 [&_td.r]:text-right [&_td.r]:font-serif [&_td.r]:tabular-nums [&_th.r]:text-right";

/* ===== Reconhecimento de voz (Web Speech API, pt-BR) =====
 * continuous=true + religa no onend enquanto o usuário não clicar em parar:
 * o motor encerra sozinho após uma pausa curta (era isso que "parava em ~1s").
 * Erros fatais (rede/permissão — ex.: Brave desliga a Web Speech API) deixam
 * de ser engolidos: viram uma mensagem para o usuário em vez de silêncio. */
function useSpeechRecognition({ onResult, onFinal }: { onResult?: (t: string) => void; onFinal?: (t: string) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const supported = !!SR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const wantOnRef = useRef(false); // usuário ainda quer ouvir (só false ao parar/erro fatal)
  const finalRef = useRef(""); // transcrição final acumulada na sessão atual
  const [listening, setListening] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const finalizar = () => {
    setListening(false);
    const t = finalRef.current.trim();
    if (t) onFinal && onFinal(t);
  };

  const start = () => {
    if (!supported) return;
    if (recRef.current) {
      try {
        recRef.current.onend = null; // evita religar a sessão antiga
        recRef.current.stop();
      } catch {
        /* noop */
      }
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    finalRef.current = "";
    wantOnRef.current = true;
    setErro(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalTxt = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTxt += t;
        else interim += t;
      }
      finalRef.current = finalTxt;
      onResult && onResult((finalTxt + " " + interim).trim());
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const code = e && e.error;
      // no-speech/aborted são transitórios → deixa o onend religar.
      if (code === "no-speech" || code === "aborted") return;
      wantOnRef.current = false; // erro fatal: não religar
      setErro(
        code === "not-allowed" || code === "service-not-allowed"
          ? "Permita o acesso ao microfone para falar com a IA."
          : "Reconhecimento de voz indisponível neste navegador (funciona no Chrome). Digite sua pergunta.",
      );
    };
    rec.onend = () => {
      // O motor encerra após silêncio; se o usuário ainda quer ouvir e não houve
      // erro fatal, religa para manter a escuta contínua.
      if (wantOnRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* cai para finalizar */
        }
      }
      finalizar();
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      wantOnRef.current = false;
      setListening(false);
    }
  };

  const stop = () => {
    wantOnRef.current = false; // sinaliza que NÃO deve religar
    if (recRef.current) {
      try {
        recRef.current.stop(); // dispara onend → finalizar() → onFinal
      } catch {
        /* noop */
      }
    }
    setListening(false);
  };

  return { supported, listening, erro, start, stop };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseTopGasto({ resp }: { resp: any }) {
  return (
    <div className={AI_CARD}>
      <div className={AI_CARD_TITLE}>{resp.table.title}</div>
      <table className={MINI_TABLE}>
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
      {resp.foot && <div className="caption italic">{resp.foot}</div>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseKpi({ resp }: { resp: any }) {
  return (
    <div className={AI_CARD}>
      <div className="grid grid-cols-[1fr_1.4fr] items-center gap-8">
        <div>
          <div className="eyebrow mb-2">{resp.kpi.caption}</div>
          <div className="mono-nums font-serif text-[44px] leading-none tracking-[-0.02em]">{resp.kpi.value}</div>
          <div className="mt-2.5 text-[13px] text-prejuizo">{resp.kpi.delta}</div>
        </div>
        <div>
          <div className="eyebrow mb-1.5">Distribuição mensal</div>
          <MiniBarChart data={resp.chartData} color="var(--cafe)" />
        </div>
      </div>
      {resp.foot && <div className="caption mt-2 italic">{resp.foot}</div>}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseYesNo({ resp }: { resp: any }) {
  return (
    <div className={AI_CARD}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-6">
        <div className="border-r border-border pr-6">
          <div className="eyebrow mb-1.5">Veredito</div>
          <div className="font-serif text-[56px] leading-none text-lucro">{resp.yesno.verdict}</div>
          <div className="mono-nums mt-2 font-serif text-2xl text-lucro">{resp.yesno.folga}</div>
        </div>
        <div>
          <div className="eyebrow mb-2">{resp.yesno.caption}</div>
          <table className={MINI_TABLE}>
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
    <div className={AI_CARD}>
      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-6">
        {resp.compare.map(
          (c: { label: string; value: string; sub: string }, i: number) => (
            <Fragment key={i}>
              {i > 0 && (
                <div className="pb-[18px] font-serif italic text-[color:var(--ink-mute)]">→</div>
              )}
              <div>
                <div className="eyebrow mb-2">{c.label}</div>
                <div className="mono-nums font-serif text-[32px] leading-none tracking-[-0.01em]">{c.value}</div>
                <div className="caption mt-1.5">{c.sub}</div>
              </div>
            </Fragment>
          ),
        )}
        <div className="pb-1">
          <div className="eyebrow mb-2">Variação</div>
          <div className="font-serif text-[26px] text-prejuizo">{resp.delta}</div>
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
    <div className={AI_CARD}>
      <div className="eyebrow mb-3.5">Fluxo líquido YTD 2026: −R$ 4,00 mi</div>
      <div className="flex h-14 border border-border">
        {resp.split.map(
          (s: { share: number; value: number }, i: number) => (
            <div
              key={i}
              className="relative flex items-center justify-center font-serif text-base text-[color:var(--mast-ink)]"
              style={{
                width: `${(Math.abs(s.value) / total) * 100}%`,
                background: i === 0 ? "var(--cafe)" : "var(--outros)",
                opacity: i === 1 ? 0.6 : 1,
              }}
            >
              <span className="text-[color:var(--mast-ink)] [text-shadow:0_1px_1px_rgba(0,0,0,0.2)]">{s.share}%</span>
            </div>
          ),
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-5">
        {resp.split.map((s: { label: string; value: number }, i: number) => (
          <div key={i}>
            <div className="eyebrow mb-1">
              <span
                className="legend-dot"
                style={{
                  background: i === 0 ? "var(--cafe)" : "var(--outros)",
                  opacity: i === 1 ? 0.6 : 1,
                }}
              ></span>
              {s.label}
            </div>
            <div className="mono-nums font-serif text-[28px]">{fmtMoney(s.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponseVet({ resp }: { resp: any }) {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className={AI_CARD}>
        <div className={AI_CARD_TITLE}>Protocolo de triagem — bezerro abatido</div>
        <ol className="m-0 list-decimal pl-[18px] text-[15px] leading-[1.6] text-foreground">
          {resp.triagem.map((t: string, i: number) => (
            <li key={i} className="mb-1.5">
              {t}
            </li>
          ))}
        </ol>
      </div>
      <div className={AI_CARD}>
        <div className={AI_CARD_TITLE}>Conduta por cenário</div>
        <div className="flex flex-col gap-3.5">
          {resp.cenarios.map(
            (c: { quando: string; protocolo: string }, i: number) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[180px_1fr] gap-[18px] pb-3.5",
                  i < resp.cenarios.length - 1 && "border-b border-[color:var(--rule-soft)]",
                )}
              >
                <div className="font-serif text-[15px] text-foreground">{c.quando}</div>
                <div className="text-sm leading-[1.55] text-ink-2">{c.protocolo}</div>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="alert-card pos" style={{ background: "var(--bg-card)" }}>
        <div className="stripe"></div>
        <div className="body-col">
          <span className="eyebrow">Estoque consultado</span>
          <div className="alert-title font-sans text-[15px] font-normal">{resp.estoque}</div>
        </div>
        <button className="alert-cta">Registrar uso →</button>
      </div>
    </div>
  );
}

function AiSignature({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div className={cn(AI_SIGNATURE, muted && "text-[color:var(--ink-mute)]")}>
      <span className={cn("h-1.5 w-1.5", muted ? "bg-[color:var(--ink-mute)]" : "bg-lucro")}></span>
      {children}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AIResponse({ resp }: { resp: any }) {
  return (
    <>
      <AiSignature>
        <span>Rio Novo · IA analista</span>
        <span className="text-[color:var(--ink-mute)]">· 0,8 s</span>
      </AiSignature>
      <div className="font-serif text-[19px] leading-[1.5] text-foreground">{resp.narrative}</div>
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

const MODE_BTN =
  "cursor-pointer border-0 border-r border-border bg-transparent px-[22px] py-2.5 font-sans text-sm tracking-[0.04em] text-ink-3 last:border-r-0 aria-pressed:bg-mast aria-pressed:text-mast-ink";

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
    <div className={cn("shell-wide", iaMode === "conversa" && "flex h-[calc(100vh_-_var(--header-h))] flex-col overflow-hidden")}>
      <ReportHeader eyebrow="Pergunte sobre seus números" subtitle="IA" updatedAt={R.UPDATED_AT} />

      <div className="mt-[18px] inline-flex self-start border border-border bg-card">
        <button className={MODE_BTN} aria-pressed={iaMode === "conversa"} onClick={() => setIaMode("conversa")}>
          Conversa
        </button>
        <button className={MODE_BTN} aria-pressed={iaMode === "simulador"} onClick={() => setIaMode("simulador")}>
          Simulador de cenários
        </button>
      </div>

      {iaMode === "simulador" ? (
        <Simulador R={simR} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_280px] overflow-hidden border-t border-border max-[900px]:grid-cols-1">
          {/* Esquerda: perguntas frequentes + conversas */}
          <aside className="flex flex-col gap-5 overflow-y-auto border-r border-border bg-card px-5 py-6 max-[900px]:hidden">
            <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Perguntas frequentes</h4>
            <div className="flex flex-col">
              {R.promptsSugeridos.map((p: string, i: number) => (
                <button
                  key={i}
                  className="cursor-pointer border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2.5 text-left font-serif text-[15px] italic leading-[1.4] tracking-[-0.005em] text-ink-2 hover:text-foreground"
                  onClick={() => ask(p)}
                >
                  "{p}"
                </button>
              ))}
            </div>
            <div className="mt-auto">
              <div className="flex items-baseline justify-between">
                <h4 className="m-0 mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Conversas anteriores</h4>
                <button
                  className="cursor-pointer border-0 bg-transparent font-sans text-[11px] text-[color:var(--ink-mute)] underline underline-offset-2 hover:text-prejuizo"
                  onClick={limparMemoria}
                  title="Limpar memória"
                >
                  limpar
                </button>
              </div>
              <div className="flex flex-col">
                {mem.current.conversas.slice(0, 5).map((c) => (
                  <button
                    key={c.id}
                    className="group flex cursor-pointer flex-col gap-px border-0 border-b border-[color:var(--rule-soft)] bg-transparent py-2 text-left"
                    onClick={() => c.topicos[0] && ask(`Sobre ${c.topicos[0]}, o que ficou da nossa conversa?`)}
                  >
                    <span className="text-[11px] tracking-[0.04em] text-[color:var(--ink-mute)]">{c.data}</span>
                    <span className="text-[13px] leading-[1.35] text-ink-3 group-hover:text-foreground">{c.titulo}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Centro: thread */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-background">
            <div className="mx-auto flex min-h-0 w-full max-w-[920px] flex-1 flex-col gap-7 overflow-y-auto px-9 py-7 max-[900px]:px-3.5 max-[900px]:py-5" ref={threadRef}>
              {thread.map((m, i) => (
                <div key={i} className={cn("flex flex-col gap-2.5", m.role === "user" && "items-end")}>
                  {m.role === "user" && (
                    <div className="max-w-[520px] bg-mast px-[18px] py-3 text-[17px] text-mast-ink">{m.content}</div>
                  )}
                  {m.role === "ai" && (m.kind === "intro" || m.kind === "text") && (
                    <>
                      <AiSignature>
                        <span>Rio Novo · IA analista</span>
                      </AiSignature>
                      <p className="m-0 text-[17px] leading-[1.55] text-ink-2">{m.content}</p>
                    </>
                  )}
                  {m.role === "ai" && m.kind === "recall" && (
                    <div className="flex max-w-[560px] flex-col gap-1 border-l-[3px] border-l-leite bg-[color:var(--bg-card-2)] px-4 py-3">
                      <div className="flex items-center gap-2 font-sans text-[11px] uppercase tracking-[0.14em] text-ink-3">
                        <span className="text-sm text-leite">↺</span>Lembrando de {m.recall.data}
                      </div>
                      <div className="font-serif text-base tracking-[-0.005em] text-foreground">{m.recall.titulo}</div>
                      <div className="text-sm leading-[1.5] text-ink-2">{m.recall.resumo}</div>
                    </div>
                  )}
                  {m.role === "ai" && m.kind === "response" && <AIResponse resp={m.resp} />}
                </div>
              ))}
              {typing && (
                <div className="flex flex-col gap-2.5">
                  <AiSignature muted>
                    <span>Cruzando lançamentos…</span>
                  </AiSignature>
                </div>
              )}
            </div>

            <div className="border-t border-border bg-background px-9 pb-7 pt-[18px] print:hidden max-[900px]:px-3.5 max-[900px]:pb-[18px] max-[900px]:pt-3">
              <div
                className={cn(
                  "mx-auto flex max-w-[920px] flex-col gap-2.5 border bg-card px-4 py-3.5",
                  speech.listening ? "border-prejuizo" : "border-border",
                )}
              >
                <Textarea
                  className="min-h-7 resize-none border-0 bg-transparent p-0 text-base text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 md:text-base"
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
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[11px] uppercase tracking-[0.12em] text-ink-3">
                    <span className="h-1.5 w-1.5 bg-lucro"></span>
                    Escopo: tudo · {R.iaScope.periodo}
                  </div>
                  {speech.supported && (
                    <button
                      className={cn(
                        "grid h-10 w-10 flex-shrink-0 cursor-pointer place-items-center border transition-colors",
                        speech.listening
                          ? "animate-[mic-pulse_1.4s_ease-in-out_infinite] border-prejuizo bg-prejuizo text-mast-ink"
                          : "border-border bg-card text-ink-2 hover:border-foreground hover:text-foreground",
                      )}
                      onClick={toggleMic}
                      title={speech.listening ? "Parar de gravar" : "Falar com a IA"}
                      aria-label={speech.listening ? "Parar de gravar" : "Falar com a IA"}
                    >
                      {speech.listening ? (
                        <span className="inline-flex h-[18px] items-center gap-[2px]" aria-hidden="true">
                          <i className="inline-block h-1.5 w-[2.5px] animate-[mic-bar_0.9s_ease-in-out_infinite] bg-mast-ink"></i>
                          <i className="inline-block h-1.5 w-[2.5px] animate-[mic-bar_0.9s_ease-in-out_infinite] bg-mast-ink [animation-delay:0.15s]"></i>
                          <i className="inline-block h-1.5 w-[2.5px] animate-[mic-bar_0.9s_ease-in-out_infinite] bg-mast-ink [animation-delay:0.3s]"></i>
                          <i className="inline-block h-1.5 w-[2.5px] animate-[mic-bar_0.9s_ease-in-out_infinite] bg-mast-ink [animation-delay:0.45s]"></i>
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
                  <button
                    className="ml-auto cursor-pointer border-0 bg-mast px-[18px] py-2 font-sans text-[13px] uppercase tracking-[0.08em] text-mast-ink disabled:cursor-not-allowed disabled:bg-border disabled:text-[color:var(--ink-mute)]"
                    disabled={!input.trim()}
                    onClick={() => input.trim() && ask(input.trim())}
                  >
                    {speech.listening ? "Ouvindo…" : "Perguntar"}
                  </button>
                </div>
              </div>
              {speech.listening && (
                <div className="mx-auto mt-2 flex max-w-[920px] items-center gap-2 text-[13px] tracking-[0.01em] text-ink-3">
                  <span className="h-[9px] w-[9px] animate-[mic-blink_1s_steps(2,start)_infinite] rounded-full bg-prejuizo"></span> Gravando — fale e a pergunta é enviada quando você parar (clique no microfone para encerrar).
                </div>
              )}
              {speech.erro && !speech.listening && (
                <div className="mx-auto mt-2 flex max-w-[920px] items-center gap-2 text-[13px] tracking-[0.01em] text-prejuizo">
                  <span aria-hidden="true">⚠</span> {speech.erro}
                </div>
              )}
            </div>
          </div>

          {/* Direita: memória + escopo de dados */}
          <aside className="flex flex-col gap-[22px] overflow-y-auto border-l border-border bg-card px-[22px] py-6 max-[900px]:hidden">
            <div>
              <div className="flex items-baseline justify-between">
                <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">O que a IA lembra de você</h4>
              </div>
              <div className="mt-3 flex flex-col gap-[9px]">
                {mem.current.fatos.map((f) => (
                  <div key={f.id} className="flex items-start gap-[9px]">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-lucro"></span>
                    <span className="text-[13px] leading-[1.45] text-ink-2">{f.texto}</span>
                  </div>
                ))}
              </div>
              {mem.current.pendencias.length > 0 && (
                <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--rule-soft)] pt-3.5">
                  <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Acompanhamentos pendentes</span>
                  {mem.current.pendencias.map((p) => (
                    <button
                      key={p.id}
                      className="flex cursor-pointer items-start gap-[9px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card-2)] px-[11px] py-[9px] text-left hover:border-ink-3"
                      onClick={() => ask(p.texto)}
                    >
                      <span className="mt-px text-[13px] text-[color:var(--warn)]">↻</span>
                      <span className="flex flex-col gap-0.5 text-[13px] leading-[1.4] text-foreground">
                        {p.texto}
                        <small className="text-[11px] text-[color:var(--ink-mute)]">{p.deOnde}</small>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-[18px]">
              <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Escopo de dados</h4>
              <div className="mt-3 flex flex-col gap-2 text-[13px] text-ink-2">
                {[
                  ["Período", R.iaScope.periodo],
                  ["Lançamentos", "8.412"],
                  ["Notas fiscais", "6.130"],
                  ["Categorias", "184"],
                  ["Fornecedores", "312"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3">
                    <span>{k}</span>
                    <span className="ml-auto font-serif tabular-nums">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-[18px]">
              <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Filtros ativos</h4>
              <div className="row-wrap mt-2.5">
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
              <div className="caption mt-3 italic leading-[1.55]">
                A IA usa todos os dados visíveis acima. Restringir o escopo aqui afeta as respostas.
              </div>
            </div>

            <div className="border-t border-border pt-[18px]">
              <h4 className="m-0 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Conhecimento adicional</h4>
              <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-ink-2">
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
