import { travarConfiguracaoAlertaTx } from "../alertas/concorrencia.js";
import { validarReferenciasProgramacaoTx } from "./consulta.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { RebanhoError, auditar } from "../../rebanho/regras.js";
import { hashConteudo } from "../../../alertas/publicacao.js";
import { publicarEstadoProgramacaoTx } from "./atendimento.js";
import { cadastroProgramacaoSchema, type CadastroProgramacao } from "./schemas.js";
export async function previaRevisaoProgramacao(id: string, propriedadeId: number) {
  return prisma.$transaction(async tx => {
    const p = await tx.programacaoSanitaria.findFirst({ where: { id, propriedadeId } });
    if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Programação não encontrada");
    const necessidades = await tx.necessidadeProgramacaoSanitaria.findMany({ where: { programacaoId: id }, orderBy: { id: "asc" } });
    return { programacaoId: id, revisao: p.revisao, abertas: necessidades.filter(n => !["REALIZADO", "DISPENSADO", "ENCERRADO", "INVALIDADO"].includes(n.situacao)).length, chavePrevia: hashConteudo({ p, necessidades }) };
  }, { isolationLevel: "RepeatableRead" });
}
export async function revisarProgramacao(id: string, propriedadeId: number, input: { revisao: number; chavePrevia: string; motivo: string; destinoAbertas: "MANTER" | "ENCERRAR"; cadastro?: CadastroProgramacao }, usuarioId: number) {
  return prisma.$transaction(async tx => {
    await travarConfiguracaoAlertaTx(tx, "programacao", id);
    const p = await tx.programacaoSanitaria.findFirst({ where: { id, propriedadeId } });
    if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Programação não encontrada");
    const necessidades = await tx.necessidadeProgramacaoSanitaria.findMany({ where: { programacaoId: id }, orderBy: { id: "asc" } });
    if (p.revisao !== input.revisao || hashConteudo({ p, necessidades }) !== input.chavePrevia) throw new RebanhoError("CONFLITO", "As pendências mudaram. Confira nova prévia");
    const cadastro = input.cadastro && cadastroProgramacaoSchema.parse(input.cadastro);
    if (cadastro) await validarReferenciasProgramacaoTx(tx, cadastro);
    if (cadastro && cadastro.propriedadeId !== propriedadeId) throw new RebanhoError("VALIDACAO", "Revisão não transfere programação de sítio");
    for (const n of necessidades) {
      if (n.regraNecessidadeId || !n.alertaId) continue;
      const a = await tx.alerta.findUniqueOrThrow({ where: { id: n.alertaId } });
      const resumo = a.resumo as Prisma.JsonObject;
      if (!resumo.programacaoSnapshot) throw new RebanhoError("CONFLITO", "Necessidade sem revisão preservada exige reconciliação antes de alterar a programação");
      if (input.destinoAbertas === "ENCERRAR" && a.ciclo === "ABERTO") {
        const alterada = await tx.necessidadeProgramacaoSanitaria.updateMany({ where: { id: n.id, revisao: n.revisao }, data: { situacao: "ENCERRADO", revisao: { increment: 1 } } });
        if (alterada.count !== 1) throw new RebanhoError("CONFLITO", "O cuidado mudou durante o encerramento. Confira nova prévia");
        await publicarEstadoProgramacaoTx(tx, n.id, { usuarioId }, "ENCERRAR");
      }
    }
    const depois = await tx.programacaoSanitaria.update({ where: { id }, data: cadastro ? { ...cadastro, vigenciaInicio: cadastro.vigenciaInicio ? new Date(`${cadastro.vigenciaInicio}T00:00:00Z`) : null, vigenciaFim: cadastro.vigenciaFim ? new Date(`${cadastro.vigenciaFim}T00:00:00Z`) : null, ativo: false, ativadoEm: null, revisao: { increment: 1 } } : { ativo: false, revisao: { increment: 1 } } });
    await auditar(tx, { entidade: "ProgramacaoSanitaria", entidadeId: id, propriedadeId, acao: cadastro ? "REVISAO" : "INATIVACAO", usuarioId, antes: p, depois: { ...depois, motivo: input.motivo, destinoAbertas: input.destinoAbertas } });
    return depois;
  }, { isolationLevel: "ReadCommitted" });
}
