import { Fragment } from "react";
import type { IaInsight } from "../types";
import { RebButton } from "@/components/rb/RebButton";

// Renderiza ênfase <b>…</b> de forma SEGURA — sem dangerouslySetInnerHTML.
// O texto do insight virá da IA/servidor no futuro; nunca injetamos HTML cru.
// Tudo fora de <b></b> é texto puro (escapado pelo React); o conteúdo de <b>
// é renderizado como filho de <strong> (também escapado). Sem vetor de XSS.
export function Enfase({ texto }: { texto: string }) {
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

// ✦ marcador editorial (pull-quote) — círculo fino leite, serif bold
function Dot() {
  return (
    <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-[color:var(--leite)] font-serif text-sm font-bold text-[color:var(--leite)]">
      ✦
    </div>
  );
}

// Banner horizontal (nível rebanho) — pull-quote com border-left leite
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  const cta = insight.acoes[0];
  return (
    <div className="mb-6 flex flex-wrap items-center gap-[14px] border-l border-[color:var(--leite)] py-1 pl-[18px]">
      <Dot />
      <p className="m-0 font-serif text-sm italic leading-normal text-ink-2">
        <Enfase texto={insight.texto} />
      </p>
      {cta && (
        <RebButton variant="pri" className="ml-auto flex-none max-[900px]:ml-0">
          {cta.label}
        </RebButton>
      )}
    </div>
  );
}

// Card vertical com várias ações (ficha do animal)
export function IaInsightCard({ insight }: { insight: IaInsight }) {
  return (
    <div className="my-[22px] flex items-start gap-4 border-l border-[color:var(--leite)] py-1.5 pl-[18px]">
      <Dot />
      <div className="flex-1">
        <h4 className="mb-1 mt-0 font-serif text-[15px] font-medium italic text-[color:var(--ink)]">
          A IA notou um padrão
        </h4>
        <p className="m-0 text-sm leading-normal text-ink-2">
          <Enfase texto={insight.texto} />
        </p>
        <div className="mt-2.5 flex gap-2">
          {insight.acoes.map((a, i) => (
            <RebButton key={i} variant={a.primaria ? "pri" : "default"}>
              {a.label}
            </RebButton>
          ))}
        </div>
      </div>
    </div>
  );
}
