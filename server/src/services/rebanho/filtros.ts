import { prisma } from "../../db.js";
import { criteriosParaQuery } from "./filtro.calc.js";
import type { CriarFiltroInput } from "./animais.schemas.js";

export class FiltroError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

export interface FiltroAnimalDTO {
  id: number;
  nome: string;
  status: string;
  grupoId: number | null;
  setor: string | null;
  categoria: string | null;
  finalidade: string | null;
  busca: string | null;
  // Critérios normalizados prontos para aplicar no listarAnimais.
  criterios: ReturnType<typeof criteriosParaQuery>;
}

function toDTO(f: { id: number; nome: string; status: string; grupoId: number | null; setor: string | null; categoria: string | null; finalidade: string | null; busca: string | null }): FiltroAnimalDTO {
  return {
    id: f.id, nome: f.nome, status: f.status, grupoId: f.grupoId, setor: f.setor, categoria: f.categoria, finalidade: f.finalidade, busca: f.busca,
    criterios: criteriosParaQuery({ status: f.status, grupoId: f.grupoId, setor: f.setor, categoria: f.categoria, finalidade: f.finalidade, busca: f.busca }),
  };
}

export async function listarFiltros(propriedadeId: number | null): Promise<FiltroAnimalDTO[]> {
  const rows = await prisma.filtroAnimal.findMany({
    where: propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {},
    orderBy: { nome: "asc" },
  });
  return rows.map(toDTO);
}

export async function criarFiltro(input: CriarFiltroInput, propriedadeId: number | null): Promise<FiltroAnimalDTO> {
  const f = await prisma.filtroAnimal.create({
    data: {
      nome: input.nome,
      status: input.status ?? "ATIVO",
      grupoId: input.grupoId ?? null,
      setor: input.setor ?? null,
      categoria: input.categoria ?? null,
      finalidade: input.finalidade ?? null,
      busca: input.busca ?? null,
      propriedadeId,
    },
  });
  return toDTO(f);
}

export async function excluirFiltro(id: number): Promise<void> {
  if (!(await prisma.filtroAnimal.findUnique({ where: { id } }))) throw new FiltroError("NAO_ENCONTRADO", "filtro não encontrado");
  await prisma.filtroAnimal.delete({ where: { id } });
}
