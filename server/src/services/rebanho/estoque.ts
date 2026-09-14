import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";
import { auditar } from "../financeiro/regras.js";
import { propriedadePrincipalId, escopoPadraoLeitura } from "../propriedade.js";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO" | "ORIGEM_AUTOMATICA" | "CONFLITO" | "VALIDACAO", m: string) {
    super(m);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// Limites compatíveis com colunas Decimal(12,2) — evita Postgres 22003 antes de chegar ao Prisma
const MAX_QTD = 9_999_999_999.99;
const MAX_CUSTO = 9_999_999_999.99;

export const movimentoSchema = z
  .object({
    produtoId: z.number().int(),
    tipo: z.enum(["ENTRADA", "SAIDA", "AJUSTE"]),
    data: naoFutura,
    quantidade: z.number().min(-MAX_QTD, "quantidade muito alta").max(MAX_QTD, "quantidade muito alta"),
    custoUnitario: z.number().nonnegative().max(MAX_CUSTO, "custo unitário muito alto").optional(),
    grupoId: z.number().int().optional(),
    observacao: z.string().min(5, "justificativa é obrigatória").max(200),
    propriedadeId: z.number().int().optional(), // sítio (multi-propriedade)
  })
  // ENTRADA/SAIDA exigem quantidade positiva; AJUSTE aceita negativa (correção de saldo) mas nunca zero.
  .superRefine((v, ctx) => {
    if (v.quantidade === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
    else if (v.tipo !== "AJUSTE" && v.quantidade < 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade deve ser positiva", path: ["quantidade"] });
  });
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export const ajusteContagemSchema = z.object({
  produtoId: z.number().int().positive(),
  quantidadeContada: z.number().finite().min(0).max(MAX_QTD).multipleOf(0.01),
  saldoEsperado: z.number().finite().min(-MAX_QTD).max(MAX_QTD).multipleOf(0.01),
  observacao: z.string().trim().min(5, "justificativa é obrigatória").max(200),
  propriedadeId: z.number().int().positive().optional(),
});

// Setor é opcional no produto; sem setor o item conta como GERAL (insumo compartilhado).
const setorOuGeral = (s: string | null | undefined): string => s ?? "GERAL";

export async function listarSaldos(f?: { setor?: string; propriedadeId?: number | null }) {
  const produtos = await prisma.produto.findMany({
    where: { estocavel: true, ativo: true },
    orderBy: { nome: "asc" },
    // Saldo por sítio: com filtro, só os movimentos daquela propriedade contam.
    include: { movimentos: { where: { status: "CONFIRMADO", ...(f?.propriedadeId ? { propriedadeId: f.propriedadeId } : {}) } } },
  });
  const linhas = produtos.map((p) => {
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
      setor: setorOuGeral(p.setor), // null normalizado para GERAL na borda
      saldo,
      valor,
      minimoEstoque: minimo,
      abaixoMinimo: minimo != null && saldo < minimo,
    };
  });
  // Filtro por setor: GERAL casa tanto produtos GERAL quanto os sem setor (null → GERAL acima).
  return f?.setor ? linhas.filter((l) => l.setor === f.setor) : linhas;
}

export async function listarMovimentos(f?: { produtoId?: number; tipo?: string; propriedadeId?: number | null }) {
  const where: any = {};
  where.status = "CONFIRMADO";
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.propriedadeId) where.propriedadeId = f.propriedadeId;
  const ms = await prisma.movimentoEstoque.findMany({
    where,
    orderBy: { data: "desc" },
    take: 200,
    include: { produto: true, operacao: { include: { parceiro: true } }, grupo: true },
  });
  return ms.map((m) => ({
    id: m.id,
    produtoId: m.produtoId,
    produto: m.produto.nome,
    setor: setorOuGeral(m.produto.setor), // setor operacional herdado do produto
    tipo: m.tipo,
    origem: m.origem, // MANUAL | NUTRICAO | PERDA | AJUSTE_INVENTARIO
    data: iso(m.data),
    quantidade: Number(m.quantidade),
    custoUnitario: Number(m.custoUnitario),
    valorTotal: Number(m.valorTotal),
    fornecedor: m.operacao?.parceiro?.nome ?? null,
    grupo: m.grupo?.nome ?? null,
    observacao: m.observacao ?? null,
  }));
}

