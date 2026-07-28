import { prisma } from "../../db.js";
import { agregarRelatorioReproducao, type RelatorioReproducao } from "./relatorio-reproducao.calc.js";

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
const dataUtc = (d?: string) => (d ? new Date(`${d}T00:00:00Z`) : undefined);
const viaAnimal = (propriedadeId: number | null) => (propriedadeId != null ? { animal: { propriedadeId } } : {});

const TIPOS = ["INSEMINACAO", "COBERTURA", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO", "PARTO"] as const;

// Relatório reprodutivo do sítio: lê os eventos de cobertura/diagnóstico/parto no
// escopo e na janela, e delega ao cálculo puro. Corte por método (IA/MN/TE) reusa
// calcularTaxaConcepcao via agregarRelatorioReproducao.
export async function obterRelatorioReproducao(
  propriedadeId: number | null,
  janela: { de?: string; ate?: string },
): Promise<RelatorioReproducao> {
  const gte = dataUtc(janela.de);
  const lte = dataUtc(janela.ate);
  const evs = await prisma.eventoReprodutivo.findMany({
    where: {
      tipo: { in: [...TIPOS] },
      ...viaAnimal(propriedadeId),
      ...(gte || lte ? { data: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) } } : {}),
    },
    select: { animalId: true, tipo: true, data: true, resultado: true },
  });
  return agregarRelatorioReproducao(
    evs.map((e) => ({ animalId: e.animalId, tipo: e.tipo, data: iso(e.data)!, resultado: e.resultado })),
    janela,
  );
}

// Contagem de eventos por tipo no escopo — insumo da reconciliação com o baseline IDEAGRI.
export async function contarEventosPorTipo(propriedadeId: number | null): Promise<Record<string, number>> {
  const grupos = await prisma.eventoReprodutivo.groupBy({ by: ["tipo"], where: { ...viaAnimal(propriedadeId) }, _count: { _all: true } });
  const out: Record<string, number> = {};
  for (const g of grupos) out[g.tipo] = g._count._all;
  return out;
}
