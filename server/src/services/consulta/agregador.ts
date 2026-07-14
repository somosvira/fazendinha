// Agregação determinística das linhas cruas do findMany: grupos × bucket
// temporal × métricas, comparações A/B e razões. PURO e todo em Prisma.Decimal —
// float só na saída (toDecimalPlaces(2)). É AQUI que mora toda a aritmética que
// o LLM é proibido de fazer.

import { Prisma } from "@prisma/client";
import type {
  ComparacaoGrupo,
  ComparacaoResultado,
  DimensaoDef,
  GrupoResultado,
  LinhaBase,
  MetricaDef,
  ResumoTempoMetrica,
} from "./tipos.js";

export interface ParamsAgregacao {
  dimensoes: { nome: string; def: DimensaoDef }[]; // na ordem de agruparPor
  metricas: { nome: string; def: MetricaDef }[];
  campoData: string | null;
  granularidadeTempo?: "mes" | "ano";
  ordenarPor?: { alvo: string; direcao: "asc" | "desc" };
  limite: number;
}

export interface Agregado {
  grupos: GrupoResultado[];
  totais: Record<string, number | null>;
  truncado: boolean;
  numGrupos: number;
  numLinhas: number;
  // Presente quando há granularidadeTempo: estatística dos buckets temporais
  // (métricas aditivas), calculada sobre TODOS os grupos, antes do top-N.
  porTempo?: Record<string, ResumoTempoMetrica>;
}

// Métricas cujo lado ausente numa comparação vale 0 e que podem ser somadas
// por bucket temporal (as demais — médias, min/max — não são aditivas).
const ADITIVAS = new Set(["soma", "contagem", "contagem_distinta"]);

const D = Prisma.Decimal;
type Dec = InstanceType<typeof D>;

const toDec = (v: unknown): Dec | null => {
  if (v == null) return null;
  if (v instanceof D) return v;
  if (typeof v === "number" || typeof v === "string") return new D(v);
  // Decimal de outra instância do Prisma (HMR) — reconstrói pelo toString.
  const anyV = v as { toNumber?: () => number; toString(): string };
  if (typeof anyV.toNumber === "function") return new D(anyV.toString());
  return null;
};

export const arred2 = (d: Dec): number => d.toDecimalPlaces(2).toNumber();

interface Acumulador {
  soma: Dec;
  n: number; // linhas com valor não-nulo (base da média)
  nLinhas: number; // todas as linhas do grupo (base da contagem)
  min: Dec | null;
  max: Dec | null;
  distintos: Set<string>;
  valores: number[] | null; // só mediana/desvio_padrao precisam guardar tudo
}

const novoAcc = (def: MetricaDef): Acumulador => ({
  soma: new D(0),
  n: 0,
  nLinhas: 0,
  min: null,
  max: null,
  distintos: new Set(),
  valores: def.agregacao === "mediana" || def.agregacao === "desvio_padrao" ? [] : null,
});

function acumular(acc: Acumulador, def: MetricaDef, linha: LinhaBase) {
  acc.nLinhas++;
  const bruto = def.valor ? def.valor(linha) : undefined;
  if (def.agregacao === "contagem") return;
  if (def.agregacao === "contagem_distinta") {
    if (bruto != null) acc.distintos.add(String(bruto));
    return;
  }
  const v = toDec(bruto);
  if (v == null) return;
  acc.n++;
  acc.soma = acc.soma.add(v);
  if (acc.min == null || v.lessThan(acc.min)) acc.min = v;
  if (acc.max == null || v.greaterThan(acc.max)) acc.max = v;
  if (acc.valores) acc.valores.push(v.toNumber());
}

// Mediana e desvio populacional — mesmas convenções da antiga estatisticas_lancamentos.
const round2 = (x: number) => Math.round(x * 100) / 100;
function mediana(vals: number[]): number | null {
  const n = vals.length;
  if (!n) return null;
  const ord = [...vals].sort((a, b) => a - b);
  return round2(n % 2 ? ord[(n - 1) / 2] : (ord[n / 2 - 1] + ord[n / 2]) / 2);
}
function desvioPadrao(vals: number[]): number | null {
  const n = vals.length;
  if (!n) return null;
  const media = vals.reduce((s, x) => s + x, 0) / n;
  return round2(Math.sqrt(vals.reduce((s, x) => s + (x - media) ** 2, 0) / n));
}

function finalizar(acc: Acumulador, def: MetricaDef): number | null {
  switch (def.agregacao) {
    case "soma":
      return arred2(acc.soma);
    case "media":
      return acc.n ? arred2(acc.soma.div(acc.n)) : null;
    case "mediana":
      return mediana(acc.valores ?? []);
    case "desvio_padrao":
      return desvioPadrao(acc.valores ?? []);
    case "contagem":
      return acc.nLinhas;
    case "contagem_distinta":
      return acc.distintos.size;
    case "min":
      return acc.min ? arred2(acc.min) : null;
    case "max":
      return acc.max ? arred2(acc.max) : null;
  }
}