// Um mês está fechado quando o período financeiro da propriedade está FECHADO.
// Recebe o client da transação para que a decisão e a escrita sejam uma unidade atômica.
async function mesFechado(tx: Prisma.TransactionClient, propriedadeId: number, data: Date): Promise<boolean> {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  return (await tx.periodoFinanceiro.findUnique({ where: { propriedadeId_ano_mes: { propriedadeId, ano, mes } } }))?.status === "FECHADO";
}

export async function registrarMovimento(input: MovimentoInput) {
  const propriedadeId = input.propriedadeId ?? (await propriedadePrincipalId()); // sítio ativo ou principal

  return prisma.$transaction((tx) => registrarMovimentoTx(tx, input, propriedadeId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function registrarMovimentoTx(tx: Prisma.TransactionClient, input: MovimentoInput, propriedadeId: number, usuarioId?: number) {
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
    const custo = input.custoUnitario ?? (produto.custoUnitario != null ? Number(produto.custoUnitario) : 0);
    // Valor do ajuste físico, calculado sem arredondamento intermediário em float.
    const valorTotal = new Prisma.Decimal(input.quantidade).mul(custo).toDecimalPlaces(2);
    const data = new Date(input.data);
    if (input.tipo !== "AJUSTE") {
      throw new EstoqueError("ORIGEM_AUTOMATICA", "Entradas e saídas devem nascer de uma operação financeira ou de um evento operacional; aqui só é permitido ajuste justificado de inventário");
    }
    if (await mesFechado(tx, propriedadeId, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
    const operacao = await tx.operacao.create({ data: {
      tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", data, descricao: input.observacao,
      valorTotal: valorTotal.abs(), propriedadeId, criadoPorId: usuarioId,
      itens: { create: { produtoId: produto.id, descricao: `Ajuste: ${produto.nome}`, quantidade: new Prisma.Decimal(input.quantidade).abs(), unidade: produto.unidade, valorUnitario: custo, valorTotal: valorTotal.abs(), estocavel: true } },
    }, include: { itens: true } });
    const m = await tx.movimentoEstoque.create({
      data: {
        produtoId: input.produtoId,
        tipo: input.tipo,
        origem: "AJUSTE_INVENTARIO",
        data,
        quantidade: input.quantidade,
        custoUnitario: custo,
        valorTotal,
        grupoId: input.grupoId ?? null,
        operacaoId: operacao.id,
        itemOperacaoId: operacao.itens[0]?.id,
        propriedadeId,
        observacao: input.observacao,
        criadoPorId: usuarioId,
      },
    });

    return { id: m.id, operacaoId: operacao.id };
}

export async function ajustarContagem(input: z.infer<typeof ajusteContagemSchema> & { usuarioId?: number }) {
  const propriedadeId = input.propriedadeId ?? await escopoPadraoLeitura();
  if (propriedadeId == null) throw new EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
  try {
    return await prisma.$transaction(async tx => {
      const produto = await tx.produto.findFirst({ where: { id: input.produtoId, ativo: true, estocavel: true } });
      if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto ativo de estoque não encontrado");
      const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: input.produtoId, propriedadeId, status: "CONFIRMADO" }, select: { tipo: true, quantidade: true } });
      const saldo = movimentos.reduce((total, m) => m.tipo === "SAIDA" ? total.minus(m.quantidade) : total.plus(m.quantidade), new Prisma.Decimal(0)).toDecimalPlaces(2);
      if (!saldo.equals(input.saldoEsperado)) throw new EstoqueError("CONFLITO", "O estoque mudou desde a consulta. Atualize o saldo e confira a diferença antes de confirmar.");
      const delta = new Prisma.Decimal(input.quantidadeContada).minus(saldo);
      if (delta.isZero()) throw new EstoqueError("VALIDACAO", "A quantidade contada já corresponde ao estoque. Nenhum ajuste é necessário.");
      if (delta.abs().greaterThan(MAX_QTD)) throw new EstoqueError("VALIDACAO", "A diferença excede o limite permitido para um ajuste.");
      const resultado = await registrarMovimentoTx(tx, { produtoId: input.produtoId, tipo: "AJUSTE", quantidade: delta.toNumber(), data: iso(new Date()), observacao: input.observacao }, propriedadeId, input.usuarioId);
      await auditar(tx, { entidade: "Operacao", entidadeId: resultado.operacaoId, acao: "AJUSTE_CONTAGEM", usuarioId: input.usuarioId, motivo: input.observacao,
        antes: { produtoId: produto.id, propriedadeId, quantidade: saldo.toNumber() },
        depois: { quantidade: input.quantidadeContada, diferenca: delta.toNumber(), movimentoId: resultado.id } });
      return { ...resultado, saldoAnterior: saldo.toNumber(), quantidadeContada: input.quantidadeContada, diferenca: delta.toNumber() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new EstoqueError("CONFLITO", "O estoque mudou durante a confirmação. Atualize o saldo e tente novamente.");
    throw error;
  }
}

export async function excluirMovimento(id: number, propriedadeId: number | null = null) {
  return prisma.$transaction(async (tx) => {
    const mov = await tx.movimentoEstoque.findFirst({
      where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) },
      include: { revertidoPor: true },
    });
    if (!mov) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");

    // Saídas automáticas são geridas pelo domínio que as originou. Excluí-las
    // avulsamente deixaria o fato de origem e o saldo de estoque divergentes.
    if (mov.origem === "SANIDADE") throw new EstoqueError("ORIGEM_AUTOMATICA", "esta saída veio de um evento sanitário — exclua ou estorne o evento na ficha do animal");
    if (mov.origem === "NUTRICAO" || mov.consumoPeriodoId) throw new EstoqueError("ORIGEM_AUTOMATICA", "esta saída veio do fechamento de consumo de dieta — estorne o período na aba Nutrição, não aqui");

    if (mov.revertidoPor || mov.status === "REVERTIDO") throw new EstoqueError("ORIGEM_AUTOMATICA", "movimento já estornado");
    const pid = mov.propriedadeId ?? await propriedadePrincipalId();
    if (await mesFechado(tx, pid, new Date())) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
    await tx.movimentoEstoque.create({ data: {
      produtoId: mov.produtoId,
      tipo: mov.tipo === "ENTRADA" ? "SAIDA" : mov.tipo === "SAIDA" ? "ENTRADA" : "AJUSTE",
      origem: "AJUSTE_INVENTARIO", data: new Date(),
      quantidade: mov.tipo === "AJUSTE" ? mov.quantidade.negated() : mov.quantidade,
      custoUnitario: mov.custoUnitario, valorTotal: mov.valorTotal,
      propriedadeId: pid, operacaoId: mov.operacaoId, reversaoDeId: mov.id,
      observacao: `Estorno do movimento #${mov.id}`,
    } });
    await tx.movimentoEstoque.update({ where: { id }, data: { status: "REVERTIDO" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function calcularCustoVacaDia(periodoDias = 30, propriedadeId?: number | null) {
  const hoje = iso(new Date());
  // Por sítio: vacas e saídas filtram pela propriedade quando há escopo.
  const vacas = await prisma.animal.count({ where: { status: "ATIVO", resumo: { del: { not: null } }, ...(propriedadeId ? { propriedadeId } : {}) } });
  const limite = new Date(hoje); // meia-noite UTC do dia de hoje — alinha com a janela da função pura (inclui a data-limite)
  limite.setDate(limite.getDate() - periodoDias);
  const saidas = await prisma.movimentoEstoque.findMany({
    where: { tipo: "SAIDA", status: "CONFIRMADO", data: { gte: limite }, ...(propriedadeId ? { propriedadeId } : {}) },
    select: { valorTotal: true, data: true },
  });
  const arr = saidas.map((s) => ({ valorTotal: Number(s.valorTotal), data: iso(s.data) }));
  const custo = custoVacaDia(arr, vacas, hoje, periodoDias);
  const totalConsumo = Math.round(arr.reduce((a, s) => a + s.valorTotal, 0) * 100) / 100;
  return { periodoDias, custoVacaDia: custo, vacasEmLactacao: vacas, totalConsumo };
}
