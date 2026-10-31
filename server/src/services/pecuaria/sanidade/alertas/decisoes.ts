import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RebanhoError, auditar, hojeFazendaDate } from "../../rebanho/regras.js";
import { conferirAnimalNoFato } from "../../fatos.js";
import { confirmarFato } from "../../idempotencia.js";
import { conferirDestinoAtivoTx, exigirAutorDecisao, obterNecessidadeAtendimentoTx, vincularAplicacaoAlertaTx } from "./atendimento.js";
import { publicarNecessidadeTx } from "./produtor.js";
const base = { chave: z.string().uuid(), alertaId: z.string().uuid(), animalId: z.string().uuid(), propriedadeId: z.number().int().positive(), revisao: z.number().int().positive(), motivo: z.string().trim().min(5).max(500) };
export const decisaoNecessidadeSchema = z.discriminatedUnion("acao", [
  z.object({ ...base, acao: z.literal("CONFIRMAR_NECESSIDADE") }).strict(),
  z.object({ ...base, acao: z.literal("ADIAR"), novaData: z.string().date() }).strict(),
  z.object({ ...base, acao: z.literal("DISPENSAR") }).strict(),
  z.object({ ...base, acao: z.literal("VINCULAR_APLICACAO"), aplicacaoId: z.string().uuid(), propriedadeAplicacaoId: z.number().int().positive(), confirmarCompatibilidade: z.literal(true) }).strict(),
]);
export type DecisaoNecessidadeInput = z.infer<typeof decisaoNecessidadeSchema>;
/** Chamado depois da trava do animal e da recuperação do recibo idempotente. */
export async function decidirNecessidadeTx(tx: Prisma.TransactionClient, input: DecisaoNecessidadeInput, usuarioId: number | null, hoje = hojeFazendaDate()) {
  exigirAutorDecisao(usuarioId);
  if (input.motivo.trim().length < 5) throw new RebanhoError("VALIDACAO", "Explique a decisão", "motivo");
  const n = await obterNecessidadeAtendimentoTx(tx, input.alertaId, input.propriedadeId, input.revisao);
  if (n.animalId !== input.animalId) throw new RebanhoError("NAO_ENCONTRADO", "Alerta não encontrado para este animal");
  if (input.acao === "VINCULAR_APLICACAO") {
    if (input.confirmarCompatibilidade !== true) throw new RebanhoError("VALIDACAO", "Confirme animal, produto, cuidado e dose da aplicação", "confirmarCompatibilidade");
    const fato = await tx.aplicacaoProduto.findUnique({ where: { id: input.aplicacaoId } });
    if (!fato || fato.animalId !== n.animalId || fato.propriedadeId !== input.propriedadeAplicacaoId) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada neste animal e sítio histórico");
    await conferirAnimalNoFato(tx, n.animalId, fato.propriedadeId, fato.data);
    await vincularAplicacaoAlertaTx(tx, { alertaId: input.alertaId, alertaRevisao: input.revisao, confirmarCuidadoAlerta: true, propriedadeAtendimentoId: input.propriedadeId, motivoAlerta: input.motivo }, fato, usuarioId, true);
  } else {
    if (input.acao !== "DISPENSAR") await conferirDestinoAtivoTx(tx, n.regra);
    if (input.acao === "CONFIRMAR_NECESSIDADE" && n.situacao !== "CONFERENCIA_INICIAL") throw new RebanhoError("CONFLITO", "Esta necessidade não está em conferência inicial");
    if (input.acao === "ADIAR" && !["PROXIMO", "PENDENTE", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes de adiar");
    const dataAtencao = input.acao === "ADIAR" ? new Date(`${input.novaData}T00:00:00Z`) : input.acao === "CONFIRMAR_NECESSIDADE" ? hoje : undefined;
    if (input.acao === "ADIAR" && (!dataAtencao || dataAtencao <= hoje)) throw new RebanhoError("VALIDACAO", "O adiamento exige uma data posterior a hoje", "novaData");
    const situacao = input.acao === "DISPENSAR" ? "DISPENSADO" : input.acao === "ADIAR" ? "ADIADO" : "PENDENTE";
    await tx.necessidadeSanitaria.update({ where: { id: n.id }, data: { situacao, ...(dataAtencao ? { dataAtencao } : {}), motivo: input.motivo, revisao: { increment: 1 }, decisaoEm: new Date(), decisaoPorId: usuarioId } });
    await publicarNecessidadeTx(tx, n.id, { usuarioId }, input.acao === "DISPENSAR" ? "ENCERRAR" : "PUBLICAR");
  }
  await auditar(tx, { entidade: "NecessidadeSanitaria", entidadeId: n.id, animalId: n.animalId, propriedadeId: n.propriedadeId, acao: input.acao, usuarioId, antes: n, depois: { ...input } });
  return tx.necessidadeSanitaria.findUniqueOrThrow({ where: { id: n.id } });
}
export function decidirNecessidade(entrada: unknown, usuarioId: number | null) {
  const input = decisaoNecessidadeSchema.parse(entrada);
  exigirAutorDecisao(usuarioId);
  return confirmarFato(input, usuarioId, "DECISAO_NECESSIDADE_SANITARIA", decidirNecessidadeTx, async (tx, id) => {
    const atual = await tx.necessidadeSanitaria.findFirst({ where: { id, animalId: input.animalId, propriedadeId: input.propriedadeId } });
    if (!atual) throw new RebanhoError("NAO_ENCONTRADO", "Necessidade não encontrada neste sítio");
    return atual;
  });
}
