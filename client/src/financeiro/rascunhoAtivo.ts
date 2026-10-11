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
import type { DocumentoFinanceiro, RascunhoOperacao } from "./novo-api";

export type EstadoRascunhoAtivo = {
  /** Rascunho salvo no servidor para o usuário no sítio ativo; `null` quando não há. */
  rascunho: RascunhoOperacao | null;
  /** Alguma resposta já disse se há rascunho neste contexto. Até lá, `rascunho`
   *  nulo quer dizer "ainda não sei", e não "não há rascunho". */
  conhecido: boolean;
  /** O formulário de nova operação está aberto, editando o rascunho. */
  editando: boolean;
  recuperacao: { dados: RascunhoOperacao["dados"]; erro: string | null } | null;
};

let estado: EstadoRascunhoAtivo = { rascunho: null, conhecido: false, editando: false, recuperacao: null };
let contextoRecuperacao: string | null = null;
let estadoSemRecuperacao: EstadoRascunhoAtivo = estado;
let geracao = 0;
const ouvintes = new Set<() => void>();
const contextoAtual = () => `${getToken() ?? ""}|${getPropriedadeAtiva() ?? ""}`;

function atualizar(proximo: Partial<EstadoRascunhoAtivo>) {
  estado = { ...estado, ...proximo };
  estadoSemRecuperacao = estado.recuperacao ? { ...estado, recuperacao: null } : estado;
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
      atualizar({ rascunho, conhecido: true, ...(tipo === "escrita" && !rascunho ? { recuperacao: null } : {}) });
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
  if (estado.rascunho || estado.conhecido || estado.recuperacao) atualizar({ rascunho: null, conhecido: false, recuperacao: null });
}

/** Marca o formulário de nova operação como aberto; devolve a função que desmarca. */
export function marcarEdicaoRascunho(): () => void {
  atualizar({ editando: true });
  return () => atualizar({ editando: false });
}

export function estadoRascunhoAtivo(): EstadoRascunhoAtivo {
  return contextoRecuperacao == null || contextoRecuperacao === contextoAtual() ? estado : estadoSemRecuperacao;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => { ouvintes.delete(ouvinte); };
}

export function useRascunhoAtivo(): EstadoRascunhoAtivo {
  return useSyncExternalStore(assinar, estadoRascunhoAtivo, estadoRascunhoAtivo);
}

/** A edição ainda não salva pertence à mesma sessão e sítio do formulário. */
export function contextoEdicaoRascunho() {
  const contexto = contextoAtual();
  return () => contexto === contextoAtual();
}

export function guardarEdicaoRascunho(dados: RascunhoOperacao["dados"]) {
  contextoRecuperacao = contextoAtual();
  atualizar({ recuperacao: { dados, erro: null } });
}

export function concluirEdicaoRascunho(dados: RascunhoOperacao["dados"], erro: string | null = null) {
  if (contextoRecuperacao !== contextoAtual() || estado.recuperacao?.dados !== dados) return;
  atualizar({ recuperacao: erro ? { dados, erro } : null });
}

let filaSalvamento: Promise<unknown> = Promise.resolve();
/** Serializa instâncias desmontadas e reabertas sem perder a versão anterior. */
export function enfileirarSalvamentoRascunho<T>(salvar: () => Promise<T>): Promise<T> {
  const requisicao = filaSalvamento.catch(() => undefined).then(salvar);
  filaSalvamento = requisicao;
  return requisicao;
}


export function atualizarDocumentosRascunho(alterar: (documentos: DocumentoFinanceiro[]) => DocumentoFinanceiro[]) {
  if (!estado.rascunho) return;
  geracao += 1;
  atualizar({ rascunho: { ...estado.rascunho, documentos: alterar(estado.rascunho.documentos) } });
}
