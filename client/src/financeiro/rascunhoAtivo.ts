/* Rascunho de operação ativo — fonte única compartilhada entre quem edita o
 * rascunho (tela de operações) e quem só o exibe (atalho "Trabalho ativo" no
 * topo da sidebar). Módulo-global pelo mesmo motivo de `propriedadeScope`: o
 * valor atravessa árvores React que não se conhecem.
 *
 * Quem publica é `novo-api.ts`, a cada leitura ou gravação do rascunho. Assim
 * qualquer fluxo que toque no rascunho (autosave, confirmar, limpar, descartar
 * em Compromissos) mantém a sidebar em dia sem código extra nas telas.
 *
 * Duas proteções contra respostas fora de ordem:
 *  - contexto: a resposta só vale para a sessão e o sítio em que a requisição
 *    saiu; se o usuário trocou de sítio ou de conta no caminho, ela é descartada;
 *  - leitura x escrita: uma leitura só publica se nada foi publicado depois que
 *    ela saiu, para um GET lento não sobrescrever o autosave mais recente. */

import { useSyncExternalStore } from "react";
import { getToken } from "../lib/auth";
import { getPropriedadeAtiva } from "../propriedadeScope";
import type { RascunhoOperacao } from "./novo-api";

export type EstadoRascunhoAtivo = {
  /** Rascunho salvo no servidor para o usuário no sítio ativo; `null` quando não há. */
  rascunho: RascunhoOperacao | null;
  /** O formulário de nova operação está aberto, editando o rascunho. */
  editando: boolean;
};

let estado: EstadoRascunhoAtivo = { rascunho: null, editando: false };
let geracao = 0;
const ouvintes = new Set<() => void>();
const contextoAtual = () => `${getToken() ?? ""}|${getPropriedadeAtiva() ?? ""}`;

function atualizar(proximo: Partial<EstadoRascunhoAtivo>) {
  estado = { ...estado, ...proximo };
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** Prepara a publicação do resultado de uma requisição ao rascunho. Chame ANTES
 *  de disparar a requisição, para capturar o contexto e o momento de saída. */
export function prepararPublicacaoRascunho(tipo: "leitura" | "escrita") {
  const contexto = contextoAtual();
  const saida = geracao;
  return <T extends RascunhoOperacao | null>(rascunho: T): T => {
    const mesmoContexto = contexto === contextoAtual();
    const nadaMaisNovo = tipo === "escrita" || geracao === saida;
    if (mesmoContexto && nadaMaisNovo) {
      geracao += 1;
      atualizar({ rascunho });
    }
    return rascunho;
  };
}

/** Esquece o rascunho conhecido (troca de sítio ou de sessão, perda de acesso).
 *  NÃO invalida leituras a caminho: as de outro contexto já são descartadas, e as
 *  do contexto atual seguem válidas. Isso importa porque os efeitos dos filhos
 *  rodam antes dos do App: a tela de operações dispara a sua leitura antes deste
 *  limpar, e perdê-la faria o formulário montar vazio sobre um rascunho salvo. */
export function limparRascunhoAtivo() {
  if (estado.rascunho) atualizar({ rascunho: null });
}

/** Marca o formulário de nova operação como aberto; devolve a função que desmarca. */
export function marcarEdicaoRascunho(): () => void {
  atualizar({ editando: true });
  return () => atualizar({ editando: false });
}

export function estadoRascunhoAtivo(): EstadoRascunhoAtivo {
  return estado;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

export function useRascunhoAtivo(): EstadoRascunhoAtivo {
  return useSyncExternalStore(assinar, estadoRascunhoAtivo, estadoRascunhoAtivo);
}
