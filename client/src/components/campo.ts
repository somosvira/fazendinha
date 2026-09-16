/* Aparência compartilhada dos gatilhos de formulário (select, busca, data):
 * mesma caixa arredondada dos inputs de texto, com o ícone afastado da borda. */
export const CLASSE_GATILHO_CAMPO =
  "mt-1.5 flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-white py-2.5 pl-3 pr-3.5 text-left text-sm font-normal text-ink outline-none transition hover:border-ink-3/50 focus-visible:border-outros focus-visible:ring-2 focus-visible:ring-outros/20 data-[state=open]:border-outros data-[state=open]:ring-2 data-[state=open]:ring-outros/20 disabled:cursor-not-allowed disabled:opacity-50";

/** Variante sublinhada: o mesmo look do RebSelect/RebField dos módulos operacionais. */
export const CLASSE_GATILHO_SUBLINHADO =
  "flex w-full min-w-0 cursor-pointer items-center justify-between gap-3 rounded-none border-0 border-b font-sans not-italic border-b-border bg-transparent px-0.5 py-2 text-left text-sm font-normal text-foreground outline-none transition-colors hover:border-b-ink-2 focus-visible:border-b-[color:var(--cafe)] data-[state=open]:border-b-[color:var(--cafe)] disabled:cursor-not-allowed disabled:opacity-50";

export type VarianteCampo = "caixa" | "sublinhado";
export const classeGatilho = (variante: VarianteCampo = "caixa") => (variante === "sublinhado" ? CLASSE_GATILHO_SUBLINHADO : CLASSE_GATILHO_CAMPO);

/** Ícone à direita do gatilho (chevron, calendário). */
export const CLASSE_ICONE_CAMPO = "size-4 shrink-0 text-ink-3";
