import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { ratearTransacao, incluirClassificacao, ratearCategorias, ratearCompromissos } from "./classificacao.js";
import { movimentoRealizado } from "./dashboard.calc.js";
import { SEM_VINCULO } from "../../lib/ids.js";

const data = z.string({ required_error: "Informe as datas inicial e final" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida").refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida");
export const analiseCategoriasSchema = z.object({
  inicio: data, fim: data,
  base: z.enum(["compras", "pagamentos", "pendente"]).default("compras"),
  categoriaId: z.string().uuid().or(z.literal(SEM_VINCULO)).optional(),
  centroCustoId: z.string().uuid().or(z.literal(SEM_VINCULO)).optional(),
}).refine((v) => v.inicio <= v.fim, "O início deve ser anterior ao fim");
export type FiltroAnalise = z.infer<typeof analiseCategoriasSchema>;

/** Valor do filtro como id da parte: `SEM_VINCULO` casa com `null`. */
const idDoFiltro = (valor: string) => (valor === SEM_VINCULO ? null : valor);

export async function analisarCategorias(filtro: FiltroAnalise, propriedadeId: number | null) {
  if (filtro.base === "pagamentos") return analisarPagamentos(filtro, propriedadeId);
  const periodo = { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) };
  const centroFiltro = filtro.centroCustoId !== undefined ? idDoFiltro(filtro.centroCustoId) : undefined;
  const categoriaFiltro = filtro.categoriaId !== undefined ? idDoFiltro(filtro.categoriaId) : undefined;
  const operacoes = await prisma.operacao.findMany({
    where: {
      ...(propriedadeId !== null ? { propriedadeId } : {}),
      // Pré-filtro por centro: a operação entra se ela OU algum item aponta o
      // centro; a fatia certa é escolhida abaixo pelo centro efetivo da parte.
      ...(centroFiltro !== undefined ? { OR: [{ centroCustoId: centroFiltro }, { itens: { some: { centroCustoId: centroFiltro } } }] } : {}),
      tipo: { in: ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO"] },
      ...(filtro.base === "compras" ? { status: "CONFIRMADA", data: periodo }
        : { compromissos: { some: { status: { in: ["PENDENTE", "PARCIAL"] }, dataVencimento: periodo } } }),
    },
    include: { ...incluirClassificacao, centroCusto: true, transacoes: { orderBy: { seq: "asc" } }, compromissos: { include: { liquidacoes: true } } },
    orderBy: [{ data: "desc" }, { numero: "desc" }],
  });
  const linhas: { operacaoId: string | null; contaId?: string; movimentoId?: string; descricao: string | null; data: string; categoriaId: string | null; categoria: string; centroCusto: string; classificacao: string | null; valor: string }[] = [];
  for (const op of operacoes) {
    const incluir = (partes: ReturnType<typeof ratearCategorias>, data: Date) => {
      for (const p of partes) {
        if (categoriaFiltro !== undefined && p.categoriaId !== categoriaFiltro) continue;
        if (centroFiltro !== undefined && p.centroCustoId !== centroFiltro) continue;
        if (p.valor.isZero()) continue;
        linhas.push({ operacaoId: op.id, descricao: op.descricao, data: data.toISOString().slice(0, 10), categoriaId: p.categoriaId, categoria: p.categoriaNome, centroCusto: (p.centroCustoId ? p.centroCustoNome : null) ?? "Sem centro de custo", classificacao: p.classificacao, valor: p.valor.toFixed(2) });
      }
    };
    if (filtro.base === "compras") incluir(ratearCategorias(op, op.valorTotal), op.data);
    else {
      const rateios = ratearCompromissos(op);
      for (const c of op.compromissos) if (c.dataVencimento >= periodo.gte && c.dataVencimento <= periodo.lte) incluir(rateios.get(c.id) ?? [], c.dataVencimento);
    }
  }
  const categorias = new Map<string, { categoria: string; valor: Prisma.Decimal }>();
  for (const l of linhas) {
    const key = `${l.categoriaId}:${l.categoria}`;
    const c = categorias.get(key) ?? { categoria: l.categoria, valor: new Prisma.Decimal(0) };
    c.valor = c.valor.plus(l.valor); categorias.set(key, c);
  }
  return {
    base: filtro.base,
    total: linhas.reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0)).toFixed(2),
    categorias: [...categorias.values()].sort((a, b) => b.valor.comparedTo(a.valor)).map((c) => ({ ...c, valor: c.valor.toFixed(2) })),
    linhas: linhas.sort((a, b) => b.data.localeCompare(a.data)),
  };
}

/** Mesma origem e rateio do dashboard, inclusive retiradas, avulsos e estornos. */
async function analisarPagamentos(filtro: FiltroAnalise, propriedadeId: number | null) {
  const movimentos = await prisma.movimentoConta.findMany({
    where: { transacao: { ...(propriedadeId !== null ? { propriedadeId } : {}), data: { gte: new Date(`${filtro.inicio}T00:00:00Z`), lte: new Date(`${filtro.fim}T23:59:59.999Z`) } } },
    include: { transacao: { include: { reversaoDe: { select: { tipo: true } }, operacao: { include: incluirClassificacao } } } },
    orderBy: [{ transacao: { data: "desc" } }, { id: "asc" }],
  });
  const linhas = movimentos.flatMap(movimento => {
    const realizado = movimentoRealizado(movimento);
    if (!realizado || realizado.campo !== "saidas") return [];
    return ratearTransacao(movimento.transacao.operacao, movimento.transacao.id, movimento.valor)
      .filter(parte => (filtro.categoriaId === undefined || parte.categoriaId === idDoFiltro(filtro.categoriaId)) && (filtro.centroCustoId === undefined || parte.centroCustoId === idDoFiltro(filtro.centroCustoId)))
      .map(parte => ({
        operacaoId: movimento.transacao.operacaoId, contaId: movimento.contaId, movimentoId: movimento.id,
        descricao: movimento.transacao.descricao ?? movimento.transacao.operacao?.descricao ?? null,
        data: movimento.transacao.data.toISOString().slice(0, 10), categoriaId: parte.categoriaId,
        categoria: parte.categoriaNome, centroCusto: parte.centroCustoNome ?? "Sem centro de custo", classificacao: parte.classificacao,
        valor: parte.valor.abs().mul(realizado.valor.isNegative() ? -1 : 1).toFixed(2),
      })).filter(parte => !new Prisma.Decimal(parte.valor).isZero());
  });
  const categorias = new Map<string, { categoria: string; valor: Prisma.Decimal }>();
  for (const linha of linhas) {
    const chave = `${linha.categoriaId}:${linha.categoria}`;
    const categoria = categorias.get(chave) ?? { categoria: linha.categoria, valor: new Prisma.Decimal(0) };
    categoria.valor = categoria.valor.plus(linha.valor); categorias.set(chave, categoria);
  }
  return { base: filtro.base, total: linhas.reduce((total, linha) => total.plus(linha.valor), new Prisma.Decimal(0)).toFixed(2), categorias: [...categorias.values()].sort((a, b) => b.valor.comparedTo(a.valor)).map(item => ({ ...item, valor: item.valor.toFixed(2) })), linhas };
}
