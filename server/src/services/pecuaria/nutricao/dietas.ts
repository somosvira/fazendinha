import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, hojeFazendaDate } from "../rebanho/regras.js";
import { filtroLotesNutricao, type ConsultaNutricao } from "./schemas.js";
import { transacaoPecuaria } from "../transacao.js";
import { travarUsosProduto } from "../../estoque/usos.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
export const normalizarNomeDieta = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const travarCatalogo = (tx: Prisma.TransactionClient) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pec-dietas-catalogo'))`;

export async function listarDietas() {
  const dietas = await prisma.dieta.findMany({ include: { _count: { select: { vigencias: true } }, itens: { include: { produto: { select: { nome: true, unidade: true } } } } },
    orderBy: [{ nome: "asc" }, { versao: "desc" }] });
  return dietas.map((d) => ({ ...d, podeExcluir: d._count.vigencias === 0 }));
}

export async function criarDieta(input: { nome: string; observacao?: string | null;
  itens: Array<{ produtoId: string; quantidadeCabecaDia: number }> }, usuarioId: number | null, id?: string) {
  if (!input.itens.length || new Set(input.itens.map((i) => i.produtoId)).size !== input.itens.length) {
    throw new RebanhoError("VALIDACAO", "Informe ingredientes sem repetição", "itens");
  }
  return prisma.$transaction(async (tx) => {
    await travarCatalogo(tx);
    await travarUsosProduto(tx, input.itens.map((i) => i.produtoId));
    const existente = id ? await tx.dieta.findUnique({ where: { id }, include: { itens: true } }) : null;
    if (id && !existente) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    if (existente?.publicadaEm) throw new RebanhoError("CONFLITO", "Versão publicada é imutável; crie nova versão");
    const catalogo = await tx.dieta.findMany({ select: { id: true, nome: true, versao: true } });
    const nome = input.nome.trim().replace(/\s+/g, " ");
    const repetidas = catalogo.filter((d) => normalizarNomeDieta(d.nome) === normalizarNomeDieta(nome) && d.id !== id);
    if (repetidas.length && (!existente || normalizarNomeDieta(existente.nome) !== normalizarNomeDieta(nome))) {
      throw new RebanhoError("CONFLITO", "Já existe uma dieta com este nome; use Nova versão na dieta existente", "nome");
    }
    if (existente && repetidas.length && nome !== existente.nome) throw new RebanhoError("CONFLITO", "O nome identifica as versões desta dieta; mantenha o nome original", "nome");
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
    const dados = { nome, observacao: input.observacao?.trim() || null };
    const dieta = existente ? await tx.dieta.update({ where: { id: existente.id }, data: { ...dados, itens: { deleteMany: {}, create: itens } }, include: { itens: true } }) : await tx.dieta.create({ data: { ...dados, versao: 1, itens: { create: itens } }, include: { itens: true } });
    await auditar(tx, { entidade: "Dieta", entidadeId: dieta.id, acao: existente ? "RASCUNHO_EDITADO" : "VERSAO_CRIADA", usuarioId, ...(existente ? { antes: existente } : {}), depois: dieta });
    return dieta;
  });
}

export async function criarVersaoDieta(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarCatalogo(tx);
    const original = await tx.dieta.findUnique({ where: { id }, include: { itens: true } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    await travarUsosProduto(tx, original.itens.map((i) => i.produtoId));
    const ultima = await tx.dieta.findFirst({ where: { nome: original.nome }, orderBy: { versao: "desc" } });
    const dieta = await tx.dieta.create({ data: { nome: original.nome, observacao: original.observacao, versao: (ultima?.versao ?? 0) + 1,
      itens: { create: original.itens.map(({ produtoId, quantidadeCabecaDia, unidade, materiaSecaPercentualSnapshot }) => ({ produtoId, quantidadeCabecaDia, unidade, materiaSecaPercentualSnapshot })) } }, include: { itens: true } });
    await auditar(tx, { entidade: "Dieta", entidadeId: dieta.id, acao: "VERSAO_CRIADA", usuarioId, depois: { ...dieta, origemId: id } });
    return dieta;
  });
}

export async function alterarEstadoDieta(id: string, ativo: boolean, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarCatalogo(tx);
    const antes = await tx.dieta.findUnique({ where: { id } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    const depois = await tx.dieta.update({ where: { id }, data: { ativo } });
    await auditar(tx, { entidade: "Dieta", entidadeId: id, acao: ativo ? "ATIVACAO" : "INATIVACAO", usuarioId, antes, depois });
    return depois;
  });
}

