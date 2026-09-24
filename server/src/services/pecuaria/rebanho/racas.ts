import { prisma } from "../../../db.js";
import { auditar, RebanhoError, type DbPecuaria } from "./regras.js";
import type { CriarRacaInput, EditarRacaInput } from "./schemas.js";

export interface RacaDTO {
  id: string;
  nome: string;
  sigla: string;
  base: boolean;
  ativo: boolean;
  /** animais ativos (sem baixa em vigor) com essa raça na composição */
  animaisAtivos: number;
}

const dto = (r: { id: string; nome: string; sigla: string; base: boolean; ativo: boolean }, animaisAtivos = 0): RacaDTO => ({
  id: r.id,
  nome: r.nome,
  sigla: r.sigla,
  base: r.base,
  ativo: r.ativo,
  animaisAtivos,
});

/** Ids de raça -> contagem de animais ativos (sem baixa em vigor) que têm a raça na composição. */
async function contarAnimaisAtivosPorRaca(db: DbPecuaria, racaIds: string[]): Promise<Map<string, number>> {
  if (racaIds.length === 0) return new Map();
  const composicoes = await db.composicaoRacial.findMany({
    where: { racaId: { in: racaIds }, animal: { baixas: { none: { estornadaEm: null } } } },
    select: { racaId: true, animalId: true },
  });
  const animaisPorRaca = new Map<string, Set<string>>();
  for (const c of composicoes) {
    const set = animaisPorRaca.get(c.racaId) ?? new Set<string>();
    set.add(c.animalId);
    animaisPorRaca.set(c.racaId, set);
  }
  return new Map([...animaisPorRaca].map(([racaId, set]) => [racaId, set.size]));
}

export async function listarRacas(incluirInativos = false): Promise<RacaDTO[]> {
  const racas = await prisma.raca.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: "asc" },
  });
  const contagem = await contarAnimaisAtivosPorRaca(prisma, racas.map((r) => r.id));
  return racas.map((r) => dto(r, contagem.get(r.id) ?? 0));
}

// Sem @@unique no schema para nome/sigla: duplicidade é checada aqui, não pelo Prisma.
async function exigirNomeSiglaLivres(db: DbPecuaria, nome: string, sigla: string, ignorarId?: string) {
  const existente = await db.raca.findFirst({
    where: {
      OR: [{ nome: { equals: nome, mode: "insensitive" } }, { sigla: { equals: sigla, mode: "insensitive" } }],
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
  });
  if (!existente) return;
  if (existente.sigla.toUpperCase() === sigla.toUpperCase()) {
    throw new RebanhoError("CONFLITO", `Já existe uma raça com a sigla ${sigla}`, "sigla");
  }
  throw new RebanhoError("CONFLITO", `Já existe uma raça "${nome}"`, "nome");
}

export async function criarRaca(input: CriarRacaInput, usuarioId: number | null): Promise<RacaDTO> {
  const criada = await prisma.$transaction(async (tx) => {
    await exigirNomeSiglaLivres(tx, input.nome, input.sigla);
    const raca = await tx.raca.create({
      data: { nome: input.nome, sigla: input.sigla, base: input.base, criadoPorId: usuarioId },
    });
    await auditar(tx, { entidade: "Raca", entidadeId: raca.id, acao: "CADASTRO", usuarioId, depois: raca });
    return raca;
  });
  return dto(criada);
}

export async function editarRaca(id: string, input: EditarRacaInput, usuarioId: number | null): Promise<RacaDTO> {
  const existente = await prisma.raca.findUnique({ where: { id } });
  if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Raça não encontrada");

  const atualizada = await prisma.$transaction(async (tx) => {
    if (input.nome != null || input.sigla != null) {
      await exigirNomeSiglaLivres(tx, input.nome ?? existente.nome, input.sigla ?? existente.sigla, id);
    }
    const salva = await tx.raca.update({
      where: { id },
      data: {
        nome: input.nome ?? undefined,
        sigla: input.sigla ?? undefined,
        base: input.base ?? undefined,
        ativo: input.ativo ?? undefined,
      },
    });
    await auditar(tx, { entidade: "Raca", entidadeId: id, acao: "EDICAO", usuarioId, antes: existente, depois: salva });
    return salva;
  });
  const contagem = await contarAnimaisAtivosPorRaca(prisma, [id]);

  return dto(atualizada, contagem.get(id) ?? 0);
}
