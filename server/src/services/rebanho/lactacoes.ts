import { prisma } from "../../db.js";
import { resumoLactacoes, duracaoLactacao, producaoCiclo, normalizarData, curvaCicloCorrente, type LactacaoRow, type ControleLeite, type CurvaCiclo } from "./lactacoes.calc.js";

const iso = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const num = (v: unknown): number | null => (v == null ? null : Number(v));

export interface LactacaoDTO {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  duracaoDias: number | null;
  motivoSecagem: string | null;
  producaoTotal: number | null; // medida (Ideagri) — só a última lactação
  producao305: number | null;
  producaoControles: number | null; // estimada dos controles (TIM) quando não há valor medido
  nControles: number; // controles usados na estimativa
  emCurso: boolean;
}

export async function listarLactacoes(animalId: number, hoje: Date = new Date()) {
  const dataHoje = normalizarData(hoje);
  const [rows, controlesRaw] = await Promise.all([
    prisma.lactacao.findMany({
      where: { animalId },
      // desempate por dtInicio p/ ordem determinística caso 2 lactações tenham o mesmo numero
      orderBy: [{ numero: "desc" }, { dtInicio: "desc" }],
    }),
    prisma.controleLeiteiro.findMany({ where: { animalId }, select: { data: true, pesoTotal: true } }),
  ]);
  const controles: ControleLeite[] = controlesRaw.map((c) => ({ data: c.data, pesoTotal: Number(c.pesoTotal) }));

  // estima a produção de cada ciclo dos controles que caem na janela [dtInicio, fim]
  const derivadas = rows.map((l) => producaoCiclo(controles, l.dtInicio, l.dtFim ?? dataHoje));

  // resumo usa a produção efetiva (medida ?? estimada) na média/ciclo
  const rowsComEstimativa = rows.map((l, i) => ({ ...(l as unknown as LactacaoRow), producaoControles: derivadas[i].litros }));
  const resumo = resumoLactacoes(rowsComEstimativa, dataHoje);
  // Curva do ciclo corrente: os controles crus (data × pesoTotal) da lactação em curso.
  const curva: CurvaCiclo = curvaCicloCorrente(rows, controles, dataHoje);

  const lactacoes: LactacaoDTO[] = rows.map((l, i) => ({
    id: l.id,
    numero: l.numero,
    dtInicio: iso(l.dtInicio)!,
    dtFim: iso(l.dtFim),
    // duração até fim quando encerrada; DEL até dataHoje quando aberta (mesma fórmula)
    duracaoDias: duracaoLactacao(l as unknown as LactacaoRow, dataHoje),
    motivoSecagem: l.motivoSecagem,
    producaoTotal: num(l.producaoTotal),
    producao305: num(l.producao305),
    producaoControles: derivadas[i].litros,
    nControles: derivadas[i].nControles,
    emCurso: l.dtFim == null,
  }));
  return { lactacoes, resumo, curva };
}
