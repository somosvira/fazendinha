import { prisma } from "../../db.js";

// DTO de passada de colheita para a aba Colheita do cliente. Espelha o pattern
// de mappers.ts/talhoes.ts: Decimal→Number, Date→YYYY-MM-DD via `iso()`. Carrega
// código/nome do talhão (join leve) para a tabela "Passadas registradas".
export interface PassadaDTO {
  id: number;
  talhaoId: string;
  talhaoCodigo: string;
  talhaoNome: string | null;
  data: string; // YYYY-MM-DD
  numero: number;
  metodo: string;
  litrosCereja: number;
  rendimentoLPorSc: number;
  sacasBeneficiadas: number;
  pctCereja: number | null;
  responsavel: string | null;
}

const iso = (d: Date | null | undefined): string =>
  d ? new Date(d).toISOString().slice(0, 10) : "";
const num = (v: any): number => (v == null ? 0 : Number(v));
const numN = (v: any): number | null => (v == null ? null : Number(v));

function toPassadaDTO(p: any): PassadaDTO {
  return {
    id: p.id,
    talhaoId: String(p.talhaoId),
    talhaoCodigo: p.talhao?.codigo ?? "",
    talhaoNome: p.talhao?.nome ?? null,
    data: iso(p.data),
    numero: Number(p.numero),
    metodo: p.metodo,
    litrosCereja: num(p.litrosCereja),
    rendimentoLPorSc: num(p.rendimentoLPorSc),
    sacasBeneficiadas: num(p.sacasBeneficiadas),
    pctCereja: numN(p.pctCereja),
    responsavel: p.responsavel ?? null,
  };
}

export async function listarPassadas(filtro?: { ano?: number }): Promise<PassadaDTO[]> {
  const where: any = {};
  if (filtro?.ano != null) {
    // Janela do ano-calendário [ano-01-01, ano+1-01-01).
    where.data = { gte: new Date(Date.UTC(filtro.ano, 0, 1)), lt: new Date(Date.UTC(filtro.ano + 1, 0, 1)) };
  }
  const rows = await prisma.passadaColheita.findMany({
    where,
    include: { talhao: { select: { codigo: true, nome: true } } },
    orderBy: { data: "desc" },
  });
  return rows.map(toPassadaDTO);
}
