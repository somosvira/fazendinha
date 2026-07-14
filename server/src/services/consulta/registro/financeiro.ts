// Registro declarativo do domínio FINANCEIRO para o motor de consulta da IA.
// Modelado contra o schema real (Lancamento + dimensões) — não inventar campos.
//
// Regime default = regime de caixa do Dashboard: LIQUIDADO + estornado=false por
// dataLiquidacao (LIQUIDADO_PARCIAL fica fora, idêntico ao comportamento das
// ferramentas curadas atuais). Custeio×investimento (Categoria.classificacao)
// NÃO é modelado aqui de propósito — a derivação com nulls vive em
// buildDashboard e a ferramenta resumo_financeiro segue canônica para a tela.

import { Natureza, Prisma } from "@prisma/client";
import type { DominioDef, LinhaBase, OperadorFiltro } from "../tipos.js";

// Condição Prisma para colunas de texto (case-insensitive).
const condTexto = (op: OperadorFiltro, valor: string | string[]): Record<string, unknown> => {
  switch (op) {
    case "igual":
      return { equals: valor as string, mode: "insensitive" };
    case "diferente":
      return { not: { equals: valor as string }, mode: "insensitive" };
    case "contem":
      return { contains: valor as string, mode: "insensitive" };
    case "em":
      return { in: valor as string[], mode: "insensitive" };
  }
};

// Condição Prisma para enums (a validação já barrou operadores/valores inválidos).
export const condEnum = (op: OperadorFiltro, valor: string | string[]): unknown => {
  switch (op) {
    case "igual":
      return valor as string;
    case "diferente":
      return { not: valor as string };
    case "em":
      return { in: valor as string[] };
    default:
      throw new Error(`Operador '${op}' não se aplica a enum.`);
  }
};

type Rel = { nome?: string | null } | null | undefined;
const nomeDe = (rel: Rel, vazio: string): string => rel?.nome ?? vazio;

const asValor = (l: LinhaBase) => (l.valor as Prisma.Decimal | null) ?? null;

