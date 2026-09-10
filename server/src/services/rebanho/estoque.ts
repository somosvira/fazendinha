import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { saldoProduto, custoVacaDia, type MovIn } from "./estoque.calc.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { movimentoEstoqueSchema, type MovimentoEstoqueInput } from "@fazendinha/shared";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO" | "ORIGEM_AUTOMATICA", m: string) {
    super(m);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
export const movimentoSchema = movimentoEstoqueSchema;
export type MovimentoInput = MovimentoEstoqueInput;

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

export async function listarMovimentos(f?: { produtoId?: string; tipo?: string; propriedadeId?: number | null }) {
  const where: any = {};
  where.status = "CONFIRMADO";
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo;
  if (f?.propriedadeId) where.propriedadeId = f.propriedadeId;
  const ms = await prisma.movimentoEstoque.findMany({
    where,
    orderBy: [{ data: "desc" }, { registradoEm: "desc" }, { ordem: "asc" }],
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

  return prisma.$transaction(async (tx) => {
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
    const custo = input.custoUnitario ?? (produto.custoUnitario != null ? Number(produto.custoUnitario) : 0);
    // Decimal exato (não float) — este valor alimenta o livro financeiro real (Lancamento.valor).
    const valorTotal = new Prisma.Decimal(input.quantidade).mul(custo).toDecimalPlaces(2);
    const data = new Date(input.data);
    if (input.tipo !== "AJUSTE") {
      throw new EstoqueError("ORIGEM_AUTOMATICA", "Entradas e saídas devem nascer de uma operação financeira ou de um evento operacional; aqui só é permitido ajuste justificado de inventário");
    }
    if (await mesFechado(tx, propriedadeId, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
    const operacao = await tx.operacao.create({ data: {
      id: input.operacaoId,
      tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", data, descricao: input.observacao,
      valorTotal: valorTotal.abs(), propriedadeId,
      registradoEm: input.registradoEm,
      itens: { create: { id: input.itemOperacaoId, produtoId: produto.id, descricao: `Ajuste: ${produto.nome}`, quantidade: new Prisma.Decimal(input.quantidade).abs(), unidade: produto.unidade, valorUnitario: custo, valorTotal: valorTotal.abs(), estocavel: true } },
    }, include: { itens: true } });
    const m = await tx.movimentoEstoque.create({
      data: {
        id: input.id,
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
        registradoEm: input.registradoEm,
      },
    });

    return { id: m.id, operacaoId: operacao.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function excluirMovimento(id: string, propriedadeId: number | null = null) {
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
      observacao: "Estorno de movimento de estoque",
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
