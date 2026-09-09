import { Prisma, TipoCompromisso, TipoTransacaoFinanceira } from "@prisma/client";
import type { DominioDef, LinhaBase, OperadorFiltro } from "../tipos.js";

export const condEnum = (op: OperadorFiltro, valor: string | string[]) => {
  if (op === "igual") return { equals: valor as string };
  if (op === "diferente") return { not: valor as string };
  if (op === "em") return { in: valor as string[] };
  return { equals: valor as string };
};

const relNome = (linha: LinhaBase, chave: string) => ((linha[chave] as { nome?: string } | null)?.nome ?? "(não informado)");

export const financeiro: DominioDef = {
  nome: "financeiro",
  descricao: "Movimentação financeira realizada e compromissos futuros da fazenda.",
  entidades: {
    transacao: {
      descricao: "Dinheiro efetivamente movimentado; compromissos futuros não aparecem aqui.",
      modelo: "transacaoFinanceira",
      regimes: { realizado: { descricao: "transações confirmadas pela data de caixa", filtrosFixos: { status: "CONFIRMADA" }, campoData: "data" } },
      regimeDefault: "realizado",
      escopoPropriedade: (propriedadeId) => ({ propriedadeId }),
      dimensoes: {
        tipo: { descricao: "Tipo do movimento financeiro", tipo: "enum", valores: Object.values(TipoTransacaoFinanceira), cardinalidade: "baixa", operadores: ["igual", "em"], agrupavel: true, where: (op, v) => ({ tipo: condEnum(op, v) }), select: { tipo: true }, rotulo: (l) => String(l.tipo) },
        parceiro: { descricao: "Cliente, fornecedor ou outra contraparte", tipo: "texto", cardinalidade: "alta", operadores: ["igual", "contem"], agrupavel: true, where: (_op, v) => ({ parceiro: { nome: { contains: String(v), mode: "insensitive" } } }), select: { parceiro: { select: { nome: true } } }, rotulo: (l) => relNome(l, "parceiro") },
        categoria: { descricao: "Categoria gerencial da operação", tipo: "texto", cardinalidade: "baixa", operadores: ["igual", "contem"], agrupavel: true, where: (_op, v) => ({ operacao: { categoria: { nome: { contains: String(v), mode: "insensitive" } } } }), select: { operacao: { select: { categoria: { select: { nome: true } } } } }, rotulo: (l) => ((l.operacao as { categoria?: { nome?: string } } | null)?.categoria?.nome ?? "(sem categoria)") },
      },
      metricas: {
        valorTotal: { descricao: "Valor total realizado", agregacao: "soma", select: { valorTotal: true }, valor: (l) => l.valorTotal as Prisma.Decimal, formato: "reais" },
        numTransacoes: { descricao: "Quantidade de transações", agregacao: "contagem", formato: "inteiro" },
      },
    },
    compromisso: {
      descricao: "Valores futuros a pagar ou receber, sem efeito no saldo até a liquidação.",
      modelo: "compromissoFinanceiro",
      regimes: { pendentes: { descricao: "compromissos pendentes ou parciais por vencimento", filtrosFixos: { status: { in: ["PENDENTE", "PARCIAL"] } }, campoData: "dataVencimento" } },
      regimeDefault: "pendentes",
      escopoPropriedade: (propriedadeId) => ({ operacao: { propriedadeId } }),
      dimensoes: {
        tipo: { descricao: "A pagar ou a receber", tipo: "enum", valores: Object.values(TipoCompromisso), cardinalidade: "baixa", operadores: ["igual", "em"], agrupavel: true, where: (op, v) => ({ tipo: condEnum(op, v) }), select: { tipo: true }, rotulo: (l) => String(l.tipo) },
        parceiro: { descricao: "Contraparte", tipo: "texto", cardinalidade: "alta", operadores: ["igual", "contem"], agrupavel: true, where: (_op, v) => ({ parceiro: { nome: { contains: String(v), mode: "insensitive" } } }), select: { parceiro: { select: { nome: true } } }, rotulo: (l) => relNome(l, "parceiro") },
      },
      metricas: {
        valorOriginal: { descricao: "Valor originalmente comprometido", agregacao: "soma", select: { valorOriginal: true }, valor: (l) => l.valorOriginal as Prisma.Decimal, formato: "reais" },
        numCompromissos: { descricao: "Quantidade de compromissos", agregacao: "contagem", formato: "inteiro" },
      },
    },
  },
};
