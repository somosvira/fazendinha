import type { EventoTimeline } from "../types";

const DOM_LABEL: Record<string, string> = { reproducao: "Reprodução", sanidade: "Sanidade", nutricao: "Nutrição", producao: "Produção" };

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
    <div className="rb-tl">
      <div className="rb-tl-marker">{anoTopo}</div>
      {ordenados.map((e) => {
        const interp = interpretacao?.[`${e.dominio}:${e.id}`];
        // Detalhe + responsável: regra "o quê + quem realizou".
        const quem = e.responsavel ? `${e.detalhe ? `${e.detalhe} · ` : ""}por ${e.responsavel}` : e.detalhe;
        const destacar = flashEventoId && e.id === flashEventoId;
        return (
          <div key={e.id}>
            {e.marcador && <div className="rb-tl-marker">— {e.marcador} —</div>}
            <div className={"rb-ev " + e.dominio + (destacar ? " rb-ev-flash" : "")}>
              <span className="when">{fmtDia(e.data)}</span>
              <span className={"tag " + e.dominio}>{DOM_LABEL[e.dominio]}</span>
              <h5>{e.titulo}{e.alerta && <span className="flag"> ↑ alerta</span>}</h5>
              {quem && <p>{quem}</p>}
              {interp && <p className="rb-tl-int"><span>Interpretação</span> {interp}</p>}
              {e.impacto && <p className="rb-tl-impact"><span>Impacto</span> {e.impacto}</p>}
              {e.proximoPasso && <p className="rb-tl-next"><span>Próximo passo</span> {e.proximoPasso}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
