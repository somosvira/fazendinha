import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { podeEditarEstrutura, podeExcluirColeta } from "./coleta-imutabilidade.calc.js";
import { validarOocitos } from "./oocitos.calc.js";
import { planejarBaixaDose } from "./semen-baixa.calc.js";
import type { AdicionarEmbriaoInput, AdicionarFertilizacaoInput, AtualizarColetaInput, CriarClassificacaoEmbriaoInput, CriarColetaInput } from "./fiv.schemas.js";

export class FivError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) { super(message); }
}

const dataUtc = (data?: string) => data ? new Date(`${data}T00:00:00Z`) : undefined;
const filtroPropriedade = (propriedadeId: number | null) => propriedadeId != null ? { propriedadeId } : {};
const normalizarOocitos = (oocitos: readonly { qualidade: string; viavel: boolean; quantidade: number }[]) => oocitos.map((o) => ({ ...o, qualidade: o.qualidade.trim().toUpperCase() }));
const COLETA_INCLUDE = { doadora: { select: { id: true, numero: true, nome: true } }, oocitos: true, fertilizacoes: { include: { reprodutor: { select: { id: true, nome: true, codigo: true } }, embrioes: { include: { classificacao: true, evento: { select: { id: true, animalId: true, data: true } } } } } } } as const;

