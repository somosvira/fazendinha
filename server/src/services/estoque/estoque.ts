import { prisma } from "../../db.js";
import { Prisma, type TipoMovimento } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, custoVacaDia, custoMedioProduto, ORIGENS_CUSTO_MEDIO, type MovIn } from "./estoque.calc.js";
import { auditar } from "../financeiro/regras.js";
import { propriedadePrincipalId, escopoPadraoLeitura } from "../propriedade.js";
import { resolverCentroSaida } from "./centro.calc.js";
import { rotuloUnidade } from "./unidades.js";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO" | "ORIGEM_AUTOMATICA" | "CONFLITO" | "VALIDACAO", m: string) {
    super(m);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
// O original e seu movimento inverso se anulam no razão físico.
export const statusSaldoEstoque: Prisma.EnumStatusMovimentoEstoqueFilter = { in: ["CONFIRMADO", "REVERTIDO"] };
export const saidaConsumoConfirmada = {
  tipo: "SAIDA",
  status: "CONFIRMADO",
  reversaoDeId: null,
} satisfies Prisma.MovimentoEstoqueWhereInput;
const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// Limites compatíveis com colunas Decimal(12,2) — evita Postgres 22003 antes de chegar ao Prisma
const MAX_QTD = 9_999_999_999.99;
const MAX_CUSTO = 9_999_999_999.99;

