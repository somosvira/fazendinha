import type { SugestoesVisita } from "./visitas-api";
type Retorno = NonNullable<SugestoesVisita["retornos"]>[number];
export type GrupoAgendaReprodutiva = { id: string; itens: Retorno[]; animais: number };
/** A data só agrupa ações com identidade explícita de programação e etapa. */
export function agruparAgendaReprodutiva(itens: Retorno[], dataDe: (item: Retorno) => string | null): GrupoAgendaReprodutiva[] {
  const grupos = new Map<string, Retorno[]>();
  for (const item of itens) {
    const etapa = item.momentoId ?? item.etapaId;
    const contexto = item.programacaoId ?? item.participacaoId;
    const id = item.origem === "TAREFA_IATF" && etapa && contexto ? `${item.propriedadeId}:${contexto}:${etapa}:${dataDe(item)?.slice(0, 10) ?? "SEM_PREVISAO"}` : `${item.animalId}:${item.origem}:${item.origemId}`;
    grupos.set(id, [...(grupos.get(id) ?? []), item]);
  }
  return [...grupos].map(([id, itens]) => ({ id, itens, animais: new Set(itens.map(i => i.animalId)).size }));
}
