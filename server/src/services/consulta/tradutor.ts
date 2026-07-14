// Tradução da consulta validada em um plano de execução Prisma (where + select
// mínimo). PURO — não toca banco; o motor executa o plano.

import type { ConsultaEntidade, ContextoConsulta, EntidadeDef } from "./tipos.js";

export interface PlanoExecucao {
  modelo: string;
  whereBase: Record<string, unknown>; // sem período — o motor injeta (permite A/B)
  select: Record<string, unknown>;
  campoData: string | null;
}

// Deep-merge de selects Prisma: { categoria: { select: { nome } } } +
// { categoria: { select: { grupoCategoria: {…} } } } → um select só.
export function mesclarSelect(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const atual = out[k];
    if (
      atual != null &&
      typeof atual === "object" &&
      !Array.isArray(atual) &&
      v != null &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = mesclarSelect(atual as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function traduzir(
  def: EntidadeDef,
  c: ConsultaEntidade,
  ctx: ContextoConsulta,
): PlanoExecucao {
  const regime = def.regimes[c.regime];

  const whereBase: Record<string, unknown> = { ...regime.filtrosFixos };

  // Escopo de propriedade vem do contexto do request, NUNCA do input do LLM.
  if (ctx.propriedadeId != null && def.escopoPropriedade)
    Object.assign(whereBase, def.escopoPropriedade(ctx.propriedadeId));

  // Cada filtro vira um fragmento AND — evita colisão de chaves entre filtros
  // na mesma relação (ex.: categoria contem X E grupoCategoria igual Y).
  const and: Record<string, unknown>[] = [];
  for (const f of c.filtros) and.push(def.dimensoes[f.dimensao].where(f.operador, f.valor));
  if (and.length) whereBase.AND = and;

  let select: Record<string, unknown> = {};
  for (const d of c.agruparPor) {
    const dim = def.dimensoes[d];
    if (dim.select) select = mesclarSelect(select, dim.select);
  }
  for (const m of c.metricas) {
    const met = def.metricas[m];
    if (met.select) select = mesclarSelect(select, met.select);
  }
  if (c.granularidadeTempo && regime.campoData) select[regime.campoData] = true;
  // findMany exige ao menos uma coluna no select (contagem pura, sem dimensões).
  if (!Object.keys(select).length) select.id = true;

  return { modelo: def.modelo, whereBase, select, campoData: regime.campoData };
}

// Where final com o período aplicado sobre o campo de data do regime.
// Datas em UTC T00:00:00.000Z (mesma convenção do resto do server).
export function whereComPeriodo(
  plano: PlanoExecucao,
  de?: string,
  ate?: string,
): Record<string, unknown> {
  const where = { ...plano.whereBase };
  if (plano.campoData && (de || ate)) {
    where[plano.campoData] = {
      ...(de ? { gte: new Date(`${de}T00:00:00.000Z`) } : {}),
      ...(ate ? { lte: new Date(`${ate}T00:00:00.000Z`) } : {}),
    };
  }
  return where;
}
