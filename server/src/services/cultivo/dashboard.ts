/* Loader do dashboard do Milho — lê os read-models escopados por propriedade
 * (SafraCultivo + ResumoSafraCultivo embutido; Silo ativo), converte Decimal→
 * number na borda e delega à agregação pura. Espelha buildCorteDashboard. */
import { prisma } from "../../db.js";
import { agregarDashboardCultivo, type SafraCultivoAgg, type SiloAgg } from "./dashboard.agg.js";

export async function buildCultivoDashboard(propriedadeId?: number | null) {
  const escopo = propriedadeId != null ? { propriedadeId } : {}; // escopo do sítio
  const [safras, silos] = await Promise.all([
    prisma.safraCultivo.findMany({ where: escopo, include: { resumo: true } }),
    prisma.silo.findMany({ where: { ...escopo, ativo: true } }),
  ]);

  const safrasAgg: SafraCultivoAgg[] = safras.map((s) => ({
    fechada: s.fechada,
    resumo: s.resumo
      ? {
          areaHa: Number(s.resumo.areaHa),
          producaoGraoSc: Number(s.resumo.producaoGraoSc),
          producaoSilagemTon: Number(s.resumo.producaoSilagemTon),
          custeioTotal: Number(s.resumo.custeioTotal),
          investimentoTotal: Number(s.resumo.investimentoTotal),
          custoSaca: s.resumo.custoSaca != null ? Number(s.resumo.custoSaca) : null,
        }
      : null,
  }));

  const silosAgg: SiloAgg[] = silos.map((s) => ({
    saldoAtual: Number(s.saldoAtual),
    capacidade: s.capacidade != null ? Number(s.capacidade) : null,
    ativo: s.ativo,
  }));

  return agregarDashboardCultivo(safrasAgg, silosAgg);
}
