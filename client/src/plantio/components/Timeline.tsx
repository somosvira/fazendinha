import type { EventoTimeline } from "../types";

const DOM_LABEL: Record<string, string> = {
  fenologia: "Fenologia",
  fitossanidade: "Fitossanidade",
  nutricao: "Nutrição",
  colheita: "Colheita",
};

function fmtDia(iso: string) {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const d = new Date(iso);
  const ano = d.getFullYear() === 2026 ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate().toString().padStart(2, "0")} ${meses[d.getMonth()]}${ano}`;
}

export function Timeline({ eventos }: { eventos: EventoTimeline[] }) {
  const ordenados = [...eventos].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  const anoTopo = ordenados[0] ? new Date(ordenados[0].data).getFullYear() : new Date().getFullYear();
  return (
    <div className="rb-tl">
      <div className="rb-tl-marker">{anoTopo}</div>
      {ordenados.map((e) => {
        const quem = e.responsavel ? `${e.detalhe ? `${e.detalhe} · ` : ""}por ${e.responsavel}` : e.detalhe;
        return (
          <div key={e.id}>
            {e.marcador && <div className="rb-tl-marker">— {e.marcador} —</div>}
            <div className={"rb-ev " + e.dominio}>
              <span className="when">{fmtDia(e.data)}</span>
              <span className={"tag " + e.dominio}>{DOM_LABEL[e.dominio]}</span>
              <h5>{e.titulo}{e.alerta && <span className="flag"> ↑ alerta</span>}</h5>
              {quem && <p>{quem}</p>}
              {e.impacto && <p className="rb-tl-impact"><span>Impacto</span> {e.impacto}</p>}
              {e.proximoPasso && <p className="rb-tl-next"><span>Próximo passo</span> {e.proximoPasso}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
