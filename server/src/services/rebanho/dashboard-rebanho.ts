import { prisma } from "../../db.js";
import { agregarDashboard, type AnimalAgg, type DashboardDTO } from "./dashboard.agg.js";
const isoOrNull = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);
export async function buildRebanhoDashboard(): Promise<DashboardDTO> {
  const animais = await prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } });
  const agg: AnimalAgg[] = animais.map((a) => ({
    categoria: a.categoria,
    resumo: a.resumo ? { statusReprodutivo: a.resumo.statusReprodutivo, del: a.resumo.del, producaoMediaDia: a.resumo.producaoMediaDia != null ? Number(a.resumo.producaoMediaDia) : null, ccs: a.resumo.ccs, ccsTendencia: a.resumo.ccsTendencia, iepProjetado: a.resumo.iepProjetado, diasGestacao: a.resumo.diasGestacao, previsaoSecagem: isoOrNull(a.resumo.previsaoSecagem) } : null,
  }));
  return agregarDashboard(agg, new Date().toISOString().slice(0, 10));
}
