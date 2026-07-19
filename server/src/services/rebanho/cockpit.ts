import { prisma } from "../../db.js";
import { buildRebanhoDashboard } from "./dashboard-rebanho.js";
import { listarSaldos } from "./estoque.js";
import { buildDashboard } from "../dashboard.js";
import { carenciaAtiva } from "./carencia.calc.js";
import { resumirCockpit, type AlertaResumo, type CockpitDTO } from "./cockpit.calc.js";

// Primeiro dia do mês da data civil informada, como Date (UTC 00:00).
function inicioDoMes(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

/**
 * Cockpit do Dia: agrega, para o sítio ativo, os contadores de ação do dia (repro/sanidade das
 * worklists canônicas + carência de leite + estoque abaixo do mínimo) e o fluxo financeiro do dia e
 * do mês. Reúne fontes já testadas e delega a agregação ao calc puro `resumirCockpit`.
 */
export async function montarCockpitHoje(propriedadeId: number | null, agora: Date = new Date()): Promise<CockpitDTO> {
  const animalWhere = { status: "ATIVO" as const, ...(propriedadeId == null ? {} : { propriedadeId }) };

  // 1) Worklists canônicas (mesma fonte dos cards de <Alertas>).
  const dashboard = await buildRebanhoDashboard("7d", propriedadeId, agora);
  const alertas: AlertaResumo[] = dashboard.alertas.map((a) => ({ chave: a.chave, quantidade: a.quantidade, severidade: a.severidade }));

  // 2) Estoque abaixo do mínimo.
  const saldos = await listarSaldos({ propriedadeId });
  const estoqueAbaixoMinimo = saldos.filter((s) => s.abaixoMinimo).length;

  // 3) Carência de leite ativa nas vacas em lactação — uma query batch só (sem N+1), como agregarProducao.
  const emLact = await prisma.animal.findMany({ where: { ...animalWhere, resumo: { del: { not: null } } }, select: { id: true } });
  const idsLact = emLact.map((a) => a.id);
  const aplics = idsLact.length
    ? await prisma.eventoSanitario.findMany({
        where: { animalId: { in: idsLact }, tipo: "APLICACAO", carencia: { gt: 0 } },
        select: { animalId: true, data: true, carencia: true },
      })
    : [];
  const porAnimal = new Map<number, { data: Date; carencia: number | null }[]>();
  for (const e of aplics) {
    const lista = porAnimal.get(e.animalId) ?? [];
    lista.push({ data: e.data, carencia: e.carencia });
    porAnimal.set(e.animalId, lista);
  }
  let carenciaAtivaCount = 0;
  for (const id of idsLact) if (carenciaAtiva(porAnimal.get(id) ?? [], agora)) carenciaAtivaCount++;

  // 4) Fluxo financeiro do dia e do mês (só leitura; sinal preservado).
  const [dashDia, dashMes] = await Promise.all([
    buildDashboard({ from: agora, to: agora, propriedadeId }),
    buildDashboard({ from: inicioDoMes(agora), to: agora, propriedadeId }),
  ]);
  const fluxoDia = dashDia.periodo?.fluxo ?? 0;
  const fluxoMes = dashMes.periodo?.fluxo ?? 0;
  // Quebra do mês por atividade: com from/to setados, dashMes.totals23m já é o periodTotals do mês.
  const t = dashMes.totals23m;
  const mesPorAtividade = {
    receitaLeite: t.receitaLeite, custeioLeitePuro: t.custeioLeitePuro, investLeite: t.investLeite,
    receitaCafe: t.receitaCafe, custeioCafe: t.custeioCafe, investCafe: t.investCafe,
    totalGeral: t.totalGeral,
  };

  return resumirCockpit({ alertas, estoqueAbaixoMinimo, carenciaAtivaCount, fluxoDia, fluxoMes, mesPorAtividade });
}
