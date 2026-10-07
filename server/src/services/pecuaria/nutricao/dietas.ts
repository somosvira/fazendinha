import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, hojeFazendaDate } from "../rebanho/regras.js";
import type { PaginaNutricao } from "./schemas.js";
import { transacaoPecuaria } from "../transacao.js";
import { travarUsosProduto } from "../../estoque/usos.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);

export async function listarDietas() {
  return prisma.dieta.findMany({ include: { itens: { include: { produto: { select: { nome: true, unidade: true } } } } },
    orderBy: [{ nome: "asc" }, { versao: "desc" }] });
}

export async function criarDieta(input: { nome: string; observacao?: string | null;
  itens: Array<{ produtoId: string; quantidadeCabecaDia: number }> }, usuarioId: number | null, id?: string) {
  if (!input.itens.length || new Set(input.itens.map((i) => i.produtoId)).size !== input.itens.length) {
    throw new RebanhoError("VALIDACAO", "Informe ingredientes sem repetição", "itens");
  }
  return prisma.$transaction(async (tx) => {
    await travarUsosProduto(tx, input.itens.map((i) => i.produtoId));
    const existente = id ? await tx.dieta.findUnique({ where: { id }, include: { itens: true } }) : null;
    if (id && !existente) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    if (existente?.publicadaEm) throw new RebanhoError("CONFLITO", "Versão publicada é imutável; crie nova versão");
    const ultima = await tx.dieta.findFirst({ where: { nome: input.nome.trim() }, orderBy: { versao: "desc" } });
    const itens = [];
    for (const item of input.itens) {
      if (!Number.isFinite(item.quantidadeCabecaDia) || item.quantidadeCabecaDia <= 0 || new Prisma.Decimal(item.quantidadeCabecaDia).decimalPlaces() > 3) {
        throw new RebanhoError("VALIDACAO", "Quantidade por cabeça/dia inválida", "itens");
      }
      const produto = await tx.produto.findFirst({ where: { id: item.produtoId, ativo: true, usoNutricional: true }, include: { perfilNutricionalProduto: true } });
      if (!produto) throw new RebanhoError("VALIDACAO", "Ingrediente não encontrado", "itens");
      itens.push({ produtoId: produto.id, quantidadeCabecaDia: new Prisma.Decimal(item.quantidadeCabecaDia),
        unidade: produto.unidade, materiaSecaPercentualSnapshot: produto.perfilNutricionalProduto?.materiaSecaPercentual ?? null });
    }
    const dados = { nome: input.nome.trim(), observacao: input.observacao?.trim() || null };
    const dieta = existente ? await tx.dieta.update({ where: { id: existente.id }, data: { ...dados, itens: { deleteMany: {}, create: itens } }, include: { itens: true } }) : await tx.dieta.create({ data: { ...dados, versao: (ultima?.versao ?? 0) + 1, itens: { create: itens } }, include: { itens: true } });
    await auditar(tx, { entidade: "Dieta", entidadeId: dieta.id, acao: existente ? "RASCUNHO_EDITADO" : "VERSAO_CRIADA", usuarioId, ...(existente ? { antes: existente } : {}), depois: dieta });
    return dieta;
  });
}

export async function publicarDieta(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const dieta = await tx.dieta.findUnique({ where: { id }, include: { itens: true } });
    if (!dieta) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    await travarUsosProduto(tx, dieta.itens.map((i) => i.produtoId));
    if (dieta.publicadaEm) throw new RebanhoError("CONFLITO", "Esta versão já foi publicada");
    if (!dieta.itens.length) throw new RebanhoError("VALIDACAO", "Dieta sem ingredientes não pode ser publicada");
    for (const item of dieta.itens) {
      const produto = await tx.produto.findFirst({ where: { id: item.produtoId, ativo: true, usoNutricional: true }, include: { perfilNutricionalProduto: true } });
      if (!produto) throw new RebanhoError("CONFLITO", "Ingrediente inativo ou sem uso nutricional");
      await tx.itemDieta.update({ where: { id: item.id }, data: { unidade: produto.unidade, materiaSecaPercentualSnapshot: produto.perfilNutricionalProduto?.materiaSecaPercentual ?? null } });
    }
    const publicada = await tx.dieta.update({ where: { id }, data: { publicadaEm: new Date() } });
    await auditar(tx, { entidade: "Dieta", entidadeId: id, acao: "PUBLICACAO", usuarioId, antes: dieta, depois: publicada });
    return publicada;
  });
}

