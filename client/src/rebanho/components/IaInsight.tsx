import type { IaInsight } from "../types";

function html(texto: string) {
  return { dangerouslySetInnerHTML: { __html: texto } };
}

// Banner horizontal (nível rebanho)
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  const cta = insight.acoes[0];
  return (
    <div className="rb-ia-band">
      <div className="rb-ia-dot">✦</div>
      <p {...html(insight.texto)} />
      {cta && <button className="rb-btn pri cta">{cta.label}</button>}
    </div>
  );
}

// Card vertical com várias ações (ficha do animal)
export function IaInsightCard({ insight }: { insight: IaInsight }) {
  return (
    <div className="rb-ia-card">
      <div className="rb-ia-dot">✦</div>
      <div style={{ flex: 1 }}>
        <h4>A IA notou um padrão</h4>
        <p {...html(insight.texto)} />
        <div className="rb-ia-act">
          {insight.acoes.map((a, i) => (
            <button key={i} className={"rb-btn" + (a.primaria ? " pri" : "")}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
