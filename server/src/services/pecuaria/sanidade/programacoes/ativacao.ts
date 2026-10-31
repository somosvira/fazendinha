import { travarConfiguracaoAlertaTx } from "../alertas/concorrencia.js";
import { marcarReavaliacaoSanitariaTx } from "../alertas/cobertura.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { hashConteudo } from "../../../alertas/publicacao.js";
import { RebanhoError,auditar } from "../../rebanho/regras.js";
import { diaCivil, dataCivil } from "../alertas/datas.calc.js";
import { pendenciasAtivacao } from "./consulta.js";
import { elegivelProgramacao, janelaPublicavel } from "./elegibilidade.calc.js";
async function previaTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number, hoje: Date) {
  const p = await tx.programacaoSanitaria.findFirst({ where: { id, propriedadeId } });
  if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Programação não encontrada no sítio");
  const pendencias = pendenciasAtivacao(p);
  const regraEquivalente = p.regraEquivalenteId ? await tx.regraAlertaSanitario.findUnique({ where: { id: p.regraEquivalenteId } }) : null;
  if (p.regraEquivalenteId && (!regraEquivalente?.ativo || !regraEquivalente.propriedadeIds.includes(propriedadeId) || regraEquivalente.produtoId !== p.produtoId || p.recorrencia === "CAMPANHA_ANUAL")) pendencias.push("Equivalência com a regra de origem não está disponível");
  const animais = await tx.animal.findMany({ where: { localizacoes: { some: { propriedadeId, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] } }, baixas: { none: { estornadaEm: null, data: { lte: hoje } } } }, orderBy: { id: "asc" }, select: { id: true, sexo: true, dataNascimento: true, atualizadoEm: true } });
  const elegiveis = animais.filter(a => elegivelProgramacao(p.publico, a, hoje));
  const janelas = janelaPublicavel({ ...p, ativadoEm: hoje }, hoje);
  const produto = p.produtoId ? await tx.produto.findUnique({ where: { id: p.produtoId }, select: { id: true, ativo: true, usoSanitario: true } }) : null;
  if (p.produtoId && (!produto?.ativo || !produto.usoSanitario)) pendencias.push("Produto sanitário não disponível");
  const exame = p.tipoExameId ? await tx.tipoExame.findUnique({ where: { id: p.tipoExameId }, select: { id: true, ativo: true, contexto: true } }) : null;
  if (p.executor === "EXAME_ANIMAL" && (!exame?.ativo || exame.contexto === "REPRODUTIVO")) pendencias.push("Tipo de exame não disponível");
  return { programacaoId: id, revisao: p.revisao, ativo: p.ativo, dia: hoje.toISOString().slice(0, 10), pendencias,
    animaisElegiveis: elegiveis.length, janelas, chavePrevia: hashConteudo({ p, animais, produto, exame, regraEquivalente, hoje }) };
}
export async function previaAtivacaoProgramacao(id: string, propriedadeId: number, agora = new Date()) {
  return prisma.$transaction(tx => previaTx(tx, id, propriedadeId, dataCivil(diaCivil(agora))), { isolationLevel: "RepeatableRead" });
}
export async function ativarProgramacao(id: string, propriedadeId: number, input: { revisao: number; chavePrevia: string }, usuarioId:number, agora = new Date()) {
  if(!Number.isInteger(usuarioId)||usuarioId<1)throw new RebanhoError("VALIDACAO","A ativação exige uma pessoa autenticada");
  return prisma.$transaction(async tx => {
    await travarConfiguracaoAlertaTx(tx, "programacao", id);
    const hoje = dataCivil(diaCivil(agora)); const previa = await previaTx(tx, id, propriedadeId, hoje);
    if (previa.revisao !== input.revisao || previa.chavePrevia !== input.chavePrevia) throw new RebanhoError("CONFLITO", "Os dados mudaram. Confira uma nova prévia");
    if (previa.pendencias.length) throw new RebanhoError("VALIDACAO", previa.pendencias.join("; "));
    if (previa.ativo) return { programacaoId: id, ativo: true, revisao: previa.revisao };
    await tx.programacaoSanitaria.update({ where: { id }, data: { ativo: true, ativadoEm: hoje, revisao: { increment: 1 } } });
    await auditar(tx,{entidade:"ProgramacaoSanitaria",entidadeId:id,propriedadeId,acao:"ATIVACAO_CONFERIDA",usuarioId,antes:{ativo:false,revisao:previa.revisao},depois:{ativo:true,revisao:previa.revisao+1,ativadoEm:hoje,baseConferida:input.chavePrevia,motivo:"Ativação após confirmação da prévia"}});
    await marcarReavaliacaoSanitariaTx(tx);
    return { programacaoId: id, ativo: true, revisao: previa.revisao + 1 };
  }, { isolationLevel: "Serializable" });
}
