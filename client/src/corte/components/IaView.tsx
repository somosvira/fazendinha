import { useState } from "react";
import { Enfase } from "./IaInsight";
import { perguntarIA, useInsights } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";

const SUGESTOES = [
  "Quais lotes estão prontos pra venda?",
  "Vale atrasar para setembro?",
  "Quais lotes têm GMD baixo?",
  "Vacinação pendente?",
];

type Msg =
  | { de: "user"; txt: string }
  | { de: "ia"; txt: string; lista?: string[]; rodape?: string; modo?: "ia" | "demo" };

/* "Capão" — assistente do módulo Corte (espelho do Rúmi/Caatinga). */
export function IaView() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { data: insights, loading: carregandoInsights } = useInsights();

  async function enviar(p: string) {
    const pergunta = p.trim();
    if (!pergunta || enviando) return;
    setMsgs((m) => [...m, { de: "user", txt: pergunta }]);
    setTexto("");
    setEnviando(true);
    try {
      const resp = await perguntarIA(pergunta);
      setMsgs((m) => [...m, { de: "ia", txt: resp.resposta, lista: resp.lista, rodape: resp.rodape, modo: resp.modo }]);
    } catch {
      setMsgs((m) => [...m, { de: "ia", txt: "Não consegui responder agora." }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="rb-main">
      <RebHeader eyebrow="Assistente · Capão" title="IA" />

      <div className="mt-2 grid grid-cols-[1fr_300px] gap-6">
        <div className="flex min-h-[62vh] flex-col">
          <p className="mb-3.5 mt-0 text-sm text-ink-3">
            Pergunte sobre o plantel — pesagem, sanidade, pasto, venda. A IA lê o contexto dos lotes
            e cruza com a curva B3/Esalq atual para sugerir ponto de venda.
          </p>
          <div className="mb-5 flex flex-wrap gap-2">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                className="cursor-pointer rounded-[14px] border border-[color:var(--rule)] bg-[color:var(--bg-card)] px-3 py-1.5 font-sans text-sm text-ink-2 hover:border-cafe hover:text-cafe disabled:cursor-default disabled:opacity-55"
                onClick={() => enviar(s)}
                disabled={enviando}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-3.5">
            {msgs.map((m, i) =>
              m.de === "user" ? (
                <div key={i} className="max-w-[80%] self-end rounded-[13px_13px_3px_13px] bg-cafe px-3.5 py-2.5 text-sm leading-normal text-white">{m.txt}</div>
              ) : (
                <div key={i} className="flex max-w-[80%] gap-2.5 self-start text-sm leading-normal">
                  <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-mast font-serif font-bold text-leite">✦</div>
                  <div className="rounded-[13px_13px_13px_3px] border border-[color:var(--rule-soft)] bg-[color:var(--bg-card)] px-3.5 py-[11px] text-ink-2">
                    <Enfase texto={m.txt} />
                    {m.lista && <ul className="m-0 mt-[9px] list-none p-0 [&>li]:border-t [&>li]:border-dashed [&>li]:border-[color:var(--rule-soft)] [&>li]:py-[5px] [&>li]:text-sm">{m.lista.map((l, j) => <li key={j}>{l}</li>)}</ul>}
                    {m.rodape && <div className="mt-[9px] font-semibold text-[color:var(--ink)]">{m.rodape}</div>}
                    {m.modo === "demo" && <span className="rb-chip-demo">modo demonstração</span>}
                  </div>
                </div>
              ),
            )}
          </div>
          <form className="mt-4 flex gap-2.5 border-t border-[color:var(--rule)] pt-3.5" onSubmit={(e) => { e.preventDefault(); enviar(texto); }}>
            <input
              className="flex-1 rounded-[10px] border border-[color:var(--rule)] bg-[color:var(--bg-card)] px-3.5 py-[11px] font-sans text-sm text-[color:var(--ink)] disabled:cursor-default disabled:opacity-55"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pergunte qualquer coisa sobre os lotes…"
              aria-label="Pergunta para a IA"
              disabled={enviando}
            />
            <button
              type="submit"
              className="cursor-pointer rounded-[10px] border-0 bg-mast px-[18px] font-sans font-semibold text-mast-ink disabled:cursor-default disabled:opacity-55"
              disabled={enviando || !texto.trim()}
            >✦ {enviando ? "Enviando…" : "Enviar"}</button>
          </form>
        </div>

        <aside className="self-start">
          <h4 className="mb-3 mt-0 text-sm uppercase tracking-[.06em] text-ink-3">Insights da semana</h4>
          {carregandoInsights
            ? <div className="mb-2.5 flex gap-[9px] rounded-[9px] border border-[color:var(--rule-soft)] border-l-[3px] border-l-leite bg-[color:var(--bg-card)] px-[13px] py-[11px] text-sm text-ink-2"><div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-mast font-serif text-sm text-leite">✦</div><p className="m-0 opacity-60">Lendo o contexto dos lotes…</p></div>
            : insights.map((ins) => (
                <div key={ins.id} className="mb-2.5 flex gap-[9px] rounded-[9px] border border-[color:var(--rule-soft)] border-l-[3px] border-l-leite bg-[color:var(--bg-card)] px-[13px] py-[11px] text-sm text-ink-2"><div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-mast font-serif text-sm text-leite">✦</div><p className="m-0"><Enfase texto={ins.texto} /></p></div>
              ))}
        </aside>
      </div>
    </main>
  );
}