export async function listarClassificacoesEmbriao() { return prisma.embriaoClassificacao.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }); }
export async function criarClassificacaoEmbriao(input: CriarClassificacaoEmbriaoInput) {
  try { return await prisma.embriaoClassificacao.create({ data: { ...input, sigla: input.sigla.toUpperCase() } }); }
  catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new FivError("CONFLITO", "sigla já cadastrada"); throw e; }
}
export async function listarColetas(propriedadeId: number | null) { return prisma.coleta.findMany({ where: filtroPropriedade(propriedadeId), include: COLETA_INCLUDE, orderBy: [{ data: "desc" }, { id: "desc" }] }); }
export async function obterColeta(id: number, propriedadeId: number | null) {
  const coleta = await prisma.coleta.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, include: COLETA_INCLUDE });
  if (!coleta) throw new FivError("NAO_ENCONTRADO", "coleta não encontrada");
  return coleta;
}
async function validarDoadora(doadoraId: number, propriedadeId: number | null) {
  const doadora = await prisma.animal.findFirst({ where: { id: doadoraId, ...filtroPropriedade(propriedadeId) }, select: { id: true } });
  if (!doadora) throw new FivError("NAO_ENCONTRADO", "doadora não encontrada");
}
export async function criarColeta(input: CriarColetaInput, propriedadeId: number | null) {
  await validarDoadora(input.doadoraId, propriedadeId);
  const oocitos = normalizarOocitos(input.oocitos);
  const validacao = validarOocitos(oocitos);
  if (!validacao.valido) throw new FivError("CONFLITO", `oócitos inválidos: ${validacao.erro}`);
  return prisma.$transaction((tx) => tx.coleta.create({ data: { doadoraId: input.doadoraId, data: dataUtc(input.data)!, tecnico: input.tecnico, metodo: input.metodo, laboratorio: input.laboratorio, observacao: input.observacao, propriedadeId, oocitos: { create: oocitos } }, include: COLETA_INCLUDE }));
}
export async function atualizarColeta(id: number, input: AtualizarColetaInput, propriedadeId: number | null) {
  const atual = await prisma.coleta.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, include: { fertilizacoes: { select: { _count: { select: { embrioes: true } } } } } });
  if (!atual) throw new FivError("NAO_ENCONTRADO", "coleta não encontrada");
  if (!podeEditarEstrutura({ temEmbrioes: atual.fertilizacoes.some((f) => f._count.embrioes > 0) })) throw new FivError("CONFLITO", "coleta com embriões não permite alteração estrutural");
  if (input.doadoraId != null) await validarDoadora(input.doadoraId, propriedadeId);
  const oocitos = input.oocitos ? normalizarOocitos(input.oocitos) : undefined;
  if (oocitos) { const validacao = validarOocitos(oocitos); if (!validacao.valido) throw new FivError("CONFLITO", `oócitos inválidos: ${validacao.erro}`); }
  return prisma.$transaction(async (tx) => {
    if (oocitos) await tx.oocitoColeta.deleteMany({ where: { coletaId: id } });
    return tx.coleta.update({ where: { id }, data: { doadoraId: input.doadoraId, data: dataUtc(input.data), tecnico: input.tecnico, metodo: input.metodo, laboratorio: input.laboratorio, observacao: input.observacao, ...(oocitos ? { oocitos: { create: oocitos } } : {}) }, include: COLETA_INCLUDE });
  });
}
export async function excluirColeta(id: number, propriedadeId: number | null): Promise<void> {
  const atual = await prisma.coleta.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, include: { fertilizacoes: { select: { _count: { select: { embrioes: true } } } } } });
  if (!atual) throw new FivError("NAO_ENCONTRADO", "coleta não encontrada");
  const temFertilizacoes = atual.fertilizacoes.length > 0;
  const temEmbrioes = atual.fertilizacoes.some((f) => f._count.embrioes > 0);
  if (!podeExcluirColeta({ temFertilizacoes, temEmbrioes })) throw new FivError("CONFLITO", "coleta com dependentes não pode ser excluída");
  await prisma.coleta.delete({ where: { id } });
}
export async function cancelarColeta(id: number, motivo: string, propriedadeId: number | null) {
  const atual = await obterColeta(id, propriedadeId);
  if (atual.status === "CANCELADA") return atual;
  if (atual.fertilizacoes.some((f) => f.embrioes.some((e) => e.estado === "TRANSFERIDO"))) throw new FivError("CONFLITO", "coleta com embrião transferido não pode ser cancelada");
  return prisma.coleta.update({ where: { id }, data: { status: "CANCELADA", canceladaEm: new Date(), motivoCancelamento: motivo }, include: COLETA_INCLUDE });
}
export async function adicionarFertilizacao(coletaId: number, input: AdicionarFertilizacaoInput, propriedadeId: number | null) {
  const coleta = await prisma.coleta.findFirst({ where: { id: coletaId, ...filtroPropriedade(propriedadeId) }, select: { id: true, status: true, propriedadeId: true } });
  if (!coleta) throw new FivError("NAO_ENCONTRADO", "coleta não encontrada");
  if (coleta.status === "CANCELADA") throw new FivError("CONFLITO", "coleta cancelada");
  const reprodutor = await prisma.reprodutor.findFirst({ where: { id: input.reprodutorId, ...(propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {}) }, select: { id: true } });
  if (!reprodutor) throw new FivError("NAO_ENCONTRADO", "reprodutor não encontrado");
  return prisma.$transaction(async (tx) => {
    let doseBaixada = false; let aviso: string | null = null;
    if (input.estoqueSemenId != null) {
      const estoque = await tx.estoqueSemen.findFirst({ where: { id: input.estoqueSemenId, ...filtroPropriedade(propriedadeId), reprodutorId: input.reprodutorId }, select: { id: true, dosesDisponiveis: true } });
      if (!estoque) throw new FivError("NAO_ENCONTRADO", "lote de sêmen não encontrado");
      const plano = planejarBaixaDose({ estoqueSemenId: estoque.id, dosesDisponiveis: estoque.dosesDisponiveis }); aviso = plano.aviso;
      if (plano.consumir) {
        const baixa = await tx.estoqueSemen.updateMany({ where: { id: estoque.id, ...filtroPropriedade(propriedadeId), reprodutorId: input.reprodutorId, dosesDisponiveis: { gte: 1 } }, data: { dosesDisponiveis: { decrement: 1 } } });
        doseBaixada = baixa.count === 1;
        if (!doseBaixada) aviso = planejarBaixaDose({ estoqueSemenId: estoque.id, dosesDisponiveis: 0 }).aviso;
      }
    }
    const fertilizacao = await tx.fertilizacaoColeta.create({ data: { coletaId, reprodutorId: input.reprodutorId, estoqueSemenId: input.estoqueSemenId, doseBaixada, data: dataUtc(input.data), tecnica: input.tecnica } });
    return aviso ? { ...fertilizacao, aviso } : fertilizacao;
  });
}
export async function cancelarFertilizacao(id: number, input: { motivo: string }, propriedadeId: number | null) {
  const fertilizacao = await prisma.fertilizacaoColeta.findFirst({ where: { id, coleta: filtroPropriedade(propriedadeId) }, include: { coleta: { select: { propriedadeId: true } } } });
  if (!fertilizacao) throw new FivError("NAO_ENCONTRADO", "fertilização não encontrada");
  if (await prisma.embriaoColeta.count({ where: { fertilizacaoId: id } }) > 0) throw new FivError("CONFLITO", "fertilização com embriões não pode ser cancelada");
  return prisma.$transaction(async (tx) => {
    if (fertilizacao.estoqueSemenId != null && fertilizacao.doseBaixada) await tx.estoqueSemen.update({ where: { id: fertilizacao.estoqueSemenId }, data: { dosesDisponiveis: { increment: 1 } } });
    return tx.fertilizacaoColeta.update({ where: { id }, data: { status: "CANCELADA", canceladaEm: new Date(), motivoCancelamento: input.motivo, doseBaixada: false } });
  });
}
export async function adicionarEmbriao(fertilizacaoId: number, input: AdicionarEmbriaoInput, propriedadeId: number | null) {
  const fertilizacao = await prisma.fertilizacaoColeta.findFirst({ where: { id: fertilizacaoId, coleta: filtroPropriedade(propriedadeId) }, include: { coleta: { select: { propriedadeId: true } } } });
  if (!fertilizacao) throw new FivError("NAO_ENCONTRADO", "fertilização não encontrada");
  if (fertilizacao.status === "CANCELADA") throw new FivError("CONFLITO", "fertilização cancelada");
  if (input.classificacaoId != null && !(await prisma.embriaoClassificacao.findUnique({ where: { id: input.classificacaoId }, select: { id: true } }))) throw new FivError("NAO_ENCONTRADO", "classificação de embrião não encontrada");
  return prisma.$transaction((tx) => tx.embriaoColeta.create({ data: { fertilizacaoId, classificacaoId: input.classificacaoId, codigoInterno: input.codigoInterno, estagio: input.estagio, viavel: input.viavel, estado: input.viavel ? "DISPONIVEL" : "DESCARTADO", propriedadeId: fertilizacao.coleta.propriedadeId } }));
}
export async function descartarEmbriao(id: number, propriedadeId: number | null) {
  const embriao = await prisma.embriaoColeta.findFirst({ where: { id, ...filtroPropriedade(propriedadeId) }, select: { id: true, estado: true } });
  if (!embriao) throw new FivError("NAO_ENCONTRADO", "embrião não encontrado");
  if (embriao.estado === "TRANSFERIDO") throw new FivError("CONFLITO", "embrião transferido não pode ser descartado");
  return prisma.embriaoColeta.update({ where: { id }, data: { estado: "DESCARTADO", viavel: false } });
}
export async function listarEmbrioesDisponiveis(propriedadeId: number | null) {
  return prisma.embriaoColeta.findMany({ where: { ...filtroPropriedade(propriedadeId), estado: "DISPONIVEL", viavel: true }, include: { classificacao: true, fertilizacao: { include: { reprodutor: { select: { id: true, nome: true, codigo: true } }, coleta: { include: { doadora: { select: { id: true, numero: true, nome: true } } } } } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
}
