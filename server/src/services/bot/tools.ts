// Ferramentas curadas do bot (caminho quente, formatado e seguro) + o escape
// hatch consulta_sql. Cada ferramenta tem um `spec` (formato function-calling da
// OpenAI) e um `handler(args)` que roda Prisma e devolve JSON limpo (Decimal→Number).
//
// Regime de CAIXA: agregações financeiras usam situacao=LIQUIDADO, estornado=false,
// filtrando por dataLiquidacao (ver CLAUDE.md).

import { prisma } from "../../db.js";
import { jsonSafe } from "./serialize.js";
import { rodarSqlReadonly } from "./sql-readonly.js";
import { buildDashboard } from "../dashboard.js";

type Json = Record<string, unknown>;
type Handler = (args: Json) => Promise<unknown>;
interface Tool {
  spec: { type: "function"; function: { name: string; description: string; parameters: Json } };
  handler: Handler;
}

// ---- helpers ----
const num = (d: unknown) =>
  d == null ? 0 : typeof d === "number" ? d : Number((d as { toString(): string }).toString());
const round2 = (x: number) => Math.round(x * 100) / 100;

// Estatística determinística sobre uma lista de valores (desvio padrão POPULACIONAL).
// Usada para que "média/desvio padrão mensal" dê SEMPRE o mesmo número.
function estatisticas(vals: number[]) {
  const n = vals.length;
  if (!n) return { n: 0, media: 0, desvioPadrao: 0, mediana: 0, min: 0, max: 0 };
  const media = vals.reduce((s, x) => s + x, 0) / n;
  const variancia = vals.reduce((s, x) => s + (x - media) ** 2, 0) / n;
  const ord = [...vals].sort((a, b) => a - b);
  const mediana = n % 2 ? ord[(n - 1) / 2] : (ord[n / 2 - 1] + ord[n / 2]) / 2;
  return {
    n,
    media: round2(media),
    desvioPadrao: round2(Math.sqrt(variancia)),
    mediana: round2(mediana),
    min: round2(ord[0]),
    max: round2(ord[n - 1]),
  };
}