export async function listarVigencias(loteId: string | undefined, propriedadeId: number | null, pagina: PaginaNutricao = { pagina: 1, limite: 25 }) {
  const where: Prisma.VigenciaDietaLoteWhereInput = { ...(loteId ? { loteId } : {}), ...(propriedadeId == null ? {} : { lote: { propriedadeId } }) };
  const include = { dieta: { select: { id: true, nome: true, versao: true } }, lote: { select: { id: true, nome: true, propriedadeId: true } } } satisfies Prisma.VigenciaDietaLoteInclude;
  const hoje = hojeFazendaDate();
  return prisma.$transaction(async (tx) => {
    const [itens, total, vigente, programada] = await Promise.all([
      tx.vigenciaDietaLote.findMany({ where, include, orderBy: [{ desde: "desc" }, { id: "asc" }], skip: (pagina.pagina - 1) * pagina.limite, take: pagina.limite }),
      tx.vigenciaDietaLote.count({ where }),
      loteId ? tx.vigenciaDietaLote.findFirst({ where: { ...where, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] }, include }) : null,
      loteId ? tx.vigenciaDietaLote.findFirst({ where: { ...where, desde: { gt: hoje } }, include, orderBy: [{ desde: "asc" }, { id: "asc" }] }) : null,
    ]);
    return { itens, total, ...pagina, vigente, programada };
  });
}

export async function atribuirDieta(input: { loteId: string; propriedadeId: number; dietaId: string; desde: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
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
  });
}

export async function corrigirVigencia(id: string, propriedadeId: number, input: { desde: string; motivo: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const original = await tx.vigenciaDietaLote.findFirst({ where: { id, lote: { propriedadeId } } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Vigência não encontrada neste sítio");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${original.loteId}`}))`;
    const vizinhas = await tx.vigenciaDietaLote.findMany({ where: { loteId: original.loteId }, orderBy: { desde: "asc" } });
    const indice = vizinhas.findIndex((v) => v.id === id); const anterior = vizinhas[indice - 1]; const proxima = vizinhas[indice + 1];
    const desde = dia(input.desde);
    if ((anterior && desde <= anterior.desde) || (proxima && desde >= proxima.desde)) throw new RebanhoError("CONFLITO", "A correção deve permanecer entre as vigências vizinhas");
    const menor = desde < original.desde ? desde : original.desde;
    const maior = desde > original.desde ? desde : original.desde;
    const afetados = maior > menor ? await tx.fechamentoConsumo.findMany({ where: { loteId: original.loteId, status: "CONFIRMADO", inicio: { lt: maior }, fim: { gte: menor } }, select: { id: true } }) : [];
    if (afetados.length) throw new RebanhoError("CONFLITO", `Estorne os fechamentos afetados antes de corrigir: ${afetados.map((f) => f.id).join(", ")}`);
    // Encolhe primeiro o intervalo que cede dias: a restrição de sobreposição
    // é imediata, mesmo quando ambas as alterações pertencem à mesma transação.
    const adiada = desde > original.desde;
    let salva = adiada ? await tx.vigenciaDietaLote.update({ where: { id }, data: { desde } }) : original;
    if (anterior && anterior.ate?.getTime() === original.desde.getTime()) {
      const salvo = await tx.vigenciaDietaLote.update({ where: { id: anterior.id }, data: { ate: desde } });
      await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: anterior.id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: anterior, depois: { ...salvo, motivo: input.motivo } });
    }
    if (!adiada) salva = await tx.vigenciaDietaLote.update({ where: { id }, data: { desde } });
    await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: original, depois: { ...salva, motivo: input.motivo } });
    return salva;
  });
}