export const movimentoSchema = z
  .object({
    produtoId: z.number().int(),
    // Entradas e saídas nascem de operações financeiras ou eventos operacionais; aqui só ajuste de inventário.
    tipo: z.literal("AJUSTE"),
    data: naoFutura,
    quantidade: z.number().min(-MAX_QTD, "quantidade muito alta").max(MAX_QTD, "quantidade muito alta"),
    custoUnitario: z.number().nonnegative().max(MAX_CUSTO, "custo unitário muito alto").optional(),
    grupoId: z.number().int().optional(),
    observacao: z.string().min(5, "justificativa é obrigatória").max(200),
    propriedadeId: z.number().int().optional(), // sítio (multi-propriedade)
    centroCustoId: z.number().int().positive().nullable().optional(),
  })
  // AJUSTE aceita negativa (correção de saldo) mas nunca zero.
  .superRefine((v, ctx) => {
    if (v.quantidade === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
  });
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export const ajusteContagemSchema = z.object({
  produtoId: z.number().int().positive(),
  quantidadeContada: z.number().finite().min(0).max(MAX_QTD).multipleOf(0.01),
  saldoEsperado: z.number().finite().min(-MAX_QTD).max(MAX_QTD).multipleOf(0.01),
  observacao: z.string().trim().min(5, "justificativa é obrigatória").max(200),
  propriedadeId: z.number().int().positive().optional(),
  centroCustoId: z.number().int().positive().nullable().optional(),
});

type DbCusto = Pick<Prisma.TransactionClient, "movimentoEstoque">;

// Escopo de sítio do custo médio: movimento sem propriedade pertence à principal
// (mesma convenção do resto do estoque). null = consolidado (todas as propriedades).
async function filtroSitioCusto(propriedadeId: number | null): Promise<Prisma.MovimentoEstoqueWhereInput> {
  if (propriedadeId == null) return {};
  const principal = await propriedadePrincipalId();
  return propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
}

/**
 * Custo médio ponderado por produto num sítio, em uma única query. Produtos sem
 * base valorizada ficam fora do mapa (o chamador trata como null).
 */
export async function obterCustosMedios(db: DbCusto, produtoIds: number[], propriedadeId: number | null): Promise<Map<number, Prisma.Decimal>> {
  const ids = [...new Set(produtoIds)];
  const resultado = new Map<number, Prisma.Decimal>();
  if (ids.length === 0) return resultado;
  const movimentos = await db.movimentoEstoque.findMany({
    where: {
      produtoId: { in: ids },
      status: "CONFIRMADO",
      reversaoDeId: null,
      AND: [
        await filtroSitioCusto(propriedadeId),
        { OR: [
          { tipo: "ENTRADA", origem: { in: [...ORIGENS_CUSTO_MEDIO] } },
          { tipo: "AJUSTE", quantidade: { gt: 0 }, valorTotal: { gt: 0 } },
        ] },
      ],
    },
    select: { produtoId: true, tipo: true, origem: true, status: true, reversaoDeId: true, quantidade: true, valorTotal: true },
  });
  const porProduto = new Map<number, typeof movimentos>();
  for (const m of movimentos) {
    const lista = porProduto.get(m.produtoId) ?? [];
    lista.push(m);
    porProduto.set(m.produtoId, lista);
  }
  for (const [produtoId, lista] of porProduto) {
    const { custoMedio } = custoMedioProduto(lista);
    if (custoMedio != null) resultado.set(produtoId, custoMedio);
  }
  return resultado;
}

export async function obterCustoMedio(db: DbCusto, produtoId: number, propriedadeId: number | null): Promise<Prisma.Decimal | null> {
  return (await obterCustosMedios(db, [produtoId], propriedadeId)).get(produtoId) ?? null;
}

const USO_CAMPO = { sanitario: "usoSanitario", nutricional: "usoNutricional", agricola: "usoAgricola" } as const;

export async function listarSaldos(f?: { centroCustoId?: number; propriedadeId?: number | null; uso?: "sanitario" | "nutricional" | "agricola" }) {
  const produtos = await prisma.produto.findMany({
    where: { estocavel: true, ativo: true, ...(f?.uso ? { categoria: { [USO_CAMPO[f.uso]]: true } } : {}) },
    orderBy: { nome: "asc" },
    // Saldo por sítio: com filtro, só os movimentos daquela propriedade contam.
    include: {
      movimentos: { where: { status: statusSaldoEstoque, ...(f?.propriedadeId ? { propriedadeId: f.propriedadeId } : {}) } },
      centrosCusto: { include: { centroCusto: true } },
      categoria: true,
    },
  });
  const custos = await obterCustosMedios(prisma, produtos.map((p) => p.id), f?.propriedadeId ?? null);
  const linhas = produtos.map((p) => {
    const movs: MovIn[] = p.movimentos.map((m) => ({
      tipo: m.tipo,
      quantidade: Number(m.quantidade),
      valorTotal: Number(m.valorTotal),
      data: iso(m.data),
    }));
    const { saldo } = saldoProduto(movs);
    const custo = custos.get(p.id) ?? null;
    // Valor do estoque = saldo físico × custo médio das entradas do sítio.
    const valor = custo == null ? 0 : new Prisma.Decimal(saldo).mul(custo).toDecimalPlaces(2).toNumber();
    const minimo = p.minimoEstoque != null ? Number(p.minimoEstoque) : null;
    return {
      produtoId: p.id,
      nome: p.nome,
      categoria: p.categoria
        ? { id: p.categoria.id, nome: p.categoria.nome, usoSanitario: p.categoria.usoSanitario, usoNutricional: p.categoria.usoNutricional, usoAgricola: p.categoria.usoAgricola }
        : null,
      unidade: p.unidade,
      centrosCusto: p.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome })),
      saldo,
      custoMedio: custo == null ? null : custo.toNumber(),
      valor,
      minimoEstoque: minimo,
      abaixoMinimo: minimo != null && saldo < minimo,
    };
  });
  if (f?.centroCustoId === 0) return linhas.filter((l) => l.centrosCusto.length === 0);
  if (f?.centroCustoId) return linhas.filter((l) => l.centrosCusto.some((cc) => cc.id === f.centroCustoId));
  return linhas;
}

