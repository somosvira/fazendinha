import { Fragment } from "react";
import type { IaInsight } from "../mock/insight";
import { RebButton } from "@/components/rb/RebButton";

export function Enfase({ texto }: { texto: string }) {
  const partes = texto.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {partes.map((p, i) => {
        const m = p.match(/^<b>(.*?)<\/b>$/);
        return m ? <strong key={i}>{m[1]}</strong> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

// Banner horizontal (nível módulo) — pull-quote com border-left leite.
export function IaInsightBand({ insight }: { insight: IaInsight }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-[14px] border-l border-[color:var(--leite)] py-1 pl-[18px]">
      <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border border-[color:var(--leite)] font-serif text-sm font-bold text-[color:var(--leite)]">✦</div>
      <p className="m-0 font-serif text-sm italic leading-normal text-ink-2"><Enfase texto={insight.texto} /></p>
      {insight.acoes?.[0]?.label && (
        <RebButton variant="pri" className="ml-auto flex-none max-[900px]:ml-0">{insight.acoes[0].label}</RebButton>
      )}
    </div>
  );
}
