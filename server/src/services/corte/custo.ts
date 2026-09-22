/* Custo / economia unitária do Corte (Onda 3) — HONESTO sobre a fonte.
 *
 * A fazenda é leite + café; o GADO DE CORTE é atividade NOVA e NÃO tem centro de
 * custo dedicado nos lançamentos financeiros reais (Lancamento). Por isso NÃO há
 * ponte financeira: o custo/economia é calculado a partir dos DADOS DO PRÓPRIO
 * MÓDULO (operações comerciais, suplementação, sanidade, resumos dos lotes).
 *
 * O serviço ainda CONFERE se existe algum CentroCusto cujo nome bata /corte|gado/i
 * com lançamentos — se houver, soma como custo "real"; quase sempre não há, e a
 * `nota` deixa explícito que os números vêm das operações do módulo, não do
 * financeiro.
 *
 * Núcleo PURO (calcularEconomiaCorte) faz a matemática das @ produzidas / R$ por @
 * / custo por cabeça sem tocar no DB — testável. O wrapper (agregarCustoCorte)
 * carrega do Prisma e devolve a forma `CustoCorteData` que o client espera
 * (client/src/corte/api.ts), com campos honestos de pecuária somados.
 *
 * Referencial: rendimento de carcaça 52%; @ = 15 kg (Embrapa Gado de Corte);
 * preço da arroba spot ~R$245 (Cepea/Esalq MG, mesma constante do dashboard).
 */
import { prisma } from "../../db.js";
import { quebrarPorCategoria } from "../rebanho/custo-producao.js";
import { incluirClassificacao, ratearTransacao } from "../financeiro/classificacao.js";
import { RENDIMENTO_CARCACA, KG_POR_ARROBA, HOJE_ANCORA } from "./resumos.recompute.js";

// Preço da arroba spot — mesma referência do dashboard (Cepea/Esalq MG).
export const PRECO_ARROBA_SPOT = 245;

// Custo sanitário representativo por aplicação/cabeça (estimativa). Os produtos
// veterinários do corte NÃO têm custo unitário no schema (ManejoSanitario não
// guarda preço), então estimamos por nº de cabeças aplicadas × este valor. É um
// número de bula/mercado para vacina+vermífugo, deixado explícito na nota.
export const CUSTO_SANITARIO_POR_CABECA = 6; // R$/cabeça por aplicação

const MS = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const toNum = (x: any) => (x != null ? Number(x) : 0);

/** Diferença em dias (b − a), ambos ISO YYYY-MM-DD; nunca negativa. */
function diffDias(a: string, b: string): number {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / MS));
}

const iso = (d: Date | string): string =>
  typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);

// ── Núcleo PURO ──────────────────────────────────────────────────────────────

export interface VendaCorte {
  receitaTotal: number; // R$ da operação (só VENDA_*)
  arrobas: number; // @ da carcaça vendida
}

export interface SuplementacaoCorte {
  consumoCabecaDiaG: number; // g/cabeça/dia
  custoKg: number | null; // R$/kg do suplemento (null → não estimável)
  numCabecas: number; // efetivo do lote suplementado
  dias: number; // dias do período (até dataFim ou hoje)
}

export interface LoteEstoqueCorte {
  arrobasEstimadas: number; // @/cabeça estimadas (resumo)
  numCabecas: number;
}

export interface EconomiaCorteInput {
  vendas: VendaCorte[];
  suplementacoes: SuplementacaoCorte[];
  sanitarioCabecasAplicadas: number; // Σ numCabecas das aplicações no período
  custoSanitarioPorCabeca: number;
  lotesEstoque: LoteEstoqueCorte[]; // lotes ATIVO
  custoFinanceiroExtra: number; // lançamentos de eventual CentroCusto corte (0 quase sempre)
  precoArrobaSpot: number;
}

