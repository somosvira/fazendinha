import type { Prisma } from "@prisma/client";
import { confirmarFato } from "../../idempotencia.js";
import { conferirAnimalNoFato } from "../../fatos.js";
import { auditar, hojeFazendaDate, RebanhoError } from "../../rebanho/regras.js";
import { decisaoNecessidadeSchema, type DecisaoNecessidadeInput } from "../alertas/decisoes.js";
import { obterNecessidadeProgramaTx, publicarEstadoProgramacaoTx, vincularAplicacaoProgramacaoTx } from "./atendimento.js";
export async function decidirProgramacaoTx(tx: Prisma.TransactionClient, input: DecisaoNecessidadeInput, usuarioId: number | null) {
  if (!usuarioId || usuarioId < 1) throw new RebanhoError("VALIDACAO", "Decisão exige pessoa autenticada");
  const n = await obterNecessidadeProgramaTx(tx, input.alertaId, input.propriedadeId, input.revisao);
  if (n.sujeitoTipo !== "ANIMAL" || n.sujeitoId !== input.animalId) throw new RebanhoError("NAO_ENCONTRADO", "Cuidado não encontrado para o animal");
  if (input.acao === "VINCULAR_APLICACAO") {
    const fato = await tx.aplicacaoProduto.findUnique({ where: { id: input.aplicacaoId } });
    if (!fato || fato.propriedadeId !== input.propriedadeAplicacaoId || fato.animalId !== input.animalId) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada no animal e sítio histórico");
    await conferirAnimalNoFato(tx, fato.animalId, input.propriedadeAplicacaoId, fato.data);
    await vincularAplicacaoProgramacaoTx(tx, { alertaId: input.alertaId, alertaRevisao: input.revisao, confirmarCuidadoAlerta: input.confirmarCompatibilidade, propriedadeAtendimentoId: input.propriedadeId }, fato, usuarioId, true);
  } else {
    if (input.acao === "CONFIRMAR_NECESSIDADE" && n.situacao !== "CONFERENCIA_INICIAL") throw new RebanhoError("CONFLITO", "Necessidade não está em conferência inicial");
    if (input.acao === "ADIAR" && !["PENDENTE", "PROXIMO", "ADIADO"].includes(n.situacao)) throw new RebanhoError("CONFLITO", "Confira a necessidade antes de adiar");
    const data = input.acao === "ADIAR" ? new Date(`${input.novaData}T00:00:00Z`) : null;
    if (data && data <= hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "Adiamento exige data posterior a hoje");
    await tx.necessidadeProgramacaoSanitaria.update({ where: { id: n.id }, data: { situacao: input.acao === "DISPENSAR" ? "DISPENSADO" : input.acao === "ADIAR" ? "ADIADO" : "PENDENTE", revisao: { increment: 1 } } });
    await publicarEstadoProgramacaoTx(tx, n.id, { usuarioId }, input.acao === "DISPENSAR" ? "ENCERRAR" : "PUBLICAR", { motivo: input.motivo, ...(data ? { prazo: data } : {}) });
  }
  await auditar(tx, { entidade: "NecessidadeProgramacaoSanitaria", entidadeId: n.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: input.acao, usuarioId, antes: n, depois: input });
  return tx.necessidadeProgramacaoSanitaria.findUniqueOrThrow({ where: { id: n.id } });
}
export function decidirProgramacao(entrada: unknown, usuarioId: number | null) {
  const input = decisaoNecessidadeSchema.parse(entrada);
  return confirmarFato(input, usuarioId, "DECISAO_PROGRAMACAO_SANITARIA", decidirProgramacaoTx, (tx,id) => tx.necessidadeProgramacaoSanitaria.findUniqueOrThrow({ where: { id } }));
}