function parseDataObrigatoria(s: unknown, campo: string): Date {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw new Error(`Parâmetro "${campo}" deve ser uma data YYYY-MM-DD.`);
  return new Date(`${s}T00:00:00.000Z`);
}
const parseDataOpcional = (s: unknown): Date | undefined =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00.000Z`) : undefined;

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Filtros reusáveis sobre Lancamento (regime de caixa). Aceita período,
// natureza e dimensões (categoria/grupo/centro de custo) por nome (contains).
// Aplica os filtros de DIMENSÃO (natureza, categoria/grupo, centro de custo,
// busca, pessoa, excluir) a um `where` que já tem situação + período.
function aplicarDimensoes(where: Record<string, unknown>, a: Json) {
  if (a.natureza === "CREDITO" || a.natureza === "DEBITO") where.natureza = a.natureza;

  const cat: Record<string, unknown> = {};
  const categoria = str(a.categoria);
  const grupo = str(a.grupo);
  if (categoria) cat.nome = { contains: categoria, mode: "insensitive" };
  if (grupo) cat.grupoCategoria = { nome: { contains: grupo, mode: "insensitive" } };
  if (Object.keys(cat).length) where.categoria = cat;

  const centroCusto = str(a.centroCusto);
  if (centroCusto) where.centroCusto = { nome: { contains: centroCusto, mode: "insensitive" } };

  // Grupos OR combinados por AND (permite busca + pessoa juntos).
  const and: Record<string, unknown>[] = [];

  // Busca tolerante por ÁREA: casa em categoria OU grupo OU centro de custo.
  // Resolve o caso de "área" (ex.: 'Pessoal') que é prefixo da categoria.
  const busca = str(a.busca);
  if (busca)
    and.push({
      OR: [
        { categoria: { nome: { contains: busca, mode: "insensitive" } } },
        { categoria: { grupoCategoria: { nome: { contains: busca, mode: "insensitive" } } } },
        { centroCusto: { nome: { contains: busca, mode: "insensitive" } } },
      ],
    });

  // Filtro por PESSOA (funcionário/fornecedor): casa no cliente/fornecedor OU na
  // descrição do lançamento. É assim que se detalha um nome citado por comparar_periodos.
  const pessoa = str(a.pessoa);
  if (pessoa)
    and.push({
      OR: [
        { clienteFornecedor: { nome: { contains: pessoa, mode: "insensitive" } } },
        { descricao: { contains: pessoa, mode: "insensitive" } },
      ],
    });

  // Exclusão por termo (NOT): para "sem a rescisão", "tirando férias", etc.
  // Exclui se o termo aparecer em categoria/grupo/centro/fornecedor/descrição.
  const excluir = str(a.excluir);
  if (excluir)
    and.push({
      NOT: {
        OR: [
          { categoria: { nome: { contains: excluir, mode: "insensitive" } } },
          { categoria: { grupoCategoria: { nome: { contains: excluir, mode: "insensitive" } } } },
          { centroCusto: { nome: { contains: excluir, mode: "insensitive" } } },
          { clienteFornecedor: { nome: { contains: excluir, mode: "insensitive" } } },
          { descricao: { contains: excluir, mode: "insensitive" } },
        ],
      },
    });

  if (and.length) where.AND = and;
  return where;
}

// Realizado (regime de caixa): situacao=LIQUIDADO, filtra por dataLiquidacao.
function whereLancamento(a: Json) {
  const where: Record<string, unknown> = { situacao: "LIQUIDADO", estornado: false };
  const de = parseDataOpcional(a.de);
  const ate = parseDataOpcional(a.ate);
  if (de || ate) where.dataLiquidacao = { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };
  return aplicarDimensoes(where, a);
}

// A vencer (projeção): situacao=ABERTO, filtra por dataVencimento.
function whereAberto(a: Json) {
  const where: Record<string, unknown> = { situacao: "ABERTO", estornado: false };
  const de = parseDataOpcional(a.de);
  const ate = parseDataOpcional(a.ate);
  if (de || ate) where.dataVencimento = { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };
  return aplicarDimensoes(where, a);
}

// Esquema real do banco (tabelas + colunas) lido do information_schema, para o
// system prompt — dá ao modelo confiança para escrever SELECTs corretos no
// consulta_sql em vez de chutar tabelas/colunas. Memoizado (schema raramente muda).
let _esquemaCache: string | null = null;
const abreviaTipo = (t: string): string => {
  if (t === "integer" || t === "smallint" || t === "bigint") return "int";
  if (t === "character varying" || t === "text" || t === "character") return "text";
  if (t === "numeric") return "num";
  if (t === "boolean") return "bool";
  if (t === "date") return "date";
  if (t.startsWith("timestamp")) return "ts";
  if (t === "USER-DEFINED") return "enum";
  if (t === "jsonb" || t === "json") return "json";
  return t;
};
export async function esquemaResumo(): Promise<string> {
  if (_esquemaCache) return _esquemaCache;
  const rows = await prisma.$queryRawUnsafe<{ table_name: string; column_name: string; data_type: string }[]>(
    `SELECT table_name, column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name NOT LIKE '\\_prisma%'
     ORDER BY table_name, ordinal_position`,
  );
  const byTable = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byTable.get(r.table_name) ?? [];
    arr.push(`${r.column_name} ${abreviaTipo(r.data_type)}`);
    byTable.set(r.table_name, arr);
  }
  _esquemaCache = [...byTable.entries()].map(([t, cols]) => `"${t}"(${cols.join(", ")})`).join("\n");
  return _esquemaCache;
}

// Resumo da taxonomia real (grupos + centros de custo) para o system prompt —
// evita o modelo adivinhar nomes errados.
export async function taxonomiaResumo(): Promise<string> {
  const [grupos, centros] = await Promise.all([
    prisma.grupoCategoria.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }),
    prisma.centroCusto.findMany({ select: { nome: true }, orderBy: { nome: "asc" } }),
  ]);
  return (
    `Grupos do plano de contas: ${grupos.map((g) => g.nome).join("; ")}. ` +
    `Centros de custo: ${centros.map((c) => c.nome).join("; ")}.`
  );
}

// Propriedades de filtro comuns, para reaproveitar nos `spec` das ferramentas.
const PROPS_FILTRO = {
  de: { type: "string", description: "Data inicial YYYY-MM-DD" },
  ate: { type: "string", description: "Data final YYYY-MM-DD" },
  busca: {
    type: "string",
    description:
      "Palavra-chave de área (ex.: 'pessoal', 'ração', 'energia'). Casa em categoria OU grupo OU centro de custo. " +
      "USE ISTO quando não tiver certeza do nome exato — é a forma mais robusta de filtrar por um assunto.",
  },
  grupo: { type: "string", description: "Filtra pelo nome EXATO de um grupo do plano de contas (veja a lista no system prompt)" },
  categoria: { type: "string", description: "Filtra por categoria (parte do nome)" },
  centroCusto: { type: "string", description: "Filtra por centro de custo, ex.: 'Leiteira', 'Café' (parte do nome)" },
  pessoa: {
    type: "string",
    description:
      "Filtra por um funcionário/fornecedor específico (parte do nome). Casa no cliente/fornecedor OU na descrição. " +
      "USE ISTO para detalhar um nome citado por comparar_periodos (ex.: 'Marcos Felipe') — NÃO use `busca` para nomes de pessoa.",
  },
  excluir: {
    type: "string",
    description:
      "EXCLUI lançamentos cujo termo aparece na categoria, grupo, centro de custo, fornecedor OU descrição. " +
      "Use para 'sem a rescisão' (excluir='rescisão'), 'tirando férias' (excluir='férias'), etc. Exclui SÓ o que casa o termo.",
  },
} as const;

const fn = (
  name: string,
  description: string,
  parameters: Json,
): Tool["spec"] => ({ type: "function", function: { name, description, parameters } });

// ============================================================================
// Financeiro
// ============================================================================

// Fonte ÚNICA dos KPIs: reusa o mesmo buildDashboard do Dashboard, então os
// números batem exatamente com a tela (exclui "(Sem centro de custo)", separa
// custeio de investimento, regime de caixa por data de liquidação).
const resumoFinanceiro: Tool = {
  spec: fn(
    "resumo_financeiro",
    "TUDO que o Dashboard mostra no período, EXATAMENTE igual à tela: receita, custeio, investimento, " +
      "fluxo líquido, caixa, as maiores CATEGORIAS de gasto (topCategorias) e a quebra por ATIVIDADE " +
      "(leite/café/outros). USE ESTA FERRAMENTA para qualquer pergunta sobre esses números — aplica as " +
      "mesmas regras do Dashboard (regime de caixa, exclui o balde '(Sem centro de custo)' de transferências/aportes, " +
      "separa custeio de investimento). Prefira-a a fluxo_caixa e a gastos_por_categoria quando a pergunta " +
      "for sobre os números do Dashboard.",
    {
      type: "object",
      properties: {
        de: { type: "string", description: "Data inicial YYYY-MM-DD" },
        ate: { type: "string", description: "Data final YYYY-MM-DD" },
      },
      required: ["de", "ate"],
    },
  ),
  handler: async (a) => {
    const de = parseDataObrigatoria(a.de, "de");
    const ate = parseDataObrigatoria(a.ate, "ate");
    const d = await buildDashboard({ from: de, to: ate });
    const t = d.totals23m; // já é do período quando há filtro
    return {
      de: a.de,
      ate: a.ate,
      receita: d.periodo?.receita ?? null,
      custeio: d.periodo?.custeio ?? null,
      investimento: d.periodo?.investimento ?? null,
      fluxo: d.periodo?.fluxo ?? null,
      caixa: d.caixaHoje.total,
      // Mesmas quebras que o Dashboard mostra (categorias e atividade do período):
      topCategorias: d.categoriasReais.map((c) => ({ categoria: c.nome, total: c.total23m, atividade: c.atividade })),
      atividades: {
        leite: { receita: t.receitaLeite, custeio: t.custeioLeitePuro, investimento: t.investLeite + t.animalAquisicao },
        cafe: { receita: t.receitaCafe, custeio: t.custeioCafe, investimento: t.investCafe },
        outros: { receita: 0, custeio: t.sedeOutros, investimento: 0 },
      },
      observacao: "Idêntico ao Dashboard: exclui '(Sem centro de custo)' e usa regime de caixa.",
    };
  },
};

const fluxoCaixa: Tool = {
  spec: fn(
    "fluxo_caixa",
    "Entradas, saídas e saldo do período (regime de caixa: lançamentos LIQUIDADOS por data de liquidação).",
    {
      type: "object",
      properties: {
        de: { type: "string", description: "Data inicial YYYY-MM-DD" },
        ate: { type: "string", description: "Data final YYYY-MM-DD" },
      },
      required: ["de", "ate"],
    },
  ),
  handler: async (a) => {
    const de = parseDataObrigatoria(a.de, "de");
    const ate = parseDataObrigatoria(a.ate, "ate");
    const where = {
      situacao: "LIQUIDADO" as const,
      estornado: false,
      dataLiquidacao: { gte: de, lte: ate },
    };
    const [cred, deb] = await Promise.all([
      prisma.lancamento.aggregate({ _sum: { valor: true }, where: { ...where, natureza: "CREDITO" } }),
      prisma.lancamento.aggregate({ _sum: { valor: true }, where: { ...where, natureza: "DEBITO" } }),
    ]);
    const entradas = num(cred._sum.valor);
    const saidas = num(deb._sum.valor);
    return { de: a.de, ate: a.ate, entradas, saidas, saldo: entradas - saidas };
  },
};

const gastosPorCategoria: Tool = {
  spec: fn(
    "gastos_por_categoria",
    "Maiores despesas agrupadas por categoria no período (débitos liquidados). " +
      "Pode filtrar por grupo do plano de contas e/ou centro de custo.",
    {
      type: "object",
      properties: {
        ...PROPS_FILTRO,
        limite: { type: "integer", description: "Quantas categorias retornar (default 10)" },
      },
      required: ["de", "ate"],
    },
  ),
  handler: async (a) => {
    const take = typeof a.limite === "number" ? a.limite : 10;
    // Exclui o balde "(Sem centro de custo)" (transferências/ajustes) p/ casar com
    // o Dashboard — mas só se o usuário NÃO filtrou por um centro específico.
    const where: Record<string, unknown> = { ...whereLancamento({ ...a, natureza: "DEBITO" }) };
    if (!where.centroCusto) where.centroCusto = { nome: { not: "(Sem centro de custo)" } };
    const grupos = await prisma.lancamento.groupBy({
      by: ["categoriaId"],
      _sum: { valor: true },
      where,
      orderBy: { _sum: { valor: "desc" } },
      take,
    });
    const cats = await prisma.categoria.findMany({
      where: { id: { in: grupos.map((g) => g.categoriaId) } },
      select: { id: true, nome: true },
    });
    const nome = new Map(cats.map((c) => [c.id, c.nome]));
    return grupos.map((g) => ({ categoria: nome.get(g.categoriaId) ?? `#${g.categoriaId}`, total: num(g._sum.valor) }));
  },
};

