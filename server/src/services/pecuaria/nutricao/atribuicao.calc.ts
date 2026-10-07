import { Prisma } from "@prisma/client";
import type { Participacao } from "./animalDias.calc.js";

type Item = { produtoId: string; unidade: string; quantidadeConfirmada: Prisma.Decimal | string; custoConhecido: Prisma.Decimal | string | null };

/** Divide unidades mínimas pelos maiores restos; UUID desempata frações iguais. */
function distribuir(total: Prisma.Decimal, participacoes: Participacao[], animalDias: number, casas: number) {
  if (!total.isFinite() || total.lt(0)) throw new Error("Total inválido para atribuição");
  const fator = new Prisma.Decimal(10).pow(casas);
  const unidades = total.mul(fator).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const quotas = participacoes.map((p) => unidades.mul(p.dias).div(animalDias));
  const parcelas = quotas.map((q) => q.floor());
  const restantes = unidades.minus(parcelas.reduce((s, p) => s.plus(p), new Prisma.Decimal(0))).toNumber();
  const ordem = participacoes.map((p, i) => ({ i, animalId: p.animalId, resto: quotas[i].minus(parcelas[i]) }))
    .sort((a, b) => b.resto.comparedTo(a.resto) || a.animalId.localeCompare(b.animalId));
  for (let i = 0; i < restantes; i++) parcelas[ordem[i].i] = parcelas[ordem[i].i].plus(1);
  return parcelas.map((p) => p.div(fator).toFixed(casas));
}

export function calcularAtribuicao(participacoes: Participacao[], animalDias: number, itens: Item[]) {
  if (animalDias <= 0 || participacoes.some((p) => !Number.isInteger(p.dias) || p.dias <= 0)
    || new Set(participacoes.map((p) => p.animalId)).size !== participacoes.length
    || participacoes.reduce((s, p) => s + p.dias, 0) !== animalDias) throw new Error("Participação incompatível com animal-dias");
  const ordenadas = [...participacoes].sort((a, b) => a.animalId.localeCompare(b.animalId));
  const parcelas = itens.map((item) => ({ item,
    quantidades: distribuir(new Prisma.Decimal(item.quantidadeConfirmada), ordenadas, animalDias, 3),
    custos: item.custoConhecido == null ? null : distribuir(new Prisma.Decimal(item.custoConhecido), ordenadas, animalDias, 2),
  }));
  const coberturaCustoCompleta = itens.every((i) => i.custoConhecido != null);
  const temCustoConhecido = itens.some((i) => i.custoConhecido != null);
  return {
    custoConhecido: temCustoConhecido ? itens.reduce((s, i) => s.plus(i.custoConhecido ?? 0), new Prisma.Decimal(0)).toFixed(2) : null,
    coberturaCustoCompleta,
    participacoes: ordenadas.map((p, indice) => ({ ...p, coberturaCustoCompleta,
      custoConhecido: temCustoConhecido ? parcelas.reduce((s, i) => s.plus(i.custos?.[indice] ?? 0), new Prisma.Decimal(0)).toFixed(2) : null,
      custoConhecidoPorDia: temCustoConhecido ? parcelas.reduce((s, i) => s.plus(i.custos?.[indice] ?? 0), new Prisma.Decimal(0)).div(p.dias).toFixed(4) : null,
      itens: parcelas.map(({ item, quantidades, custos }) => ({ produtoId: item.produtoId, unidade: item.unidade,
        quantidadeAtribuida: quantidades[indice], quantidadePorDia: new Prisma.Decimal(quantidades[indice]).div(p.dias).toFixed(6), custoConhecido: custos?.[indice] ?? null })),
    })),
  };
}