const rotuloDe = (dim: { nome: string; def: DimensaoDef }, linha: LinhaBase): string =>
  dim.def.rotulo ? dim.def.rotulo(linha) : String(linha[dim.nome] ?? "(sem valor)");

function bucketTempo(linha: LinhaBase, campoData: string, gran: "mes" | "ano"): string {
  const v = linha[campoData];
  const iso = v instanceof Date ? v.toISOString() : String(v ?? "");
  return iso.slice(0, gran === "mes" ? 7 : 4);
}

export function agregar(linhas: LinhaBase[], p: ParamsAgregacao): Agregado {
  interface Grupo {
    chaves: Record<string, string>;
    tempo?: string;
    accs: Map<string, Acumulador>;
  }
  const grupos = new Map<string, Grupo>();
  const totais = new Map<string, Acumulador>(p.metricas.map((m) => [m.nome, novoAcc(m.def)]));

  for (const linha of linhas) {
    const chaves: Record<string, string> = {};
    for (const dim of p.dimensoes) chaves[dim.nome] = rotuloDe(dim, linha);
    const tempo =
      p.granularidadeTempo && p.campoData
        ? bucketTempo(linha, p.campoData, p.granularidadeTempo)
        : undefined;
    const key = JSON.stringify([...Object.values(chaves), tempo ?? ""]);

    let g = grupos.get(key);
    if (!g) {
      g = { chaves, tempo, accs: new Map(p.metricas.map((m) => [m.nome, novoAcc(m.def)])) };
      grupos.set(key, g);
    }
    for (const m of p.metricas) {
      acumular(g.accs.get(m.nome)!, m.def, linha);
      acumular(totais.get(m.nome)!, m.def, linha);
    }
  }

  let lista: GrupoResultado[] = [...grupos.values()].map((g) => ({
    chaves: g.chaves,
    ...(g.tempo !== undefined ? { tempo: g.tempo } : {}),
    metricas: Object.fromEntries(p.metricas.map((m) => [m.nome, finalizar(g.accs.get(m.nome)!, m.def)])),
  }));

  // Ordenação: pedida explicitamente > série temporal (asc) > 1ª métrica desc.
  const alvo = p.ordenarPor?.alvo ?? p.metricas[0]?.nome;
  const direcao = p.ordenarPor?.direcao ?? "desc";
  if (!p.ordenarPor && p.granularidadeTempo && !p.dimensoes.length) {
    lista.sort((a, b) => (a.tempo ?? "").localeCompare(b.tempo ?? ""));
  } else if (alvo) {
    lista.sort((a, b) => {
      const va = a.metricas[alvo];
      const vb = b.metricas[alvo];
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // nulls sempre por último
      if (vb == null) return -1;
      return direcao === "desc" ? vb - va : va - vb;
    });
  }

  const numGrupos = lista.length;

  // Estatística dos buckets temporais ANTES do top-N ("média mensal",
  // "mês de maior/menor X" saem prontos daqui — o LLM só transcreve).
  let porTempo: Record<string, ResumoTempoMetrica> | undefined;
  if (p.granularidadeTempo) {
    porTempo = {};
    for (const m of p.metricas) {
      if (!ADITIVAS.has(m.def.agregacao)) continue;
      const porBucket = new Map<string, Dec>();
      for (const g of lista) {
        const v = g.metricas[m.nome];
        if (v == null || g.tempo == null) continue;
        porBucket.set(g.tempo, (porBucket.get(g.tempo) ?? new D(0)).add(v));
      }
      const buckets = [...porBucket.entries()]
        .map(([tempo, dec]) => ({ tempo, valor: arred2(dec) }))
        .sort((a, b) => a.valor - b.valor);
      const soma = [...porBucket.values()].reduce((s, d) => s.add(d), new D(0));
      porTempo[m.nome] = {
        buckets: buckets.length,
        media: buckets.length ? arred2(soma.div(buckets.length)) : null,
        mediana: mediana(buckets.map((b) => b.valor)),
        maior: buckets[buckets.length - 1] ?? null,
        menor: buckets[0] ?? null,
      };
    }
  }

  const truncado = numGrupos > p.limite;
  if (truncado) lista = lista.slice(0, p.limite);

  return {
    grupos: lista,
    // Totais sobre TODAS as linhas (não só os grupos exibidos) — nunca somar a lista.
    totais: Object.fromEntries(p.metricas.map((m) => [m.nome, finalizar(totais.get(m.nome)!, m.def)])),
    truncado,
    numGrupos,
    numLinhas: linhas.length,
    ...(porTempo ? { porTempo } : {}),
  };
}