const saldoContas: Tool = {
  spec: fn("saldo_contas", "Saldo atual de cada conta bancária (saldo inicial + créditos - débitos liquidados).", {
    type: "object",
    properties: {},
  }),
  handler: async () => {
    const contas = await prisma.contaBancaria.findMany({ select: { id: true, nome: true, saldoInicial: true } });
    const out = [];
    for (const c of contas) {
      const [cred, deb] = await Promise.all([
        prisma.lancamento.aggregate({
          _sum: { valor: true },
          where: { contaBancariaId: c.id, situacao: "LIQUIDADO", estornado: false, natureza: "CREDITO" },
        }),
        prisma.lancamento.aggregate({
          _sum: { valor: true },
          where: { contaBancariaId: c.id, situacao: "LIQUIDADO", estornado: false, natureza: "DEBITO" },
        }),
      ]);
      out.push({ conta: c.nome, saldo: num(c.saldoInicial) + num(cred._sum.valor) - num(deb._sum.valor) });
    }
    return out;
  },
};

const serieMensal: Tool = {
  spec: fn(
    "serie_mensal",
    "Série temporal: total de entradas e saídas mês a mês no período (liquidados). Use para variação/tendência E para " +
      "ESTATÍSTICA mensal — resumo.estatisticas traz média, desvioPadrao, mediana, min e max (sobre os meses com movimento), " +
      "de forma determinística. Aceita filtros: busca, pessoa, grupo, categoria, centroCusto.",
    {
      type: "object",
      properties: { ...PROPS_FILTRO },
      required: ["de", "ate"],
    },
  ),
  handler: async (a) => {
    parseDataObrigatoria(a.de, "de");
    parseDataObrigatoria(a.ate, "ate");
    const lancs = await prisma.lancamento.findMany({
      where: whereLancamento(a),
      select: { dataLiquidacao: true, valor: true, natureza: true },
    });
    const buckets = new Map<string, { entradas: number; saidas: number }>();
    for (const l of lancs) {
      if (!l.dataLiquidacao) continue;
      const mes = l.dataLiquidacao.toISOString().slice(0, 7); // YYYY-MM
      const b = buckets.get(mes) ?? { entradas: 0, saidas: 0 };
      if (l.natureza === "CREDITO") b.entradas += num(l.valor);
      else b.saidas += num(l.valor);
      buckets.set(mes, b);
    }
    const meses = [...buckets.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([mes, b]) => ({ mes, entradas: round2(b.entradas), saidas: round2(b.saidas), saldo: round2(b.entradas - b.saidas) }));
    // resumo já calculado — evita o modelo errar média/argmax/argmin.
    const n = meses.length;
    const mediaSaidas = n ? round2(meses.reduce((s, m) => s + m.saidas, 0) / n) : 0;
    const mediaEntradas = n ? round2(meses.reduce((s, m) => s + m.entradas, 0) / n) : 0;
    const porSaidaDesc = [...meses].sort((x, y) => y.saidas - x.saidas).map((m) => ({ mes: m.mes, saidas: m.saidas }));
    const mesAtualParcial = new Date().toISOString().slice(0, 7); // YYYY-MM em curso
    return {
      meses,
      resumo: {
        numMeses: n, // meses COM movimento no período (a média/estatística é sobre eles)
        mediaSaidas,
        mediaEntradas,
        // Estatística determinística sobre os totais mensais — use ISTO para
        // média/desvio padrão/mediana, nunca calcule via SQL ad-hoc.
        estatisticas: {
          saidas: estatisticas(meses.map((m) => m.saidas)),
          entradas: estatisticas(meses.map((m) => m.entradas)),
        },
        mesMaiorSaida: porSaidaDesc[0] ?? null,
        mesMenorSaida: porSaidaDesc[porSaidaDesc.length - 1] ?? null,
        mesesPorSaidaDesc: porSaidaDesc, // ranking p/ "2º maior/menor" sem recalcular
        mesAtualParcial, // ESTE mês está incompleto — excluir ao pegar "menor"/comparar meses fechados
      },
    };
  },
};

