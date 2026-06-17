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

export async function buildDashboard() {
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
        };
        catMap.set(l.categoria.id, acc);
      }
      acc.monthly[idx] += v;
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
      return {
        id: c.id,
        nome: c.nome,
        grupo: c.grupo,
        atividade: c.atividade,
        total23m: Math.round(total23m),
        ytd2026: Math.round(ytd2026),
        delta,
        flag: c.flag,
      };
    })
    .filter((c) => c.total23m > 0)
    .sort((a, b) => b.total23m - a.total23m)
    .slice(0, 12);

  // ----- caixa hoje (placeholder até termos saldo real) --------------------
  const caixaHoje = {
    total: 184_420,
    contas: [
      { nome: "Sicoob PJ — ag. 9012", saldo: 142_380 },
      { nome: "Banco do Brasil — ag. 1234-5", saldo: 38_420 },
      { nome: "Caixa da fazenda", saldo: 3_620 },
    ],
  };

  // ----- inconsistências (curadas — derivar automaticamente fica para outro PR)
  const inconsistencias = [
    // Animal Aquisição: card só enquanto pendente (Fatia 22). Carrega categoriaId
    // para os botões reais (confirmar reclassificação / reverter para custeio BPO).
    ...(animAqCls == null
      ? [{
          id: "animal-aq",
          severidade: "alta",
          categoriaId: animAqCatId,
          titulo: "“Animal Aquisição” reclassificada para investimento",
          valor: Math.round(totals23m.animalAquisicao),
          detalhe:
            "A IA reclassificou as compras de matrizes (Animal Aquisição) de Custeio para Investimento — é compra de animal vivo, não custeio do leite. Confirme para manter, ou reverta para a classificação do BPO (custeio).",
          acao: "Confirmar reclassificação",
          impacto: "Mantém o operacional do leite 2025 em −R$ 703k (real). Reverter volta para o aparente +R$ 102k do BPO.",
        }]
      : []),
    {
      id: "rn-caminhao",
      severidade: "media",
      titulo: "“RN — Caminhão e Trator” em Curral",
      valor: Math.round(totals23m.rnCaminhao),
      detalhe:
        "Lançamentos repetidos com natureza de caminhão/trator entram em Curral. Parece custeio estrutural ou financiamento — não pertence ao custeio operacional do rebanho.",
      acao: "Mover para Estrutural — Financiamentos",
      impacto: "Curral cai e a leitura do operacional do leite fica mais limpa",
    },
    {
      id: "atv-plantio",
      severidade: "media",
      titulo: "“Atividade Plantio” × “Plantio Café”",
      valor: Math.round(totals23m.receitaCafe),
      detalhe:
        "Receita de café lançada em CCusto “Atividade Plantio”. Custeio e investimento de café em CCusto “Plantio Café”. São o mesmo negócio — unificar dá leitura limpa por safra.",
      acao: "Unificar CCustos",
      impacto: "Margem café fica visível direta na DRE",
    },
    {
      id: "vazio-sede",
      severidade: "baixa",
      titulo: "Lançamentos sem CCusto",
      valor: Math.round(totals23m.sedeOutros),
      detalhe:
        "Pequenos itens (luz, água, manutenção da casa-grande) ficam em “(sem CCusto)”. Atribuir a “Outros / Estrutural” para sair da leitura de Criação Animal.",
      acao: "Alocar em Estrutural",
      impacto: "Limpa o operacional do leite",
    },
  ];

  return {
    UPDATED_AT: "04/mai/2026, recebido do BPO",
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

    totals23m,

    idx2024H2,
    idx2025,
    idx2026YTD,
    k2025,
    k2026YTD,

    categoriasReais,
    caixaHoje,
    inconsistencias,
  };
}
