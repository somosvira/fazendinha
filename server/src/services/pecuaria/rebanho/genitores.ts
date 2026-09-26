import { prisma } from "../../../db.js";
import { auditar, RebanhoError, type DbPecuaria } from "./regras.js";
import { validarComposicao, rotuloComposicao, type FracaoRaca } from "./composicao.calc.js";
import type { CriarGenitorInput, EditarGenitorInput, ListarGenitoresQuery, SubstituirComposicaoGenitorInput } from "./schemas.js";

export interface GenitorDTO {
  id: string;
  sexo: "F" | "M";
  nome: string;
  codigo: string | null;
  fornecedor: string | null;
  observacao: string | null;
  ativo: boolean;
  composicao: FracaoRaca[];
  composicaoRotulo: string;
  filhos: number;
}

async function composicaoDoGenitor(db: DbPecuaria, genitorId: string): Promise<Array<{ racaId: string; sigla: string; nome: string; fracao64: number }>> {
  const itens = await db.composicaoGenitorExterno.findMany({ where: { genitorId }, include: { raca: true } });
  return itens
    .map((i) => ({ racaId: i.racaId, sigla: i.raca.sigla, nome: i.raca.nome, fracao64: i.fracao64 }))
    .sort((a, b) => b.fracao64 - a.fracao64);
}

async function contarFilhos(db: DbPecuaria, genitorId: string): Promise<number> {
  const [comoMae, comoPai] = await Promise.all([
    db.animal.count({ where: { maeExternaId: genitorId } }),
    db.animal.count({ where: { paiExternoId: genitorId } }),
  ]);
  return comoMae + comoPai;
}

function dto(g: { id: string; sexo: "F" | "M"; nome: string; codigo: string | null; fornecedor: string | null; observacao: string | null; ativo: boolean }, composicao: FracaoRaca[], filhos: number): GenitorDTO {
  return {
    id: g.id,
    sexo: g.sexo,
    nome: g.nome,
    codigo: g.codigo,
    fornecedor: g.fornecedor,
    observacao: g.observacao,
    ativo: g.ativo,
    composicao,
    composicaoRotulo: rotuloComposicao(composicao),
    filhos,
  };
}

export async function listarGenitores(filtros: Partial<ListarGenitoresQuery> = {}): Promise<GenitorDTO[]> {
  const genitores = await prisma.genitorExterno.findMany({
    where: {
      ...(filtros.sexo ? { sexo: filtros.sexo } : {}),
      ...(filtros.incluirInativos ? {} : { ativo: true }),
      ...(filtros.q ? { nome: { contains: filtros.q, mode: "insensitive" } } : {}),
    },
    orderBy: { nome: "asc" },
  });
  return Promise.all(genitores.map(async (g) => dto(g, await composicaoDoGenitor(prisma, g.id), await contarFilhos(prisma, g.id))));
}

export async function buscarGenitor(id: string): Promise<GenitorDTO> {
  const g = await prisma.genitorExterno.findUnique({ where: { id } });
  if (!g) throw new RebanhoError("NAO_ENCONTRADO", "Genitor não encontrado");
  return dto(g, await composicaoDoGenitor(prisma, id), await contarFilhos(prisma, id));
}