const listarLancamentos: Tool = {
  spec: fn(
    "listar_lancamentos",
    "Lista lançamentos individuais (drill-down) com filtros de período, natureza, grupo, categoria e centro de custo. " +
      "Use quando o usuário pedir os lançamentos específicos, detalhar um pico ou auditar um valor.",
    {
      type: "object",
      properties: {
        ...PROPS_FILTRO,
        natureza: { type: "string", enum: ["CREDITO", "DEBITO"], description: "Filtra entradas ou saídas" },
        limite: { type: "integer", description: "Máximo de linhas (default 30, teto 100)" },
      },
      required: ["de", "ate"],
    },
  ),
  handler: async (a) => {
    const take = Math.min(typeof a.limite === "number" ? a.limite : 30, 100);
    const where = whereLancamento(a);
    const [lancs, agg] = await Promise.all([
      prisma.lancamento.findMany({
        where,
        orderBy: { dataLiquidacao: "desc" },
        take,
        select: {
          dataLiquidacao: true,
          valor: true,
          natureza: true,
          descricao: true,
          numeroDocumento: true,
          categoria: { select: { nome: true } },
          centroCusto: { select: { nome: true } },
          clienteFornecedor: { select: { nome: true } },
        },
      }),
      prisma.lancamento.aggregate({ where, _count: true, _sum: { valor: true } }),
    ]);
    const itens = lancs.map((l) => ({
      data: l.dataLiquidacao,
      natureza: l.natureza,
      valor: num(l.valor),
      categoria: l.categoria?.nome ?? null,
      centroCusto: l.centroCusto?.nome ?? null,
      fornecedor: l.clienteFornecedor?.nome ?? null,
      descricao: l.descricao,
      documento: l.numeroDocumento,
    }));
    // numTotal/totalValor refletem TODOS os lançamentos do filtro (não só os exibidos).
    // Para total/contagem use SEMPRE estes campos — nunca some `itens` (pode estar truncada).
    return jsonSafe({
      numTotal: agg._count,
      totalValor: num(agg._sum.valor),
      mostrando: itens.length,
      truncado: agg._count > itens.length,
      itens,
    });
  },
};

