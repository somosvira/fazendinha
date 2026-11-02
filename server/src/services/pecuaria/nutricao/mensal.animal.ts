import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { calcularAtribuicao } from "./atribuicao.calc.js";
import { textoData } from "./mensal.calc.js";

/** Página mista sem transformar os novos dias em fechamentos legados. */
export async function paginaConsumoAnimal(
  animalId: string,
  propriedadeId: number | null,
  pagina: number,
  limite: number,
) {
  return prisma.$transaction(
    async (tx) => {
      const linhas = await tx.$queryRaw<
        Array<{ id: string; origem: string; total: bigint }>
      >(Prisma.sql`
   WITH periodos AS (
    SELECT f.id,'LEGADO' AS origem,f.inicio AS data FROM pecuaria."FechamentoConsumo" f
      JOIN pecuaria."ParticipacaoConsumoAnimal" p ON p."fechamentoId"=f.id
      WHERE p."animalId"=${animalId} ${propriedadeId === null ? Prisma.empty : Prisma.sql`AND f."propriedadeId"=${propriedadeId}`}
    UNION ALL
    SELECT d.id,'DIARIO' AS origem,d.data FROM pecuaria."ConsumoDiario" d
      JOIN pecuaria."MesNutricao" m ON m.id=d."mesId" JOIN pecuaria."ParticipacaoConsumoDiario" p ON p."diaId"=d.id
      WHERE p."animalId"=${animalId} AND d.situacao='EFETIVADO' ${propriedadeId === null ? Prisma.empty : Prisma.sql`AND m."propriedadeId"=${propriedadeId}`}
   ) SELECT id,origem,COUNT(*) OVER() AS total FROM periodos ORDER BY data DESC,id LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`);
      const dias = await tx.consumoDiario.findMany({
        where: {
          id: {
            in: linhas.filter((l) => l.origem === "DIARIO").map((l) => l.id),
          },
        },
        include: {
          mes: { include: { lote: { select: { id: true, nome: true } } } },
          participantes: { include: { animal: { select: { brinco: true } } } },
          itens: true,
        },
      });
      const total = linhas.length
        ? Number(linhas[0].total)
        : pagina === 1
          ? 0
          : (await tx.fechamentoConsumo.count({
              where: {
                ...(propriedadeId === null ? {} : { propriedadeId }),
                participacoes: { some: { animalId } },
              },
            })) +
            (await tx.consumoDiario.count({
              where: {
                situacao: "EFETIVADO",
                mes: propriedadeId === null ? {} : { propriedadeId },
                participantes: { some: { animalId } },
              },
            }));
      return { linhas, dias, total };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
export function apresentarConsumoDiario(
  d: Awaited<ReturnType<typeof paginaConsumoAnimal>>["dias"][number],
  animalId: string,
  verValores: boolean,
) {
  const parcelas = calcularAtribuicao(
    d.participantes.map((p) => ({ ...p, dias: 1 })),
    d.participantes.length,
    d.itens.map((i) => ({
      ...i,
      quantidadeConfirmada: i.confirmada,
      custoConhecido: verValores ? i.custoLiquido : null,
    })),
  );
  const p = parcelas.participacoes.find((p) => p.animalId === animalId)!;
  const versao = d.dietaNome?.match(/ v(\d+)$/)?.[1];
  return {
    ...p,
    id: d.id,
    participacaoId: d.participantes.find((p) => p.animalId === animalId)!.id,
    origem: "DIARIO" as const,
    mesId: d.mesId,
    inicio: textoData(d.data),
    fim: textoData(d.data),
    status: "CONFIRMADO" as const,
    lote: d.mes.lote,
    propriedadeId: d.mes.propriedadeId,
    dieta: {
      nome: d.dietaNome ?? "Dieta histórica",
      versao: versao ? Number(versao) : null,
    },
    animal: {
      brinco: d.participantes.find((p) => p.animalId === animalId)!.animal
        .brinco,
    },
    coberturaCustoCompleta: true,
    itens: p.itens.map((i) => ({
      ...i,
      nome: d.itens.find((x) => x.produtoId === i.produtoId)!.nome,
    })),
  };
}
