import { prisma } from "../../../db.js";
import { auditar, hojeFazendaDate, traduzirConflitoUnico, RebanhoError, type DbPecuaria } from "./regras.js";
import { avaliarCategoria, idadeEmMeses, type CategoriaRef } from "./categoria.calc.js";
import { carregarRegras, manualDe, SELECT_MANUAL_ABERTA } from "./categorias.js";
import { agregarPesoLote, resumoPeso, type ItemPesoLote } from "./peso.calc.js";
import type { CriarLoteInput, EditarLoteInput } from "./schemas.js";

export interface LoteDTO {
  id: string;
  nome: string;
  propriedadeId: number;
  propriedade: { id: number; nome: string };
  ativo: boolean;
  observacao: string | null;
  animaisAtivos: number;
}

/** Ids de lote -> contagem de animais ativos (localização aberta nesse lote e sem saída ativa). */
async function contarAnimaisAtivosPorLote(db: DbPecuaria, loteIds: string[]): Promise<Map<string, number>> {
  if (loteIds.length === 0) return new Map();
  const localizacoesAbertas = await db.localizacaoAnimal.findMany({
    where: { ate: null, loteId: { in: loteIds } },
    select: { loteId: true, animalId: true },
  });
  const baixasAbertas = await db.baixaAnimal.findMany({
    where: { estornadaEm: null, animalId: { in: localizacoesAbertas.map((l) => l.animalId) } },
    select: { animalId: true },
  });
  const inativos = new Set(baixasAbertas.map((s) => s.animalId));
  const contagem = new Map<string, number>();
  for (const loc of localizacoesAbertas) {
    if (!loc.loteId || inativos.has(loc.animalId)) continue;
    contagem.set(loc.loteId, (contagem.get(loc.loteId) ?? 0) + 1);
  }
  return contagem;
}

export async function listarLotes(propriedadeId: number | null, incluirInativos = false): Promise<LoteDTO[]> {
  const lotes = await prisma.lote.findMany({
    where: { ...(propriedadeId != null ? { propriedadeId } : {}), ...(incluirInativos ? {} : { ativo: true }) },
    include: { propriedade: { select: { id: true, nome: true } } },
    orderBy: { nome: "asc" },
  });
  const contagem = await contarAnimaisAtivosPorLote(prisma, lotes.map((l) => l.id));
  return lotes.map((l) => ({
    id: l.id,
    nome: l.nome,
    propriedadeId: l.propriedadeId,
    propriedade: l.propriedade,
    ativo: l.ativo,
    observacao: l.observacao,
    animaisAtivos: contagem.get(l.id) ?? 0,
  }));
}