export async function excluirDieta(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarCatalogo(tx);
    const antes = await tx.dieta.findUnique({ where: { id }, include: { itens: true } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Dieta não encontrada");
    if (await tx.vigenciaDietaLote.count({ where: { dietaId: id } })) throw new RebanhoError("CONFLITO", "Dieta com histórico de atribuição só pode ser inativada");
    await tx.itemDieta.deleteMany({ where: { dietaId: id } });
    await tx.dieta.delete({ where: { id } });
    await auditar(tx, { entidade: "Dieta", entidadeId: id, acao: "EXCLUSAO", usuarioId, antes });
    return { id, excluida: true };
  });
}

export async function publicarDieta(id: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarCatalogo(tx);
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

export async function listarVigencias(loteId: string | undefined, propriedadeId: number | null, pagina: ConsultaNutricao = { pagina: 1, limite: 25 }) {
  const status = pagina.status?.filter((s): s is "VALIDO" | "ANULADO" => s === "VALIDO" || s === "ANULADO");
  if (pagina.status && status?.length !== pagina.status.length) throw new RebanhoError("VALIDACAO", "Situação de atribuição inválida");
  const where: Prisma.VigenciaDietaLoteWhereInput = { ...filtroLotesNutricao(loteId, pagina), ...(status?.length ? { status: { in: status } } : {}), ...(propriedadeId == null ? {} : { lote: { propriedadeId } }) };
  const include = { dieta: { select: { id: true, nome: true, versao: true } }, lote: { select: { id: true, nome: true, propriedadeId: true } } } satisfies Prisma.VigenciaDietaLoteInclude;
  const hoje = hojeFazendaDate();
  return prisma.$transaction(async (tx) => {
    const [itens, total, vigente, programada] = await Promise.all([
      tx.vigenciaDietaLote.findMany({ where, include, orderBy: [{ desde: "desc" }, { id: "asc" }], skip: (pagina.pagina - 1) * pagina.limite, take: pagina.limite }),
      tx.vigenciaDietaLote.count({ where }),
      loteId ? tx.vigenciaDietaLote.findFirst({ where: { ...where, status: "VALIDO", desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] }, include }) : null,
      loteId ? tx.vigenciaDietaLote.findFirst({ where: { ...where, status: "VALIDO", desde: { gt: hoje } }, include, orderBy: [{ desde: "asc" }, { id: "asc" }] }) : null,
    ]);
    return { itens: itens.map((i) => ({ ...i, propriedadeId: i.lote.propriedadeId })), total, ...pagina, vigente, programada };
  });
}

