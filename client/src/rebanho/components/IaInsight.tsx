import { Fragment } from "react";
import type { IaInsight } from "../types";

// Renderiza ênfase <b>…</b> de forma SEGURA — sem dangerouslySetInnerHTML.
// O texto do insight virá da IA/servidor no futuro; nunca injetamos HTML cru.
// Tudo fora de <b></b> é texto puro (escapado pelo React); o conteúdo de <b>
// é renderizado como filho de <strong> (também escapado). Sem vetor de XSS.
function Enfase({ texto }: { texto: string }) {
  const partes = texto.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {partes.map((parte, i) => {
        const m = parte.match(/^<b>(.*?)<\/b>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{parte}</Fragment>;
      })}
    </>
  );
}

// Banner horizontal (nível rebanho)
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  const cta = insight.acoes[0];
  return (
    <div className="rb-ia-band">
      <div className="rb-ia-dot">✦</div>
      <p><Enfase texto={insight.texto} /></p>
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
        <p><Enfase texto={insight.texto} /></p>
        <div className="rb-ia-act">
          {insight.acoes.map((a, i) => (
            <button key={i} className={"rb-btn" + (a.primaria ? " pri" : "")}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
