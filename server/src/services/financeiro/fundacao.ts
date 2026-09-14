import { prisma } from "../../db.js";

// Dev usa db push, que cria as colunas mas não executa os backfills da migration.
// O tipo legado DINHEIRO já foi convertido para CAIXA e removido do schema.
// Nunca substituir papéis já escolhidos por uma projeção do tipo legado.
export async function garantirCadastrosFinanceiros() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "ParceiroPapel" ("parceiroId", "papel")
      SELECT p.id, unnest(CASE WHEN p.tipo = 'AMBOS'
        THEN ARRAY['CLIENTE', 'FORNECEDOR']::"PapelParceiro"[]
        ELSE ARRAY[p.tipo::text::"PapelParceiro"] END)
      FROM "Parceiro" p
      WHERE NOT EXISTS (SELECT 1 FROM "ParceiroPapel" pp WHERE pp."parceiroId" = p.id)
      ON CONFLICT DO NOTHING
    `;
  });
}
