/* Agregações que alimentam o Dashboard do frontend.
 *
 * Forma do retorno espelha o `data/rionovo.ts` (mock) — mesmas chaves,
 * mesma unidade (R$ inteiros). Lançamentos são filtrados por:
 *   - situacao = LIQUIDADO  (regime de caixa)
 *   - estornado = false
 * Janela fixa: 23 meses de Jul/2024 a Mai/2026 (último parcial, sinalizado
 * com "*" no label). Trocar para janela dinâmica quando o frontend mandar
 * range explícito.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../env.js";

// Janela: Jul/2024 (idx 0) → Mai/2026 (idx 22)
const WINDOW_START_YEAR = 2024;
const WINDOW_START_MONTH = 6; // 0-indexed: julho
const WINDOW_LEN = 23;
const PARTIAL_LAST = true;

const PT_MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const CATEGORIAS_MISCLASSIFICADAS = new Set([
  "Animal Aquisição",
  "RN - Caminhão e Trator",
]);

type Atividade = "leite" | "cafe" | "outros";

function mesIndex(date: Date): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return (y - WINDOW_START_YEAR) * 12 + (m - WINDOW_START_MONTH);
}

function mesLabel(idx: number): string {
  const total = WINDOW_START_MONTH + idx;
  const y = WINDOW_START_YEAR + Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12;
  const star = PARTIAL_LAST && idx === WINDOW_LEN - 1 ? "*" : "";
  return `${PT_MONTHS_SHORT[m]}/${String(y).slice(-2)}${star}`;
}

function atividadeDe(centroNome: string): Atividade {
  if (centroNome.includes("Leiteira")) return "leite";
  if (centroNome.includes("Café") || centroNome.includes("Plantio")) return "cafe";
  return "outros";
}

const zeros = () => new Array<number>(WINDOW_LEN).fill(0);
const sumArr = (a: number[]) => a.reduce((s, x) => s + x, 0);
const sumAt = (a: number[], idxs: number[]) => idxs.reduce((s, i) => s + (a[i] ?? 0), 0);
const toNum = (d: Prisma.Decimal | number) =>
  typeof d === "number" ? d : d.toNumber();

export type DashboardPayload = Awaited<ReturnType<typeof buildDashboard>>;

// Caixa real "na data": saldo inicial de cada conta + fluxo líquido liquidado
// (CRÉDITO − DÉBITO) até `asOf`. Inclui TODOS os lançamentos (até "(Sem centro de
// custo)", que são transferências/aportes e afetam o caixa de verdade).
// ⚠ saldoInicial das contas está 0 no banco — então hoje isto é, na prática, o
// fluxo de caixa acumulado. Quando os saldos de abertura forem importados, vira
// o saldo bancário verdadeiro sem mudar o código.
async function buildCaixa(asOf: Date) {
  const contas = await prisma.contaBancaria.findMany({
    select: { id: true, nome: true, saldoInicial: true },
    orderBy: { id: "asc" },
  });
  const flows = await prisma.lancamento.groupBy({
    by: ["contaBancariaId", "natureza"],
    where: { situacao: "LIQUIDADO", estornado: false, dataLiquidacao: { lte: asOf } },
    _sum: { valor: true },
  });
  const saldo = new Map<number, number>();
  for (const c of contas) saldo.set(c.id, toNum(c.saldoInicial ?? 0));
  for (const f of flows) {
    if (f.contaBancariaId == null) continue;
    const v = toNum(f._sum.valor ?? 0);
    saldo.set(f.contaBancariaId, (saldo.get(f.contaBancariaId) ?? 0) + (f.natureza === "CREDITO" ? v : -v));
  }
  const contasOut = contas.map((c) => ({ nome: c.nome, saldo: Math.round(saldo.get(c.id) ?? 0) }));
  return {
    total: contasOut.reduce((s, c) => s + c.saldo, 0),
    asOf: asOf.toISOString().slice(0, 10),
    contas: contasOut,
  };
}

// Lista REAL de lançamentos de uma categoria (opcionalmente de um fornecedor),
// para o drill do dashboard. Regime de caixa: LIQUIDADO, não estornado, débitos,
// fora do balde "(Sem centro de custo)".
export async function buildLancamentos(opts: {
  categoriaId: number;
  fornecedor?: string;
  from?: Date;
  to?: Date;
}) {
  const { categoriaId, fornecedor, from, to } = opts;
  const dataFilter: Prisma.DateTimeNullableFilter = { not: null };
  if (from) dataFilter.gte = from;
  if (to) dataFilter.lte = to;
  const rows = await prisma.lancamento.findMany({
    where: {
      situacao: "LIQUIDADO",
      estornado: false,
      natureza: "DEBITO",
      categoriaId,
      centroCusto: { nome: { not: "(Sem centro de custo)" } },
      dataLiquidacao: dataFilter,
      ...(fornecedor ? { clienteFornecedor: { nome: fornecedor } } : {}),
    },
    select: {
      dataLiquidacao: true,
      valor: true,
      numeroDocumento: true,
      descricao: true,
      clienteFornecedor: { select: { nome: true } },
    },
    orderBy: { dataLiquidacao: "desc" },
    take: 300,
  });
  return rows.map((r) => ({
    data: r.dataLiquidacao ? r.dataLiquidacao.toISOString().slice(0, 10) : null,
    valor: Math.round(toNum(r.valor)),
    doc: r.numeroDocumento,
    descricao: r.descricao,
    fornecedor: r.clienteFornecedor?.nome ?? "(sem fornecedor)",
  }));
}

export async function buildDashboard(opts: { from?: Date; to?: Date } = {}) {
  const { from, to } = opts;
  const lancamentos = await prisma.lancamento.findMany({
    where: {
      situacao: "LIQUIDADO",
      estornado: false,
      dataLiquidacao: { not: null },
      // Exclui o balde "(Sem centro de custo)" — usado pelo BPO como
      // transferências entre contas e ajustes. Não representa fluxo
      // operacional e infla o total em ~R$ 7 mi.
      centroCusto: { nome: { not: "(Sem centro de custo)" } },
    },
    select: {
      natureza: true,
      valor: true,
      dataLiquidacao: true,
      categoria: { select: { id: true, nome: true, classificacao: true, grupoCategoria: { select: { nome: true } } } },
      centroCusto: { select: { nome: true, ehInvestimento: true } },
      clienteFornecedor: { select: { nome: true } },
    },
  });

  // ----- séries mensais (23 meses) ------------------------------------------
  const receitaLeite = zeros();
  const receitaCafe = zeros();
  // custeio sem misclassificados
  const custeioLeitePuro = zeros();
  const custeioCafe = zeros();
  const sedeOutros = zeros();
  // misclassificados (devem ser investimento)
  const animalAquisicao = zeros();
  const rnCaminhao = zeros();
  // investimento "correto" (ehInvestimento=true)
  const investLeite = zeros();
  const investCafe = zeros();
  const totalGeral = zeros();

  // categoria → { por mês, atividade dominante, grupo, flag }
  type CatAcc = {
    id: number;
    nome: string;
    grupo: string;
    monthly: number[];
    atividade: Atividade;
    flag?: "investimento-misclassificado";
    fornecedores: Map<string, { valor: number; n: number }>; // nome → gasto + nº lançamentos
  };
  const catMap = new Map<number, CatAcc>();

  // Captura a categoria "Animal Aquisição" e sua classificação (Fatia 22).
  let animAqCatId: number | null = null;
  let animAqCls: "CUSTEIO" | "INVESTIMENTO" | null = null;

  for (const l of lancamentos) {
    if (!l.dataLiquidacao) continue;
    const idx = mesIndex(l.dataLiquidacao);
    if (idx < 0 || idx >= WINDOW_LEN) continue;

    const v = toNum(l.valor);
    const atv = atividadeDe(l.centroCusto.nome);
    const catNome = l.categoria.nome;
    // Override de classificação (Fatia 22). null = pendente (default reclassificado).
    const cls = l.categoria.classificacao; // "CUSTEIO" | "INVESTIMENTO" | null
    const isAnimAq = catNome === "Animal Aquisição";
    if (isAnimAq) { animAqCatId = l.categoria.id; animAqCls = cls; }
    // Revertido p/ BPO: Animal Aquisição volta pro custeio (sai dos misclassificados).
    const animAqRevertido = isAnimAq && cls === "CUSTEIO";
    const misclass = CATEGORIAS_MISCLASSIFICADAS.has(catNome) && !animAqRevertido;
    // A flag ehInvestimento no schema veio do import, que respeitou
    // capitalização exata. "Plantio Café - investimento" entrou com false.
    // Fallback: detecta "investimento" no nome do centro.
    const ehInv =
      l.centroCusto.ehInvestimento ||
      /investimento/i.test(l.centroCusto.nome);

    if (l.natureza === "CREDITO") {
      if (atv === "leite") receitaLeite[idx] += v;
      else if (atv === "cafe") receitaCafe[idx] += v;
      totalGeral[idx] += v;
    } else {
      // DEBITO
      totalGeral[idx] -= v;

      if (misclass) {
        if (catNome === "Animal Aquisição") animalAquisicao[idx] += v;
        else rnCaminhao[idx] += v;
      } else if (ehInv) {
        if (atv === "leite") investLeite[idx] += v;
        else if (atv === "cafe") investCafe[idx] += v;
        // "outros" investimento (raro) ignora a separação por atividade
      } else {
        if (atv === "leite") custeioLeitePuro[idx] += v;
        else if (atv === "cafe") custeioCafe[idx] += v;
        else sedeOutros[idx] += v;
      }
    }

    // acumular por categoria (qualquer débito vira candidato ao top)
    if (l.natureza === "DEBITO") {
      let acc = catMap.get(l.categoria.id);
      if (!acc) {
        acc = {
          id: l.categoria.id,
          nome: catNome,
          grupo: l.categoria.grupoCategoria.nome,
          monthly: zeros(),
          atividade: atv,
          // ⚠ só enquanto pendente; some quando Animal Aquisição é decidida (confirma/reverte).
          flag: misclass && !(isAnimAq && cls != null) ? "investimento-misclassificado" : undefined,
          fornecedores: new Map(),
        };
        catMap.set(l.categoria.id, acc);
      }
      acc.monthly[idx] += v;
      const fnome = l.clienteFornecedor?.nome ?? "(sem fornecedor)";
      const fcur = acc.fornecedores.get(fnome) ?? { valor: 0, n: 0 };
      fcur.valor += v;
      fcur.n += 1;
      acc.fornecedores.set(fnome, fcur);
    }
  }

  // custeioLeiteBPO (referência: como o BPO entrega — com misclassificados juntos)
  const custeioLeiteBPO = custeioLeitePuro.map(
    (v, i) => v + animalAquisicao[i] + rnCaminhao[i],
  );

  const totals23m = {
    receitaLeite: sumArr(receitaLeite),
    receitaCafe: sumArr(receitaCafe),
    custeioLeiteBPO: sumArr(custeioLeiteBPO),
    custeioLeitePuro: sumArr(custeioLeitePuro),
    animalAquisicao: sumArr(animalAquisicao),
    rnCaminhao: sumArr(rnCaminhao),
    investLeite: sumArr(investLeite),
    custeioCafe: sumArr(custeioCafe),
    investCafe: sumArr(investCafe),
    sedeOutros: sumArr(sedeOutros),
    totalGeral: sumArr(totalGeral),
  };

  // ----- recortes anuais (DRE) ---------------------------------------------
  // Jul/24=0  Jan/25=6  Jan/26=18
  const idx2024H2 = [0, 1, 2, 3, 4, 5];
  const idx2025 = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  const idx2026YTD = [18, 19, 20, 21, 22];
  // Mesmo período de 2026 YTD em 2025 (Jan-Mai)
  const idx2025MesmaJanela = [6, 7, 8, 9, 10];

  const aggIdx = (idxs: number[]) => ({
    receitaLeite: sumAt(receitaLeite, idxs),
    receitaCafe: sumAt(receitaCafe, idxs),
    custeioLeiteBPO: sumAt(custeioLeiteBPO, idxs),
    custeioLeitePuro: sumAt(custeioLeitePuro, idxs),
    animalAquisicao: sumAt(animalAquisicao, idxs),
    investLeite: sumAt(investLeite, idxs),
    custeioCafe: sumAt(custeioCafe, idxs),
    investCafe: sumAt(investCafe, idxs),
    sedeOutros: sumAt(sedeOutros, idxs),
    totalGeral: sumAt(totalGeral, idxs),
  });

  const k2025 = aggIdx(idx2025);
  const k2026YTD = aggIdx(idx2026YTD);

  // ----- categorias top 12 -------------------------------------------------
  const categoriasReais = Array.from(catMap.values())
    .map((c) => {
      const total23m = sumArr(c.monthly);
      const ytd2026 = sumAt(c.monthly, idx2026YTD);
      const ytd2025MesmaJanela = sumAt(c.monthly, idx2025MesmaJanela);
      const delta =
        ytd2025MesmaJanela > 0
          ? Math.round((ytd2026 / ytd2025MesmaJanela - 1) * 100)
          : ytd2026 > 0
            ? 100
            : 0;
      const fornsArr = [...c.fornecedores.entries()]
        .map(([nome, x]) => ({ nome, valor: Math.round(x.valor), n: x.n }))
        .sort((a, b) => b.valor - a.valor);
      return {
        id: c.id,
        nome: c.nome,
        grupo: c.grupo,
        atividade: c.atividade,
        total23m: Math.round(total23m),
        ytd2026: Math.round(ytd2026),
        delta,
        flag: c.flag,
        // top 8 fornecedores reais (gasto + nº lançamentos) na janela 23m, e o
        // total distinto pra montar o balde "Outros" das subcategorias.
        fornecedores: fornsArr.slice(0, 8),
        nFornecedores: fornsArr.length,
      };
    })
    .filter((c) => c.total23m > 0)
    .sort((a, b) => b.total23m - a.total23m)
    .slice(0, 12);

  // ----- caixa real "na data" (saldo das contas) ---------------------------
  // asOf = fim do período filtrado; sem filtro, agora.
  const caixaHoje = await buildCaixa(to ?? new Date());

  // inconsistências: construídas mais abaixo, após o bloco de período (usam os
  // totais DO PERÍODO e escondem cards zerados).

  // ----- período selecionado (filtro de data do dashboard) -----------------
  // Agregado por DATA EXATA de liquidação em [from, to], com a MESMA classificação
  // dos KPIs do cockpit (assim, com o range cheio, `periodo` == totais 23m):
  //   receita      = créditos
  //   investimento = débitos ehInvestimento + "Animal Aquisição" (se não revertida)
  //   custeio      = demais débitos
  //   fluxo        = créditos − todos os débitos
  // "RN - Caminhão e Trator" (misclass) fica fora de custeio e investimento, igual
  // ao cockpit. Sem from/to → periodo = null (frontend cai nos totais 23m).
  let periodo:
    | { from: string; to: string; receita: number; custeio: number; investimento: number; fluxo: number }
    | null = null;
  // Com filtro, categorias e atividade (totals23m) também passam a refletir o
  // PERÍODO — mesma classificação dos KPIs. Substituem os 23m no retorno, para a
  // dashboard inteira ficar coerente com o mês selecionado (e casar com o chat).
  let periodTotals: typeof totals23m | null = null;
  let periodCategorias: typeof categoriasReais | null = null;
  if (from && to) {
    const pt = {
      receitaLeite: 0, receitaCafe: 0, custeioLeitePuro: 0, custeioCafe: 0, sedeOutros: 0,
      investLeite: 0, investCafe: 0, animalAquisicao: 0, rnCaminhao: 0, totalGeral: 0,
    };
    const pcat = new Map<number, {
      id: number; nome: string; grupo: string; atividade: Atividade; total: number;
      fornecedores: Map<string, { valor: number; n: number }>; flag?: "investimento-misclassificado";
    }>();
    for (const l of lancamentos) {
      if (!l.dataLiquidacao) continue;
      if (l.dataLiquidacao < from || l.dataLiquidacao > to) continue;
      const v = toNum(l.valor);
      const atv = atividadeDe(l.centroCusto.nome);
      const catNome = l.categoria.nome;
      const cls = l.categoria.classificacao;
      const isAnimAq = catNome === "Animal Aquisição";
      const animAqRevertido = isAnimAq && cls === "CUSTEIO";
      const misclass = CATEGORIAS_MISCLASSIFICADAS.has(catNome) && !animAqRevertido;
      const ehInv = l.centroCusto.ehInvestimento || /investimento/i.test(l.centroCusto.nome);
      if (l.natureza === "CREDITO") {
        if (atv === "leite") pt.receitaLeite += v; else if (atv === "cafe") pt.receitaCafe += v;
        pt.totalGeral += v;
        continue;
      }
      pt.totalGeral -= v;
      if (misclass) {
        if (isAnimAq) pt.animalAquisicao += v; else pt.rnCaminhao += v;
      } else if (ehInv) {
        if (atv === "leite") pt.investLeite += v; else if (atv === "cafe") pt.investCafe += v;
      } else {
        if (atv === "leite") pt.custeioLeitePuro += v; else if (atv === "cafe") pt.custeioCafe += v; else pt.sedeOutros += v;
      }
      // acumula por categoria (débitos) — mesma lógica do 23m, mas do período
      let acc = pcat.get(l.categoria.id);
      if (!acc) {
        acc = {
          id: l.categoria.id, nome: catNome, grupo: l.categoria.grupoCategoria.nome, atividade: atv,
          total: 0, fornecedores: new Map(),
          flag: misclass && !(isAnimAq && cls != null) ? "investimento-misclassificado" : undefined,
        };
        pcat.set(l.categoria.id, acc);
      }
      acc.total += v;
      const fnome = l.clienteFornecedor?.nome ?? "(sem fornecedor)";
      const fcur = acc.fornecedores.get(fnome) ?? { valor: 0, n: 0 };
      fcur.valor += v; fcur.n += 1; acc.fornecedores.set(fnome, fcur);
    }
    periodo = {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      receita: Math.round(pt.receitaLeite + pt.receitaCafe),
      custeio: Math.round(pt.custeioLeitePuro + pt.custeioCafe + pt.sedeOutros),
      investimento: Math.round(pt.investLeite + pt.investCafe + pt.animalAquisicao),
      fluxo: Math.round(pt.totalGeral),
    };
    periodTotals = {
      receitaLeite: Math.round(pt.receitaLeite), receitaCafe: Math.round(pt.receitaCafe),
      custeioLeiteBPO: Math.round(pt.custeioLeitePuro + pt.animalAquisicao + pt.rnCaminhao),
      custeioLeitePuro: Math.round(pt.custeioLeitePuro), animalAquisicao: Math.round(pt.animalAquisicao),
      rnCaminhao: Math.round(pt.rnCaminhao), investLeite: Math.round(pt.investLeite),
      custeioCafe: Math.round(pt.custeioCafe), investCafe: Math.round(pt.investCafe),
      sedeOutros: Math.round(pt.sedeOutros), totalGeral: Math.round(pt.totalGeral),
    };
    periodCategorias = [...pcat.values()].map((c) => {
      const fornsArr = [...c.fornecedores.entries()]
        .map(([nome, x]) => ({ nome, valor: Math.round(x.valor), n: x.n }))
        .sort((a, b) => b.valor - a.valor);
      return {
        id: c.id, nome: c.nome, grupo: c.grupo, atividade: c.atividade,
        total23m: Math.round(c.total), ytd2026: Math.round(c.total), delta: 0, flag: c.flag,
        fornecedores: fornsArr.slice(0, 8), nFornecedores: fornsArr.length,
      };
    }).filter((c) => c.total23m > 0).sort((a, b) => b.total23m - a.total23m).slice(0, 12);
  }

  // ----- inconsistências (curadas; valores DO PERÍODO; cards zerados escondidos) ---
  const tInc = periodTotals ?? totals23m;
  const inconsistencias = [
    // Animal Aquisição: card só enquanto pendente. Carrega categoriaId p/ os botões
    // reais (confirmar reclassificação / reverter para custeio BPO). A ação vale p/
    // a categoria inteira; o valor mostrado é o do período filtrado.
    ...(animAqCls == null
      ? [{
          id: "animal-aq",
          severidade: "alta",
          categoriaId: animAqCatId,
          titulo: "“Animal Aquisição” reclassificada para investimento",
          valor: Math.round(tInc.animalAquisicao),
          detalhe:
            "A IA reclassificou as compras de matrizes (Animal Aquisição) de Custeio para Investimento — é compra de animal vivo, não custeio do leite. Confirme para manter, ou reverta para a classificação do BPO (custeio).",
          acao: "Confirmar reclassificação",
          impacto: "Tira a compra de gado do custeio operacional do leite.",
        }]
      : []),
    {
      id: "rn-caminhao",
      severidade: "media",
      titulo: "“RN — Caminhão e Trator” em Curral",
      valor: Math.round(tInc.rnCaminhao),
      detalhe:
        "Lançamentos repetidos com natureza de caminhão/trator entram em Curral. Parece custeio estrutural ou financiamento — não pertence ao custeio operacional do rebanho.",
      acao: "Mover para Estrutural — Financiamentos",
      impacto: "Curral cai e a leitura do operacional do leite fica mais limpa",
    },
    {
      id: "atv-plantio",
      severidade: "media",
      titulo: "“Atividade Plantio” × “Plantio Café”",
      valor: Math.round(tInc.receitaCafe),
      detalhe:
        "Receita de café lançada em CCusto “Atividade Plantio”. Custeio e investimento de café em CCusto “Plantio Café”. São o mesmo negócio — unificar dá leitura limpa por safra.",
      acao: "Unificar CCustos",
      impacto: "Margem café fica visível direta na DRE",
    },
    {
      id: "vazio-sede",
      severidade: "baixa",
      titulo: "Lançamentos sem CCusto",
      valor: Math.round(tInc.sedeOutros),
      detalhe:
        "Pequenos itens (luz, água, manutenção da casa-grande) ficam em “(sem CCusto)”. Atribuir a “Outros / Estrutural” para sair da leitura de Criação Animal.",
      acao: "Alocar em Estrutural",
      impacto: "Limpa o operacional do leite",
    },
  ].filter((i) => i.valor > 0); // esconde cards zerados (mortos nos dados reais)

  // ----- projeção de caixa: fôlego / ruptura (Plano #2) --------------------
  // Determinístico (não é IA). Queima mensal = média das saídas líquidas dos
  // últimos N meses COMPLETOS (exclui o último mês parcial). N = env.DASHBOARD_MESES_QUEIMA.
  //   queimaTotal[i]       = saída líquida do mês  = −totalGeral[i]
  //   queimaOperacional[i] = déficit do leite      = custeio − receita
  // Fôlego = caixa ÷ queima. Ruptura = projeta o caixa caindo pela queima até < 0.
  const N = env.DASHBOARD_MESES_QUEIMA;
  const ultimoCompleto = WINDOW_LEN - (PARTIAL_LAST ? 2 : 1);
  const baseIdxs: number[] = [];
  for (let i = Math.max(0, ultimoCompleto - N + 1); i <= ultimoCompleto; i++) baseIdxs.push(i);
  const media = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  const queimaMensal = Math.round(media(baseIdxs.map((i) => -totalGeral[i])));
  const queimaCusteioMensal = Math.round(
    media(baseIdxs.map((i) => custeioLeitePuro[i] + custeioCafe[i] + sedeOutros[i] - receitaLeite[i] - receitaCafe[i])),
  );
  const caixaAtual = caixaHoje.total;
  const folegoMeses = queimaMensal > 0 ? Math.round((caixaAtual / queimaMensal) * 10) / 10 : null;
  // projeção do saldo pra frente (H meses), caindo pela queima total
  const H = 6;
  const baseDate = to ?? new Date();
  const fluxoProj: { mes: string; caixaFim: number }[] = [];
  let saldo = caixaAtual;
  for (let t = 1; t <= H; t++) {
    saldo -= queimaMensal;
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + t, 1));
    fluxoProj.push({
      mes: `${PT_MONTHS_SHORT[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(-2)}`,
      caixaFim: Math.round(saldo),
    });
  }
  const mesesAteRuptura = queimaMensal > 0 && caixaAtual > 0 ? caixaAtual / queimaMensal : 0;
  const dRup = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + Math.ceil(mesesAteRuptura), 1));
  const projecao = {
    baseMeses: N,
    caixa: caixaAtual,
    queimaMensal, // R$/mês (positivo = saindo)
    queimaCusteioMensal, // déficit operacional R$/mês
    queimaInvestimentoMensal: queimaMensal - queimaCusteioMensal,
    folegoMeses,
    folegoDias: folegoMeses != null ? Math.round(folegoMeses * 30) : null,
    fluxoProj,
    ruptura: queimaMensal > 0
      ? {
          rompe: caixaAtual > 0,
          mesesAteRuptura: Math.round(mesesAteRuptura * 10) / 10,
          dataRuptura: `${PT_MONTHS_SHORT[dRup.getUTCMonth()]}/${String(dRup.getUTCFullYear()).slice(-2)}`,
          aporteMensalSugerido: queimaMensal,
        }
      : { rompe: false },
  };

  return {
    UPDATED_AT: "04/mai/2026, recebido do BPO",
    periodo,
    projecao,
    OWNER: "Marco Antônio",
    REPORT_DATE_LABEL: "Relatório 04/05/2026",

    MESES_23M: Array.from({ length: WINDOW_LEN }, (_, i) => mesLabel(i)),

    receitaLeite,
    receitaCafe,
    custeioLeiteBPO,
    custeioLeitePuro,
    animalAquisicao,
    rnCaminhao,
    investLeite,
    custeioCafe,
    investCafe,
    sedeOutros,
    totalGeral,

    // Com filtro, viram os totais/categorias DO PERÍODO (dashboard mensal coerente).
    totals23m: periodTotals ?? totals23m,

    idx2024H2,
    idx2025,
    idx2026YTD,
    k2025,
    k2026YTD,

    categoriasReais: periodCategorias ?? categoriasReais,
    caixaHoje,
    inconsistencias,
  };
}
