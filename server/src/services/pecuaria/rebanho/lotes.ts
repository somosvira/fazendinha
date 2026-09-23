import { prisma } from "../../../db.js";
import { auditar, traduzirConflitoUnico, RebanhoError } from "./regras.js";
import type { CriarLoteInput, EditarLoteInput } from "./schemas.js";

export interface LoteDTO {
  id: string;
  nome: string;
  propriedadeId: number;
  ativo: boolean;
  observacao: string | null;
}

const dto = (l: { id: string; nome: string; propriedadeId: number; ativo: boolean; observacao: string | null }): LoteDTO => ({
  id: l.id, nome: l.nome, propriedadeId: l.propriedadeId, ativo: l.ativo, observacao: l.observacao,
});

export async function listarLotes(propriedadeId: number | null, incluirInativos = false): Promise<LoteDTO[]> {
  const lotes = await prisma.lote.findMany({
    where: { ...(propriedadeId != null ? { propriedadeId } : {}), ...(incluirInativos ? {} : { ativo: true }) },
    orderBy: { nome: "asc" },
  });
  return lotes.map(dto);
}

export async function criarLote(input: CriarLoteInput, usuarioId: number | null): Promise<LoteDTO> {
  const propriedade = await prisma.propriedade.findFirst({ where: { id: input.propriedadeId, ativo: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Propriedade não encontrada ou inativa", "propriedadeId");

  const criado = await prisma.$transaction(async (tx) => {
    const lote = await tx.lote.create({
      data: { nome: input.nome, propriedadeId: input.propriedadeId, observacao: input.observacao ?? null, criadoPorId: usuarioId },
    }).catch((e) => traduzirConflitoUnico(e, { propriedadeId_nome: `Já existe um lote "${input.nome}" nesse sítio` }));
    await auditar(tx, { entidade: "Lote", entidadeId: lote.id, acao: "CADASTRO", usuarioId, depois: lote });
    return lote;
  });

  return dto(criado);
}

export async function editarLote(id: string, input: EditarLoteInput, usuarioId: number | null, escopo: number | null = null): Promise<LoteDTO> {
  const existente = await prisma.lote.findUnique({ where: { id } });
  if (!existente || (escopo != null && existente.propriedadeId !== escopo)) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado");

  const atualizado = await prisma.$transaction(async (tx) => {
    const salvo = await tx.lote.update({
      where: { id },
      data: { nome: input.nome ?? undefined, ativo: input.ativo ?? undefined, observacao: input.observacao === undefined ? undefined : input.observacao },
    }).catch((e) => traduzirConflitoUnico(e, { propriedadeId_nome: `Já existe um lote "${input.nome}" nesse sítio` }));
    await auditar(tx, { entidade: "Lote", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salvo });
    return salvo;
  });

  return dto(atualizado);
}
