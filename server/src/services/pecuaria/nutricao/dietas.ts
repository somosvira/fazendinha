import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar } from "../rebanho/regras.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarDietas() {
  return prisma.dieta.findMany({ include: { itens: { include: { produto: { select: { nome: true, unidade: true } } } } },
    orderBy: [{ nome: "asc" }, { versao: "desc" }] });
}

export async function criarDieta(input: { nome: string; observacao?: string | null;
  itens: Array<{ produtoId: string; quantidadeCabecaDia: number }> }, usuarioId: number | null) {
  if (!input.itens.length || new Set(input.itens.map((i) => i.produtoId)).size !== input.itens.length) {
    throw new RebanhoError("VALIDACAO", "Informe ingredientes sem repetição", "itens");
  }
  return prisma.$transaction(async (tx) => {
    const ultima = await tx.dieta.findFirst({ where: { nome: input.nome.trim() }, orderBy: { versao: "desc" } });
    const itens = [];
    for (const item of input.itens) {
      if (!Number.isFinite(item.quantidadeCabecaDia) || item.quantidadeCabecaDia <= 0 || new Prisma.Decimal(item.quantidadeCabecaDia).decimalPlaces() > 3) {
        throw new RebanhoError("VALIDACAO", "Quantidade por cabeça/dia inválida", "itens");
      }
      const produto = await tx.produto.findFirst({ where: { id: item.produtoId, ativo: true }, include: { perfilNutricionalProduto: true } });
      if (!produto) throw new RebanhoError("VALIDACAO", "Ingrediente não encontrado", "itens");
      itens.push({ produtoId: produto.id, quantidadeCabecaDia: new Prisma.Decimal(item.quantidadeCabecaDia),
        unidade: produto.unidade, materiaSecaPercentualSnapshot: produto.perfilNutricionalProduto?.materiaSecaPercentual ?? null });
    }
    const dieta = await tx.dieta.create({ data: { nome: input.nome.trim(), versao: (ultima?.versao ?? 0) + 1,
      observacao: input.observacao?.trim() || null, itens: { create: itens } }, include: { itens: true } });
    await auditar(tx, { entidade: "Dieta", entidadeId: dieta.id, acao: "VERSAO_CRIADA", usuarioId, depois: dieta });
    return dieta;
  });
}

export async function publicarDieta(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const dieta = await tx.dieta.findUnique({ where: { id }, include: { itens: true } });
    if (!dieta) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    if (dieta.publicadaEm) throw new RebanhoError("CONFLITO", "Esta versão já foi publicada");
    if (!dieta.itens.length) throw new RebanhoError("VALIDACAO", "Dieta sem ingredientes não pode ser publicada");
    const publicada = await tx.dieta.update({ where: { id }, data: { publicadaEm: new Date() } });
    await auditar(tx, { entidade: "Dieta", entidadeId: id, acao: "PUBLICACAO", usuarioId, antes: dieta, depois: publicada });
    return publicada;
  });
}

export async function listarVigencias(loteId: string | undefined, propriedadeId: number | null) {
  return prisma.vigenciaDietaLote.findMany({ where: { ...(loteId ? { loteId } : {}), ...(propriedadeId == null ? {} : { lote: { propriedadeId } }) },
    include: { dieta: { select: { id: true, nome: true, versao: true } }, lote: { select: { id: true, nome: true, propriedadeId: true } } },
    orderBy: { desde: "desc" }, take: 100 });
}

export async function atribuirDieta(input: { loteId: string; propriedadeId: number; dietaId: string; desde: string }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const lote = await tx.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError("VALIDACAO", "Lote não encontrado neste sítio", "loteId");
    const dieta = await tx.dieta.findFirst({ where: { id: input.dietaId, publicadaEm: { not: null }, ativo: true } });
    if (!dieta) throw new RebanhoError("VALIDACAO", "Selecione uma dieta publicada", "dietaId");
    const desde = dia(input.desde);
    const vigentes = await tx.vigenciaDietaLote.findMany({ where: { loteId: lote.id }, orderBy: { desde: "desc" } });
    const ultima = vigentes[0];
    if (ultima && desde <= ultima.desde) throw new RebanhoError("CONFLITO", "A nova vigência deve começar depois da última");
    if (ultima && !ultima.ate) {
      const fechamento = await tx.fechamentoConsumo.findFirst({ where: { loteId: lote.id, status: "CONFIRMADO", fim: { gte: desde } } });
      if (fechamento) throw new RebanhoError("CONFLITO", "Há consumo fechado após a troca proposta; estorne antes de alterar a dieta");
      await tx.vigenciaDietaLote.update({ where: { id: ultima.id }, data: { ate: desde } });
    }
    const criada = await tx.vigenciaDietaLote.create({ data: { loteId: lote.id, dietaId: dieta.id, desde } });
    await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: criada.id, propriedadeId: lote.propriedadeId,
      acao: "ATRIBUICAO", usuarioId, depois: criada });
    return criada;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
