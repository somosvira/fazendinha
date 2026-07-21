// Ferramentas curadas do bot (casos com regra de negócio própria: Dashboard,
// saldo com saldoInicial, fichas, alertas, folha). A agregação/consulta LIVRE
// vive no motor de consulta (../consulta) via tools-consulta.ts — SQL gerado
// pelo LLM foi aposentado. Cada ferramenta tem `spec` (function-calling OpenAI)
// e `handler(args, ctx)` que roda Prisma e devolve JSON limpo (Decimal→Number).
//
// Regime de CAIXA: agregações financeiras usam situacao=LIQUIDADO, estornado=false,
// filtrando por dataLiquidacao (ver CLAUDE.md).

import { prisma } from "../../db.js";
import { jsonSafe } from "./serialize.js";
import { buildDashboard } from "../dashboard.js";
import { mencaoAnimal } from "../rebanho/identificacao.js";
import type { ContextoConsulta } from "../consulta/tipos.js";
import { toolsConsulta } from "./tools-consulta.js";

export type Json = Record<string, unknown>;
// ctx = escopo resolvido POR FORA da conversa (propriedade ativa); o LLM nunca o escolhe.
type Handler = (args: Json, ctx: ContextoConsulta) => Promise<unknown>;
export interface Tool {
  spec: { type: "function"; function: { name: string; description: string; parameters: Json } };
  handler: Handler;
}

// ---- helpers ----
const num = (d: unknown) =>
  d == null ? 0 : typeof d === "number" ? d : Number((d as { toString(): string }).toString());
const round2 = (x: number) => Math.round(x * 100) / 100;

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
  handler: async (a, ctx) => {
    const de = parseDataObrigatoria(a.de, "de");
    const ate = parseDataObrigatoria(a.ate, "ate");
    const d = await buildDashboard({ from: de, to: ate, propriedadeId: ctx.propriedadeId });
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

export function formatarAnimalAlerta(animal: { numero: string; nome: string | null }): string {
  return mencaoAnimal(animal.numero, animal.nome);
}

const alertasRebanho: Tool = {
  spec: fn(
    "alertas_rebanho",
    "Alertas do rebanho agora: vacas com CCS alto (≥400 mil), vazias atrasadas (DEL>90) e a secar nos próximos 30 dias.",
    { type: "object", properties: {} },
  ),
  handler: async () => {
    const animais = await prisma.animal.findMany({ where: { status: "ATIVO" }, include: { resumo: true } });
    const hoje = new Date();
    const lim = new Date(hoje);
    lim.setUTCDate(lim.getUTCDate() + 30);

    const ccsAlto = animais
      .filter((a) => a.resumo?.ccs != null && a.resumo.ccs >= 400)
      .map((a) => ({ animal: formatarAnimalAlerta(a), ccs: a.resumo!.ccs }));
    const vaziasAtrasadas = animais
      .filter((a) => a.resumo?.statusReprodutivo === "VAZIA" && (a.resumo?.del ?? 0) > 90)
      .map((a) => ({ animal: formatarAnimalAlerta(a), del: a.resumo!.del }));
    const aSecar = animais
      .filter((a) => a.resumo?.statusReprodutivo === "PRENHE" && a.resumo?.previsaoSecagem && a.resumo.previsaoSecagem <= lim)
      .map((a) => ({ animal: formatarAnimalAlerta(a), previsaoSecagem: a.resumo!.previsaoSecagem!.toISOString().slice(0, 10) }));

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
// Registro
// ============================================================================

const TOOLS: Tool[] = [
  // Consulta estruturada (motor + registro declarativo) — caminho preferido
  // para agregação/comparação livre; as curadas específicas abaixo migram
  // gradualmente para cima dele.
  ...toolsConsulta,
  resumoFinanceiro,
  listarLancamentos,
  folhaPagamento,
  buscarPessoa,
  saldoContas,
  buscarAnimal,
  alertasRebanho,
  estoque,
];

const byName = new Map(TOOLS.map((t) => [t.spec.function.name, t]));

export const toolSpecs = TOOLS.map((t) => t.spec);

export async function dispatchTool(
  name: string,
  args: Json,
  ctx: ContextoConsulta = { propriedadeId: null },
): Promise<unknown> {
  const tool = byName.get(name);
  if (!tool) return { erro: `Ferramenta desconhecida: ${name}` };
  try {
    return await tool.handler(args ?? {}, ctx);
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    // Log de operação: mostra o que o modelo pediu e por que foi rejeitado
    // (essencial para diagnosticar quando o bot "não consegue" responder).
    console.error(`[bot] ${name} erro: ${erro} | args: ${JSON.stringify(args)}`);
    return { erro };
  }
}
