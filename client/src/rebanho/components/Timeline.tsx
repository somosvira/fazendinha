import type { EventoTimeline } from "../types";

const DOM_LABEL: Record<string, string> = { reproducao: "Reprodução", sanidade: "Sanidade", nutricao: "Nutrição", producao: "Produção" };

// Cor do "nó" (bolinha) e da tag por domínio — reproduz .rb-ev.<dominio>::before
// e .rb-ev .tag.<dominio> do rebanho.css.
const DOT: Record<string, string> = {
  reproducao: "before:bg-cafe",
  sanidade: "before:bg-prejuizo",
  nutricao: "before:bg-outros",
  producao: "before:bg-leite",
};
const TAG: Record<string, string> = {
  reproducao: "bg-[color:var(--cafe-soft)] text-cafe",
  sanidade: "bg-[#EEDAD3] text-prejuizo",
  nutricao: "bg-[color:var(--outros-soft)] text-[#42523a]",
  producao: "bg-[color:var(--leite-soft)] text-[#6e5a26]",
};

function fmtDia(iso: string) {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  const ano = d.getFullYear() === 2026 ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate().toString().padStart(2, "0")} ${meses[d.getMonth()]}${ano}`;
}

export function Timeline({ eventos, interpretacao, flashEventoId }: { eventos: EventoTimeline[]; interpretacao?: Record<string, string>; flashEventoId?: string | null }) {
  // Pilha (LIFO), como num currículo: mais recente no topo. Ordenação defensiva por data.
  const ordenados = [...eventos].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  const anoTopo = ordenados[0] ? new Date(ordenados[0].data).getFullYear() : new Date().getFullYear();
  return (
    // .rb-tl — trilho vertical com border-left
    <div className="relative ml-1.5 border-l-2 border-[color:var(--rule)] pl-6">
      <div className="my-0 mb-3 mt-0.5 font-serif text-sm italic text-ink-2">{anoTopo}</div>
      {ordenados.map((e) => {
        const interp = interpretacao?.[`${e.dominio}:${e.id}`];
        // Detalhe + responsável: regra "o quê + quem realizou".
        const quem = e.responsavel ? `${e.detalhe ? `${e.detalhe} · ` : ""}por ${e.responsavel}` : e.detalhe;
        const destacar = flashEventoId && e.id === flashEventoId;
        return (
          <div key={e.id}>
            {e.marcador && <div className="my-0 mb-3 mt-0.5 font-serif text-sm italic text-ink-2">— {e.marcador} —</div>}
            {/* .rb-ev — nó (::before) posicionado à esquerda do trilho */}
            <div
              className={
                "relative pb-5 before:absolute before:-left-[31px] before:top-[3px] before:h-[11px] before:w-[11px] before:rounded-full before:border-2 before:border-[color:var(--bg)] before:content-[''] " +
                DOT[e.dominio] +
                (destacar ? " rb-ev-flash" : "")
              }
            >
              <span className="text-sm font-semibold text-ink-2">{fmtDia(e.data)}</span>
              <span className={"ml-2 inline-block rounded-[9px] px-[7px] py-px align-[1px] text-sm font-bold uppercase tracking-[.06em] " + TAG[e.dominio]}>{DOM_LABEL[e.dominio]}</span>
              <h5 className="mb-0.5 mt-1 text-[15px] font-semibold">{e.titulo}{e.alerta && <span className="font-semibold text-prejuizo"> ↑ alerta</span>}</h5>
              {quem && <p className="m-0 text-sm text-ink-3">{quem}</p>}
              {interp && <p className="mt-2 font-serif text-[15px] font-medium italic text-ink-2"><span className="mr-2 font-sans text-sm font-bold uppercase not-italic tracking-[.08em] text-[color:var(--ink)]">Interpretação</span> {interp}</p>}
              {e.impacto && <p className="mt-1.5 font-sans text-[15px] font-semibold text-[color:var(--ink)] tabular-nums"><span className="mr-2 text-sm font-bold uppercase tracking-[.08em] text-ink-2">Impacto</span> {e.impacto}</p>}
              {e.proximoPasso && <p className="mt-1.5 font-sans text-[15px] font-semibold text-[color:var(--ink)]"><span className="mr-2 text-sm font-bold uppercase tracking-[.08em] text-cafe">Próximo passo</span> {e.proximoPasso}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
