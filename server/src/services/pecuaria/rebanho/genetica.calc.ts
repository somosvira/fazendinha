// Regras puras da filiação (v2 · Genética): quem pode ser mãe/pai, ciclo e composição do filho.
// Sem Prisma — o service carrega os dados (genitores, ancestrais) e chama estas funções.

import { calcularComposicaoFilho, type FracaoRaca } from "./composicao.calc.js";

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

export type GenitorRef =
  | { tipo: "ANIMAL"; id: string; sexo: "F" | "M"; dataNascimento: string }
  | { tipo: "EXTERNO"; id: string; sexo: "F" | "M"; ativo?: boolean };

export interface FilhoRef {
  id: string;
  dataNascimento: string;
}

/** Meses inteiros entre duas datas ISO ('YYYY-MM-DD'), aproximação por 30 dias (mesma usada só para o aviso de intervalo entre partos). */
function mesesEntre(deISO: string, ateISO: string): number {
  const dias = (Date.parse(ateISO) - Date.parse(deISO)) / 86_400_000;
  return dias / 30;
}

/**
 * Valida a filiação proposta para `filho`: sexo dos genitores, genitor animal não pode ser o
 * próprio filho, e genitor animal precisa ter nascido estritamente antes do filho. Retorna a
 * lista de erros (vazia = válida) e os avisos que não bloqueiam (mãe com <15 meses de idade no parto).
 */
export function validarFiliacao(
  filho: FilhoRef,
  mae: GenitorRef | null,
  pai: GenitorRef | null,
): { erros: ErroValidacao[]; avisos: ErroValidacao[] } {
  const erros: ErroValidacao[] = [];
  const avisos: ErroValidacao[] = [];

  if (mae) {
    if (mae.sexo !== "F") erros.push({ campo: "maeId", mensagem: "A mãe precisa ser uma fêmea" });
    if (mae.tipo === "ANIMAL") {
      if (mae.id === filho.id) erros.push({ campo: "maeId", mensagem: "O animal não pode ser sua própria mãe" });
      else if (mae.dataNascimento >= filho.dataNascimento) {
        erros.push({ campo: "maeId", mensagem: "A mãe precisa ter nascido antes do filho" });
      } else if (mesesEntre(mae.dataNascimento, filho.dataNascimento) < 15) {
        avisos.push({ campo: "maeId", mensagem: "A mãe teria menos de 15 meses de idade no parto" });
      }
    }
  }

  if (pai) {
    if (pai.sexo !== "M") erros.push({ campo: "paiId", mensagem: "O pai precisa ser um macho" });
    if (pai.tipo === "ANIMAL") {
      if (pai.id === filho.id) erros.push({ campo: "paiId", mensagem: "O animal não pode ser seu próprio pai" });
      else if (pai.dataNascimento >= filho.dataNascimento) {
        erros.push({ campo: "paiId", mensagem: "O pai precisa ter nascido antes do filho" });
      }
    }
  }

  return { erros, avisos };
}

/**
 * Aviso (não bloqueia): a mãe teve outro parto a menos de 15 meses do nascimento do filho.
 * `partosAnteriores` = datas de nascimento dos outros filhos dessa mãe.
 */
export function validarIntervaloPartos(dataNascimentoFilho: string, partosAnteriores: string[]): ErroValidacao[] {
  const LIMITE_MESES = 15;
  for (const parto of partosAnteriores) {
    const meses = Math.abs(mesesEntre(parto, dataNascimentoFilho));
    if (meses < LIMITE_MESES) {
      return [{ campo: "maeId", mensagem: `A mãe teve outro parto há menos de ${LIMITE_MESES} meses` }];
    }
  }
  return [];
}

/**
 * Verifica se `genitorId` está entre os descendentes de `filhoId` até 3 gerações — nesse caso o
 * genitor seria filho/neto/bisneto do próprio filho, o que fecharia um ciclo de ancestralidade.
 * `descendentes` já vem carregado pelo service (ids de filho, nietos e bisnietos de `filhoId`).
 */
export function genitorEhDescendente(genitorId: string, descendentes: Set<string>): boolean {
  return descendentes.has(genitorId);
}

/**
 * Composição do filho a partir da composição de cada genitor (mãe/pai, animal ou externo).
 * Lado desconhecido = [] (contribui 0 no cálculo; a diferença fica "desconhecida" no rótulo).
 * `null` quando os dois lados são desconhecidos (nada para sugerir).
 */
export function composicaoDosGenitores(maeComposicao: FracaoRaca[] | null, paiComposicao: FracaoRaca[] | null): FracaoRaca[] | null {
  if ((maeComposicao == null || maeComposicao.length === 0) && (paiComposicao == null || paiComposicao.length === 0)) return null;
  return calcularComposicaoFilho(maeComposicao ?? [], paiComposicao ?? []);
}
