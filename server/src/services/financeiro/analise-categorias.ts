import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db.js";
import { classificarFluxo, incluirClassificacao, ratearCategorias, ratearCompromissos } from "./classificacao.js";

const data = z.string({ required_error: "Informe as datas inicial e final" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data válida").refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Data inválida");
export const analiseCategoriasSchema = z.object({
  inicio: data, fim: data,
  base: z.enum(["compras", "pagamentos", "pendente"]).default("compras"),
  categoriaId: z.coerce.number().int().min(0).optional(),
  centroCustoId: z.coerce.number().int().min(0).optional(),
}).refine((v) => v.inicio <= v.fim, "O início deve ser anterior ao fim");
export type FiltroAnalise = z.infer<typeof analiseCategoriasSchema>;

export async function analisarCategorias(filtro: FiltroAnalise, propriedadeId: number | null) {
  const periodo = { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) };
  const operacoes = await prisma.operacao.findMany({
    where: {
      ...(propriedadeId !== null ? { propriedadeId } : {}),
      ...(filtro.centroCustoId !== undefined ? { centroCustoId: filtro.centroCustoId || null } : {}),
      tipo: { in: ["COMPRA_ESTOQUE", "COMPRA_CONSUMO_DIRETO", "SERVICO"] },
      ...(filtro.base === "compras" ? { status: "CONFIRMADA", data: periodo }
        : filtro.base === "pagamentos" ? { transacoes: { some: { data: periodo, tipo: { in: ["PAGAMENTO", "REVERSAO"] } } } }
        : { compromissos: { some: { status: { in: ["PENDENTE", "PARCIAL"] }, dataVencimento: periodo } } }),
    },
    include: { ...incluirClassificacao, centroCusto: true, transacoes: { orderBy: { id: "asc" } }, compromissos: { include: { liquidacoes: true } } },
    orderBy: [{ data: "desc" }, { id: "desc" }],
  });
  const linhas: { operacaoId: number | null; contaId?: number; movimentoId?: number; descricao: string | null; data: string; categoriaId: number | null; categoria: string; centroCusto: string; classificacao: string | null; valor: string }[] = [];
  for (const op of operacoes) {
    const incluir = (partes: ReturnType<typeof ratearCategorias>, data: Date) => {
      for (const p of partes) {
        if (filtro.categoriaId !== undefined && p.categoriaId !== (filtro.categoriaId || null)) continue;
        if (p.valor.isZero()) continue;
        linhas.push({ operacaoId: op.id, descricao: op.descricao, data: data.toISOString().slice(0, 10), categoriaId: p.categoriaId, categoria: p.categoriaNome, centroCusto: op.centroCusto?.nome ?? "Sem centro de custo", classificacao: p.classificacao, valor: p.valor.toFixed(2) });
      }
    };
    if (filtro.base === "compras") incluir(ratearCategorias(op, op.valorTotal), op.data);
    else if (filtro.base === "pagamentos") {
      const fluxo = classificarFluxo(op);
      for (const t of op.transacoes) if (t.data >= periodo.gte && t.data <= periodo.lte) incluir(fluxo.transacoes.get(t.id) ?? [], t.data);
    } else {
      const rateios = ratearCompromissos(op);
      for (const c of op.compromissos) if (c.dataVencimento >= periodo.gte && c.dataVencimento <= periodo.lte) incluir(rateios.get(c.id) ?? [], c.dataVencimento);
    }
  }
  // Pagamentos sem operação pertencem a "Sem categoria" e "Sem centro".
  // O livro mantém o original e a reversão, cada um na sua data de caixa.
  if (filtro.base === "pagamentos" && !filtro.categoriaId && !filtro.centroCustoId) {
    const avulsos = await prisma.movimentoConta.findMany({
      where: { transacao: {
        operacaoId: null, data: periodo,
        ...(propriedadeId !== null ? { propriedadeId } : {}),
        OR: [{ tipo: "PAGAMENTO" }, { tipo: "REVERSAO", reversaoDe: { tipo: "PAGAMENTO" } }],
      } },
      include: { transacao: true },
    });
    for (const m of avulsos) linhas.push({
      operacaoId: null, contaId: m.contaId, movimentoId: m.id,
      descricao: m.transacao.descricao, data: m.transacao.data.toISOString().slice(0, 10),
      categoriaId: null, categoria: "Sem categoria", centroCusto: "Sem centro de custo", classificacao: null,
      valor: (m.direcao === "SAIDA" ? m.valor : m.valor.negated()).toFixed(2),
    });
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
