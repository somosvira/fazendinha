import type { IaInsight } from "../types";

export function Enfase({ texto }: { texto: string }) {
  const partes = texto.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {partes.map((p, i) => {
        const m = p.match(/^<b>(.*?)<\/b>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function IaInsightBand({ insight }: { insight: IaInsight }) {
  return (
    <div className="rb-ia-band">
      <div className="rb-ia-dot">✦</div>
      <p><Enfase texto={insight.texto} /></p>
      {insight.acoes?.[0]?.label && (
        <button className="rb-btn pri cta">{insight.acoes[0].label}</button>
      )}
    </div>
  );
}
