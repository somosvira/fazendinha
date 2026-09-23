import { prisma } from "../../../db.js";
import { auditar, RebanhoError, type DbPecuaria } from "./regras.js";
import type { CriarMotivoSaidaInput, EditarMotivoSaidaInput } from "./schemas.js";

export interface MotivoSaidaDTO {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

const dto = (m: { id: string; nome: string; tipo: string; ativo: boolean }): MotivoSaidaDTO => ({
  id: m.id,
  nome: m.nome,
  tipo: m.tipo,
  ativo: m.ativo,
});

export async function listarMotivosSaida(incluirInativos = false): Promise<MotivoSaidaDTO[]> {
  const motivos = await prisma.motivoSaida.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
  });
  return motivos.map(dto);
}

// Sem @@unique no schema: duplicidade (mesmo nome + tipo) é checada aqui.
async function exigirNomeTipoLivre(db: DbPecuaria, nome: string, tipo: string, ignorarId?: string) {
  const existente = await db.motivoSaida.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, tipo: tipo as never, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
  });
  if (existente) throw new RebanhoError("CONFLITO", `Já existe um motivo "${nome}" para esse tipo de saída`, "nome");
}

export async function criarMotivoSaida(input: CriarMotivoSaidaInput, usuarioId: number | null): Promise<MotivoSaidaDTO> {
  const criado = await prisma.$transaction(async (tx) => {
    await exigirNomeTipoLivre(tx, input.nome, input.tipo);
    const motivo = await tx.motivoSaida.create({
      data: { nome: input.nome, tipo: input.tipo, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "MotivoSaida", entidadeId: motivo.id, acao: "CADASTRO", usuarioId, depois: motivo });
    return motivo;
  });
  return dto(criado);
}

export async function editarMotivoSaida(id: string, input: EditarMotivoSaidaInput, usuarioId: number | null): Promise<MotivoSaidaDTO> {
  const existente = await prisma.motivoSaida.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de saída não encontrado");

  const atualizado = await prisma.$transaction(async (tx) => {
    if (input.nome != null || input.tipo != null) {
      await exigirNomeTipoLivre(tx, input.nome ?? existente.nome, input.tipo ?? existente.tipo, id);
    }
    const salvo = await tx.motivoSaida.update({
      where: { id },
      data: { nome: input.nome ?? undefined, tipo: input.tipo ?? undefined, ativo: input.ativo ?? undefined },
    });
    await auditar(tx, { entidade: "MotivoSaida", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salvo });
    return salvo;
  });

  return dto(atualizado);
}
