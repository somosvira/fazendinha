// Sub-navegação sublinhada comum às três seções do Rebanho (Visão geral ·
// Animais · Cadastros) — mesmo visual das abas de ConfiguracoesFinanceiras,
// mas baseada em URL (cada seção é uma rota própria, não um estado local).

import { navegarPara } from "../../../router";

export type SecaoRebanho = "visao-geral" | "animais" | "lotes" | "cadastros";

const SECOES: { valor: SecaoRebanho; rotulo: string; href: string }[] = [
  { valor: "visao-geral", rotulo: "Visão geral", href: "/pecuaria/rebanho" },
  { valor: "animais", rotulo: "Animais", href: "/pecuaria/rebanho/animais" },
  { valor: "lotes", rotulo: "Lotes", href: "/pecuaria/rebanho/lotes" },
  { valor: "cadastros", rotulo: "Cadastros", href: "/pecuaria/rebanho/cadastros" },
];

export function NavRebanho({ ativa }: { ativa: SecaoRebanho }) {
  return <div className="mt-6 flex gap-2 overflow-x-auto border-b border-border">
    {SECOES.map((secao) => <button key={secao.valor} type="button" onClick={() => navegarPara(secao.href)} className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${ativa === secao.valor ? "border-mast text-ink" : "border-transparent text-ink-3"}`}>{secao.rotulo}</button>)}
  </div>;
}
