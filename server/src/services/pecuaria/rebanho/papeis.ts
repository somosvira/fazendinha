import { Prisma, type PapelReprodutivo } from "@prisma/client";
import { auditar, RebanhoError } from "./regras.js";
import { resolverPapelReprodutivo } from "./papel-reprodutivo.calc.js";

export async function papelReprodutivoNaDataTx(tx: Prisma.TransactionClient, animalId: string, data: Date) {
  const periodos = await tx.periodoReprodutivoAnimal.findMany({ where: { animalId, revogadoEm: null, inicio: { lte: data }, OR: [{ fim: null }, { fim: { gt: data } }] } });
  return resolverPapelReprodutivo(periodos, data);
}

/** O chamador trava o animal. A seleção explícita não pode sobrescrever um conflito histórico. */
export async function registrarPapelReprodutivoTx(tx: Prisma.TransactionClient, input: {
  animalId: string; tipo: PapelReprodutivo; inicio: Date; destinoOrigemId: string; usuarioId: number | null;
}) {
  const anteriores = await tx.periodoReprodutivoAnimal.findMany({ where: { animalId: input.animalId, revogadoEm: null } });
  const atual = resolverPapelReprodutivo(anteriores, input.inicio);
  if (atual.estado === "CONFLITO") throw new RebanhoError("CONFLITO", "Há papéis reprodutivos conflitantes nesta data; concilie o histórico antes de alterar", "papelReprodutivo");
  if (atual.papel === input.tipo) return;
  if (anteriores.some(p => p.inicio > input.inicio)) throw new RebanhoError("CONFLITO", "A mudança antecede papéis já registrados; revise a cronologia", "data");
  for (const p of anteriores.filter(p => atual.evidencias.includes(p.id))) {
    const depois = await tx.periodoReprodutivoAnimal.update({ where: { id: p.id }, data: { fim: input.inicio, fimAntesDaMudanca: p.fim, encerradoPorDestinoId: input.destinoOrigemId } });
    await auditar(tx, { entidade: "PeriodoReprodutivoAnimal", entidadeId: p.id, animalId: input.animalId, acao: "ENCERRAMENTO_PAPEL", usuarioId: input.usuarioId, antes: p, depois });
  }
  const novo = await tx.periodoReprodutivoAnimal.create({ data: { animalId: input.animalId, tipo: input.tipo, inicio: input.inicio, origem: "MANUAL", destinoOrigemId: input.destinoOrigemId, criadoPorId: input.usuarioId } });
  await auditar(tx, { entidade: "PeriodoReprodutivoAnimal", entidadeId: novo.id, animalId: input.animalId, acao: "PAPEL_REGISTRADO", usuarioId: input.usuarioId, depois: novo });
}

export async function desfazerPapelDoDestinoTx(tx: Prisma.TransactionClient, animalId: string, destinoId: string, usuarioId: number | null) {
  const periodos = await tx.periodoReprodutivoAnimal.findMany({ where: { animalId, revogadoEm: null, OR: [{ destinoOrigemId: destinoId }, { encerradoPorDestinoId: destinoId }] } });
  for (const p of periodos) {
    const depois = await tx.periodoReprodutivoAnimal.update({ where: { id: p.id }, data: p.destinoOrigemId === destinoId
      ? { revogadoEm: new Date(), motivoRevogacao: "Mudança de destino desfeita" }
      : { fim: p.fimAntesDaMudanca, fimAntesDaMudanca: null, encerradoPorDestinoId: null } });
    await auditar(tx, { entidade: "PeriodoReprodutivoAnimal", entidadeId: p.id, animalId, acao: "DESFAZER_PAPEL", usuarioId, antes: p, depois });
  }
}

export async function idsComPapelReprodutivo(tx: Prisma.TransactionClient, tipo: PapelReprodutivo, hoje: Date): Promise<string[]> {
  const ids = await tx.$queryRaw<{ id: string }[]>`
    WITH referencias AS (
      SELECT a.id, COALESCE(b.data,${hoje}::date) AS data, b.data IS NOT NULL AS baixado
      FROM pecuaria."Animal" a
      LEFT JOIN LATERAL (SELECT b.data FROM pecuaria."BaixaAnimal" b WHERE b."animalId"=a.id AND b."estornadaEm" IS NULL LIMIT 1) b ON TRUE
    ), evidencias AS (
      SELECT r.id, p.tipo FROM referencias r
      JOIN pecuaria."PeriodoReprodutivoAnimal" p ON p."animalId"=r.id AND p."revogadoEm" IS NULL AND p.inicio<=r.data
      WHERE p.fim IS NULL OR p.fim>r.data OR (r.baixado AND p.fim=r.data AND NOT EXISTS (
        SELECT 1 FROM pecuaria."PeriodoReprodutivoAnimal" vigente WHERE vigente."animalId"=r.id AND vigente."revogadoEm" IS NULL
        AND vigente.inicio<=r.data AND (vigente.fim IS NULL OR vigente.fim>r.data)))
    )
    SELECT id FROM evidencias GROUP BY id HAVING count(DISTINCT tipo)=1 AND min(tipo)=${tipo}`;
  return ids.map(a => a.id);
}
