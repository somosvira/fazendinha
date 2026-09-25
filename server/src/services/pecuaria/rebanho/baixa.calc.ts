// Planejamento de baixa (fecha localização/destino abertos) e do estorno (reabre),
// e a regra que liga o tipo da baixa (o que aconteceu) à classe do motivo (o porquê).

import type { ClasseMotivoBaixa, TipoBaixa } from "@prisma/client";

/**
 * Classes de motivo que cada tipo de baixa aceita. Venda, abate e doação são saídas por
 * descarte (voluntário ou involuntário); morte só aceita causa de morte; extravio e
 * cadastro indevido não têm motivo de catálogo (fica a observação).
 * O cliente espelha esta tabela em `client/src/pecuaria/rebanho/lib/rotulos.ts`.
 */
export const CLASSES_POR_TIPO: Record<TipoBaixa, readonly ClasseMotivoBaixa[]> = {
  VENDA: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  ABATE: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  DOACAO: ["DESCARTE_VOLUNTARIO", "DESCARTE_INVOLUNTARIO"],
  MORTE: ["MORTE"],
  EXTRAVIO: [],
  CADASTRO_INDEVIDO: [],
};

export function motivoAceito(tipo: TipoBaixa, classe: ClasseMotivoBaixa): boolean {
  return CLASSES_POR_TIPO[tipo].includes(classe);
}

const ROTULO_TIPO: Record<TipoBaixa, string> = {
  VENDA: "venda",
  ABATE: "abate",
  DOACAO: "doação",
  MORTE: "morte",
  EXTRAVIO: "extravio",
  CADASTRO_INDEVIDO: "cadastro indevido",
};

const ROTULO_CLASSE: Record<ClasseMotivoBaixa, string> = {
  DESCARTE_VOLUNTARIO: "descarte voluntário",
  DESCARTE_INVOLUNTARIO: "descarte involuntário",
  MORTE: "morte",
};

/** Mensagem para o motivo recusado — ex.: "Motivo de morte não serve para baixa por venda". */
export function mensagemMotivoRecusado(tipo: TipoBaixa, classe: ClasseMotivoBaixa): string {
  if (CLASSES_POR_TIPO[tipo].length === 0) return `Baixa por ${ROTULO_TIPO[tipo]} não usa motivo do catálogo; descreva na observação`;
  return `Motivo de ${ROTULO_CLASSE[classe]} não serve para baixa por ${ROTULO_TIPO[tipo]}`;
}

export class BaixaError extends Error {
  constructor(message: string, public codigo: "INATIVO" | "DATA" | "CONFLITO" = "DATA") {
    super(message);
    this.name = "BaixaError";
  }
}

export interface LinhaAberta {
  id: string;
  desde: Date | string;
}

export interface PlanoBaixa {
  fecharLocalizacao: { id: string; ate: Date | string } | null;
  fecharDestino: { id: string; ate: Date | string } | null;
}

export function planejarBaixa(input: {
  animalAtivo: boolean;
  localizacaoAberta: LinhaAberta | null;
  destinoAberto: LinhaAberta | null;
  data: Date | string;
}): PlanoBaixa {
  if (!input.animalAtivo) {
    throw new BaixaError("Animal já está inativo (baixa não estornada)", "INATIVO");
  }
  const t = (v: Date | string) => (typeof v === "string" ? new Date(v) : v).getTime();
  if (input.localizacaoAberta && t(input.data) < t(input.localizacaoAberta.desde)) {
    throw new BaixaError("Data da baixa não pode ser anterior ao início da localização atual");
  }
  if (input.destinoAberto && t(input.data) < t(input.destinoAberto.desde)) {
    throw new BaixaError("Data da baixa não pode ser anterior ao início do destino atual");
  }

  return {
    fecharLocalizacao: input.localizacaoAberta ? { id: input.localizacaoAberta.id, ate: input.data } : null,
    fecharDestino: input.destinoAberto ? { id: input.destinoAberto.id, ate: input.data } : null,
  };
}

export interface PlanoEstornoBaixa {
  reabrirLocalizacao: { id: string } | null;
  reabrirDestino: { id: string } | null;
}

/**
 * Reabre exatamente as linhas que a baixa fechou (ids gravados na própria BaixaAnimal).
 * Não deduz pela data: uma movimentação no mesmo dia da baixa também fecha uma linha
 * com o mesmo `ate`, e reabrir a errada restaura a localização anterior.
 * Se já existir linha aberta (não deveria), recusa para não violar "uma aberta por animal".
 */
export function planejarEstornoBaixa(input: {
  baixa: { localizacaoFechadaId: string | null; destinoFechadoId: string | null };
  localizacaoAberta: { id: string } | null;
  destinoAberto: { id: string } | null;
}): PlanoEstornoBaixa {
  const { baixa } = input;
  if (baixa.localizacaoFechadaId && input.localizacaoAberta && input.localizacaoAberta.id !== baixa.localizacaoFechadaId) {
    throw new BaixaError("Animal já tem uma localização aberta; não é possível reabrir a da baixa", "CONFLITO");
  }
  if (baixa.destinoFechadoId && input.destinoAberto && input.destinoAberto.id !== baixa.destinoFechadoId) {
    throw new BaixaError("Animal já tem um destino aberto; não é possível reabrir o da baixa", "CONFLITO");
  }
  return {
    reabrirLocalizacao: baixa.localizacaoFechadaId ? { id: baixa.localizacaoFechadaId } : null,
    reabrirDestino: baixa.destinoFechadoId ? { id: baixa.destinoFechadoId } : null,
  };
}
