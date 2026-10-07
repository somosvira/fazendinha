// Sub-navegação sublinhada comum às três seções do Rebanho (Visão geral ·
// Animais · Cadastros) — mesmo visual das abas de ConfiguracoesFinanceiras,
// mas baseada em URL (cada seção é uma rota própria, não um estado local).

export type SecaoRebanho = "visao-geral" | "animais" | "lotes" | "cadastros" | "sanidade" | "nutricao" | "coletas" | "pesagens";

// Os consumidores antigos são preservados enquanto a navegação principal
// passa a ser única na sidebar, inclusive no menu móvel.
export function NavRebanho(_props: { ativa: SecaoRebanho }) {
  return null;
}
