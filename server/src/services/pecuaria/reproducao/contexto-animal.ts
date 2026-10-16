import type { Prisma } from "@prisma/client";
import {
  calcularContextoAnimalNaData,
  dataCalendarioContexto,
  type ContextoAnimalNaData,
} from "./contexto-animal.calc.js";

type LeitorContextoAnimal = Pick<Prisma.TransactionClient,
  "animal" | "partoAnimal" | "tentativaReprodutiva" | "lactacaoAnimal" | "gestacaoAnimal"
  | "localizacaoAnimal" | "avaliacaoReprodutiva" | "situacaoInicialReprodutiva"
>;

function agruparPorAnimal<T extends { animalId: string }>(fatos: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const fato of fatos) {
    const grupo = grupos.get(fato.animalId);
    if (grupo) grupo.push(fato);
    else grupos.set(fato.animalId, [fato]);
  }
  return grupos;
}

/**
 * Leitura clínica em lote. O chamador deve autorizar os animais na localização da data
 * consultada; fatos anteriores acompanham o animal entre sítios e não expõem custos.
 * Usar a transação do fluxo quando a projeção participar da revisão de uma escrita.
 */
export async function obterContextosAnimaisNaDataTx(
  tx: LeitorContextoAnimal,
  animalIds: readonly string[],
  dataReferencia: Date,
): Promise<Map<string, ContextoAnimalNaData>> {
  const referencia = dataCalendarioContexto(dataReferencia);
  const ids = [...new Set(animalIds)];
  if (!ids.length) return new Map();
  const animalId = { in: ids };
  const fatos = { animalId, status: "VALIDO" as const, data: { lte: referencia } };
  const [animais, partos, tentativas, lactacoes, gestacoes, localizacoes, avaliacoes, iniciais] = await Promise.all([
    tx.animal.findMany({
      where: { id: { in: ids } }, select: { id: true, dataEntrada: true, partosAntesDaEntrada: true },
    }),
    tx.partoAnimal.findMany({
      where: fatos,
      select: { id: true, animalId: true, propriedadeId: true, data: true, status: true, tipo: true, incluidoSaldoAnterior: true },
    }),
    tx.tentativaReprodutiva.findMany({
      where: fatos,
      select: { id: true, animalId: true, propriedadeId: true, data: true, status: true, tipo: true, ciclo: true, ordem: true, criadoEm: true },
    }),
    tx.lactacaoAnimal.findMany({
      where: { animalId, inicio: { lte: referencia } },
      select: { id: true, animalId: true, propriedadeId: true, partoId: true, inicio: true, encerradaEm: true, origem: true },
    }),
    tx.gestacaoAnimal.findMany({
      where: { animalId, status: "VALIDO", confirmadaEm: { lte: referencia } },
      select: { id: true, animalId: true, propriedadeId: true, tentativaId: true, confirmadaEm: true, encerradaEm: true, status: true },
    }),
    tx.localizacaoAnimal.findMany({
      where: { animalId, desde: { lte: referencia }, OR: [{ ate: null }, { ate: { gt: referencia } }] },
      select: { id: true, animalId: true, propriedadeId: true, loteId: true, desde: true, ate: true },
    }),
    // Projeção de leitura da evidência comum; não grava pela view de compatibilidade.
    tx.avaliacaoReprodutiva.findMany({
      where: fatos, select: { animalId: true, data: true, resultado: true, status: true },
    }),
    tx.situacaoInicialReprodutiva.findMany({
      where: fatos, select: { animalId: true, data: true, situacao: true, status: true },
    }),
  ]);
  const porAnimal = {
    partos: agruparPorAnimal(partos), tentativas: agruparPorAnimal(tentativas),
    lactacoes: agruparPorAnimal(lactacoes), gestacoes: agruparPorAnimal(gestacoes),
    localizacoes: agruparPorAnimal(localizacoes), avaliacoes: agruparPorAnimal(avaliacoes), iniciais: agruparPorAnimal(iniciais),
  };
  return new Map(animais.map(animal => [animal.id, calcularContextoAnimalNaData({
    animal,
    partos: porAnimal.partos.get(animal.id) ?? [], tentativas: porAnimal.tentativas.get(animal.id) ?? [],
    lactacoes: porAnimal.lactacoes.get(animal.id) ?? [], gestacoes: porAnimal.gestacoes.get(animal.id) ?? [],
    localizacoes: porAnimal.localizacoes.get(animal.id) ?? [], avaliacoes: porAnimal.avaliacoes.get(animal.id) ?? [],
    iniciais: porAnimal.iniciais.get(animal.id) ?? [],
  }, referencia)]));
}
