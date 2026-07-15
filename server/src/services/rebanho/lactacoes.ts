import { prisma } from "../../db.js";
import { resumoLactacoes, duracaoLactacao, type LactacaoRow } from "./lactacoes.calc.js";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LactacaoDTO {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  duracaoDias: number | null;
  motivoSecagem: string | null;
  producaoTotal: number | null;
  producao305: number | null;
  emCurso: boolean;
}

export async function listarLactacoes(animalId: number, hoje: Date = new Date()) {
  const rows = await prisma.lactacao.findMany({
    where: { animalId },
    orderBy: { numero: "desc" },
  });
  const resumo = resumoLactacoes(rows as unknown as LactacaoRow[], hoje);
  const lactacoes: LactacaoDTO[] = rows.map((l) => ({
    id: l.id,
    numero: l.numero,
    dtInicio: iso(l.dtInicio)!,
    dtFim: iso(l.dtFim),
    // duração até fim quando encerrada; DEL até hoje quando aberta (mesma fórmula)
    duracaoDias: duracaoLactacao(l as unknown as LactacaoRow, hoje),
    motivoSecagem: l.motivoSecagem,
    producaoTotal: num(l.producaoTotal),
    producao305: num(l.producao305),
    emCurso: l.dtFim == null,
  }));
  return { lactacoes, resumo };
}