const estatisticasLancamentos: Tool = {
  spec: fn(
    "estatisticas_lancamentos",
    "Resumo DETERMINÍSTICO dos lançamentos que batem nos filtros: quantidade, TOTAL (soma) e estatística POR PAGAMENTO " +
      "(média, mediana, desvioPadrao, min, max sobre os valores individuais). Use para 'quanto X recebeu/gastou no total' " +
      "e para 'média/mediana/desvio dos pagamentos'. (Para média MENSAL use serie_mensal.) Sem período = todo o histórico.",
    {
      type: "object",
      properties: {
        de: { type: "string", description: "Data inicial YYYY-MM-DD (opcional)" },
        ate: { type: "string", description: "Data final YYYY-MM-DD (opcional)" },
        busca: PROPS_FILTRO.busca,
        pessoa: PROPS_FILTRO.pessoa,
        excluir: PROPS_FILTRO.excluir,
        grupo: PROPS_FILTRO.grupo,
        categoria: PROPS_FILTRO.categoria,
        centroCusto: PROPS_FILTRO.centroCusto,
        natureza: { type: "string", enum: ["CREDITO", "DEBITO"], description: "Filtra entradas ou saídas" },
      },
    },
  ),
  handler: async (a) => {
    const lancs = await prisma.lancamento.findMany({ where: whereLancamento(a), select: { valor: true } });
    const vals = lancs.map((l) => num(l.valor));
    const total = round2(vals.reduce((s, x) => s + x, 0));
    return { numLancamentos: vals.length, total, porPagamento: estatisticas(vals) };
  },
};

const compararPeriodos: Tool = {
  spec: fn(
    "comparar_periodos",
    "Compara DOIS períodos pagamento a pagamento, alinhando por fornecedor/funcionário + categoria. " +
      "Devolve o total de cada período, a diferença total, a diferença por item, e o que apareceu SÓ em um dos " +
      "períodos (somenteA / somenteB). Use para 'compare o mês X com o mês Y', diferença de folha entre meses, etc. " +
      "Não trunca — pega todos os lançamentos. Aceita os mesmos filtros (busca/grupo/categoria/centroCusto).",
    {
      type: "object",
      properties: {
        deA: { type: "string", description: "Início do período A (YYYY-MM-DD)" },
        ateA: { type: "string", description: "Fim do período A (YYYY-MM-DD)" },
        deB: { type: "string", description: "Início do período B (YYYY-MM-DD)" },
        ateB: { type: "string", description: "Fim do período B (YYYY-MM-DD)" },
        busca: PROPS_FILTRO.busca,
        pessoa: PROPS_FILTRO.pessoa,
        excluir: PROPS_FILTRO.excluir,
        grupo: PROPS_FILTRO.grupo,
        categoria: PROPS_FILTRO.categoria,
        centroCusto: PROPS_FILTRO.centroCusto,
        natureza: { type: "string", enum: ["CREDITO", "DEBITO"], description: "Filtra entradas ou saídas" },
      },
      required: ["deA", "ateA", "deB", "ateB"],
    },
  ),
  handler: async (a) => {
    const filtro = { busca: a.busca, pessoa: a.pessoa, excluir: a.excluir, grupo: a.grupo, categoria: a.categoria, centroCusto: a.centroCusto, natureza: a.natureza };
    const sel = {
      select: {
        valor: true,
        categoria: { select: { nome: true } },
        clienteFornecedor: { select: { nome: true } },
        descricao: true,
      },
    } as const;
    const [la, lb] = await Promise.all([
      prisma.lancamento.findMany({ where: whereLancamento({ ...filtro, de: a.deA, ate: a.ateA }), ...sel }),
      prisma.lancamento.findMany({ where: whereLancamento({ ...filtro, de: a.deB, ate: a.ateB }), ...sel }),
    ]);

    type Linha = { valor: unknown; categoria: { nome: string } | null; clienteFornecedor: { nome: string } | null; descricao: string | null };
    const agrupar = (rows: Linha[]) => {
      const m = new Map<string, { item: string; categoria: string; valor: number }>();
      let total = 0;
      for (const r of rows) {
        const categoria = r.categoria?.nome ?? "(sem categoria)";
        const item = r.clienteFornecedor?.nome ?? r.descricao ?? "(sem identificação)";
        const key = `${categoria}||${item}`;
        const cur = m.get(key) ?? { item, categoria, valor: 0 };
        cur.valor += num(r.valor);
        m.set(key, cur);
        total += num(r.valor);
      }
      return { m, total: round2(total) };
    };

    const A = agrupar(la);
    const B = agrupar(lb);
    const keys = new Set([...A.m.keys(), ...B.m.keys()]);
    const itens = [...keys].map((k) => {
      const ia = A.m.get(k);
      const ib = B.m.get(k);
      const base = (ia ?? ib)!;
      const valorA = round2(ia?.valor ?? 0);
      const valorB = round2(ib?.valor ?? 0);
      return { item: base.item, categoria: base.categoria, valorA, valorB, diff: round2(valorA - valorB) };
    });
    itens.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));

    return {
      periodoA: { de: a.deA, ate: a.ateA, total: A.total, numItens: A.m.size },
      periodoB: { de: a.deB, ate: a.ateB, total: B.total, numItens: B.m.size },
      diferencaTotal: round2(A.total - B.total),
      somenteA: itens.filter((i) => i.valorB === 0).map((i) => ({ item: i.item, categoria: i.categoria, valor: i.valorA })),
      somenteB: itens.filter((i) => i.valorA === 0).map((i) => ({ item: i.item, categoria: i.categoria, valor: i.valorB })),
      itens: itens.slice(0, 200),
    };
  },
};