// ── Comparação A/B (períodos ou fatias) ──────────────────────────────────────
// delta e deltaPct calculados aqui — o LLM só transcreve. Para métricas aditivas
// (soma/contagem) o lado ausente vale 0; para media/min/max fica null.

function celula(
  def: MetricaDef,
  va: number | null | undefined,
  vb: number | null | undefined,
): { valorA: number | null; valorB: number | null; delta: number | null; deltaPct: number | null } {
  const zeroSeAusente = ADITIVAS.has(def.agregacao);
  const valorA = va ?? (zeroSeAusente ? 0 : null);
  const valorB = vb ?? (zeroSeAusente ? 0 : null);
  if (valorA == null || valorB == null) return { valorA, valorB, delta: null, deltaPct: null };
  const delta = arred2(new D(valorA).minus(valorB));
  const deltaPct = valorB !== 0 ? arred2(new D(delta).div(new D(valorB).abs()).mul(100)) : null;
  return { valorA, valorB, delta, deltaPct };
}

export function compararAgregados(
  a: Agregado,
  b: Agregado,
  metricas: { nome: string; def: MetricaDef }[],
): ComparacaoResultado {
  const keyDe = (g: GrupoResultado) => JSON.stringify([...Object.values(g.chaves), g.tempo ?? ""]);
  const mapaA = new Map(a.grupos.map((g) => [keyDe(g), g]));
  const mapaB = new Map(b.grupos.map((g) => [keyDe(g), g]));
  const keys = [...new Set([...mapaA.keys(), ...mapaB.keys()])];

  const porGrupo: ComparacaoGrupo[] = keys.map((k) => {
    const ga = mapaA.get(k);
    const gb = mapaB.get(k);
    const base = (ga ?? gb)!;
    return {
      chaves: base.chaves,
      ...(base.tempo !== undefined ? { tempo: base.tempo } : {}),
      metricas: Object.fromEntries(
        metricas.map((m) => [m.nome, celula(m.def, ga?.metricas[m.nome], gb?.metricas[m.nome])]),
      ),
    };
  });

  // Maior |delta| primeiro (na 1ª métrica) — é o que interessa numa comparação.
  const alvo = metricas[0]?.nome;
  if (alvo)
    porGrupo.sort(
      (x, y) => Math.abs(y.metricas[alvo]?.delta ?? 0) - Math.abs(x.metricas[alvo]?.delta ?? 0),
    );

  return {
    porGrupo,
    totais: Object.fromEntries(
      metricas.map((m) => [m.nome, celula(m.def, a.totais[m.nome], b.totais[m.nome])]),
    ),
    somenteA: keys.filter((k) => !mapaB.has(k)).map((k) => mapaA.get(k)!.chaves),
    somenteB: keys.filter((k) => !mapaA.has(k)).map((k) => mapaB.get(k)!.chaves),
  };
}

// ── Razão numerador/denominador alinhada por bucket ─────────────────────────
// Cada lado já vem agregado (sem dimensões, só tempo opcional). Divide com
// Decimal; bucket sem denominador (ou zero) → null.

export interface LinhaRazao {
  tempo?: string;
  numerador: number | null;
  denominador: number | null;
  razao: number | null;
}

export function dividirAgregados(
  num: Agregado,
  den: Agregado,
  metricaNum: string,
  metricaDen: string,
): { linhas: LinhaRazao[]; total: LinhaRazao; buracos: string[] } {
  const mapa = (ag: Agregado, metrica: string) =>
    new Map(ag.grupos.map((g) => [g.tempo ?? "", g.metricas[metrica] ?? null]));
  const mNum = mapa(num, metricaNum);
  const mDen = mapa(den, metricaDen);

  const dividir = (n: number | null, d: number | null): number | null =>
    n != null && d != null && d !== 0 ? new D(n).div(d).toDecimalPlaces(4).toNumber() : null;

  const tempos = [...new Set([...mNum.keys(), ...mDen.keys()])].sort();
  const buracos: string[] = [];
  const linhas: LinhaRazao[] = tempos.map((t) => {
    const n = mNum.get(t) ?? null;
    const d = mDen.get(t) ?? null;
    if ((d == null || d === 0) && t !== "") buracos.push(t);
    return { ...(t !== "" ? { tempo: t } : {}), numerador: n, denominador: d, razao: dividir(n, d) };
  });

  const tn = num.totais[metricaNum] ?? null;
  const td = den.totais[metricaDen] ?? null;
  return { linhas, total: { numerador: tn, denominador: td, razao: dividir(tn, td) }, buracos };
}
