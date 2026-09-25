import type { ClasseMotivoBaixa } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, type DbPecuaria } from "./regras.js";
import { motivoAceito } from "./baixa.calc.js";
import type { CriarMotivoBaixaInput, EditarMotivoBaixaInput } from "./schemas.js";

export interface MotivoBaixaDTO {
  id: string;
  nome: string;
  classe: ClasseMotivoBaixa;
  ativo: boolean;
  /** baixas em vigor (não estornadas) que usam este motivo */
  baixasValendo: number;
}

const dto = (m: { id: string; nome: string; classe: ClasseMotivoBaixa; ativo: boolean }, baixasValendo = 0): MotivoBaixaDTO => ({
  id: m.id,
  nome: m.nome,
  classe: m.classe,
  ativo: m.ativo,
  baixasValendo,
});

async function contarBaixasValendoPorMotivo(db: DbPecuaria, motivoIds: string[]): Promise<Map<string, number>> {
  if (motivoIds.length === 0) return new Map();
  const baixas = await db.baixaAnimal.findMany({ where: { motivoId: { in: motivoIds }, estornadaEm: null }, select: { motivoId: true } });
  const contagem = new Map<string, number>();
  for (const b of baixas) {
    if (!b.motivoId) continue;
    contagem.set(b.motivoId, (contagem.get(b.motivoId) ?? 0) + 1);
  }
  return contagem;
}

// A ordem por `classe` segue a declaração do enum no schema (descarte voluntário, involuntário, morte).
export async function listarMotivosBaixa(incluirInativos = false): Promise<MotivoBaixaDTO[]> {
  const motivos = await prisma.motivoBaixa.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: [{ classe: "asc" }, { nome: "asc" }],
  });
  const contagem = await contarBaixasValendoPorMotivo(prisma, motivos.map((m) => m.id));
  return motivos.map((m) => dto(m, contagem.get(m.id) ?? 0));
}

// Sem @@unique no schema: o nome é único no catálogo inteiro (não só dentro da classe).
async function exigirNomeLivre(db: DbPecuaria, nome: string, ignorarId?: string) {
  const existente = await db.motivoBaixa.findFirst({
    where: { nome: { equals: nome.trim(), mode: "insensitive" }, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
  });
  if (existente) throw new RebanhoError("CONFLITO", "Já existe um motivo de baixa com esse nome", "nome");
}

export async function criarMotivoBaixa(input: CriarMotivoBaixaInput, usuarioId: number | null): Promise<MotivoBaixaDTO> {
  const criado = await prisma.$transaction(async (tx) => {
    await exigirNomeLivre(tx, input.nome);
    const motivo = await tx.motivoBaixa.create({
      data: { nome: input.nome, classe: input.classe, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "MotivoBaixa", entidadeId: motivo.id, acao: "CADASTRO", usuarioId, depois: motivo });
    return motivo;
  });
  return dto(criado);
}

export async function editarMotivoBaixa(id: string, input: EditarMotivoBaixaInput, usuarioId: number | null): Promise<MotivoBaixaDTO> {
  const existente = await prisma.motivoBaixa.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Motivo de baixa não encontrado");

  const atualizado = await prisma.$transaction(async (tx) => {
    if (input.nome != null) {
      await exigirNomeLivre(tx, input.nome, id);
    }

    // trocar a classe pode deixar de servir para baixas já registradas com esse motivo
    if (input.classe != null && input.classe !== existente.classe) {
      const baixasDoMotivo = await tx.baixaAnimal.findMany({
        where: { motivoId: id, estornadaEm: null },
        select: { tipo: true },
      });
      const bloqueadas = baixasDoMotivo.filter((b) => !motivoAceito(b.tipo, input.classe!));
      if (bloqueadas.length > 0) {
        throw new RebanhoError(
          "CONFLITO",
          `${bloqueadas.length} baixa(s) já registradas com esse motivo não aceitam a nova classe`,
          "classe",
        );
      }
    }

    const salvo = await tx.motivoBaixa.update({
      where: { id },
      data: { nome: input.nome ?? undefined, classe: input.classe ?? undefined, ativo: input.ativo ?? undefined },
    });
    await auditar(tx, { entidade: "MotivoBaixa", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salvo });
    return salvo;
  });

  const contagem = await contarBaixasValendoPorMotivo(prisma, [id]);
  return dto(atualizado, contagem.get(id) ?? 0);
}
