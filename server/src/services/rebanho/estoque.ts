import { prisma } from "../../db.js";
import { z } from "zod";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO", m: string) {
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

export async function registrarMovimento(input: MovimentoInput) {
  const produto = await prisma.produto.findUnique({ where: { id: input.produtoId } });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
  const custo = input.custoUnitario ?? (produto.custoUnitario != null ? Number(produto.custoUnitario) : 0);
  const valorTotal = Math.round(input.quantidade * custo * 100) / 100;
  const m = await prisma.movimentoEstoque.create({
    data: {
      produtoId: input.produtoId,
      tipo: input.tipo,
      data: new Date(input.data),
      quantidade: input.quantidade,
      custoUnitario: custo,
      valorTotal,
      grupoId: input.grupoId ?? null,
      fornecedorId: input.fornecedorId ?? null,
      observacao: input.observacao,
    },
  });
  return { id: m.id };
}

export async function excluirMovimento(id: number) {
  if (!(await prisma.movimentoEstoque.findUnique({ where: { id } })))
    throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");
  await prisma.movimentoEstoque.delete({ where: { id } });
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
