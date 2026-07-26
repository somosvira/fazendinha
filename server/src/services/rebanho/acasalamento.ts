import { prisma } from "../../db.js";
import { recomendar, type Recomendacao, type ReprodutorCand } from "./acasalamento.calc.js";

export class AcasalamentoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) { super(message); }
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface RecomendacaoAcasalamentoDTO {
  animalId: number;
  paiNome: string | null;
  recomendacoes: Recomendacao[];
}

// Recomenda touros do catálogo para uma vaca, por mérito genético, evitando consanguinidade.
export async function recomendarParaAnimal(animalId: number, propriedadeId: number | null): Promise<RecomendacaoAcasalamentoDTO> {
  const vaca = await prisma.animal.findFirst({
    where: { id: animalId, ...(propriedadeId != null ? { propriedadeId } : {}) },
    select: { id: true, paiNome: true },
  });
  if (!vaca) throw new AcasalamentoError("NAO_ENCONTRADO", "animal não encontrado");

  const rows = await prisma.reprodutor.findMany({
    where: { ativo: true, ...(propriedadeId != null ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : {}) },
    select: { id: true, nome: true, codigo: true, ptaLeite: true, tpi: true },
  });
  const cands: ReprodutorCand[] = rows.map((r) => ({ id: r.id, nome: r.nome, codigo: r.codigo, ptaLeite: num(r.ptaLeite), tpi: r.tpi }));

  return { animalId, paiNome: vaca.paiNome, recomendacoes: recomendar({ paiNome: vaca.paiNome }, cands) };
}