const folhaPagamento: Tool = {
  spec: fn(
    "folha_pagamento",
    "Folha de SALÁRIOS de um período: lista quem recebeu salário, quanto cada um, o total e a CONTAGEM de pessoas. " +
      "Use para 'quantos funcionários temos', 'quem está na folha', 'funcionários ativos'. Sem período informado, usa o " +
      "último mês fechado. IMPORTANTE: não existe cadastro de funcionário no sistema — 'funcionário' = pessoa que recebeu salário.",
    {
      type: "object",
      properties: {
        de: { type: "string", description: "Data inicial YYYY-MM-DD (opcional; default = último mês fechado)" },
        ate: { type: "string", description: "Data final YYYY-MM-DD (opcional; default = último mês fechado)" },
      },
    },
  ),
  handler: async (a) => {
    let de = parseDataOpcional(a.de);
    let ate = parseDataOpcional(a.ate);
    if (!de || !ate) {
      const hoje = new Date();
      ate = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0)); // último dia do mês passado
      de = new Date(Date.UTC(ate.getUTCFullYear(), ate.getUTCMonth(), 1)); // primeiro dia do mês passado
    }
    const deISO = de.toISOString().slice(0, 10);
    const ateISO = ate.toISOString().slice(0, 10);
    const lancs = await prisma.lancamento.findMany({
      where: whereLancamento({ de: deISO, ate: ateISO, busca: "salário", natureza: "DEBITO" }),
      select: { valor: true, clienteFornecedor: { select: { nome: true } }, descricao: true },
    });
    const m = new Map<string, number>();
    for (const l of lancs) {
      const nome = l.clienteFornecedor?.nome ?? l.descricao ?? "(sem nome)";
      m.set(nome, (m.get(nome) ?? 0) + num(l.valor));
    }
    const funcionarios = [...m.entries()]
      .map(([nome, total]) => ({ nome, total: round2(total) }))
      .sort((x, y) => y.total - x.total);
    return {
      periodo: { de: deISO, ate: ateISO },
      numFuncionarios: funcionarios.length,
      totalSalarios: round2(funcionarios.reduce((s, f) => s + f.total, 0)),
      funcionarios,
    };
  },
};

