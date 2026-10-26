import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { METODO_LEITE } from "../../estoque/leite.js";
import { RebanhoError } from "../rebanho/regras.js";

export const consultaResumoEstoqueLeiteSchema = z.object({
  propriedadeId: z.coerce.number().int().positive().max(2147483647).optional(),
  produtoId: z.string().uuid().optional(), busca: z.string().trim().max(100).default(""),
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  porPagina: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type ConsultaResumoEstoqueLeite = z.input<typeof consultaResumoEstoqueLeiteSchema>;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Recorte do razão compartilhado. Catálogo em litros, isoladamente, não identifica leite. */
export async function consultarResumoEstoqueLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, input: ConsultaResumoEstoqueLeite, verValores: boolean) {
  const filtro = consultaResumoEstoqueLeiteSchema.parse(input);
  const produtos = await tx.produto.findMany({ where: {
    ...(filtro.produtoId ? { id: filtro.produtoId } : {}),
    ...(filtro.busca ? { nome: { contains: filtro.busca, mode: "insensitive" } } : {}),
    movimentos: { some: { propriedadeId, metodoValorizacao: METODO_LEITE } },
  }, select: { id: true, nome: true, ativo: true, unidade: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], take: 2001 });
  if (produtos.length > 2000) throw new RebanhoError("VALIDACAO", "Refine a consulta: limite de dois mil produtos leiteiros");
  const ids = produtos.map(p => p.id);
  const [movimentos, entradas] = ids.length ? await Promise.all([
    tx.movimentoEstoque.groupBy({ by: ["produtoId", "tipo", "metodoValorizacao"], where: {
      produtoId: { in: ids }, propriedadeId, status: { in: ["CONFIRMADO", "REVERTIDO"] },
    }, _sum: { quantidade: true } }),
    tx.entradaProducaoLeite.findMany({ where: { status: "CONFIRMADA", movimento: {
      produtoId: { in: ids }, propriedadeId, status: "CONFIRMADO",
    } }, select: {
      movimento: { select: { produtoId: true, quantidade: true } },
      classificacoes: { orderBy: { versao: "desc" }, take: 1, select: { natureza: true } },
      apuracoes: { orderBy: { versao: "desc" }, take: 1, select: { valorTotal: true, apropriacoes: { select: { alocacaoId: true, valorTotal: true } } } },
      alocacoes: { select: { id: true, quantidade: true, valorTotal: true, movimento: { select: { status: true, reversaoDeId: true } } } },
    }, take: 50001 }),
  ]) : [[], []];
  if (entradas.length > 50000) throw new RebanhoError("VALIDACAO", "Refine a consulta: limite de 50 mil origens leiteiras");
  const porProduto = new Map<string, typeof entradas>();
  for (const entrada of entradas) { const grupo = porProduto.get(entrada.movimento.produtoId) ?? []; grupo.push(entrada); porProduto.set(entrada.movimento.produtoId, grupo); }
  const fisicos = new Map<string, Prisma.Decimal>(), outrosMetodos = new Set<string>();
  for (const m of movimentos) {
    const quantidade = m._sum.quantidade ?? D(0);
    fisicos.set(m.produtoId, (fisicos.get(m.produtoId) ?? D(0)).plus(m.tipo === "SAIDA" ? quantidade.negated() : quantidade));
    if (m.metodoValorizacao !== METODO_LEITE) outrosMetodos.add(m.produtoId);
  }
  const itens = produtos.map(produto => {
    // Mesmo FIFO e apropriação vigente do adaptador compartilhado: estornos não
    // consomem a origem e uma apropriação ausente mantém o valor desconhecido.
    const origens = (porProduto.get(produto.id) ?? []).map(e => {
      const apuracao = e.apuracoes[0];
      const consumos = e.alocacoes.filter(a => a.movimento.status === "CONFIRMADO" && !a.movimento.reversaoDeId);
      const quantidade = e.movimento.quantidade.minus(consumos.reduce((s, a) => s.plus(a.quantidade), D(0)));
      const valores = consumos.map(a => apuracao?.apropriacoes.find(p => p.alocacaoId === a.id)?.valorTotal ?? a.valorTotal);
      const valor = apuracao && valores.every(v => v != null) ? apuracao.valorTotal.minus(valores.reduce<Prisma.Decimal>((s, v) => s.plus(v!), D(0))) : null;
      return { quantidade, valor, natureza: e.classificacoes[0]?.natureza ?? "NAO_INFORMADA" };
    });
    const saldo = origens.reduce((s, o) => s.plus(o.quantidade), D(0));
    const fisico = fisicos.get(produto.id) ?? D(0);
    const confiavel = origens.length > 0 && !outrosMetodos.has(produto.id) && !fisico.isNegative() && origens.every(o => !o.quantidade.isNegative()) && fisico.eq(saldo);
    const porNatureza = (natureza: string) => confiavel ? origens.filter(o => o.natureza === natureza).reduce((s, o) => s.plus(o.quantidade), D(0)).toString() : null;
    const classificacaoPendenteLitros = confiavel ? origens.filter(o => !["COMERCIAL", "NAO_COMERCIAL", "COLOSTRO"].includes(o.natureza)).reduce((s, o) => s.plus(o.quantidade), D(0)).toString() : null;
    const custoPendente = origens.some(o => o.quantidade.gt(0) && o.valor === null);
    return { produtoId: produto.id, nome: produto.nome, ativo: produto.ativo,
      confiavel, motivoNaoAferivel: confiavel ? null : !origens.length ? "Não há produção confirmada que comprove o saldo" : "O razão físico diverge das origens confirmadas ou contém outro método de valorização",
      quantidadeLitros: confiavel ? saldo.toString() : null,
      comercial: { confiavel: confiavel && classificacaoPendenteLitros === "0", quantidadeLitros: confiavel && classificacaoPendenteLitros === "0" ? porNatureza("COMERCIAL") : null },
      descarteLitros: porNatureza("NAO_COMERCIAL"), colostroLitros: porNatureza("COLOSTRO"), classificacaoPendenteLitros,
      custoPendenteLitros: verValores && confiavel ? origens.filter(o => o.quantidade.gt(0) && o.valor === null).reduce((s, o) => s.plus(o.quantidade), D(0)).toString() : null,
      estadoValor: !verValores ? "OCULTO" as const : !confiavel || custoPendente ? "PENDENTE" as const : "APURADO" as const,
      valorTotal: verValores && confiavel && !custoPendente ? origens.reduce((s, o) => s.plus(o.valor ?? 0), D(0)).toFixed(2) : null,
    };
  });
  const confiavel = itens.length > 0 && itens.every(i => i.confiavel);
  const soma = (valores: (string | null)[], casas?: number) => {
    if (!valores.length || valores.some(v => v === null)) return null;
    const total = valores.reduce<Prisma.Decimal>((s, v) => s.plus(v!), D(0));
    return casas === undefined ? total.toString() : total.toFixed(casas);
  };
  const resumo = { confiavel, produtos: itens.length, produtosSemLastro: itens.filter(i => !i.confiavel).length,
    quantidadeLitros: soma(itens.map(i => i.quantidadeLitros)),
    comercial: { confiavel: itens.length > 0 && itens.every(i => i.comercial.confiavel), quantidadeLitros: soma(itens.map(i => i.comercial.quantidadeLitros)) },
    descarteLitros: soma(itens.map(i => i.descarteLitros)), colostroLitros: soma(itens.map(i => i.colostroLitros)),
    classificacaoPendenteLitros: soma(itens.map(i => i.classificacaoPendenteLitros)), custoPendenteLitros: soma(itens.map(i => i.custoPendenteLitros)),
    estadoValor: !verValores ? "OCULTO" : confiavel && itens.every(i => i.estadoValor === "APURADO") ? "APURADO" : "PENDENTE",
    valorTotal: soma(itens.map(i => i.valorTotal), 2),
  };
  return { propriedadeId, resumo, itens: itens.slice((filtro.pagina - 1) * filtro.porPagina, filtro.pagina * filtro.porPagina), total: itens.length, pagina: filtro.pagina, porPagina: filtro.porPagina };
}
export function consultarResumoEstoqueLeite(propriedadeId: number, input: ConsultaResumoEstoqueLeite, verValores: boolean) {
  return prisma.$transaction(tx => consultarResumoEstoqueLeiteTx(tx, propriedadeId, input, verValores), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
