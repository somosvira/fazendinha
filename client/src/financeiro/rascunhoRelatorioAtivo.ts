/* Estado compartilhado do rascunho de relatório. Espelha o rascunho ativo de
 * operações para que a sidebar possa oferecer os dois trabalhos pendentes. */
import { useSyncExternalStore } from "react";
import { getToken } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";
import type { ConfiguracaoRelatorioFinanceiro, RascunhoRelatorioFinanceiro } from "./novo-api";

export type EstadoRascunhoRelatorioAtivo = {
  rascunho: RascunhoRelatorioFinanceiro | null;
  conhecido: boolean;
  editando: boolean;
  recuperacao: { configuracao: ConfiguracaoRelatorioFinanceiro; erro: string | null } | null;
};

let estado: EstadoRascunhoRelatorioAtivo = { rascunho: null, conhecido: false, editando: false, recuperacao: null };
let contextoEstado: string | null = null;
const vazio: EstadoRascunhoRelatorioAtivo = { rascunho: null, conhecido: false, editando: false, recuperacao: null };
let geracao = 0;
const ouvintes = new Set<() => void>();
const contextoAtual = () => `${getToken() ?? ""}|${getPropriedadeAtiva() ?? ""}`;
const atualizar = (proximo: Partial<EstadoRascunhoRelatorioAtivo>) => {
  estado = { ...estadoRascunhoRelatorioAtivo(), ...proximo };
  contextoEstado = contextoAtual();
  ouvintes.forEach((ouvinte) => ouvinte());
};

export function prepararPublicacaoRascunhoRelatorio(tipo: "leitura" | "escrita") {
  const contexto = contextoAtual();
  const saida = geracao;
  return <T extends RascunhoRelatorioFinanceiro | null>(rascunho: T): T => {
    if (contexto === contextoAtual() && (tipo === "escrita" || geracao === saida)) {
      geracao += 1;
      atualizar({ rascunho, conhecido: true, ...(tipo === "escrita" && !rascunho ? { recuperacao: null } : {}) });
    }
    return rascunho;
  };
}

export function limparRascunhoRelatorioAtivo() {
  atualizar({ rascunho: null, conhecido: false, recuperacao: null });
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
  return useSyncExternalStore(assinar, estadoRascunhoRelatorioAtivo, estadoRascunhoRelatorioAtivo);
}

export function estadoRascunhoRelatorioAtivo(): EstadoRascunhoRelatorioAtivo {
  return contextoEstado == null || contextoEstado === contextoAtual() ? estado : vazio;
}

export function contextoEdicaoRascunhoRelatorio() {
  const contexto = contextoAtual();
  return () => contexto === contextoAtual();
}

export function guardarEdicaoRascunhoRelatorio(configuracao: ConfiguracaoRelatorioFinanceiro) {
  geracao += 1;
  atualizar({ recuperacao: { configuracao, erro: null } });
}

export function concluirEdicaoRascunhoRelatorio(configuracao: ConfiguracaoRelatorioFinanceiro, salvo: RascunhoRelatorioFinanceiro | null, erro: string | null = null) {
  if (salvo) atualizar({ rascunho: salvo, conhecido: true });
  if (estadoRascunhoRelatorioAtivo().recuperacao?.configuracao !== configuracao) return;
  atualizar({ recuperacao: erro ? { configuracao, erro } : null });
}

const filas = new Map<string, Promise<unknown>>();
/** Instâncias desmontadas e reabertas compartilham a fila e a versão confirmada. */
export function enfileirarSalvamentoRascunhoRelatorio<T>(salvar: () => Promise<T>): Promise<T> {
  const contexto = contextoAtual();
  const requisicao = (filas.get(contexto) ?? Promise.resolve()).catch(() => undefined).then(salvar);
  filas.set(contexto, requisicao);
  void requisicao.finally(() => { if (filas.get(contexto) === requisicao) filas.delete(contexto); }).catch(() => undefined);
  return requisicao;
}