const contasAVencer: Tool = {
  spec: fn(
    "contas_a_vencer",
    "Contas A VENCER / projeção: lançamentos ABERTO (ainda NÃO liquidados), por data de VENCIMENTO. " +
      "Use para 'quanto tenho a pagar', 'o que vence em julho', projeção de caixa. As outras ferramentas só veem o " +
      "REALIZADO (liquidado); esta é a única que enxerga o que está a vencer. Para 'a pagar' passe natureza=DEBITO.",
    {
      type: "object",
      properties: {
        de: { type: "string", description: "Vencimento inicial YYYY-MM-DD (opcional)" },
        ate: { type: "string", description: "Vencimento final YYYY-MM-DD (opcional)" },
        natureza: { type: "string", enum: ["CREDITO", "DEBITO"], description: "DEBITO = a pagar, CREDITO = a receber" },
        busca: PROPS_FILTRO.busca,
        pessoa: PROPS_FILTRO.pessoa,
        excluir: PROPS_FILTRO.excluir,
        grupo: PROPS_FILTRO.grupo,
        categoria: PROPS_FILTRO.categoria,
        centroCusto: PROPS_FILTRO.centroCusto,
      },
    },
  ),
  handler: async (a) => {
    const lancs = await prisma.lancamento.findMany({
      where: whereAberto(a),
      select: { valor: true, dataVencimento: true, descricao: true, categoria: { select: { nome: true } }, clienteFornecedor: { select: { nome: true } } },
    });
    let total = 0;
    const buckets = new Map<string, number>();
    for (const l of lancs) {
      const v = num(l.valor);
      total += v;
      const mes = l.dataVencimento.toISOString().slice(0, 7);
      buckets.set(mes, (buckets.get(mes) ?? 0) + v);
    }
    const porMes = [...buckets.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([mes, t]) => ({ mes, total: round2(t) }));
    const proximos = [...lancs]
      .sort((x, y) => x.dataVencimento.getTime() - y.dataVencimento.getTime())
      .slice(0, 20)
      .map((l) => ({
        vencimento: l.dataVencimento.toISOString().slice(0, 10),
        valor: num(l.valor),
        categoria: l.categoria?.nome ?? null,
        fornecedor: l.clienteFornecedor?.nome ?? null,
        descricao: l.descricao,
      }));
    return { numLancamentos: lancs.length, total: round2(total), porMes, proximos };
  },
};

const buscarPessoa: Tool = {
  spec: fn(
    "buscar_pessoa",
    "Resolve um nome de pessoa/fornecedor: retorna os fornecedores DISTINTOS que casam o termo, com quanto cada um já " +
      "movimentou (liquidado). Use ANTES de filtrar por pessoa quando o nome for curto/comum (ex.: 'Marcos', 'João'): se " +
      "vier mais de um, NÃO some os diferentes — pergunte qual ou separe por pessoa.",
    { type: "object", properties: { termo: { type: "string", description: "Nome ou parte do nome" } }, required: ["termo"] },
  ),
  handler: async (a) => {
    const termo = String(a.termo ?? "").trim();
    if (!termo) return { erro: "Informe um termo de busca." };
    const pessoas = await prisma.clienteFornecedor.findMany({
      where: { nome: { contains: termo, mode: "insensitive" } },
      select: { id: true, nome: true },
      take: 20,
    });
    const out = [];
    for (const p of pessoas) {
      const agg = await prisma.lancamento.aggregate({
        where: { clienteFornecedorId: p.id, situacao: "LIQUIDADO", estornado: false },
        _count: true,
        _sum: { valor: true },
      });
      out.push({ nome: p.nome, numLancamentos: agg._count, totalLiquidado: num(agg._sum.valor) });
    }
    out.sort((x, y) => y.totalLiquidado - x.totalLiquidado);
    return { termo, qtdEncontrada: out.length, pessoas: out };
  },
};

// ============================================================================
// Rebanho
// ============================================================================

const producaoLeite: Tool = {
  spec: fn("producao_leite", "Produção de leite (litros) no período, a partir dos lançamentos de produção por lote/tanque.", {
    type: "object",
    properties: {
      de: { type: "string", description: "Data inicial YYYY-MM-DD" },
      ate: { type: "string", description: "Data final YYYY-MM-DD" },
    },
    required: ["de", "ate"],
  }),
  handler: async (a) => {
    const de = parseDataObrigatoria(a.de, "de");
    const ate = parseDataObrigatoria(a.ate, "ate");
    const agg = await prisma.producaoLote.aggregate({
      _sum: { litros: true },
      _count: true,
      where: { data: { gte: de, lte: ate } },
    });
    const dias = new Set(
      (await prisma.producaoLote.findMany({ where: { data: { gte: de, lte: ate } }, select: { data: true } })).map(
        (r) => r.data.toISOString().slice(0, 10),
      ),
    ).size;
    const total = num(agg._sum.litros);
    return { de: a.de, ate: a.ate, totalLitros: total, dias, mediaDia: dias ? Math.round((total / dias) * 10) / 10 : 0 };
  },
};

const buscarAnimal: Tool = {
  spec: fn("buscar_animal", "Ficha de um animal pelo número (exato) ou parte do nome.", {
    type: "object",
    properties: { termo: { type: "string", description: "Número do brinco ou nome (ou parte)" } },
    required: ["termo"],
  }),
  handler: async (a) => {
    const termo = String(a.termo ?? "").trim();
    const animais = await prisma.animal.findMany({
      where: { OR: [{ numero: termo }, { nome: { contains: termo, mode: "insensitive" } }] },
      include: { resumo: true, grupo: { select: { nome: true } }, raca: { select: { nome: true } } },
      take: 5,
    });
    return jsonSafe(
      animais.map((an) => ({
        numero: an.numero,
        nome: an.nome,
        categoria: an.categoria,
        status: an.status,
        raca: an.raca?.nome ?? null,
        grupo: an.grupo?.nome ?? null,
        statusReprodutivo: an.resumo?.statusReprodutivo ?? null,
        del: an.resumo?.del ?? null,
        producaoMediaDia: an.resumo?.producaoMediaDia ?? null,
        ccs: an.resumo?.ccs ?? null,
        previsaoSecagem: an.resumo?.previsaoSecagem ?? null,
      })),
    );
  },
};