export interface EconomiaCorte {
  receita: number;
  custoSuplementacao: number;
  custoSanitario: number;
  custoFinanceiroExtra: number;
  custeioTotal: number; // suplementação + sanidade + financeiro extra
  arrobasProduzidas: number; // @ vendidas no período
  arrobasEstoque: number; // @ biológicas no plantel ativo
  valorBiologicoEstoque: number; // R$ do estoque biológico (@ estoque × spot)
  custoArroba: number | null; // custeio ÷ @ produzidas
  custoPorCabeca: number | null; // custeio ÷ cabeças no plantel ativo
  margemBruta: number; // receita − custeio
}

/**
 * Núcleo PURO — deriva a economia unitária do corte dos dados do módulo.
 *   custoSuplementacao = Σ (consumoCabecaDia(kg) × custoKg × numCabecas × dias)
 *   custoSanitario     = cabeçasAplicadas × custoSanitarioPorCabeca
 *   custeioTotal       = suplementação + sanidade + financeiro extra
 *   arrobasProduzidas  = Σ @ das vendas
 *   custoArroba        = custeioTotal ÷ @ produzidas   (null se 0 @)
 *   custoPorCabeca     = custeioTotal ÷ cabeças ativas (null se 0 cabeças)
 *   valorBiologico     = Σ(@/cab estoque × cabeças) × precoSpot
 */
export function calcularEconomiaCorte(input: EconomiaCorteInput): EconomiaCorte {
  const receita = round2(input.vendas.reduce((s, v) => s + v.receitaTotal, 0));
  const arrobasProduzidas = round2(input.vendas.reduce((s, v) => s + v.arrobas, 0));

  const custoSuplementacao = round2(
    input.suplementacoes.reduce((s, x) => {
      if (x.custoKg == null) return s;
      const kgDia = x.consumoCabecaDiaG / 1000;
      return s + kgDia * x.custoKg * x.numCabecas * x.dias;
    }, 0)
  );

  const custoSanitario = round2(input.sanitarioCabecasAplicadas * input.custoSanitarioPorCabeca);
  const custoFinanceiroExtra = round2(input.custoFinanceiroExtra);
  const custeioTotal = round2(custoSuplementacao + custoSanitario + custoFinanceiroExtra);

  const cabecasAtivas = input.lotesEstoque.reduce((s, l) => s + l.numCabecas, 0);
  const arrobasEstoque = round2(
    input.lotesEstoque.reduce((s, l) => s + l.arrobasEstimadas * l.numCabecas, 0)
  );
  const valorBiologicoEstoque = Math.round(arrobasEstoque * input.precoArrobaSpot);

  const custoArroba = arrobasProduzidas > 0 ? round2(custeioTotal / arrobasProduzidas) : null;
  const custoPorCabeca = cabecasAtivas > 0 ? round2(custeioTotal / cabecasAtivas) : null;

  return {
    receita,
    custoSuplementacao,
    custoSanitario,
    custoFinanceiroExtra,
    custeioTotal,
    arrobasProduzidas,
    arrobasEstoque,
    valorBiologicoEstoque,
    custoArroba,
    custoPorCabeca,
    margemBruta: round2(receita - custeioTotal),
  };
}

// ── Forma que o client espera (CustoCorteData) + campos honestos de pecuária ──

export interface CustoCorteData {
  // forma original do mock do client (PRESERVADA)
  custoArroba: number;
  custoHa: number;
  custeioTotal: number;
  arrobasProduzidas: number;
  periodoMeses: number;
  breakdown: { categoria: string; valor: number; pct: number }[];
  nota: string;
  // campos honestos de unit economics de corte (novos — o client pode ignorar)
  receita: number;
  custoSuplementacao: number;
  custoSanitario: number;
  valorBiologicoEstoque: number;
  arrobasEstoque: number;
  custoPorCabeca: number | null;
  margemBruta: number;
  precoArrobaSpot: number;
  cabecasAtivas: number;
}

// ── Wrapper com DB ───────────────────────────────────────────────────────────