export async function listarMovimentos(f?: { produtoId?: number; tipo?: string; propriedadeId?: number | null }) {
  const where: Prisma.MovimentoEstoqueWhereInput = {};
  where.status = statusSaldoEstoque;
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo as TipoMovimento;
  if (f?.propriedadeId) where.propriedadeId = f.propriedadeId;
  const ms = await prisma.movimentoEstoque.findMany({
    where,
    orderBy: { data: "desc" },
    take: 200,
    include: { produto: { include: { centrosCusto: { include: { centroCusto: true } } } }, operacao: { include: { parceiro: true } }, grupo: true },
  });
  return ms.map((m) => ({
    id: m.id,
    produtoId: m.produtoId,
    produto: m.produto.nome,
    centrosCusto: m.produto.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome })),
    tipo: m.tipo,
    origem: m.origem, // COMPRA | CONSUMO_DIRETO | TRANSFERENCIA | PRODUCAO | DEVOLUCAO | BONIFICACAO | INVENTARIO_INICIAL | NUTRICAO | SANIDADE | APLICACAO | PERDA | AJUSTE_INVENTARIO
    status: m.status,
    reversaoDeId: m.reversaoDeId,
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

export async function registrarMovimento(input: MovimentoInput & { usuarioId?: number | null }) {
  const propriedadeId = input.propriedadeId ?? (await propriedadePrincipalId()); // sítio ativo ou principal

  return prisma.$transaction(async (tx) => {
    const resultado = await registrarMovimentoTx(tx, input, propriedadeId, input.usuarioId);
    await auditar(tx, { entidade: "Operacao", entidadeId: resultado.operacaoId, acao: "AJUSTE_MANUAL", usuarioId: input.usuarioId, motivo: input.observacao,
      depois: { produtoId: input.produtoId, propriedadeId, quantidade: input.quantidade, data: input.data, centroCustoId: input.centroCustoId ?? null, movimentoId: resultado.id } });
    return resultado;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function registrarMovimentoTx(tx: Prisma.TransactionClient, input: MovimentoInput, propriedadeId: number, usuarioId?: number | null) {
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId }, include: { centrosCusto: { select: { centroCustoId: true } } } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
    if (input.centroCustoId != null && !(await tx.centroCusto.findFirst({ where: { id: input.centroCustoId, ativo: true } }))) throw new EstoqueError("NAO_ENCONTRADO", "centro de custo não encontrado");
    const centroCustoId = resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: input.centroCustoId });
    // Sem custo informado, o ajuste é valorizado pelo custo médio do sítio.
    const custo = input.custoUnitario != null ? new Prisma.Decimal(input.custoUnitario) : (await obterCustoMedio(tx, produto.id, propriedadeId)) ?? new Prisma.Decimal(0);
    // Valor do ajuste físico, calculado sem arredondamento intermediário em float.
    const valorTotal = new Prisma.Decimal(input.quantidade).mul(custo).toDecimalPlaces(2);
    const data = new Date(input.data);
    if (input.tipo !== "AJUSTE") {
      throw new EstoqueError("ORIGEM_AUTOMATICA", "Entradas e saídas devem nascer de uma operação financeira ou de um evento operacional; aqui só é permitido ajuste justificado de inventário");
    }
    if (await mesFechado(tx, propriedadeId, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
    const operacao = await tx.operacao.create({ data: {
      tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", data, descricao: input.observacao,
      valorTotal: valorTotal.abs(), propriedadeId, criadoPorId: usuarioId ?? null,
      itens: { create: { produtoId: produto.id, descricao: `Ajuste: ${produto.nome}`, quantidade: new Prisma.Decimal(input.quantidade).abs(), unidade: rotuloUnidade(produto.unidade), valorUnitario: custo, valorTotal: valorTotal.abs(), estocavel: true } },
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
        centroCustoId,
        observacao: input.observacao,
        criadoPorId: usuarioId ?? null,
      },
    });

    return { id: m.id, operacaoId: operacao.id };
}

export async function ajustarContagem(input: z.infer<typeof ajusteContagemSchema> & { usuarioId?: number | null }) {
  const propriedadeId = input.propriedadeId ?? await escopoPadraoLeitura();
  if (propriedadeId == null) throw new EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
  try {
    return await prisma.$transaction(async tx => {
      const produto = await tx.produto.findFirst({ where: { id: input.produtoId, ativo: true, estocavel: true } });
      if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto ativo de estoque não encontrado");
      const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: input.produtoId, propriedadeId, status: statusSaldoEstoque }, select: { tipo: true, quantidade: true } });
      const saldo = movimentos.reduce((total, m) => m.tipo === "SAIDA" ? total.minus(m.quantidade) : total.plus(m.quantidade), new Prisma.Decimal(0)).toDecimalPlaces(2);
      if (!saldo.equals(input.saldoEsperado)) throw new EstoqueError("CONFLITO", "O estoque mudou desde a consulta. Atualize o saldo e confira a diferença antes de confirmar.");
      const delta = new Prisma.Decimal(input.quantidadeContada).minus(saldo);
      if (delta.isZero()) throw new EstoqueError("VALIDACAO", "A quantidade contada já corresponde ao estoque. Nenhum ajuste é necessário.");
      if (delta.abs().greaterThan(MAX_QTD)) throw new EstoqueError("VALIDACAO", "A diferença excede o limite permitido para um ajuste.");
      const resultado = await registrarMovimentoTx(tx, { produtoId: input.produtoId, tipo: "AJUSTE", quantidade: delta.toNumber(), data: iso(new Date()), observacao: input.observacao, centroCustoId: input.centroCustoId }, propriedadeId, input.usuarioId);
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

/**
 * Estorna um movimento de estoque dentro de uma transação já aberta: cria o
 * movimento inverso (reversaoDeId) copiando centro/propriedade/operação e marca
 * o original como REVERTIDO. Não decide se a origem PODE ser estornada — essa
 * checagem fica com quem chama (excluirMovimento, plantio, sanidade...).
 */
export async function estornarMovimentoTx(
  tx: Prisma.TransactionClient,
  movimentoId: number,
  opts: { usuarioId?: number | null; observacao?: string; data?: Date; propriedadeId?: number | null } = {},
) {
  const filtroPropriedade = opts.propriedadeId != null ? { propriedadeId: opts.propriedadeId } : {};
  const referencia = await tx.movimentoEstoque.findFirst({ where: { id: movimentoId, ...filtroPropriedade }, select: { operacaoId: true } });
  if (!referencia) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");

  // Usa o mesmo lock do cancelamento financeiro. Depois de obtê-lo, relê o
  // movimento para decidir com o estado que venceu a corrida.
  if (referencia.operacaoId != null) {
    await tx.$queryRaw`SELECT "id" FROM "Operacao" WHERE "id" = ${referencia.operacaoId} FOR NO KEY UPDATE`;
  } else {
    await tx.$queryRaw`SELECT "id" FROM "MovimentoEstoque" WHERE "id" = ${movimentoId} FOR NO KEY UPDATE`;
  }
  const mov = await tx.movimentoEstoque.findFirst({ where: { id: movimentoId, ...filtroPropriedade }, include: { revertidoPor: true } });
  if (!mov) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");
  if (mov.revertidoPor || mov.status === "REVERTIDO") throw new EstoqueError("ORIGEM_AUTOMATICA", "movimento já estornado");
  if (mov.reversaoDeId != null) throw new EstoqueError("ORIGEM_AUTOMATICA", "um movimento de estorno não pode ser estornado novamente");

  const pid = mov.propriedadeId ?? await propriedadePrincipalId();
  const data = opts.data ?? new Date();
  if (await mesFechado(tx, pid, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
  const inverso = await tx.movimentoEstoque.create({ data: {
    produtoId: mov.produtoId,
    tipo: mov.tipo === "ENTRADA" ? "SAIDA" : mov.tipo === "SAIDA" ? "ENTRADA" : "AJUSTE",
    origem: "AJUSTE_INVENTARIO", data,
    quantidade: mov.tipo === "AJUSTE" ? mov.quantidade.negated() : mov.quantidade,
    custoUnitario: mov.custoUnitario, valorTotal: mov.tipo === "AJUSTE" ? mov.valorTotal.negated() : mov.valorTotal,
    propriedadeId: pid, operacaoId: mov.operacaoId, reversaoDeId: mov.id, centroCustoId: mov.centroCustoId,
    observacao: opts.observacao ?? `Estorno do movimento #${mov.id}`,
    criadoPorId: opts.usuarioId ?? null,
  } });
  await tx.movimentoEstoque.update({ where: { id: movimentoId }, data: { status: "REVERTIDO" } });
  await auditar(tx, { entidade: "MovimentoEstoque", entidadeId: mov.id, acao: "ESTORNO_MOVIMENTO", usuarioId: opts.usuarioId, motivo: opts.observacao,
    antes: { produtoId: mov.produtoId, tipo: mov.tipo, origem: mov.origem, quantidade: mov.quantidade.toNumber(), operacaoId: mov.operacaoId, centroCustoId: mov.centroCustoId },
    depois: { status: "REVERTIDO", movimentoInversoId: inverso.id } });
  return { original: mov, inverso };
}

// Estorno manual (tela de estoque): só movimentos de ajuste de inventário. Os
// demais são geridos pelo domínio que os originou.
export async function excluirMovimento(id: number, propriedadeId: number | null = null, usuarioId?: number | null) {
  return prisma.$transaction(async (tx) => {
    const mov = await tx.movimentoEstoque.findFirst({
      where: { id, ...(propriedadeId != null ? { propriedadeId } : {}) },
      select: { origem: true, operacaoId: true, consumoPeriodoId: true },
    });
    if (!mov) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");

    // Saídas automáticas são geridas pelo domínio que as originou. Excluí-las
    // avulsamente deixaria o fato de origem e o saldo de estoque divergentes.
    if (mov.origem === "SANIDADE") throw new EstoqueError("ORIGEM_AUTOMATICA", "esta saída veio de um evento sanitário — exclua ou estorne o evento na ficha do animal");
    if (mov.origem === "NUTRICAO" || mov.consumoPeriodoId) throw new EstoqueError("ORIGEM_AUTOMATICA", "esta saída veio do fechamento de consumo de dieta — estorne o período na aba Nutrição, não aqui");
    if (mov.origem === "APLICACAO") throw new EstoqueError("ORIGEM_AUTOMATICA", "esta saída veio de uma operação agrícola — exclua a operação na timeline do talhão, não aqui");
    if (mov.operacaoId != null && mov.origem !== "AJUSTE_INVENTARIO") throw new EstoqueError("ORIGEM_AUTOMATICA", "este movimento nasceu de uma operação financeira — estorne a operação, não o movimento");

    await estornarMovimentoTx(tx, id, { usuarioId, propriedadeId });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function calcularCustoVacaDia(periodoDias = 30, propriedadeId?: number | null) {
  const hoje = iso(new Date());
  // Por sítio: vacas e saídas filtram pela propriedade quando há escopo.
  const vacas = await prisma.animal.count({ where: { status: "ATIVO", resumo: { del: { not: null } }, ...(propriedadeId ? { propriedadeId } : {}) } });
  const limite = new Date(hoje); // meia-noite UTC do dia de hoje — alinha com a janela da função pura (inclui a data-limite)
  limite.setDate(limite.getDate() - periodoDias);
  const saidas = await prisma.movimentoEstoque.findMany({
    where: { ...saidaConsumoConfirmada, data: { gte: limite }, ...(propriedadeId ? { propriedadeId } : {}) },
    select: { valorTotal: true, data: true },
  });
  const arr = saidas.map((s) => ({ valorTotal: Number(s.valorTotal), data: iso(s.data) }));
  const custo = custoVacaDia(arr, vacas, hoje, periodoDias);
  const totalConsumo = Math.round(arr.reduce((a, s) => a + s.valorTotal, 0) * 100) / 100;
  return { periodoDias, custoVacaDia: custo, vacasEmLactacao: vacas, totalConsumo };
}
