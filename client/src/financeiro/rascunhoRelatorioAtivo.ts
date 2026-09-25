/* Estado compartilhado do rascunho de relatório. Espelha o rascunho ativo de
 * operações para que a sidebar possa oferecer os dois trabalhos pendentes. */
import { useSyncExternalStore } from "react";
import { getToken } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";
import type { RascunhoRelatorioFinanceiro } from "./novo-api";

export type EstadoRascunhoRelatorioAtivo = {
  rascunho: RascunhoRelatorioFinanceiro | null;
  conhecido: boolean;
  editando: boolean;
};

let estado: EstadoRascunhoRelatorioAtivo = { rascunho: null, conhecido: false, editando: false };
let geracao = 0;
const ouvintes = new Set<() => void>();
const contextoAtual = () => `${getToken() ?? ""}|${getPropriedadeAtiva() ?? ""}`;
const atualizar = (proximo: Partial<EstadoRascunhoRelatorioAtivo>) => {
  estado = { ...estado, ...proximo };
  ouvintes.forEach((ouvinte) => ouvinte());
};

export function prepararPublicacaoRascunhoRelatorio(tipo: "leitura" | "escrita") {
  const contexto = contextoAtual();
  const saida = geracao;
  return <T extends RascunhoRelatorioFinanceiro | null>(rascunho: T): T => {
    if (contexto === contextoAtual() && (tipo === "escrita" || geracao === saida)) {
      geracao += 1;
      atualizar({ rascunho, conhecido: true });
    }
    return rascunho;
  };
}

export function limparRascunhoRelatorioAtivo() {
  if (estado.rascunho || estado.conhecido) atualizar({ rascunho: null, conhecido: false });
}

export function marcarEdicaoRascunhoRelatorio(): () => void {
  atualizar({ editando: true });
  return () => atualizar({ editando: false });
}

const assinar = (ouvinte: () => void) => {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
};

export function useRascunhoRelatorioAtivo() {
  return useSyncExternalStore(assinar, () => estado, () => estado);
}