export const financeiro: DominioDef = {
  nome: "financeiro",
  descricao: "Lançamentos financeiros da fazenda (regime de caixa).",
  entidades: {
    lancamento: {
      descricao:
        "Lançamento financeiro individual (crédito=entrada, débito=saída; valor sempre positivo, o sinal vem da natureza).",
      modelo: "lancamento",
      regimes: {
        realizado: {
          descricao: "REALIZADO (regime de caixa): liquidados, por data de liquidação",
          filtrosFixos: { situacao: "LIQUIDADO", estornado: false },
          campoData: "dataLiquidacao",
        },
        a_vencer: {
          descricao: "A VENCER (projeção): em aberto, por data de vencimento",
          filtrosFixos: { situacao: "ABERTO", estornado: false },
          campoData: "dataVencimento",
        },
      },
      regimeDefault: "realizado",
      escopoPropriedade: (propriedadeId) => ({ propriedadeId }),
      dimensoes: {
        natureza: {
          descricao: "CREDITO = entrada/receita; DEBITO = saída/despesa",
          tipo: "enum",
          valores: Object.values(Natureza),
          cardinalidade: "baixa",
          operadores: ["igual", "em"],
          agrupavel: true,
          where: (op, v) => ({ natureza: condEnum(op, v) }),
          select: { natureza: true },
          rotulo: (l) => String(l.natureza),
        },
        categoria: {
          descricao: "Categoria do plano de contas (ex.: 'Pessoal - Salário')",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ categoria: { nome: condTexto(op, v) } }),
          select: { categoria: { select: { nome: true } } },
          rotulo: (l) => nomeDe(l.categoria as Rel, "(sem categoria)"),
        },
        grupoCategoria: {
          descricao: "Grupo do plano de contas (nível acima da categoria)",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ categoria: { grupoCategoria: { nome: condTexto(op, v) } } }),
          select: { categoria: { select: { grupoCategoria: { select: { nome: true } } } } },
          rotulo: (l) =>
            nomeDe((l.categoria as { grupoCategoria?: Rel } | null)?.grupoCategoria, "(sem grupo)"),
        },
        centroCusto: {
          descricao: "Centro de custo / atividade (ex.: 'Leiteira', 'Café')",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ centroCusto: { nome: condTexto(op, v) } }),
          select: { centroCusto: { select: { nome: true } } },
          rotulo: (l) => nomeDe(l.centroCusto as Rel, "(sem centro de custo)"),
        },
        contaBancaria: {
          descricao: "Conta bancária do lançamento",
          tipo: "texto",
          cardinalidade: "baixa",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ contaBancaria: { nome: condTexto(op, v) } }),
          select: { contaBancaria: { select: { nome: true } } },
          rotulo: (l) => nomeDe(l.contaBancaria as Rel, "(sem conta)"),
        },
        clienteFornecedor: {
          descricao: "Cliente/fornecedor/funcionário do lançamento (muitos valores — agrupamento sai top-N)",
          tipo: "texto",
          cardinalidade: "alta",
          operadores: ["igual", "diferente", "contem", "em"],
          agrupavel: true,
          where: (op, v) => ({ clienteFornecedor: { nome: condTexto(op, v) } }),
          select: { clienteFornecedor: { select: { nome: true } } },
          rotulo: (l) => nomeDe(l.clienteFornecedor as Rel, "(sem fornecedor)"),
        },
        descricao: {
          descricao: "Texto livre do lançamento (só filtro 'contem')",
          tipo: "texto",
          cardinalidade: "alta",
          operadores: ["contem"],
          agrupavel: false,
          where: (op, v) => ({ descricao: condTexto(op, v) }),
        },
        // Virtuais só-filtro — mesma semântica OR tolerante das ferramentas curadas.
        busca: {
          descricao:
            "Busca tolerante por ÁREA/assunto (ex.: 'pessoal', 'ração'): casa em categoria OU grupo OU centro de custo. Use quando não souber o nome exato.",
          tipo: "texto",
          cardinalidade: "alta",
          operadores: ["contem"],
          agrupavel: false,
          where: (_op, v) => ({
            OR: [
              { categoria: { nome: { contains: v as string, mode: "insensitive" } } },
              { categoria: { grupoCategoria: { nome: { contains: v as string, mode: "insensitive" } } } },
              { centroCusto: { nome: { contains: v as string, mode: "insensitive" } } },
            ],
          }),
        },
        pessoa: {
          descricao:
            "Filtro por pessoa (funcionário/fornecedor, parte do nome): casa no cliente/fornecedor OU na descrição. NÃO use 'busca' para nomes de pessoa.",
          tipo: "texto",
          cardinalidade: "alta",
          operadores: ["contem"],
          agrupavel: false,
          where: (_op, v) => ({
            OR: [
              { clienteFornecedor: { nome: { contains: v as string, mode: "insensitive" } } },
              { descricao: { contains: v as string, mode: "insensitive" } },
            ],
          }),
        },
      },
      metricas: {
        valorTotal: {
          descricao: "Soma dos valores (R$)",
          agregacao: "soma",
          select: { valor: true },
          valor: asValor,
          formato: "reais",
        },
        numLancamentos: {
          descricao: "Quantidade de lançamentos",
          agregacao: "contagem",
          formato: "inteiro",
        },
        valorMedio: {
          descricao: "Valor médio POR LANÇAMENTO (R$)",
          agregacao: "media",
          select: { valor: true },
          valor: asValor,
          formato: "reais",
        },
        valorMin: {
          descricao: "Menor valor individual (R$)",
          agregacao: "min",
          select: { valor: true },
          valor: asValor,
          formato: "reais",
        },
        valorMax: {
          descricao: "Maior valor individual (R$)",
          agregacao: "max",
          select: { valor: true },
          valor: asValor,
          formato: "reais",
        },
      },
    },
  },
  razoes: {
    custoPorLitro: {
      descricao:
        "Custo por litro de leite (R$/L): débitos realizados ÷ litros produzidos no MESMO período. Aceita filtros (centroCusto/grupoCategoria/categoria/busca) para recortar o custo. Granularidade: total ou mes.",
      numerador: {
        dominio: "financeiro",
        entidade: "lancamento",
        regime: "realizado",
        metrica: "valorTotal",
        filtrosFixos: [{ dimensao: "natureza", operador: "igual", valor: "DEBITO" }],
        aceitaFiltros: ["centroCusto", "grupoCategoria", "categoria", "busca"],
      },
      denominador: { dominio: "rebanho", entidade: "producao_lote", metrica: "litrosTotal" },
      formato: "reais",
      granularidades: ["total", "mes"],
    },
    receitaPorLitro: {
      descricao:
        "Receita por litro de leite (R$/L): créditos realizados ÷ litros produzidos no MESMO período. Aceita os mesmos filtros do custoPorLitro.",
      numerador: {
        dominio: "financeiro",
        entidade: "lancamento",
        regime: "realizado",
        metrica: "valorTotal",
        filtrosFixos: [{ dimensao: "natureza", operador: "igual", valor: "CREDITO" }],
        aceitaFiltros: ["centroCusto", "grupoCategoria", "categoria", "busca"],
      },
      denominador: { dominio: "rebanho", entidade: "producao_lote", metrica: "litrosTotal" },
      formato: "reais",
      granularidades: ["total", "mes"],
    },
  },
};
