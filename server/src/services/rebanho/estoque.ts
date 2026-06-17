import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";
import { resolverLancamentoDaEntrada } from "./ponte.calc.js";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO", m: string) {
    super(m);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

export const movimentoSchema = z
  .object({
    produtoId: z.number().int(),
    tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
    data: naoFutura,
    quantidade: z.number(),
    custoUnitario: z.number().nonnegative().optional(),
    grupoId: z.number().int().optional(),
    fornecedorId: z.number().int().optional(),
    observacao: z.string().max(200).optional(),
    // Ponte compra→financeiro (só ENTRADA): gerar Lancamento e com qual mapeamento contábil.
    gerarLancamento: z.boolean().optional(),
    categoriaId: z.number().int().optional(),
    centroCustoId: z.number().int().optional(),
  })
  // ENTRADA/SAIDA exigem quantidade positiva; AJUSTE aceita negativa (correção de saldo) mas nunca zero.
  .superRefine((v, ctx) => {
    if (v.quantidade === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
    else if (v.tipo !== "AJUSTE" && v.quantidade < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade deve ser positiva", path: ["quantidade"] });
  });
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export async function listarSaldos() {
  const produtos = await prisma.produto.findMany({
    where: { estocavel: true, ativo: true },
    orderBy: { nome: "asc" },
    include: { movimentos: true },
  });
  return produtos.map((p) => {
    const movs: MovIn[] = p.movimentos.map((m) => ({
      tipo: m.tipo,
      quantidade: Number(m.quantidade),
      valorTotal: Number(m.valorTotal),
      data: iso(m.data),
    }));
    const { saldo, valor } = saldoProduto(movs);
    const minimo = p.minimoEstoque != null ? Number(p.minimoEstoque) : null;
    return {
      produtoId: p.id,
      nome: p.nome,
      tipo: p.tipo,
      unidade: p.unidade,
      saldo,
      valor,
      minimoEstoque: minimo,
      abaixoMinimo: minimo != null && saldo < minimo,
    };
  });
}

export async function listarMovimentos(f?: { produtoId?: number; tipo?: string }) {
  const where: any = {};
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo;
  const ms = await prisma.movimentoEstoque.findMany({
    where,
    orderBy: { data: "desc" },
    take: 200,
    include: { produto: true, fornecedor: true, grupo: true },
  });
  return ms.map((m) => ({
    id: m.id,
    produtoId: m.produtoId,
    produto: m.produto.nome,
    tipo: m.tipo,
    data: iso(m.data),
    quantidade: Number(m.quantidade),
    custoUnitario: Number(m.custoUnitario),
    valorTotal: Number(m.valorTotal),
    fornecedor: m.fornecedor?.nome ?? null,
    grupo: m.grupo?.nome ?? null,
    observacao: m.observacao ?? null,
  }));
}

// Um mês (ano/mes 1-12) está fechado se existe FechamentoMensal correspondente.
async function mesFechado(data: Date): Promise<boolean> {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  return (await prisma.fechamentoMensal.findFirst({ where: { ano, mes } })) != null;
}

export async function registrarMovimento(input: MovimentoInput) {
  const produto = await prisma.produto.findUnique({ where: { id: input.produtoId } });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
  const custo = input.custoUnitario ?? (produto.custoUnitario != null ? Number(produto.custoUnitario) : 0);
  // Decimal exato (não float) — este valor alimenta o livro financeiro real (Lancamento.valor).
  const valorTotal = new Prisma.Decimal(input.quantidade).mul(custo).toDecimalPlaces(2);
  const data = new Date(input.data);
  const m = await prisma.movimentoEstoque.create({
    data: {
      produtoId: input.produtoId,
      tipo: input.tipo,
      data,
      quantidade: input.quantidade,
      custoUnitario: custo,
      valorTotal,
      grupoId: input.grupoId ?? null,
      fornecedorId: input.fornecedorId ?? null,
      observacao: input.observacao,
    },
  });

  // Ponte compra→financeiro: ENTRADA pode gerar um Lancamento (DEBITO/LIQUIDADO).
  // Nunca bloqueia o movimento — se não dá para criar, devolve o motivo.
  const resol = resolverLancamentoDaEntrada({
    tipo: input.tipo,
    gerarLancamento: input.gerarLancamento,
    inputCategoriaId: input.categoriaId,
    inputCentroCustoId: input.centroCustoId,
    produtoCategoriaId: produto.categoriaId,
    produtoCentroCustoId: produto.centroCustoId,
    mesFechado: input.tipo === "ENTRADA" ? await mesFechado(data) : false,
  });

  if (!resol.deveCriar) return { id: m.id, lancamentoCriado: false, motivo: resol.motivo };

  const lanc = await prisma.lancamento.create({
    data: {
      natureza: "DEBITO",
      valor: valorTotal,
      dataCompetencia: data,
      dataVencimento: data,
      dataLiquidacao: data,
      situacao: "LIQUIDADO",
      categoriaId: resol.categoriaId!,
      centroCustoId: resol.centroCustoId!,
      clienteFornecedorId: input.fornecedorId ?? null,
      descricao: `Compra: ${produto.nome} (${input.quantidade} ${produto.unidade})`,
    },
  });
  await prisma.movimentoEstoque.update({ where: { id: m.id }, data: { lancamentoId: lanc.id } });
  return { id: m.id, lancamentoCriado: true, lancamentoId: lanc.id };
}

export async function excluirMovimento(id: number) {
  const mov = await prisma.movimentoEstoque.findUnique({
    where: { id },
    include: { lancamento: true },
  });
  if (!mov) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");

  // Se há um Lancamento vinculado num mês fechado, não exclui nada.
  if (mov.lancamento) {
    const ref = mov.lancamento.dataLiquidacao ?? mov.lancamento.dataCompetencia;
    if (await mesFechado(ref)) throw new EstoqueError("MES_FECHADO", "lançamento em mês fechado — não pode ser excluído");
  }

  // O movimento referencia o lançamento (FK em MovimentoEstoque.lancamentoId);
  // exclui o movimento primeiro, depois o lançamento.
  await prisma.movimentoEstoque.delete({ where: { id } });
  if (mov.lancamentoId) await prisma.lancamento.delete({ where: { id: mov.lancamentoId } });
}

export async function calcularCustoVacaDia(periodoDias = 30) {
  const hoje = iso(new Date());
  const vacas = await prisma.animal.count({ where: { status: "ATIVO", resumo: { del: { not: null } } } });
  const limite = new Date(hoje); // meia-noite UTC do dia de hoje — alinha com a janela da função pura (inclui a data-limite)
  limite.setDate(limite.getDate() - periodoDias);
  const saidas = await prisma.movimentoEstoque.findMany({
    where: { tipo: "SAIDA", data: { gte: limite } },
    select: { valorTotal: true, data: true },
  });
  const arr = saidas.map((s) => ({ valorTotal: Number(s.valorTotal), data: iso(s.data) }));
  const custo = custoVacaDia(arr, vacas, hoje, periodoDias);
  const totalConsumo = Math.round(arr.reduce((a, s) => a + s.valorTotal, 0) * 100) / 100;
  return { periodoDias, custoVacaDia: custo, vacasEmLactacao: vacas, totalConsumo };
}