const alertasRebanho: Tool = {
  spec: fn(
    "alertas_rebanho",
    "Alertas do rebanho agora: vacas com CCS alto (≥400 mil), vazias atrasadas (DEL>90) e a secar nos próximos 30 dias.",
    { type: "object", properties: {} },
  ),
  handler: async () => {
    const animais = await prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } });
    const apelido = (a: (typeof animais)[number]) => `${a.nome ?? "Sem nome"} #${a.numero}`;
    const hoje = new Date();
    const lim = new Date(hoje);
    lim.setUTCDate(lim.getUTCDate() + 30);

    const ccsAlto = animais
      .filter((a) => a.resumo?.ccs != null && a.resumo.ccs >= 400)
      .map((a) => ({ animal: apelido(a), ccs: a.resumo!.ccs }));
    const vaziasAtrasadas = animais
      .filter((a) => a.resumo?.statusReprodutivo === "VAZIA" && (a.resumo?.del ?? 0) > 90)
      .map((a) => ({ animal: apelido(a), del: a.resumo!.del }));
    const aSecar = animais
      .filter((a) => a.resumo?.statusReprodutivo === "PRENHE" && a.resumo?.previsaoSecagem && a.resumo.previsaoSecagem <= lim)
      .map((a) => ({ animal: apelido(a), previsaoSecagem: a.resumo!.previsaoSecagem!.toISOString().slice(0, 10) }));

    return jsonSafe({ ccsAlto, vaziasAtrasadas, aSecar });
  },
};

const estoque: Tool = {
  spec: fn("estoque", "Saldo de estoque por produto (entradas - saídas). Opcionalmente filtra por nome do produto.", {
    type: "object",
    properties: { produto: { type: "string", description: "Nome (ou parte) do produto; vazio = todos" } },
  }),
  handler: async (a) => {
    const filtro = typeof a.produto === "string" && a.produto.trim() ? a.produto.trim() : null;
    const produtos = await prisma.produto.findMany({
      where: filtro ? { nome: { contains: filtro, mode: "insensitive" } } : { ativo: true },
      select: { id: true, nome: true, unidade: true },
      take: 50,
    });
    const out = [];
    for (const p of produtos) {
      const mov = await prisma.movimentoEstoque.groupBy({
        by: ["tipo"],
        _sum: { quantidade: true },
        where: { produtoId: p.id },
      });
      let saldo = 0;
      for (const m of mov) {
        const q = num(m._sum.quantidade);
        if (m.tipo === "ENTRADA") saldo += q;
        else if (m.tipo === "SAIDA") saldo -= q;
        else saldo += q; // AJUSTE: quantidade já vem com o sinal pretendido
      }
      out.push({ produto: p.nome, unidade: p.unidade, saldo });
    }
    return out;
  },
};

// ============================================================================
// Escape hatch: SQL read-only
// ============================================================================

const consultaSql: Tool = {
  spec: fn(
    "consulta_sql",
    "Escape hatch para perguntas não cobertas pelas outras ferramentas. Gere UM SELECT Postgres (read-only) " +
      "usando o schema da fazenda (tabelas: Lancamento, Categoria, GrupoCategoria, CentroCusto, ContaBancaria, " +
      "ClienteFornecedor, Animal, ResumoAnimal, Grupo, ProducaoLote, ControleLeiteiro, EventoReprodutivo, " +
      "EventoSanitario, Produto, MovimentoEstoque, FechamentoMensal). Nomes de tabela/coluna são case-sensitive " +
      "(use aspas duplas). Só leitura — nada de INSERT/UPDATE/DELETE. " +
      "CONVENÇÃO OBRIGATÓRIA: sempre filtre l.estornado = false (há ~1.240 estornos); para valores REALIZADOS use " +
      "l.situacao='LIQUIDADO' (por dataLiquidacao); para A VENCER use l.situacao='ABERTO' (por dataVencimento).",
    {
      type: "object",
      properties: { sql: { type: "string", description: "Um único comando SELECT (ou WITH ... SELECT)." } },
      required: ["sql"],
    },
  ),
  handler: async (a) => rodarSqlReadonly(String(a.sql ?? "")),
};

// ============================================================================
// Registro
// ============================================================================

const TOOLS: Tool[] = [
  resumoFinanceiro,
  fluxoCaixa,
  gastosPorCategoria,
  serieMensal,
  listarLancamentos,
  estatisticasLancamentos,
  compararPeriodos,
  folhaPagamento,
  contasAVencer,
  buscarPessoa,
  saldoContas,
  producaoLeite,
  buscarAnimal,
  alertasRebanho,
  estoque,
  consultaSql,
];

const byName = new Map(TOOLS.map((t) => [t.spec.function.name, t]));

export const toolSpecs = TOOLS.map((t) => t.spec);

export async function dispatchTool(name: string, args: Json): Promise<unknown> {
  const tool = byName.get(name);
  if (!tool) return { erro: `Ferramenta desconhecida: ${name}` };
  try {
    return await tool.handler(args ?? {});
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}
