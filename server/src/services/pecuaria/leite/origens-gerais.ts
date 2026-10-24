import { Prisma } from "@prisma/client";
import { z } from "zod";
import { RebanhoError } from "../rebanho/regras.js";

const evidenciaOrigem = z.object({
  animalId: z.string(), finalidadeId: z.string(), localizacaoId: z.string(), lactacaoId: z.string().nullable(),
});
type LinhaOrigemGeral = {
  animalId: string; propriedadeId: number; data: Date; entradaId: string | null; evidencia: unknown;
};

/** A projeção acontece no banco: nunca transporta a composição dos demais animais do tanque.
 * Somente a versão atual da aferição e suas entradas confirmadas restringem correções.
 * Entradas anuladas conservam o snapshot original, sem reativar vínculos regularizados. */
export async function consultarOrigensGeraisTx(tx: Prisma.TransactionClient, animalIds: string[], desde?: Date, ate?: Date) {
  const ids = [...new Set(animalIds)];
  if (!ids.length) return [];
  const linhas = await tx.$queryRaw<LinhaOrigemGeral[]>(Prisma.sql`
    SELECT pedido."animalId", d."propriedadeId", d."dataOperacional" AS data,
      e.id AS "entradaId", vinculo.evidencia
    FROM unnest(${ids}::text[]) AS pedido("animalId")
    JOIN pecuaria."MedicaoGeralLeite" g ON g."animaisOrigem" @> jsonb_build_array(pedido."animalId")
    JOIN pecuaria."SessaoOrdenha" s ON s.id=g."sessaoId"
    JOIN pecuaria."DiaProducaoLeite" d ON d.id=s."diaId"
    LEFT JOIN pecuaria."EntradaProducaoLeite" e ON e."medicaoGeralId"=g.id AND e.status='CONFIRMADA'
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object('animalId', a->'animalId', 'finalidadeId', a->'finalidadeId',
        'localizacaoId', a->'localizacaoId', 'lactacaoId', a->'lactacaoId') AS evidencia
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(e.snapshot->'animaisOrigem')='array'
        THEN e.snapshot->'animaisOrigem' ELSE '[]'::jsonb END) a
      WHERE a->>'animalId'=pedido."animalId" LIMIT 1
    ) vinculo ON true
    WHERE true
      ${desde ? Prisma.sql`AND d."dataOperacional">=${desde}::date` : Prisma.empty}
      ${ate ? Prisma.sql`AND d."dataOperacional"<${ate}::date` : Prisma.empty}
  `);
  return linhas.filter(l => ids.includes(l.animalId)).map(l => {
    if (l.entradaId == null) return { animalId: l.animalId, propriedadeId: l.propriedadeId, data: l.data, evidencias: [] };
    const evidencia = evidenciaOrigem.safeParse(l.evidencia);
    if (!evidencia.success || evidencia.data.animalId !== l.animalId)
      throw new RebanhoError("CONFLITO", "A origem confirmada não tem evidência histórica válida; regularize a entrada antes de alterar o animal");
    return { animalId: l.animalId, propriedadeId: l.propriedadeId, data: l.data, evidencias: [evidencia.data] };
  });
}
