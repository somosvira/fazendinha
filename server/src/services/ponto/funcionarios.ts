import { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { toFuncionarioDTO, type FuncionarioDTO } from "./funcionarios.mappers.js";
import type {
  CriarFuncionarioInput,
  EditarFuncionarioInput,
  ListFuncionariosFiltros,
} from "./funcionarios.schemas.js";

export class FuncionarioError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
  }
}

const d = (s?: string | null) => (s ? new Date(s) : null);

// P2025 = "Record to update/delete not found" (Prisma). Convertemos numa
// FuncionarioError NAO_ENCONTRADO — evita o findUnique+update não atômico.
function comoNaoEncontrado(e: unknown): FuncionarioError {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
    return new FuncionarioError("NAO_ENCONTRADO", "funcionário não encontrado");
  }
  throw e;
}

export async function listarFuncionarios(f: ListFuncionariosFiltros = {}): Promise<FuncionarioDTO[]> {
  const where: Prisma.FuncionarioWhereInput = {};
  if (f.ativo !== undefined) where.ativo = f.ativo;
  const rows = await prisma.funcionario.findMany({ where, orderBy: { nome: "asc" } });
  return rows.map(toFuncionarioDTO);
}

export async function obterFuncionario(id: number): Promise<FuncionarioDTO | null> {
  const row = await prisma.funcionario.findUnique({ where: { id } });
  return row ? toFuncionarioDTO(row) : null;
}

export async function criarFuncionario(input: CriarFuncionarioInput): Promise<FuncionarioDTO> {
  const row = await prisma.funcionario.create({
    data: {
      nome: input.nome,
      cargo: input.cargo ?? null,
      salarioMensal: input.salarioMensal,
      cargaMensalHoras: input.cargaMensalHoras,
      jornadaDiariaHoras: input.jornadaDiariaHoras,
      dataAdmissao: d(input.dataAdmissao),
      cpf: input.cpf ?? null,
      chavePix: input.chavePix ?? null,
      ativo: input.ativo,
    },
  });
  return toFuncionarioDTO(row);
}

export async function editarFuncionario(
  id: number,
  input: EditarFuncionarioInput
): Promise<FuncionarioDTO> {
  try {
    const row = await prisma.funcionario.update({
      where: { id },
      data: {
        nome: input.nome,
        cargo: input.cargo === undefined ? undefined : input.cargo,
        salarioMensal: input.salarioMensal,
        cargaMensalHoras: input.cargaMensalHoras,
        jornadaDiariaHoras: input.jornadaDiariaHoras,
        dataAdmissao: input.dataAdmissao === undefined ? undefined : d(input.dataAdmissao),
        cpf: input.cpf === undefined ? undefined : input.cpf,
        chavePix: input.chavePix === undefined ? undefined : input.chavePix,
        ativo: input.ativo,
      },
    });
    return toFuncionarioDTO(row);
  } catch (e) {
    throw comoNaoEncontrado(e);
  }
}

/** Baixa lógica: ativo:false, não deleta (preserva histórico de ponto). */
export async function baixarFuncionario(id: number): Promise<FuncionarioDTO> {
  try {
    const row = await prisma.funcionario.update({ where: { id }, data: { ativo: false } });
    return toFuncionarioDTO(row);
  } catch (e) {
    throw comoNaoEncontrado(e);
  }
}
