import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { auditar, FinanceiroError } from "../financeiro/regras.js";
import { comReenvioCadastro, normalizarNomeCatalogo } from "./cadastro-reenvio.js";
import type { ConsultaCatalogo } from "./catalogos.schemas.js";
import type { z } from "zod";
import type { criarCatalogoSchema, patchCatalogoSchema, criarNutrienteSchema, patchNutrienteSchema } from "./catalogos.schemas.js";

type Criar = z.infer<typeof criarCatalogoSchema>;
type Patch = z.infer<typeof patchCatalogoSchema>;
const autor = (id?: number | null) => id && id > 0 ? id : null;
function duplicidade(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new FinanceiroError("CONFLITO", "Já existe um cadastro com este nome, inclusive entre os inativos", "nome");
  throw e;
}

export async function listarFabricantes(input: ConsultaCatalogo) {
  return prisma.$transaction(async tx => {
    const where: Prisma.FabricanteProdutoWhereInput = {
      ...(input.selecionadoId ? { id: input.selecionadoId } : input.ativo === undefined ? {} : { ativo: input.ativo === "true" }),
      nomeNormalizado: { contains: normalizarNomeCatalogo(input.busca) },
    };
    const total = await tx.fabricanteProduto.count({ where });
    const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    const itens = await tx.fabricanteProduto.findMany({ where, include: { origensCadastro: true }, orderBy: [{ nomeNormalizado: "asc" }, { id: "asc" }], skip: (pagina - 1) * input.porPagina, take: input.porPagina });
    return { itens: itens.map(({nomeNormalizado, origensCadastro: origens, ...item}) => ({...item, origens})), total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function criarFabricantes(input: Criar, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "fabricantes:criar", usuarioId, input.chaveReenvio, input, async () => {
    const { chaveReenvio, ...dados } = input;
    const criado = await tx.fabricanteProduto.create({ data: { ...dados, nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome), criadoPorId: autor(usuarioId), atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "FabricanteProduto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: criado });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = criado;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}
export async function atualizarFabricantes(id: string, input: Patch, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "fabricantes:atualizar:" + id, usuarioId, input.chaveReenvio, input, async () => {
    await tx.$queryRaw`SELECT "id" FROM public."FabricanteProduto" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const antes = await tx.fabricanteProduto.findUnique({ where: { id } });
    if (!antes) throw new FinanceiroError("NAO_ENCONTRADO", "Cadastro não encontrado");
    if (antes.revisao !== input.revisaoEsperada) throw new FinanceiroError("CONFLITO", "O cadastro foi alterado por outra pessoa. Carregue a versão atual.", "revisaoEsperada");
    if (input.ativo !== undefined && input.ativo !== antes.ativo && !input.motivoAlteracao?.trim()) throw new FinanceiroError("VALIDACAO", "Explique a alteração de situação", "motivoAlteracao");
    const { chaveReenvio, revisaoEsperada, motivoAlteracao, ...dados } = input;
    const depois = await tx.fabricanteProduto.update({ where: { id }, data: { ...dados, ...(dados.nome ? { nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome) } : {}), revisao: { increment: 1 }, atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "FabricanteProduto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois, motivo: motivoAlteracao });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = depois;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}

export async function listarClassificacoesTecnicas(input: ConsultaCatalogo) {
  return prisma.$transaction(async tx => {
    const where: Prisma.ClassificacaoTecnicaProdutoWhereInput = {
      ...(input.selecionadoId ? { id: input.selecionadoId } : input.ativo === undefined ? {} : { ativo: input.ativo === "true" }),
      nomeNormalizado: { contains: normalizarNomeCatalogo(input.busca) },
    };
    const total = await tx.classificacaoTecnicaProduto.count({ where });
    const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    const itens = await tx.classificacaoTecnicaProduto.findMany({ where, include: { origensCadastro: true }, orderBy: [{ nomeNormalizado: "asc" }, { id: "asc" }], skip: (pagina - 1) * input.porPagina, take: input.porPagina });
    return { itens: itens.map(({nomeNormalizado, origensCadastro: origens, ...item}) => ({...item, origens})), total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function criarClassificacoesTecnicas(input: Criar, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "classificacoesTecnicas:criar", usuarioId, input.chaveReenvio, input, async () => {
    const { chaveReenvio, ...dados } = input;
    const criado = await tx.classificacaoTecnicaProduto.create({ data: { ...dados, nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome), criadoPorId: autor(usuarioId), atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "ClassificacaoTecnicaProduto", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: criado });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = criado;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}
export async function atualizarClassificacoesTecnicas(id: string, input: Patch, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "classificacoesTecnicas:atualizar:" + id, usuarioId, input.chaveReenvio, input, async () => {
    await tx.$queryRaw`SELECT "id" FROM public."ClassificacaoTecnicaProduto" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const antes = await tx.classificacaoTecnicaProduto.findUnique({ where: { id } });
    if (!antes) throw new FinanceiroError("NAO_ENCONTRADO", "Cadastro não encontrado");
    if (antes.revisao !== input.revisaoEsperada) throw new FinanceiroError("CONFLITO", "O cadastro foi alterado por outra pessoa. Carregue a versão atual.", "revisaoEsperada");
    if (input.ativo !== undefined && input.ativo !== antes.ativo && !input.motivoAlteracao?.trim()) throw new FinanceiroError("VALIDACAO", "Explique a alteração de situação", "motivoAlteracao");
    const { chaveReenvio, revisaoEsperada, motivoAlteracao, ...dados } = input;
    const depois = await tx.classificacaoTecnicaProduto.update({ where: { id }, data: { ...dados, ...(dados.nome ? { nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome) } : {}), revisao: { increment: 1 }, atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "ClassificacaoTecnicaProduto", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois, motivo: motivoAlteracao });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = depois;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}

export async function listarPrincipiosAtivos(input: ConsultaCatalogo) {
  return prisma.$transaction(async tx => {
    const where: Prisma.PrincipioAtivoWhereInput = {
      ...(input.selecionadoId ? { id: input.selecionadoId } : input.ativo === undefined ? {} : { ativo: input.ativo === "true" }),
      nomeNormalizado: { contains: normalizarNomeCatalogo(input.busca) },
    };
    const total = await tx.principioAtivo.count({ where });
    const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    const itens = await tx.principioAtivo.findMany({ where, include: { origens: true }, orderBy: [{ nomeNormalizado: "asc" }, { id: "asc" }], skip: (pagina - 1) * input.porPagina, take: input.porPagina });
    return { itens: itens.map(({nomeNormalizado, origens: origens, ...item}) => ({...item, origens})), total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function criarPrincipiosAtivos(input: Criar, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "principiosAtivos:criar", usuarioId, input.chaveReenvio, input, async () => {
    const { chaveReenvio, ...dados } = input;
    const criado = await tx.principioAtivo.create({ data: { ...dados, nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome), criadoPorId: autor(usuarioId), atualizadoPorId: autor(usuarioId) }, include: { origens: true } });
    await auditar(tx, { entidade: "PrincipioAtivo", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: criado });
    const { nomeNormalizado, origens: origens, ...dto } = criado;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}
export async function atualizarPrincipiosAtivos(id: string, input: Patch, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "principiosAtivos:atualizar:" + id, usuarioId, input.chaveReenvio, input, async () => {
    await tx.$queryRaw`SELECT "id" FROM public."PrincipioAtivo" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const antes = await tx.principioAtivo.findUnique({ where: { id } });
    if (!antes) throw new FinanceiroError("NAO_ENCONTRADO", "Cadastro não encontrado");
    if (antes.revisao !== input.revisaoEsperada) throw new FinanceiroError("CONFLITO", "O cadastro foi alterado por outra pessoa. Carregue a versão atual.", "revisaoEsperada");
    if (input.ativo !== undefined && input.ativo !== antes.ativo && !input.motivoAlteracao?.trim()) throw new FinanceiroError("VALIDACAO", "Explique a alteração de situação", "motivoAlteracao");
    const { chaveReenvio, revisaoEsperada, motivoAlteracao, ...dados } = input;
    const depois = await tx.principioAtivo.update({ where: { id }, data: { ...dados, ...(dados.nome ? { nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome) } : {}), revisao: { increment: 1 }, atualizadoPorId: autor(usuarioId) }, include: { origens: true } });
    await auditar(tx, { entidade: "PrincipioAtivo", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois, motivo: motivoAlteracao });
    const { nomeNormalizado, origens: origens, ...dto } = depois;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}

export async function listarNutrientes(input: ConsultaCatalogo) {
  return prisma.$transaction(async tx => {
    const where: Prisma.NutrienteProdutoCatalogoWhereInput = {
      ...(input.selecionadoId ? { id: input.selecionadoId } : input.ativo === undefined ? {} : { ativo: input.ativo === "true" }),
      nomeNormalizado: { contains: normalizarNomeCatalogo(input.busca) },
    };
    const total = await tx.nutrienteProdutoCatalogo.count({ where });
    const pagina = Math.min(input.pagina, Math.max(1, Math.ceil(total / input.porPagina)));
    const itens = await tx.nutrienteProdutoCatalogo.findMany({ where, include: { origensCadastro: true }, orderBy: [{ nomeNormalizado: "asc" }, { id: "asc" }], skip: (pagina - 1) * input.porPagina, take: input.porPagina });
    return { itens: itens.map(({nomeNormalizado, origensCadastro: origens, ...item}) => ({...item, origens})), total, pagina, porPagina: input.porPagina };
  }, { isolationLevel: "RepeatableRead" });
}
export async function criarNutrientes(input: z.infer<typeof criarNutrienteSchema>, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "nutrientes:criar", usuarioId, input.chaveReenvio, input, async () => {
    const { chaveReenvio, ...dados } = input;
    const criado = await tx.nutrienteProdutoCatalogo.create({ data: { ...dados, nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome), criadoPorId: autor(usuarioId), atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "NutrienteProdutoCatalogo", entidadeId: criado.id, acao: "CRIADO", usuarioId, depois: criado });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = criado;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}
export async function atualizarNutrientes(id: string, input: z.infer<typeof patchNutrienteSchema>, usuarioId?: number | null) {
  try { return await prisma.$transaction(tx => comReenvioCadastro(tx, "nutrientes:atualizar:" + id, usuarioId, input.chaveReenvio, input, async () => {
    await tx.$queryRaw`SELECT "id" FROM public."NutrienteProdutoCatalogo" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const antes = await tx.nutrienteProdutoCatalogo.findUnique({ where: { id } });
    if (!antes) throw new FinanceiroError("NAO_ENCONTRADO", "Cadastro não encontrado");
    if (antes.revisao !== input.revisaoEsperada) throw new FinanceiroError("CONFLITO", "O cadastro foi alterado por outra pessoa. Carregue a versão atual.", "revisaoEsperada");
    if (input.ativo !== undefined && input.ativo !== antes.ativo && !input.motivoAlteracao?.trim()) throw new FinanceiroError("VALIDACAO", "Explique a alteração de situação", "motivoAlteracao");
    const { chaveReenvio, revisaoEsperada, motivoAlteracao, ...dados } = input;
    if (dados.unidadeReferencia !== undefined && dados.unidadeReferencia !== antes.unidadeReferencia && await tx.perfilNutricionalProdutoItem.count({ where: { nutrienteId: id } }) > 0) throw new FinanceiroError("CONFLITO", "A unidade de um nutriente com histórico não pode ser alterada. Cadastre outro nutriente para a nova unidade.", "unidadeReferencia");
    const depois = await tx.nutrienteProdutoCatalogo.update({ where: { id }, data: { ...dados, ...(dados.nome ? { nome: dados.nome.trim().replace(/\s+/g," "), nomeNormalizado: normalizarNomeCatalogo(dados.nome) } : {}), revisao: { increment: 1 }, atualizadoPorId: autor(usuarioId) }, include: { origensCadastro: true } });
    await auditar(tx, { entidade: "NutrienteProdutoCatalogo", entidadeId: id, acao: "ATUALIZADO", usuarioId, antes, depois, motivo: motivoAlteracao });
    const { nomeNormalizado, origensCadastro: origens, ...dto } = depois;
    return {...dto, origens};
  })); } catch(e) { duplicidade(e); }
}