export async function buscarLote(id: string, escopo: number | null): Promise<LoteDTO> {
  const lote = await prisma.lote.findUnique({ where: { id }, include: { propriedade: { select: { id: true, nome: true } } } });
  if (!lote || (escopo != null && lote.propriedadeId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");
  const contagem = await contarAnimaisAtivosPorLote(prisma, [id]);
  return { id: lote.id, nome: lote.nome, propriedadeId: lote.propriedadeId, propriedade: lote.propriedade, ativo: lote.ativo, observacao: lote.observacao, animaisAtivos: contagem.get(id) ?? 0 };
}

export async function criarLote(input: CriarLoteInput, usuarioId: number | null): Promise<LoteDTO> {
  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  const criado = await prisma.$transaction(async (tx) => {
    const lote = await tx.lote.create({
      data: { nome: input.nome, propriedadeId: input.propriedadeId, observacao: input.observacao ?? null, criadoPorId: usuarioId },
    }).catch((e) => traduzirConflitoUnico(e, { nome: `Já existe um lote "${input.nome}" nesse sítio` }));
    await auditar(tx, { entidade: "Lote", entidadeId: lote.id, acao: "CADASTRO", usuarioId, depois: lote });
    return lote;
  });

  return { id: criado.id, nome: criado.nome, propriedadeId: criado.propriedadeId, propriedade: { id: propriedade.id, nome: propriedade.nome }, ativo: criado.ativo, observacao: criado.observacao, animaisAtivos: 0 };
}

export async function editarLote(id: string, input: EditarLoteInput, usuarioId: number | null, escopo: number | null = null): Promise<LoteDTO> {
  const existente = await prisma.lote.findUnique({ where: { id }, include: { propriedade: { select: { id: true, nome: true } } } });
  if (!existente || (escopo != null && existente.propriedadeId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");

  const atualizado = await prisma.$transaction(async (tx) => {
    if (input.ativo === false && existente.ativo) {
      // FOR UPDATE espera quem está pondo animal no lote (FOR SHARE em travarLoteAtivo) terminar,
      // e a contagem abaixo, lida depois, já enxerga esse animal
      await tx.$queryRaw`SELECT "id" FROM "pecuaria"."Lote" WHERE "id" = ${id} FOR UPDATE`;
      const contagem = await contarAnimaisAtivosPorLote(tx, [id]);
      const ativos = contagem.get(id) ?? 0;
      if (ativos > 0) {
        throw new RebanhoError("CONFLITO", `Mova os ${ativos} animais antes de desativar o lote`, "ativo");
      }
    }

    const salvo = await tx.lote.update({
      where: { id },
      data: { nome: input.nome ?? undefined, ativo: input.ativo ?? undefined, observacao: input.observacao === undefined ? undefined : input.observacao },
    }).catch((e) => traduzirConflitoUnico(e, { nome: `Já existe um lote "${input.nome}" nesse sítio` }));
    await auditar(tx, { entidade: "Lote", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salvo });
    return salvo;
  });

  const contagem = await contarAnimaisAtivosPorLote(prisma, [id]);
  return { id: atualizado.id, nome: atualizado.nome, propriedadeId: atualizado.propriedadeId, propriedade: existente.propriedade, ativo: atualizado.ativo, observacao: atualizado.observacao, animaisAtivos: contagem.get(id) ?? 0 };
}

// ---------- resumo do lote (GMD, peso, categorias — só os animais ativos que estão nele hoje) ----------

export interface ResumoLoteDTO {
  ativos: number;
  porSexo: { F: number; M: number };
  /** `categoriaId` nulo = sem categoria; ordenado pela ordem de avaliação das regras (mesma forma de `PainelGeralDTO.porCategoria`) */
  porCategoria: Array<{ categoriaId: string | null; categoria: string; qtd: number }>;
  idadeMediaMeses: number | null;
  peso: { medioKg: number | null; minKg: number | null; maxKg: number | null; semPeso: number };
  gmd: { medio: number | null; comGmd: number; periodoDias: number | null };
}

/**
 * Resumo do lote: só os animais ATIVOS com a localização aberta nele hoje (quem já saiu entra no
 * histórico de movimentações, não na média). Duas consultas — animais e as pesagens deles — sem
 * N+1 por animal.
 */
export async function buscarResumoLote(id: string, periodoDias: number | null, escopo: number | null): Promise<ResumoLoteDTO> {
  const lote = await prisma.lote.findUnique({ where: { id } });
  if (!lote || (escopo != null && lote.propriedadeId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");

  const hoje = hojeFazendaDate();
  const [animais, regras] = await Promise.all([
    prisma.animal.findMany({
      where: { localizacoes: { some: { ate: null, loteId: id } }, baixas: { none: { estornadaEm: null } } },
      select: { id: true, sexo: true, dataNascimento: true, partosAntesDaEntrada: true, categoriasManuais: SELECT_MANUAL_ABERTA },
    }),
    carregarRegras(),
  ]);

  const ids = animais.map((a) => a.id);
  const pesagens = ids.length
    ? await prisma.pesagem.findMany({ where: { animalId: { in: ids } }, orderBy: [{ animalId: "asc" }, { data: "desc" }], select: { animalId: true, data: true, pesoKg: true } })
    : [];
  const pesagensPorAnimal = new Map<string, Array<{ data: Date; pesoKg: number }>>();
  for (const p of pesagens) {
    const lista = pesagensPorAnimal.get(p.animalId) ?? [];
    lista.push({ data: p.data, pesoKg: Number(p.pesoKg) });
    pesagensPorAnimal.set(p.animalId, lista);
  }

  let femeas = 0;
  let machos = 0;
  let somaIdadeMeses = 0;
  const ordem = new Map(regras.map((r) => [r.id, r.ordem]));
  const porCategoriaMap = new Map<string, { categoria: CategoriaRef | null; total: number }>();
  const itensPeso: ItemPesoLote[] = [];

  for (const a of animais) {
    if (a.sexo === "F") femeas += 1; else machos += 1;
    somaIdadeMeses += idadeEmMeses(a.dataNascimento, hoje);

    const { categoria } = avaliarCategoria(
      { sexo: a.sexo, dataNascimento: a.dataNascimento, partos: a.partosAntesDaEntrada }, regras, manualDe(a.categoriasManuais), hoje,
    );
    const chave = categoria?.id ?? "";
    const atual = porCategoriaMap.get(chave);
    porCategoriaMap.set(chave, { categoria, total: (atual?.total ?? 0) + 1 });

    const resumo = resumoPeso(pesagensPorAnimal.get(a.id) ?? [], { hoje, periodoDias });
    itensPeso.push({ ultimoKg: resumo.ultimo?.kg ?? null, gmdPeriodo: resumo.gmdPeriodo.valor });
  }

  const agregado = agregarPesoLote(itensPeso);
  const porCategoria = [...porCategoriaMap.values()]
    .sort((x, y) => (x.categoria ? ordem.get(x.categoria.id) ?? 1e9 : 2e9) - (y.categoria ? ordem.get(y.categoria.id) ?? 1e9 : 2e9))
    .map((c) => ({ categoriaId: c.categoria?.id ?? null, categoria: c.categoria?.nome ?? "Sem categoria", qtd: c.total }));

  return {
    ativos: animais.length,
    porSexo: { F: femeas, M: machos },
    porCategoria,
    idadeMediaMeses: animais.length ? Math.round((somaIdadeMeses / animais.length) * 10) / 10 : null,
    peso: agregado.peso,
    gmd: { ...agregado.gmd, periodoDias },
  };
}
