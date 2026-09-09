import { prisma } from "../../db.js";
import { buildRebanhoDashboard } from "./dashboard-rebanho.js";
import { agregarEventosResumoMensal } from "./resumo-mensal.calc.js";

const utc = (iso: string, fim = false) =>
  new Date(`${iso}T${fim ? "23:59:59.999" : "00:00:00.000"}Z`);
const iso = (data: Date) => data.toISOString().slice(0, 10);

function mesAnterior(from: string) {
  const data = utc(from);
  const inicio = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth() - 1, 1));
  const fim = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), 0));
  return { from: iso(inicio), to: iso(fim) };
}

function escopoAnimal(propriedadeId: number | null) {
  return propriedadeId == null ? {} : { propriedadeId };
}

function ativosNoFim(propriedadeId: number | null, fim: Date) {
  return {
    ...escopoAnimal(propriedadeId),
    dataEntrada: { lte: fim },
    OR: [{ dataBaixa: null }, { dataBaixa: { gt: fim } }],
  };
}

export async function buildResumoMensalRebanho(
  from: string,
  to: string,
  propriedadeId: number | null,
) {
  const anterior = mesAnterior(from);
  const inicio = utc(from);
  const fim = utc(to, true);
  const inicioAnterior = utc(anterior.from);
  const fimAnterior = utc(anterior.to, true);
  const animalAtual = ativosNoFim(propriedadeId, fim);
  const animalAnterior = ativosNoFim(propriedadeId, fimAnterior);
  const viaAnimal = propriedadeId == null ? {} : { animal: { propriedadeId } };

  const [
    eventosAtuais,
    eventosAnteriores,
    rebanhoAtivo,
    vacasAtivas,
    lactacoesAtuais,
    rebanhoAtivoAnterior,
    vacasAtivasAnterior,
    lactacoesAnteriores,
    baixas,
    baixasAnteriores,
    dashboardAtual,
  ] = await Promise.all([
    prisma.eventoReprodutivo.findMany({
      where: { ...viaAnimal, data: { gte: inicio, lte: fim }, tipo: { in: ["PARTO", "DIAGNOSTICO", "SECAGEM"] } },
      select: { tipo: true, resultado: true, tipoParto: true },
    }),
    prisma.eventoReprodutivo.findMany({
      where: { ...viaAnimal, data: { gte: inicioAnterior, lte: fimAnterior }, tipo: { in: ["PARTO", "DIAGNOSTICO", "SECAGEM"] } },
      select: { tipo: true, resultado: true, tipoParto: true },
    }),
    prisma.animal.count({ where: animalAtual }),
    prisma.animal.count({ where: { ...animalAtual, categoria: "VACA" } }),
    prisma.lactacao.findMany({
      where: { animal: animalAtual, dtInicio: { lte: fim }, OR: [{ dtFim: null }, { dtFim: { gt: fim } }] },
      select: { animalId: true },
      distinct: ["animalId"],
    }),
    prisma.animal.count({ where: animalAnterior }),
    prisma.animal.count({ where: { ...animalAnterior, categoria: "VACA" } }),
    prisma.lactacao.findMany({
      where: { animal: animalAnterior, dtInicio: { lte: fimAnterior }, OR: [{ dtFim: null }, { dtFim: { gt: fimAnterior } }] },
      select: { animalId: true },
      distinct: ["animalId"],
    }),
    prisma.animal.count({ where: { ...escopoAnimal(propriedadeId), dataBaixa: { gte: inicio, lte: fim } } }),
    prisma.animal.count({ where: { ...escopoAnimal(propriedadeId), dataBaixa: { gte: inicioAnterior, lte: fimAnterior } } }),
    buildRebanhoDashboard("7d", propriedadeId),
  ]);

  const atual = agregarEventosResumoMensal(eventosAtuais);
  const anteriorEventos = agregarEventosResumoMensal(eventosAnteriores);
  const alertasAtuais = dashboardAtual.alertas
    .filter((a) => a.quantidade > 0)
    .sort((a, b) => {
      const peso = { alta: 3, media: 2, baixa: 1 };
      return peso[b.severidade] - peso[a.severidade] || b.quantidade - a.quantidade;
    })
    .slice(0, 3)
    .map((a) => ({ chave: a.chave, titulo: a.titulo, quantidade: a.quantidade, severidade: a.severidade, tab: a.tab }));

  return {
    meta: {
      periodo: { from, to },
      comparacao: anterior,
      geradoEm: new Date().toISOString(),
      dadoRebanhoMaisRecente: dashboardAtual.meta.dadoMaisRecente,
    },
    atual: {
      rebanhoAtivo,
      vacasAtivas,
      vacasEmLactacao: lactacoesAtuais.length,
      ...atual,
      baixas,
    },
    anterior: {
      rebanhoAtivo: rebanhoAtivoAnterior,
      vacasAtivas: vacasAtivasAnterior,
      vacasEmLactacao: lactacoesAnteriores.length,
      ...anteriorEventos,
      baixas: baixasAnteriores,
    },
    alertasAtuais,
  };
}

