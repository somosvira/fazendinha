import type { EventoTimeline } from "../types";

const DOM_LABEL: Record<string, string> = { reproducao: "Reprodução", sanidade: "Sanidade", nutricao: "Nutrição", producao: "Produção" };

function fmtDia(iso: string) {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  const ano = d.getFullYear() === 2026 ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate().toString().padStart(2, "0")} ${meses[d.getMonth()]}${ano}`;
}

export function Timeline({ eventos, interpretacao }: { eventos: EventoTimeline[]; interpretacao?: Record<string, string> }) {
  return (
    <div className="rb-tl">
      <div className="rb-tl-marker">2026</div>
      {eventos.map((e) => {
        const interp = interpretacao?.[`${e.dominio}:${e.id}`];
        return (
          <div key={e.id}>
            {e.marcador && <div className="rb-tl-marker">— {e.marcador} —</div>}
            <div className={"rb-ev " + e.dominio}>
              <span className="when">{fmtDia(e.data)}</span>
              <span className={"tag " + e.dominio}>{DOM_LABEL[e.dominio]}</span>
              <h5>{e.titulo}{e.alerta && <span className="flag"> ↑ alerta</span>}</h5>
              {e.detalhe && <p>{e.detalhe}</p>}
              {interp && <p className="rb-tl-int"><span>Sistema</span> {interp}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
