import { prisma } from "../../db.js";
import type { Lavoura, PlanoAdubacao } from "./mock.js";

export interface VariedadeDTO {
  id: number;
  nome: string;
  resistenteFerrugem: boolean;
}

// Linha de Lavoura com talhões (+ resumo) incluídos — forma que agregarLavoura espera.
export interface LavouraRow {
  id: number;
  nome: string;
  planoAdubacao?: { nome: string } | null;
  talhoes: {
    variedade?: { nome: string } | null;
    areaHa: any; // Prisma Decimal
    estado?: string | null;
    resumo?: { produtividadeEsperada: any } | null;
  }[];
}

// Pura: agrega numTalhoes/areaHa/produtividadeMedia/variedade(mais comum) a
// partir dos talhões da lavoura. Extraída do query para ser testável sem DB.
// Talhões BAIXADO não entram na área/contagem (não fazem parte da lavoura viva);
// FORMACAO/RECEPA continuam contando (são talhões reais, só não produzindo).
export function agregarLavoura(l: LavouraRow): Lavoura {
  const talhoes = (l.talhoes ?? []).filter((t) => t.estado !== "BAIXADO");
  const numTalhoes = talhoes.length;
  const areaHa = Math.round(talhoes.reduce((s, t) => s + (t.areaHa != null ? Number(t.areaHa) : 0), 0) * 100) / 100;

  // produtividadeMedia = média das produtividadeEsperada > 0 (ignora formação/recepa em 0).
  const prods = talhoes
    .map((t) => (t.resumo?.produtividadeEsperada != null ? Number(t.resumo.produtividadeEsperada) : 0))
    .filter((p) => p > 0);
  const produtividadeMedia = prods.length ? Math.round((prods.reduce((s, p) => s + p, 0) / prods.length) * 100) / 100 : undefined;

  // variedade = a mais comum entre os talhões (desempate pela ordem de aparição).
  const contagem = new Map<string, number>();
  for (const t of talhoes) {
    const v = t.variedade?.nome;
    if (v) contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  let variedade: string | undefined;
  let max = 0;
  for (const [nome, n] of contagem) if (n > max) { max = n; variedade = nome; }

  return {
    id: l.id,
    nome: l.nome,
    variedade,
    numTalhoes,
    areaHa,
    produtividadeMedia,
    planoAdubacaoNome: l.planoAdubacao?.nome ?? null,
  };
}

export async function listarLavouras(): Promise<Lavoura[]> {
  const rows = await prisma.lavoura.findMany({
    orderBy: { nome: "asc" },
    include: {
      planoAdubacao: { select: { nome: true } },
      talhoes: { include: { variedade: { select: { nome: true } }, resumo: { select: { produtividadeEsperada: true } } } },
    },
  });
  return rows.map(agregarLavoura);
}

export async function listarPlanos(): Promise<PlanoAdubacao[]> {
  const rows = await prisma.planoAdubacao.findMany({ orderBy: { nome: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao ?? undefined,
    nKgHa: p.nKgHa != null ? Number(p.nKgHa) : undefined,
    p2o5KgHa: p.p2o5KgHa != null ? Number(p.p2o5KgHa) : undefined,
    k2oKgHa: p.k2oKgHa != null ? Number(p.k2oKgHa) : undefined,
    parcelas: p.parcelas ?? undefined,
    ativo: p.ativo,
  }));
}

export async function listarVariedades(): Promise<VariedadeDTO[]> {
  return prisma.variedadeCafe.findMany({
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, resistenteFerrugem: true },
  });
}
