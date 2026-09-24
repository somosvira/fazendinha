// Categorias do rebanho configuráveis pela fazenda (CategoriaAnimal): cadastro, ordem de
// avaliação, simulação de impacto e "Restaurar padrões". O cálculo em si é puro e vive em
// categoria.calc.ts; aqui fica o que depende do banco (regras carregadas, filtro Prisma, contagens).

import type { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, traduzirConflitoUnico, RebanhoError, type DbPecuaria } from "./regras.js";
import {
  avaliarCategoria, descreverRegra, filtroCategoria, validarRegra,
  type CategoriaRef, type CondicaoRegra, type CriterioPartos, type RegraCategoria, type Sexo,
} from "./categoria.calc.js";
import type { CriarCategoriaInput, EditarCategoriaInput, RegraPropostaInput } from "./schemas.js";

/** Padrões de fábrica: as categorias do IDEAGRI (CATEGORIA 1–7). Mesmos valores da migration pecuaria_categorias. */
export const CATEGORIAS_PADRAO: Array<{
  chavePadrao: string; ideagriId: number; nome: string; sexo: Sexo; automatica: boolean;
  idadeMinMeses: number | null; idadeMaxMeses: number | null; partos: CriterioPartos; ordem: number;
}> = [
  { chavePadrao: "F_VACA", ideagriId: 7, nome: "Vaca", sexo: "F", automatica: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM", ordem: 10 },
  { chavePadrao: "F_EM_CRESCIMENTO", ideagriId: 5, nome: "Em crescimento", sexo: "F", automatica: true, idadeMinMeses: null, idadeMaxMeses: 12, partos: "SEM", ordem: 20 },
  { chavePadrao: "F_NOVILHA", ideagriId: 6, nome: "Novilha", sexo: "F", automatica: true, idadeMinMeses: 12, idadeMaxMeses: null, partos: "SEM", ordem: 30 },
  { chavePadrao: "M_EM_CRESCIMENTO", ideagriId: 1, nome: "Em crescimento", sexo: "M", automatica: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ordem: 40 },
  { chavePadrao: "M_REPRODUTOR", ideagriId: 2, nome: "Reprodutor", sexo: "M", automatica: false, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ordem: 50 },
  { chavePadrao: "M_BOI_CARREIRO", ideagriId: 3, nome: "Boi carreiro", sexo: "M", automatica: false, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ordem: 60 },
  { chavePadrao: "M_RUFIAO", ideagriId: 4, nome: "Rufião", sexo: "M", automatica: false, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ordem: 70 },
];

type LinhaCategoria = Prisma.CategoriaAnimalGetPayload<Record<string, never>>;

const paraRegra = (c: LinhaCategoria): RegraCategoria => ({
  id: c.id, nome: c.nome, sexo: c.sexo, automatica: c.automatica, ativo: c.ativo, ordem: c.ordem,
  idadeMinMeses: c.idadeMinMeses, idadeMaxMeses: c.idadeMaxMeses, partos: c.partos,
});

/** Todas as categorias (ativas e inativas) como regras — carregar uma vez por request. */
export async function carregarRegras(db: DbPecuaria = prisma): Promise<RegraCategoria[]> {
  const linhas = await db.categoriaAnimal.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  return linhas.map(paraRegra);
}

/** Seleção da categoria manual aberta, para `include`/`select` do Animal. */
export const SELECT_MANUAL_ABERTA = {
  where: { ate: null },
  take: 1,
  select: { categoria: { select: { id: true, nome: true } } },
} satisfies Prisma.Animal$categoriasManuaisArgs;

export const manualDe = (linhas: Array<{ categoria: CategoriaRef }> | undefined): CategoriaRef | null => linhas?.[0]?.categoria ?? null;

function whereCondicao(c: CondicaoRegra): Prisma.AnimalWhereInput {
  return {
    sexo: c.sexo,
    ...(c.semPartos === undefined ? {} : { partosAntesDaEntrada: c.semPartos ? 0 : { gt: 0 } }),
    ...(c.nascidoAte || c.nascidoApos ? { dataNascimento: { ...(c.nascidoAte ? { lte: c.nascidoAte } : {}), ...(c.nascidoApos ? { gt: c.nascidoApos } : {}) } } : {}),
  };
}

/** `where` do Prisma equivalente a "a categoria que vale para o animal é `categoriaId`". */
export function whereCategoria(categoriaId: string | undefined, regras: RegraCategoria[], hoje: Date): Prisma.AnimalWhereInput {
  if (!categoriaId) return {};
  const f = filtroCategoria(categoriaId, regras, hoje);
  const manual: Prisma.AnimalWhereInput = { categoriasManuais: { some: { ate: null, categoriaId } } };
  if (!f.automatica) return manual;
  return {
    OR: [
      manual,
      { AND: [{ categoriasManuais: { none: { ate: null } } }, whereCondicao(f.automatica.incluir), ...f.automatica.excluir.map((e) => ({ NOT: whereCondicao(e) }))] },
    ],
  };
}

// ---------- contagem e simulação (sobre os animais ativos da fazenda) ----------

interface AnimalAtivoCategoria {
  id: string;
  sexo: Sexo;
  dataNascimento: Date;
  partos: number;
  manual: CategoriaRef | null;
}

async function animaisAtivos(db: DbPecuaria = prisma): Promise<AnimalAtivoCategoria[]> {
  const animais = await db.animal.findMany({
    where: { saidas: { none: { estornadaEm: null } } },
    select: { id: true, sexo: true, dataNascimento: true, partosAntesDaEntrada: true, categoriasManuais: SELECT_MANUAL_ABERTA },
  });
  return animais.map((a) => ({ id: a.id, sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada, manual: manualDe(a.categoriasManuais) }));
}

function contar(animais: AnimalAtivoCategoria[], regras: RegraCategoria[], hoje: Date) {
  const porCategoria = new Map<string, number>();
  let semCategoria = 0;
  const atual = new Map<string, CategoriaRef | null>();
  for (const a of animais) {
    const { categoria } = avaliarCategoria(a, regras, a.manual, hoje);
    atual.set(a.id, categoria);
    if (categoria) porCategoria.set(categoria.id, (porCategoria.get(categoria.id) ?? 0) + 1);
    else semCategoria += 1;
  }
  return { porCategoria, semCategoria, atual };
}

export interface ResultadoSimulacao {
  afetados: number;
  mudancas: Array<{ de: CategoriaRef | null; para: CategoriaRef | null; total: number }>;
  semCategoria: number;
}

/** Compara as regras atuais com as propostas, sem gravar. As trocas manuais continuam valendo. */
async function simularContra(propostas: RegraCategoria[]): Promise<ResultadoSimulacao> {
  const hoje = new Date();
  const [regras, animais] = await Promise.all([carregarRegras(), animaisAtivos()]);
  const antes = contar(animais, regras, hoje).atual;
  const depois = contar(animais, propostas, hoje);
  const mudancas = new Map<string, { de: CategoriaRef | null; para: CategoriaRef | null; total: number }>();
  for (const a of animais) {
    const de = antes.get(a.id) ?? null;
    const para = depois.atual.get(a.id) ?? null;
    if ((de?.id ?? null) === (para?.id ?? null)) continue;
    const chave = `${de?.id ?? "-"}>${para?.id ?? "-"}`;
    const item = mudancas.get(chave) ?? { de, para, total: 0 };
    item.total += 1;
    mudancas.set(chave, item);
  }
  const lista = [...mudancas.values()].sort((x, y) => y.total - x.total);
  return { afetados: lista.reduce((s, m) => s + m.total, 0), mudancas: lista, semCategoria: depois.semCategoria };
}

export async function simularCategorias(propostas: RegraPropostaInput[]): Promise<ResultadoSimulacao> {
  return simularContra(propostas.map((p, i) => ({
    id: p.id ?? `nova-${i}`, nome: p.nome, sexo: p.sexo, automatica: p.automatica, ativo: p.ativo, ordem: p.ordem,
    idadeMinMeses: p.idadeMinMeses ?? null, idadeMaxMeses: p.idadeMaxMeses ?? null, partos: p.partos,
  })));
}

// ---------- cadastro ----------

export interface CategoriaDTO extends RegraCategoria {
  ideagriId: number | null;
  padrao: boolean;
  regra: string;
  animaisAtivos: number;
  manuaisAbertas: number;
}

export async function listarCategorias(incluirInativas = false): Promise<{ itens: CategoriaDTO[]; semCategoria: number }> {
  const hoje = new Date();
  const [linhas, animais, manuais] = await Promise.all([
    prisma.categoriaAnimal.findMany({ where: incluirInativas ? {} : { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    animaisAtivos(),
    prisma.categoriaManualAnimal.groupBy({ by: ["categoriaId"], where: { ate: null }, _count: { _all: true } }),
  ]);
  const regras = await carregarRegras();
  const { porCategoria, semCategoria } = contar(animais, regras, hoje);
  const manuaisPor = new Map(manuais.map((m) => [m.categoriaId, m._count._all]));
  return {
    itens: linhas.map((c) => ({
      ...paraRegra(c),
      ideagriId: c.ideagriId,
      padrao: c.chavePadrao != null,
      regra: descreverRegra(c),
      animaisAtivos: porCategoria.get(c.id) ?? 0,
      manuaisAbertas: manuaisPor.get(c.id) ?? 0,
    })),
    semCategoria,
  };
}

function exigirRegraValida(input: { nome: string; automatica: boolean; idadeMinMeses?: number | null; idadeMaxMeses?: number | null }) {
  const erros = validarRegra({ nome: input.nome, automatica: input.automatica, idadeMinMeses: input.idadeMinMeses ?? null, idadeMaxMeses: input.idadeMaxMeses ?? null });
  if (erros.length) throw new RebanhoError("VALIDACAO", erros[0].mensagem, erros[0].campo);
}

const NOME_DUPLICADO = "Já existe uma categoria com esse nome para esse sexo";

export async function criarCategoria(input: CriarCategoriaInput, usuarioId: number | null): Promise<CategoriaRef> {
  exigirRegraValida(input);
  const ultima = await prisma.categoriaAnimal.findFirst({ orderBy: { ordem: "desc" }, select: { ordem: true } });
  const criada = await prisma.$transaction(async (tx) => {
    const c = await tx.categoriaAnimal.create({
      data: {
        nome: input.nome, sexo: input.sexo, automatica: input.automatica,
        idadeMinMeses: input.automatica ? input.idadeMinMeses ?? null : null,
        idadeMaxMeses: input.automatica ? input.idadeMaxMeses ?? null : null,
        partos: input.automatica ? input.partos : "QUALQUER",
        ordem: input.ordem ?? (ultima?.ordem ?? 0) + 10,
        criadoPorId: usuarioId,
      },
    }).catch((e) => traduzirConflitoUnico(e, { nome: NOME_DUPLICADO }));
    await auditar(tx, { entidade: "CategoriaAnimal", entidadeId: c.id, acao: "CADASTRO", usuarioId, depois: c });
    return c;
  });
  return { id: criada.id, nome: criada.nome };
}

export async function editarCategoria(id: string, input: EditarCategoriaInput, usuarioId: number | null): Promise<CategoriaRef> {
  const existente = await prisma.categoriaAnimal.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Categoria não encontrada");
  const automatica = input.automatica ?? existente.automatica;
  const nome = input.nome ?? existente.nome;
  const idadeMinMeses = input.idadeMinMeses === undefined ? existente.idadeMinMeses : input.idadeMinMeses;
  const idadeMaxMeses = input.idadeMaxMeses === undefined ? existente.idadeMaxMeses : input.idadeMaxMeses;
  exigirRegraValida({ nome, automatica, idadeMinMeses, idadeMaxMeses });

  const salva = await prisma.$transaction(async (tx) => {
    const manuais = await tx.categoriaManualAnimal.count({ where: { categoriaId: id, ate: null } });
    if (manuais > 0 && input.sexo && input.sexo !== existente.sexo) {
      throw new RebanhoError("CONFLITO", `${manuais} animal(is) têm esta categoria manual; volte-os ao automático antes de trocar o sexo`, "sexo");
    }
    if (manuais > 0 && input.ativo === false) {
      throw new RebanhoError("CONFLITO", `${manuais} animal(is) têm esta categoria manual; volte-os ao automático antes de desativar`, "ativo");
    }
    const c = await tx.categoriaAnimal.update({
      where: { id },
      data: {
        nome, sexo: input.sexo ?? undefined, automatica, ativo: input.ativo ?? undefined, ordem: input.ordem ?? undefined,
        idadeMinMeses: automatica ? idadeMinMeses : null,
        idadeMaxMeses: automatica ? idadeMaxMeses : null,
        partos: automatica ? input.partos ?? existente.partos : "QUALQUER",
      },
    }).catch((e) => traduzirConflitoUnico(e, { nome: NOME_DUPLICADO }));
    await auditar(tx, { entidade: "CategoriaAnimal", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: c });
    return c;
  });
  return { id: salva.id, nome: salva.nome };
}

/** Grava a ordem de avaliação: `ids` na ordem desejada (os não citados mantêm a posição relativa ao fim). */
export async function reordenarCategorias(ids: string[], usuarioId: number | null): Promise<void> {
  const todas = await prisma.categoriaAnimal.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, ordem: true } });
  const conhecidos = new Set(todas.map((c) => c.id));
  if (ids.some((id) => !conhecidos.has(id))) throw new RebanhoError("NAO_ENCONTRADO", "Categoria não encontrada");
  const final = [...ids, ...todas.map((c) => c.id).filter((id) => !ids.includes(id))];
  await prisma.$transaction(async (tx) => {
    for (const [i, id] of final.entries()) await tx.categoriaAnimal.update({ where: { id }, data: { ordem: (i + 1) * 10 } });
    await auditar(tx, { entidade: "CategoriaAnimal", entidadeId: "ordem", acao: "REORDENACAO", usuarioId, antes: todas, depois: final });
  });
}

/** Reescreve nome/regra/ordem dos itens de fábrica e os reativa. Categorias criadas pelo usuário não mudam. */
export async function restaurarPadroes(simular: boolean, usuarioId: number | null): Promise<ResultadoSimulacao> {
  const regras = await carregarRegras();
  const linhas = await prisma.categoriaAnimal.findMany({ where: { chavePadrao: { not: null } } });
  const porChave = new Map(linhas.map((l) => [l.chavePadrao!, l]));
  const propostas = regras.map((r) => {
    const linha = linhas.find((l) => l.id === r.id);
    const padrao = linha ? CATEGORIAS_PADRAO.find((p) => p.chavePadrao === linha.chavePadrao) : undefined;
    return padrao ? { ...r, nome: padrao.nome, sexo: padrao.sexo, automatica: padrao.automatica, ativo: true, ordem: padrao.ordem, idadeMinMeses: padrao.idadeMinMeses, idadeMaxMeses: padrao.idadeMaxMeses, partos: padrao.partos } : r;
  });
  // padrão apagado do banco (não deveria acontecer) volta a existir
  for (const p of CATEGORIAS_PADRAO) if (!porChave.has(p.chavePadrao)) propostas.push({ id: `padrao-${p.chavePadrao}`, ativo: true, ...p });
  const resultado = await simularContra(propostas);
  if (simular) return resultado;

  await prisma.$transaction(async (tx) => {
    for (const p of CATEGORIAS_PADRAO) {
      const dados = { nome: p.nome, sexo: p.sexo, automatica: p.automatica, idadeMinMeses: p.idadeMinMeses, idadeMaxMeses: p.idadeMaxMeses, partos: p.partos, ordem: p.ordem, ativo: true };
      // um nome de fábrica pode estar ocupado por uma categoria do usuário: libera renomeando a do usuário
      const ocupante = await tx.categoriaAnimal.findFirst({ where: { sexo: p.sexo, nome: p.nome, OR: [{ chavePadrao: null }, { chavePadrao: { not: p.chavePadrao } }] } });
      if (ocupante) await tx.categoriaAnimal.update({ where: { id: ocupante.id }, data: { nome: `${ocupante.nome} (antiga)` } });
      await tx.categoriaAnimal.upsert({ where: { chavePadrao: p.chavePadrao }, update: dados, create: { ...dados, chavePadrao: p.chavePadrao, ideagriId: p.ideagriId, criadoPorId: usuarioId } });
    }
    await auditar(tx, { entidade: "CategoriaAnimal", entidadeId: "padroes", acao: "RESTAURAR_PADROES", usuarioId, antes: linhas, depois: CATEGORIAS_PADRAO });
  });
  return resultado;
}