export async function atribuirDieta(input: { loteId: string; propriedadeId: number; dietaId: string; desde: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${input.loteId}`}))`;
    const lote = await tx.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
    if (!lote) throw new RebanhoError("VALIDACAO", "Lote não encontrado neste sítio", "loteId");
    const dieta = await tx.dieta.findFirst({ where: { id: input.dietaId, publicadaEm: { not: null }, ativo: true } });
    if (!dieta) throw new RebanhoError("VALIDACAO", "Selecione uma dieta publicada", "dietaId");
    const desde = dia(input.desde);
    const vigentes = await tx.vigenciaDietaLote.findMany({ where: { loteId: lote.id, status: "VALIDO" }, orderBy: { desde: "desc" } });
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

type AlteracaoVigencia = { desde?: string; dietaId?: string; motivo: string; revisao?: string; anular?: boolean };

async function previaVigenciaTx(tx: Prisma.TransactionClient, id: string, propriedadeId: number, input: AlteracaoVigencia) {
  if (input.motivo.trim().length < 5 || input.motivo.trim().length > 500) throw new RebanhoError("VALIDACAO", "Explique o motivo com 5 a 500 caracteres", "motivo");
  const original = await tx.vigenciaDietaLote.findFirst({ where: { id, status: "VALIDO", lote: { propriedadeId } }, include: { dieta: { select: { id: true, nome: true, versao: true } }, lote: { select: { id: true, nome: true, propriedadeId: true } } } });
  if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Atribuição não encontrada neste sítio ou já anulada");
  const vizinhas = await tx.vigenciaDietaLote.findMany({ where: { loteId: original.loteId, status: "VALIDO" }, orderBy: { desde: "asc" } });
  const indice = vizinhas.findIndex((v) => v.id === id); const anterior = vizinhas[indice - 1] ?? null; const proxima = vizinhas[indice + 1] ?? null;
  const desde = input.desde ? dia(input.desde) : original.desde;
  if (!Number.isFinite(desde.getTime())) throw new RebanhoError("VALIDACAO", "Informe uma data válida", "desde");
  if (!input.anular && ((anterior && desde <= anterior.desde) || (proxima && desde >= proxima.desde) || (original.ate && desde >= original.ate))) throw new RebanhoError("CONFLITO", "A correção deve permanecer entre as vigências vizinhas");
  const dietaId = input.dietaId ?? original.dietaId;
  const dieta = dietaId === original.dietaId ? original.dieta : await tx.dieta.findFirst({ where: { id: dietaId, publicadaEm: { not: null }, ativo: true }, select: { id: true, nome: true, versao: true } });
  if (!dieta) throw new RebanhoError("VALIDACAO", "Selecione uma dieta publicada e ativa", "dietaId");
  const menor = desde < original.desde ? desde : original.desde;
  const maior = input.anular || dietaId !== original.dietaId ? original.ate : desde > original.desde ? desde : original.desde;
  const fechamentosAfetados = maior == null || maior > menor ? await tx.fechamentoConsumo.findMany({ where: { loteId: original.loteId, status: "CONFIRMADO", fim: { gte: menor }, ...(maior ? { inicio: { lt: maior } } : {}) }, select: { id: true, inicio: true, fim: true }, orderBy: { inicio: "asc" } }) : [];
  const proposta = { ...original, desde, dietaId, dieta, status: input.anular ? "ANULADO" as const : "VALIDO" as const };
  const base = { original, proposta, anterior, proxima, fechamentosAfetados };
  return { ...base, bloqueada: fechamentosAfetados.length > 0, revisao: crypto.createHash("sha256").update(JSON.stringify(base)).digest("hex") };
}

export async function previaAlteracaoVigencia(id: string, propriedadeId: number, input: AlteracaoVigencia) {
  return prisma.$transaction((tx) => previaVigenciaTx(tx, id, propriedadeId, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function corrigirVigencia(id: string, propriedadeId: number, input: { desde: string; dietaId?: string; motivo: string; revisao?: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const previa = await previaVigenciaTx(tx, id, propriedadeId, input);
    const { original, anterior, proposta } = previa; const desde = proposta.desde;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${original.loteId}`}))`;
    if (input.revisao && input.revisao !== previa.revisao) throw new RebanhoError("CONFLITO", "A atribuição ou consumo mudou desde a prévia; confira novamente");
    if (previa.bloqueada) throw new RebanhoError("CONFLITO", `Estorne os fechamentos afetados antes de corrigir: ${previa.fechamentosAfetados.map((f) => f.id).join(", ")}`);
    // Fechamentos antigos continuam apontando à receita e ao intervalo originais.
    if (proposta.dietaId !== original.dietaId) {
      const anulada = await tx.vigenciaDietaLote.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: input.motivo.trim(), anuladoEm: new Date() } });
      await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: id, propriedadeId, acao: "ANULACAO_POR_CORRECAO", usuarioId, antes: original, depois: anulada });
      if (anterior && anterior.ate?.getTime() === original.desde.getTime()) {
        const salva = await tx.vigenciaDietaLote.update({ where: { id: anterior.id }, data: { ate: desde } });
        await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: anterior.id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: anterior, depois: { ...salva, motivo: input.motivo } });
      }
      const substituta = await tx.vigenciaDietaLote.create({ data: { loteId: original.loteId, dietaId: proposta.dietaId, desde, ate: original.ate } });
      await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: substituta.id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: original, depois: { ...substituta, motivo: input.motivo, substituiId: id } });
      return substituta;
    }
    // Encolhe primeiro o intervalo que cede dias: a restrição de sobreposição
    // é imediata, mesmo quando ambas as alterações pertencem à mesma transação.
    const adiada = desde > original.desde;
    let salva = adiada ? await tx.vigenciaDietaLote.update({ where: { id }, data: { desde, dietaId: proposta.dietaId } }) : original;
    if (anterior && anterior.ate?.getTime() === original.desde.getTime()) {
      const salvo = await tx.vigenciaDietaLote.update({ where: { id: anterior.id }, data: { ate: desde } });
      await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: anterior.id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: anterior, depois: { ...salvo, motivo: input.motivo } });
    }
    if (!adiada) salva = await tx.vigenciaDietaLote.update({ where: { id }, data: { desde, dietaId: proposta.dietaId } });
    await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: id, propriedadeId, acao: "VIGENCIA_CORRIGIDA", usuarioId, antes: original, depois: { ...salva, motivo: input.motivo } });
    return salva;
  });
}

export async function anularVigencia(id: string, propriedadeId: number, input: { motivo: string; revisao?: string }, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const previa = await previaVigenciaTx(tx, id, propriedadeId, { ...input, anular: true });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${previa.original.loteId}`}))`;
    if (input.revisao && input.revisao !== previa.revisao) throw new RebanhoError("CONFLITO", "A atribuição ou consumo mudou desde a prévia; confira novamente");
    if (previa.bloqueada) throw new RebanhoError("CONFLITO", `Estorne os fechamentos afetados antes de anular: ${previa.fechamentosAfetados.map((f) => f.id).join(", ")}`);
    const salvo = await tx.vigenciaDietaLote.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: input.motivo.trim(), anuladoEm: new Date() } });
    await auditar(tx, { entidade: "VigenciaDietaLote", entidadeId: id, propriedadeId, acao: "ANULACAO", usuarioId, antes: previa.original, depois: salvo });
    return salvo;
  });
}
