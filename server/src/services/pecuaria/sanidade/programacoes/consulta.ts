import { prisma } from "../../../../db.js";
import { type ProgramacaoSanitaria, Prisma } from "@prisma/client";
import { RebanhoError } from "../../rebanho/regras.js";
import { janelaProgramacao } from "./calendario.calc.js";
import { publicoProgramacaoSchema, type CadastroProgramacao, type ConsultaProgramacoes } from "./schemas.js";
import type { ConsultaProgramacoesDTO, EventoProgramacaoDTO } from "./contratos.js";
export function pendenciasAtivacao(p: Pick<ProgramacaoSanitaria, "publico" | "publicoConferido" | "executor" | "sujeitoTipo" | "produtoId" | "procedimento" | "tipoExameId" | "ano" | "recorrencia" | "vigenciaInicio">): string[] {
  const pendencias: string[] = [];
  const publico = publicoProgramacaoSchema.safeParse(p.publico);
  if (!p.publicoConferido || !publico.success || publico.data.criterioPendente) pendencias.push("Conferir critérios factuais do público");
  if (!p.produtoId && !p.procedimento) pendencias.push("Vincular produto ou procedimento sem insumo");
  if (p.sujeitoTipo !== "ANIMAL") pendencias.push("Executor de verificação por lote/sítio ainda indisponível");
  if (!p.executor || (p.executor === "APLICACAO" && !p.produtoId) || (p.executor === "EXAME_ANIMAL" && !p.tipoExameId)) pendencias.push("Confirmar executor factual compatível");
  if (p.recorrencia === "SEM_REPETICAO" && p.ano == null) pendencias.push("Definir ano da ocorrência sem repetição");
  if (!p.vigenciaInicio) pendencias.push("Definir início da vigência");
  return pendencias;
}
export async function validarReferenciasProgramacaoTx(tx: Prisma.TransactionClient, input: CadastroProgramacao) {
  if (!(await tx.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true }, select: { id: true } }))) throw new RebanhoError("VALIDACAO", "Sítio não disponível", "propriedadeId");
  if (input.produtoId && !(await tx.produto.findFirst({ where: { id: input.produtoId, usoSanitario: true, ativo: true }, select: { id: true } }))) throw new RebanhoError("VALIDACAO", "Produto sanitário não disponível", "produtoId");
  if (input.tipoExameId && !(await tx.tipoExame.findFirst({ where: { id: input.tipoExameId, ativo: true, contexto: { not: "REPRODUTIVO" } }, select: { id: true } }))) throw new RebanhoError("VALIDACAO", "Tipo de exame não disponível", "tipoExameId");
  if (input.regraEquivalenteId) {
    const regra = await tx.regraAlertaSanitario.findUnique({ where: { id: input.regraEquivalenteId } });
    if (!regra || !regra.ativo || !regra.propriedadeIds.includes(input.propriedadeId) || regra.produtoId !== input.produtoId || input.sujeitoTipo !== "ANIMAL" || input.recorrencia === "CAMPANHA_ANUAL" || !input.publicoConferido)
      throw new RebanhoError("VALIDACAO", "Equivalência exige regra ativa compatível, público conferido e necessidade sem nova campanha", "regraEquivalenteId");
  }
}
export async function cadastrarProgramacao(input: CadastroProgramacao, usuarioId: number) {
  return prisma.$transaction(async tx => {
    await validarReferenciasProgramacaoTx(tx, input);
    return tx.programacaoSanitaria.create({ data: { ...input, publico: input.publico, vigenciaInicio: input.vigenciaInicio ? new Date(`${input.vigenciaInicio}T00:00:00Z`) : null,
      vigenciaFim: input.vigenciaFim ? new Date(`${input.vigenciaFim}T00:00:00Z`) : null, criadoPorId: usuarioId, ativo: false } });
  });
}
export async function consultarProgramacoes(filtro: ConsultaProgramacoes, propriedadeId: number | null): Promise<ConsultaProgramacoesDTO> {
  const registros = await prisma.programacaoSanitaria.findMany({ where: { ...(propriedadeId == null ? {} : { propriedadeId }), ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
    ...(filtro.busca ? { OR: [{ nome: { contains: filtro.busca, mode: "insensitive" } }, { procedimento: { contains: filtro.busca, mode: "insensitive" } }] } : {}) }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
  const idsProdutos = [...new Set(registros.flatMap(p => p.produtoId ? [p.produtoId] : []))];
  const produtos = await prisma.produto.findMany({ where: { id: { in: idsProdutos } }, select: { id: true, nome: true } });
  const nomes = new Map(produtos.map(p => [p.id, p.nome]));
  const necessidades = registros.length ? await prisma.necessidadeProgramacaoSanitaria.findMany({ where: { programacaoId: { in: registros.map(p => p.id) }, ...(propriedadeId == null ? {} : { propriedadeId }) }, select: { programacaoId: true, periodo: true, situacao: true, regraNecessidadeId: true } }) : [];
  const vinculadas = necessidades.flatMap(n => n.regraNecessidadeId ? [n.regraNecessidadeId] : []);
  const estadosVinculados = vinculadas.length ? await prisma.necessidadeSanitaria.findMany({ where: { id: { in: vinculadas } }, select: { id: true, situacao: true } }) : [];
  const estados = new Map(estadosVinculados.map(n => [n.id, n.situacao]));
  const situacao = (n: typeof necessidades[number]) => n.regraNecessidadeId ? estados.get(n.regraNecessidadeId) ?? "NECESSITA_REVISAO" : n.situacao;
  const meses = Array.from({ length: 12 }, (_, indice) => {
    const mes = indice + 1;
    const eventos: EventoProgramacaoDTO[] = registros.flatMap(p => {
      const janela = janelaProgramacao(p, filtro.ano, mes); if (!janela) return [];
      const participantes = necessidades.filter(n => n.programacaoId === p.id && n.periodo === janela.periodo);
      const atendidos = participantes.filter(n => situacao(n) === "REALIZADO").length;
      return [{ ...janela, nome: p.nome, tipo: p.tipo, propriedadeId: p.propriedadeId, ativo: p.ativo, produtoId: p.produtoId, produtoNome: p.produtoId ? nomes.get(p.produtoId) ?? null : null,
        procedimento: p.procedimento, sujeitoTipo: p.sujeitoTipo, recorrencia: p.recorrencia, publico: p.publico, fonte: p.fonte, observacao: p.observacao, revisao: p.revisao,
        pendenciasAtivacao: pendenciasAtivacao(p), previstos: participantes.length, atendidos, pendentes: participantes.filter(n => !["REALIZADO", "DISPENSADO", "INVALIDADO"].includes(situacao(n))).length }];
    });
    return { mes, eventos, total: eventos.length };
  });
  const todos = meses.filter(m => filtro.mes == null || m.mes === filtro.mes).flatMap(m => m.eventos);
  return { ano: filtro.ano, mes: filtro.mes ?? null, meses, itens: todos.slice((filtro.pagina - 1) * filtro.tamanho, filtro.pagina * filtro.tamanho), total: todos.length, pagina: filtro.pagina, tamanho: filtro.tamanho };
}

export async function listarSitiosExportacao(propriedadeId: number | null) {
  return prisma.propriedade.findMany({ where: propriedadeId == null ? {} : { id: propriedadeId }, select: { id: true, nome: true }, orderBy: { id: "asc" } });
}

export async function listarCadastrosProgramacoes(propriedadeId: number | null) {
  const registros = await prisma.programacaoSanitaria.findMany({ where: propriedadeId == null ? {} : { propriedadeId }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
  return registros.map(p => ({ ...p, pendenciasAtivacao: pendenciasAtivacao(p) }));
}
export async function obterCadastroProgramacao(id: string, propriedadeId: number | null) {
  const p = await prisma.programacaoSanitaria.findFirst({ where: { id, ...(propriedadeId == null ? {} : { propriedadeId }) } });
  if (!p) throw new RebanhoError("NAO_ENCONTRADO", "Programação não encontrada no sítio");
  return { ...p, pendenciasAtivacao: pendenciasAtivacao(p) };
}
