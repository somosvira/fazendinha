import type { Aptidao, ListarFiltros, Origem, PapelReprodutivo, TipoBaixa } from "../types";
export type FiltrosAvancadosAnimais = {
  propriedadeId: string; categoriaId: string; aptidao: "" | Aptidao; racaId: string;
  origem: "" | Origem; papelReprodutivo: "" | PapelReprodutivo;
  idadeMin: string; idadeMax: string; tipoBaixa: "" | Exclude<TipoBaixa,"CADASTRO_INDEVIDO">; baixaDe: string; baixaAte: string;
};
export const FILTROS_AVANCADOS_VAZIOS: FiltrosAvancadosAnimais = {
  propriedadeId:"",categoriaId:"",aptidao:"",racaId:"",origem:"",papelReprodutivo:"",idadeMin:"",idadeMax:"",tipoBaixa:"",baixaDe:"",baixaAte:"",
};
type Situacao = NonNullable<ListarFiltros["situacao"]>;
export function contarFiltrosAvancados(f: FiltrosAvancadosAnimais, situacao: Situacao): number {
  return Object.entries(f).filter(([chave,valor]) => valor !== "" && (situacao !== "ATIVO" || !["tipoBaixa","baixaDe","baixaAte"].includes(chave))).length;
}
export function validarFiltrosAvancados(f: FiltrosAvancadosAnimais, situacao: Situacao): string | null {
  for (const valor of [f.idadeMin,f.idadeMax]) if (valor !== "" && (!/^\d+$/.test(valor) || Number(valor) > 600)) return "Informe idades inteiras entre 0 e 600 meses.";
  if (f.idadeMin !== "" && f.idadeMax !== "" && Number(f.idadeMin) > Number(f.idadeMax)) return "A idade máxima não pode ser menor que a mínima.";
  if (situacao !== "ATIVO") {
    for (const data of [f.baixaDe,f.baixaAte]) if (data && (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !Number.isFinite(Date.parse(data+"T00:00:00Z")) || new Date(data+"T00:00:00Z").toISOString().slice(0,10) !== data)) return "Informe uma data de baixa válida.";
    if (f.baixaDe && f.baixaAte && f.baixaDe > f.baixaAte) return "A data final da baixa não pode ser anterior à inicial.";
  }
  return null;
}
export function consultaFiltrosAvancados(f: FiltrosAvancadosAnimais, situacao: Situacao): Partial<ListarFiltros> {
  const especial = ["__sem_categoria__","__manual__"].includes(f.categoriaId);
  return {
    propriedadeId:f.propriedadeId ? Number(f.propriedadeId) : undefined,
    categoriaId:especial ? undefined : f.categoriaId || undefined,
    semCategoria:f.categoriaId === "__sem_categoria__" || undefined,
    categoriaOrigem:f.categoriaId === "__manual__" ? "MANUAL" : undefined,
    aptidao:f.aptidao || undefined,racaId:f.racaId || undefined,origem:f.origem || undefined,papelReprodutivo:f.papelReprodutivo || undefined,
    idadeMinMeses:f.idadeMin === "" ? undefined : Number(f.idadeMin),idadeMaxMeses:f.idadeMax === "" ? undefined : Number(f.idadeMax),
    tipoBaixa:situacao === "ATIVO" ? undefined : f.tipoBaixa || undefined,
    baixaDe:situacao === "ATIVO" ? undefined : f.baixaDe || undefined,baixaAte:situacao === "ATIVO" ? undefined : f.baixaAte || undefined,
  };
}
