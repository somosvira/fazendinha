import { prisma } from "../../db.js";
import { buildRebanhoDashboard } from "./dashboard-rebanho.js";
import { listarSaldos } from "./estoque.js";
import { obterDashboard } from "../financeiro/dashboard.js";
import { carenciaAtiva } from "./carencia.calc.js";
import { resumirCockpit, type AlertaResumo, type CockpitDTO } from "./cockpit.calc.js";
import { obterSugestoes } from "./sugestoes.js";

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
  // Vacinas pendentes: a worklist vacina-pendente já é montada no dashboard (vencidas + próximas).
  const vacinaPendenteCount = dashboard.alertas.find((a) => a.chave === "vacina-pendente")?.quantidade ?? 0;

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
    obterDashboard(propriedadeId, agora, agora),
    obterDashboard(propriedadeId, inicioDoMes(agora), agora),
  ]);
  const fluxoDia = Number(dashDia.realizado.resultado);
  const fluxoMes = Number(dashMes.realizado.resultado);
  const mesPorAtividade = {
    receitaLeite: 0, custeioLeitePuro: 0, investLeite: 0,
    receitaCafe: 0, custeioCafe: 0, investCafe: 0,
    totalGeral: fluxoMes,
  };

  const dto = resumirCockpit({ alertas, estoqueAbaixoMinimo, carenciaAtivaCount, vacinaPendenteCount, fluxoDia, fluxoMes, mesPorAtividade });

  // 5) Sugestões preditivas (V2 §5.1): top-3 por impacto R$/dia. Recomputa a mesma
  // base do pool (aceitável — Hoje e aba raramente carregam juntos).
  const sug = await obterSugestoes(propriedadeId);
  return { ...dto, sugestoesTop3: sug.sugestoes.slice(0, 3), impactoDiaSugestoes: sug.impactoDiaTotal };
}