export async function agregarCustoCorte(meses = 12): Promise<CustoCorteData> {
  const hoje = HOJE_ANCORA; // âncora do app (2026-05-28)
  const desde = new Date(`${hoje}T00:00:00Z`);
  desde.setUTCMonth(desde.getUTCMonth() - meses);

  // 1) Receita = vendas (VENDA_*) no período — COMPRA/TRANSFERENCIA não entram.
  const vendas = await prisma.operacaoComercial.findMany({
    where: {
      tipo: { in: ["VENDA_ABATE", "VENDA_REPRODUCAO"] },
      data: { gte: desde },
    },
    select: { receitaTotal: true, arrobas: true },
  });

  // 2) Suplementações ativas no período (dataFim null OU dataFim >= desde).
  const sups = await prisma.suplementacao.findMany({
    where: { OR: [{ dataFim: null }, { dataFim: { gte: desde } }] },
    select: { consumoCabecaDiaG: true, custoKg: true, dataInicio: true, dataFim: true, loteId: true },
  });
  // Efetivo por lote (cabeças atuais) para multiplicar o consumo.
  const loteIds = [...new Set(sups.map((s) => s.loteId))];
  const lotesSup = await prisma.loteCorte.findMany({
    where: { id: { in: loteIds } },
    select: { id: true, numCabecas: true },
  });
  const cabecasPorLote = new Map(lotesSup.map((l) => [l.id, l.numCabecas]));

  const suplementacoes: SuplementacaoCorte[] = sups.map((s) => {
    const inicio = iso(s.dataInicio);
    const fim = s.dataFim ? iso(s.dataFim) : hoje;
    // limita o período à janela [desde, hoje] (não conta dias fora dela)
    const ini = inicio < iso(desde) ? iso(desde) : inicio;
    const dias = diffDias(ini, fim);
    return {
      consumoCabecaDiaG: toNum(s.consumoCabecaDiaG),
      custoKg: s.custoKg != null ? Number(s.custoKg) : null,
      numCabecas: cabecasPorLote.get(s.loteId) ?? 0,
      dias,
    };
  });

  // 3) Sanidade — sem custo unitário no schema; estima por cabeças aplicadas.
  const manejos = await prisma.manejoSanitario.findMany({
    where: { data: { gte: desde } },
    select: { numCabecas: true },
  });
  const sanitarioCabecasAplicadas = manejos.reduce((s, m) => s + m.numCabecas, 0);

  // 4) Estoque biológico — lotes ATIVO com @/cabeça do resumo.
  const lotesAtivos = await prisma.loteCorte.findMany({
    where: { estado: "ATIVO" },
    include: { resumo: { select: { arrobasEstimadas: true } } },
  });
  const lotesEstoque: LoteEstoqueCorte[] = lotesAtivos.map((l) => ({
    arrobasEstimadas: l.resumo?.arrobasEstimadas != null ? Number(l.resumo.arrobasEstimadas) : 0,
    numCabecas: l.numCabecas,
  }));
  const cabecasAtivas = lotesEstoque.reduce((s, l) => s + l.numCabecas, 0);

  // 5) Confere se existe CentroCusto de corte/gado COM lançamentos liquidados —
  //    quase sempre não existe (atividade nova). Se existir, soma como custo real.
  const centrosCorte = await prisma.centroCusto.findMany({
    where: {
      OR: [
        { nome: { contains: "corte", mode: "insensitive" } },
        { nome: { contains: "gado", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  let custoFinanceiroExtra = 0;
  let temCentroCorte = false;
  if (centrosCorte.length) {
    const idsCorte = centrosCorte.map((c) => c.id);
    // Pré-filtro: a operação ou algum item aponta um centro de corte. Soma só
    // as partes rateadas cujo centro efetivo (item ?? operação) é de corte —
    // uma nota mista (ração do corte + insumo do leite) não entra inteira.
    const lancs = await prisma.transacaoFinanceira.findMany({
      where: {
        status: "CONFIRMADA",
        tipo: "PAGAMENTO",
        data: { gte: desde },
        operacao: { OR: [{ centroCustoId: { in: idsCorte } }, { itens: { some: { centroCustoId: { in: idsCorte } } } }] },
      },
      select: { id: true, valorTotal: true, operacao: { include: incluirClassificacao } },
    });
    const partes = lancs.flatMap((l) => ratearTransacao(l.operacao, l.id, l.valorTotal).filter((p) => p.centroCustoId != null && idsCorte.includes(p.centroCustoId)));
    custoFinanceiroExtra = Math.round(partes.reduce((s, p) => s + p.valor.toNumber(), 0) * 100) / 100;
    temCentroCorte = partes.length > 0;
  }

  // 6) Economia unitária (núcleo puro).
  const econ = calcularEconomiaCorte({
    vendas: vendas.map((v) => ({ receitaTotal: toNum(v.receitaTotal), arrobas: toNum(v.arrobas) })),
    suplementacoes,
    sanitarioCabecasAplicadas,
    custoSanitarioPorCabeca: CUSTO_SANITARIO_POR_CABECA,
    lotesEstoque,
    custoFinanceiroExtra,
    precoArrobaSpot: PRECO_ARROBA_SPOT,
  });

  // 7) Breakdown do custeio por componente (reusa o motor puro do rebanho).
  const itens = [
    { categoria: "Suplementação (mineral / proteinado)", valor: econ.custoSuplementacao },
    { categoria: "Sanidade (vacinas + vermífugos, estimado)", valor: econ.custoSanitario },
  ];
  if (econ.custoFinanceiroExtra > 0) itens.push({ categoria: "Lançamentos (centro de custo corte)", valor: econ.custoFinanceiroExtra });
  const quebra = quebrarPorCategoria(itens.filter((i) => i.valor > 0));

  // custoHa não se aplica ao corte (sem área dedicada nos dados); preservamos o
  // campo da forma do client, mas zerado — a unidade real do corte é R$/@ e R$/cab.
  const nota = temCentroCorte
    ? "Custo do gado de corte calculado a partir das operações do módulo (suplementação, " +
      "sanidade) somadas aos lançamentos de um centro de custo de corte encontrado no " +
      "financeiro. Receita e @ produzidas vêm das vendas registradas; o estoque biológico " +
      "é o valor estimado das @ no plantel ativo (preço spot R$" + PRECO_ARROBA_SPOT + "/@). " +
      "Sanidade é estimativa por cabeça (produtos sem custo unitário no cadastro)."
    : "O gado de corte é atividade NOVA e NÃO tem centro de custo dedicado nos lançamentos " +
      "financeiros — por isso o custo é calculado HONESTAMENTE a partir dos dados do próprio " +
      "módulo: suplementação (consumo × custo/kg × cabeças × dias) + sanidade (estimada por " +
      "cabeça aplicada, pois os produtos não têm custo unitário no cadastro). Receita e @ " +
      "produzidas vêm das vendas registradas; o estoque biológico é o valor das @ no plantel " +
      "ativo a R$" + PRECO_ARROBA_SPOT + "/@ (spot). Não há ponte financeira fabricada.";

  return {
    custoArroba: econ.custoArroba ?? 0,
    custoHa: 0,
    custeioTotal: econ.custeioTotal,
    arrobasProduzidas: econ.arrobasProduzidas,
    periodoMeses: meses,
    breakdown: quebra.linhas,
    nota,
    receita: econ.receita,
    custoSuplementacao: econ.custoSuplementacao,
    custoSanitario: econ.custoSanitario,
    valorBiologicoEstoque: econ.valorBiologicoEstoque,
    arrobasEstoque: econ.arrobasEstoque,
    custoPorCabeca: econ.custoPorCabeca,
    margemBruta: econ.margemBruta,
    precoArrobaSpot: PRECO_ARROBA_SPOT,
    cabecasAtivas,
  };
}
