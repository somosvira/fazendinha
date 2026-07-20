import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../db.js";
import { diffMovimentacoes, type EdicaoAlocacao, type EstadoAlocacao } from "./movimentacao.calc.js";

const iso = (x: Date) => new Date(x).toISOString().slice(0, 10);

export interface MovimentacaoDTO {
  id: number;
  tipo: "GRUPO" | "SETOR";
  data: string;
  origem: string | null;
  destino: string;
  motivo: string | null;
}

// Grava os fatos de movimentação derivados do diff de alocação. Chamado dentro da
// transação de editarAnimal (recebe o `tx`), com a data e a propriedade do animal.
// Não gera nada quando não houve troca de grupo/setor.
export async function registrarMovimentacoes(
  tx: Prisma.TransactionClient | PrismaClient,
  animalId: number,
  atual: EstadoAlocacao,
  edicao: EdicaoAlocacao,
  opts: { data?: Date; propriedadeId?: number | null; motivo?: string | null } = {},
): Promise<number> {
  const fatos = diffMovimentacoes(atual, edicao);
  if (fatos.length === 0) return 0;
  const data = opts.data ?? new Date();
  await tx.movimentacaoAnimal.createMany({
    data: fatos.map((f) => ({
      animalId,
      tipo: f.tipo,
      data,
      origem: f.origem,
      destino: f.destino,
      grupoOrigemId: f.grupoOrigemId ?? null,
      grupoDestinoId: f.grupoDestinoId ?? null,
      motivo: opts.motivo ?? null,
      propriedadeId: opts.propriedadeId ?? null,
    })),
  });
  return fatos.length;
}

// Histórico de movimentações de um animal, da mais recente para a mais antiga
// (desempate por id desc — grava-se GRUPO antes de SETOR no mesmo dia).
export async function listarMovimentacoes(animalId: number): Promise<MovimentacaoDTO[]> {
  const rows = await prisma.movimentacaoAnimal.findMany({
    where: { animalId },
    orderBy: [{ data: "desc" }, { id: "desc" }],
    select: { id: true, tipo: true, data: true, origem: true, destino: true, motivo: true },
  });
  return rows.map((r) => ({ id: r.id, tipo: r.tipo, data: iso(r.data), origem: r.origem, destino: r.destino, motivo: r.motivo }));
}
