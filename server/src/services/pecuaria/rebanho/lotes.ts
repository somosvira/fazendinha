import { prisma } from "../../../db.js";
import { auditar, traduzirConflitoUnico, RebanhoError, type DbPecuaria } from "./regras.js";
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
  const saidasAbertas = await db.saidaAnimal.findMany({
    where: { estornadaEm: null, animalId: { in: localizacoesAbertas.map((l) => l.animalId) } },
    select: { animalId: true },
  });
  const inativos = new Set(saidasAbertas.map((s) => s.animalId));
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