async function exigirNomeLivre(db: DbPecuaria, sexo: "F" | "M", nome: string, ignorarId?: string) {
  const existente = await db.genitorExterno.findFirst({
    where: { sexo, nome: { equals: nome, mode: "insensitive" }, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
  });
  if (existente) throw new RebanhoError("CONFLITO", `Já existe um genitor "${nome}" desse sexo`, "nome");
}

function validarComposicaoInput(itens: Array<{ racaId: string; fracao64: number }>) {
  if (!itens.length) return;
  const erros = validarComposicao(itens.map((c) => ({ sigla: c.racaId, fracao64: c.fracao64 })));
  if (erros.length) throw new RebanhoError("VALIDACAO", erros[0].mensagem, erros[0].campo);
}

async function exigirRacasValidas(db: DbPecuaria, itens: Array<{ racaId: string }>, jaPresentes = new Set<string>()) {
  if (!itens.length) return;
  const racaIds = [...new Set(itens.map((c) => c.racaId))];
  const racas = await db.raca.findMany({ where: { id: { in: racaIds } }, select: { id: true, ativo: true } });
  const aceitas = racas.filter((r) => r.ativo || jaPresentes.has(r.id));
  if (aceitas.length !== racaIds.length) throw new RebanhoError("NAO_ENCONTRADO", "Raça da composição não encontrada ou inativa", "composicao");
}

export async function criarGenitor(input: CriarGenitorInput, usuarioId: number | null): Promise<GenitorDTO> {
  validarComposicaoInput(input.composicao);
  await exigirRacasValidas(prisma, input.composicao);

  const criado = await prisma.$transaction(async (tx) => {
    await exigirNomeLivre(tx, input.sexo, input.nome);
    const genitor = await tx.genitorExterno.create({
      data: {
        sexo: input.sexo, nome: input.nome, codigo: input.codigo ?? null, fornecedor: input.fornecedor ?? null,
        observacao: input.observacao ?? null, criadoPorId: usuarioId,
      },
    });
    if (input.composicao.length) {
      await tx.composicaoGenitorExterno.createMany({
        data: input.composicao.map((c) => ({ genitorId: genitor.id, racaId: c.racaId, fracao64: c.fracao64 })),
      });
    }
    await auditar(tx, { entidade: "GenitorExterno", entidadeId: genitor.id, acao: "CADASTRO", usuarioId, depois: { ...genitor, composicao: input.composicao } });
    return genitor;
  });

  return dto(criado, await composicaoDoGenitor(prisma, criado.id), 0);
}

export async function editarGenitor(id: string, input: EditarGenitorInput, usuarioId: number | null): Promise<GenitorDTO> {
  const existente = await prisma.genitorExterno.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Genitor não encontrado");

  const atualizado = await prisma.$transaction(async (tx) => {
    if (input.sexo && input.sexo !== existente.sexo) {
      const filhos = await contarFilhos(tx, id);
      if (filhos > 0) throw new RebanhoError("CONFLITO", "Este genitor já tem filhos registrados; não é possível trocar o sexo", "sexo");
      const materiais = await tx.materialGenetico.count({ where: { OR: [{ touroExternoId: id }, { doadoraExternaId: id }] } });
      if (materiais > 0) throw new RebanhoError("CONFLITO", "Este genitor é usado em material genético (sêmen/embrião); não é possível trocar o sexo", "sexo");
    }
    if (input.nome != null || input.sexo != null) {
      await exigirNomeLivre(tx, input.sexo ?? existente.sexo, input.nome ?? existente.nome, id);
    }
    const salvo = await tx.genitorExterno.update({
      where: { id },
      data: {
        sexo: input.sexo ?? undefined,
        nome: input.nome ?? undefined,
        codigo: input.codigo === undefined ? undefined : input.codigo,
        fornecedor: input.fornecedor === undefined ? undefined : input.fornecedor,
        observacao: input.observacao === undefined ? undefined : input.observacao,
        ativo: input.ativo ?? undefined,
      },
    });
    await auditar(tx, { entidade: "GenitorExterno", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salvo });
    return salvo;
  });

  return dto(atualizado, await composicaoDoGenitor(prisma, id), await contarFilhos(prisma, id));
}

export async function substituirComposicaoGenitor(id: string, input: SubstituirComposicaoGenitorInput, usuarioId: number | null): Promise<GenitorDTO> {
  const existente = await prisma.genitorExterno.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Genitor não encontrado");

  validarComposicaoInput(input.itens);

  await prisma.$transaction(async (tx) => {
    const atuais = await tx.composicaoGenitorExterno.findMany({ where: { genitorId: id } });
    await exigirRacasValidas(tx, input.itens, new Set(atuais.map((a) => a.racaId)));

    const antes = atuais;
    await tx.composicaoGenitorExterno.deleteMany({ where: { genitorId: id } });
    if (input.itens.length) {
      await tx.composicaoGenitorExterno.createMany({
        data: input.itens.map((c) => ({ genitorId: id, racaId: c.racaId, fracao64: c.fracao64 })),
      });
    }
    const depois = await tx.composicaoGenitorExterno.findMany({ where: { genitorId: id } });
    await auditar(tx, { entidade: "GenitorExterno", entidadeId: id, acao: "COMPOSICAO", usuarioId, antes, depois });
  });

  return dto(existente, await composicaoDoGenitor(prisma, id), await contarFilhos(prisma, id));
}
