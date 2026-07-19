import { prisma } from "../../db.js";
import { obterConfig } from "./config.js";
import { agregarDashboard, type DashboardDTO, type PeriodoDashboard } from "./dashboard.agg.js";
import { getParametros } from "./parametros.js";
import type { ChaveWorklistRebanho, CarenciaWorklistIn } from "./dashboard.types.js";
import { obterWorklist } from "./regras-manejo.js";
import { carenciaAtiva } from "./carencia.calc.js";

const iso = (x: Date) => x.toISOString().slice(0, 10);
const isoOrNull = (x: Date | null) => x ? iso(x) : null;
const diasDoPeriodo = (periodo: PeriodoDashboard) => periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;

function subtrairDias(data: Date, dias: number): Date {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() - dias);
  return d;
}

export async function buildRebanhoDashboard(
  periodo: PeriodoDashboard = "7d",
  propriedadeId: number | null = null,
  agora = new Date(),
): Promise<DashboardDTO> {
  const hoje = iso(agora);
  const nDias = diasDoPeriodo(periodo);
  // Inclui comparação anterior e, em "hoje", os seis dias contextuais da sparkline.
  const inicioConsulta = subtrairDias(new Date(`${hoje}T00:00:00Z`), Math.max(nDias * 2 - 1, 6));
  const fimConsulta = new Date(`${hoje}T23:59:59.999Z`);
  const animalWhere = { status: "ATIVO" as const, ...(propriedadeId == null ? {} : { propriedadeId }) };
  const filhoWhere = { animal: animalWhere };
  const producaoLoteWhere = propriedadeId == null
    ? { data: { gte: inicioConsulta, lte: fimConsulta } }
    : { data: { gte: inicioConsulta, lte: fimConsulta }, OR: [{ grupoId: null }, { grupo: { propriedadeId } }] };

  // Aplicações com carência ativa das vacas em lactação (batch, sem N+1 — como agregarProducao).
  const vacasLactacao = await prisma.animal.findMany({ where: { ...animalWhere, resumo: { del: { not: null } } }, select: { id: true } });
  const idsLact = vacasLactacao.map((a) => a.id);

  const [animaisRaw, lactacoesRaw, controlesRaw, producoesLoteRaw, eventosRaw, parametrosRaw, config, aplicsCarencia] = await Promise.all([
    prisma.animal.findMany({
      where: animalWhere,
      select: {
        id: true, numero: true, nome: true, categoria: true, sexo: true, grupoId: true, setor: true,
        grupo: { select: { nome: true } },
        resumo: { select: { statusReprodutivo: true, del: true, producaoMediaDia: true, ccs: true, ccsTendencia: true, iepProjetado: true, diasGestacao: true, previsaoSecagem: true, ultimoDgData: true } },
      },
    }),
    prisma.lactacao.findMany({
      where: { ...filhoWhere, dtInicio: { lte: fimConsulta }, OR: [{ dtFim: null }, { dtFim: { gte: inicioConsulta } }] },
      select: { animalId: true, dtInicio: true, dtFim: true },
    }),
    prisma.controleLeiteiro.findMany({
      where: { ...filhoWhere, data: { gte: inicioConsulta, lte: fimConsulta } },
      select: { id: true, animalId: true, data: true, pesoTotal: true, updatedAt: true },
    }),
    prisma.producaoLote.findMany({
      where: producaoLoteWhere,
      select: { id: true, grupoId: true, data: true, litros: true, updatedAt: true },
    }),
    prisma.eventoReprodutivo.findMany({
      where: { ...filhoWhere, tipo: { in: ["INSEMINACAO", "TRANSFERENCIA_EMBRIAO", "DIAGNOSTICO"] } },
      select: { animalId: true, tipo: true, data: true, resultado: true },
      orderBy: { data: "asc" },
    }),
    getParametros(),
    obterConfig(),
    idsLact.length
      ? prisma.eventoSanitario.findMany({
          where: { animalId: { in: idsLact }, tipo: "APLICACAO", carencia: { gt: 0 } },
          select: { animalId: true, data: true, carencia: true, produto: true },
        })
      : Promise.resolve([] as { animalId: number; data: Date; carencia: number | null; produto: string | null }[]),
  ]);

  // Resolve a carência ativa por animal (a janela que termina mais tarde) e o produto mais recente.
  const aplicsPorAnimal = new Map<number, { data: Date; carencia: number | null; produto: string | null }[]>();
  for (const e of aplicsCarencia) {
    const lista = aplicsPorAnimal.get(e.animalId) ?? [];
    lista.push({ data: e.data, carencia: e.carencia, produto: e.produto });
    aplicsPorAnimal.set(e.animalId, lista);
  }
  const carencias: CarenciaWorklistIn[] = [];
  for (const [animalId, aplics] of aplicsPorAnimal) {
    const ativa = carenciaAtiva(aplics, agora);
    if (!ativa) continue;
    // produto da aplicação cuja janela é a que está em vigor (a que termina no `fim`); fallback: a mais recente.
    const doFim = aplics.find((a) => a.carencia != null && a.carencia > 0 && new Date(a.data.getTime() + a.carencia * 3_600_000).getTime() === ativa.fim.getTime());
    carencias.push({ animalId, produto: doFim?.produto ?? null, fim: ativa.fim.toISOString(), horasRestantes: ativa.horasRestantes, diasRestantes: ativa.diasRestantes });
  }

  const parametros = new Map(parametrosRaw.map((p) => [p.chave, p]));
  const numero = (chave: "PEV_DIAS" | "GESTACAO_DIAS" | "SECAGEM_ANTEC", fallback: number) => parametros.get(chave)?.valorNumero ?? fallback;
  const ccsAceitavel = parametros.get("META_CCS")?.valorNumeroAceitavel ?? 400;

  return agregarDashboard({
    hoje,
    geradoEm: agora.toISOString(),
    periodo,
    modoProducao: config.producaoModo,
    escopoPropriedadeId: propriedadeId,
    animais: animaisRaw.map((a) => ({
      id: a.id,
      numero: a.numero,
      nome: a.nome,
      categoria: a.categoria,
      sexo: a.sexo,
      grupoId: a.grupoId,
      grupoNome: a.grupo?.nome ?? null,
      setor: a.setor,
      resumo: a.resumo ? {
        statusReprodutivo: a.resumo.statusReprodutivo,
        del: a.resumo.del,
        producaoMediaDia: a.resumo.producaoMediaDia == null ? null : Number(a.resumo.producaoMediaDia),
        ccs: a.resumo.ccs,
        ccsTendencia: a.resumo.ccsTendencia,
        iepProjetado: a.resumo.iepProjetado,
        diasGestacao: a.resumo.diasGestacao,
        previsaoSecagem: isoOrNull(a.resumo.previsaoSecagem),
        ultimoDgData: isoOrNull(a.resumo.ultimoDgData),
      } : null,
    })),
    lactacoes: lactacoesRaw.map((l) => ({ animalId: l.animalId, dtInicio: iso(l.dtInicio), dtFim: isoOrNull(l.dtFim) })),
    controles: controlesRaw.map((c) => ({ id: c.id, animalId: c.animalId, data: iso(c.data), pesoTotal: Number(c.pesoTotal), atualizadoEm: c.updatedAt.toISOString() })),
    producoesLote: producoesLoteRaw.map((p) => ({ id: p.id, grupoId: p.grupoId, data: iso(p.data), litros: Number(p.litros), atualizadoEm: p.updatedAt.toISOString() })),
    eventosConcepcao: eventosRaw.map((e) => ({ animalId: e.animalId, tipo: e.tipo, data: iso(e.data), resultado: e.resultado })),
    carencias,
    parametros: {
      pevDias: numero("PEV_DIAS", 60),
      gestacaoDias: numero("GESTACAO_DIAS", 283),
      secagemAntec: numero("SECAGEM_ANTEC", 60),
      ccsAlto: ccsAceitavel,
    },
  });
}

export async function buildRebanhoWorklist(
  chave: ChaveWorklistRebanho,
  propriedadeId: number | null = null,
  agora = new Date(),
) {
  const dashboard = await buildRebanhoDashboard("7d", propriedadeId, agora);
  return {
    meta: {
      geradoEm: dashboard.meta.geradoEm,
      escopo: dashboard.meta.escopo,
    },
    worklist: obterWorklist(dashboard.alertas, chave),
  };
}
