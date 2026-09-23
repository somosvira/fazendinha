import { prisma } from "../../db.js";
import { Prisma, type TipoMovimento } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, custoVacaDia, custoMedioDaBase, valorSaidaDaBase, ORIGENS_CUSTO_MEDIO, type BaseCusto, type MovIn } from "./estoque.calc.js";
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

// MAX_QTD compatível com MovimentoEstoque.quantidade Decimal(12,3); MAX_CUSTO com
// custoUnitario Decimal(14,4) truncado à mesma ordem de grandeza — evita Postgres 22003
// antes de chegar ao Prisma.
const MAX_QTD = 999_999_999.999;
const MAX_CUSTO = 9_999_999_999.99;

export const movimentoSchema = z
  .object({
    produtoId: z.number().int(),
    // Entradas e saídas nascem de operações financeiras ou eventos operacionais; aqui só ajuste de inventário.
    tipo: z.literal("AJUSTE"),
    data: naoFutura,
    // 3 casas = MovimentoEstoque.quantidade Decimal(12,3); 0,0004 seria gravado como 0,000.
    quantidade: z.number().finite().min(-MAX_QTD, "quantidade muito alta").max(MAX_QTD, "quantidade muito alta").multipleOf(0.001, "quantidade aceita no máximo 3 casas decimais"),
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
  quantidadeContada: z.number().finite().min(0).max(MAX_QTD).multipleOf(0.001),
  saldoEsperado: z.number().finite().min(-MAX_QTD).max(MAX_QTD).multipleOf(0.001),
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

type DbTemEstoque = Pick<Prisma.TransactionClient, "movimentoEstoque">;

// "O produto tem estoque neste sítio" = existe ao menos uma ENTRADA ou AJUSTE
// CONFIRMADO (não estornado e que não seja ele mesmo um estorno) do produto no
// sítio. Não é atributo do produto: quem põe um produto no estoque é a
// operação (compra para estoque, inventário, bonificação, produção, ajuste).
// Mesmo escopo de sítio do custo médio (movimento sem propriedade = principal;
// propriedadeId null = consolidado, qualquer sítio).
async function filtroTemEstoque(propriedadeId: number | null): Promise<Prisma.MovimentoEstoqueWhereInput> {
  return {
    tipo: { in: ["ENTRADA", "AJUSTE"] },
    status: "CONFIRMADO",
    reversaoDeId: null,
    ...(await filtroSitioCusto(propriedadeId)),
  };
}

/** Baixas automáticas (dieta, sanidade, aplicação agrícola) só consomem produto que tem estoque no sítio. */
export async function produtoTemEstoque(db: DbTemEstoque, produtoId: number, propriedadeId: number | null): Promise<boolean> {
  const mov = await db.movimentoEstoque.findFirst({ where: { produtoId, ...(await filtroTemEstoque(propriedadeId)) }, select: { id: true } });
  return mov != null;
}

/** Versão em lote de produtoTemEstoque: devolve o conjunto dos produtos com estoque no sítio. */
export async function produtosComEstoque(db: DbTemEstoque, produtoIds: number[], propriedadeId: number | null): Promise<Set<number>> {
  const ids = [...new Set(produtoIds)];
  if (ids.length === 0) return new Set();
  const grupos = await db.movimentoEstoque.groupBy({ by: ["produtoId"], where: { produtoId: { in: ids }, ...(await filtroTemEstoque(propriedadeId)) } });
  return new Set(grupos.map((g) => g.produtoId));
}

/**
 * Base do custo médio (Σ quantidade, Σ valor das entradas valorizadas) por
 * produto num sítio, agregada no banco em um único groupBy. Produtos sem base
 * valorizada ficam fora do mapa (o chamador trata como sem custo).
 *
 * O `where` espelha `entraNoCustoMedio` (estoque.calc.ts): CONFIRMADO, sem
 * reversaoDeId, quantidade > 0 e valorTotal > 0, e tipo ENTRADA de uma origem
 * de ORIGENS_CUSTO_MEDIO ou tipo AJUSTE. Como ENTRADA e AJUSTE hoje exigem as
 * mesmas condições de quantidade/valor, a diferença por tipo cabe num único OR
 * e um groupBy basta (sem somar dois resultados em memória). Nenhuma SAIDA nem
 * linha individual de movimento sai do banco.
 */
export async function obterBasesCusto(db: DbCusto, produtoIds: number[], propriedadeId: number | null): Promise<Map<number, BaseCusto>> {
  const ids = [...new Set(produtoIds)];
  const resultado = new Map<number, BaseCusto>();
  if (ids.length === 0) return resultado;
  const grupos = await db.movimentoEstoque.groupBy({
    by: ["produtoId"],
    where: {
      produtoId: { in: ids },
      status: "CONFIRMADO",
      reversaoDeId: null,
      quantidade: { gt: 0 },
      valorTotal: { gt: 0 },
      AND: [
        await filtroSitioCusto(propriedadeId),
        { OR: [
          { tipo: "ENTRADA", origem: { in: [...ORIGENS_CUSTO_MEDIO] } },
          { tipo: "AJUSTE" },
        ] },
      ],
    },
    _sum: { quantidade: true, valorTotal: true },
  });
  for (const g of grupos) {
    const quantidade = g._sum.quantidade ?? new Prisma.Decimal(0);
    const valor = g._sum.valorTotal ?? new Prisma.Decimal(0);
    if (quantidade.greaterThan(0)) resultado.set(g.produtoId, { quantidade, valor });
  }
  return resultado;
}

export async function obterBaseCusto(db: DbCusto, produtoId: number, propriedadeId: number | null): Promise<BaseCusto | null> {
  return (await obterBasesCusto(db, [produtoId], propriedadeId)).get(produtoId) ?? null;
}

/**
 * Custo médio ponderado (4 casas) por produto num sítio — só para EXIBIÇÃO.
 * Para valorizar uma saída use obterBasesCusto + valorSaidaPreciso.
 */
export async function obterCustosMedios(db: DbCusto, produtoIds: number[], propriedadeId: number | null): Promise<Map<number, Prisma.Decimal>> {
  const resultado = new Map<number, Prisma.Decimal>();
  for (const [produtoId, base] of await obterBasesCusto(db, produtoIds, propriedadeId)) {
    const custo = custoMedioDaBase(base);
    if (custo != null) resultado.set(produtoId, custo);
  }
  return resultado;
}

export async function obterCustoMedio(db: DbCusto, produtoId: number, propriedadeId: number | null): Promise<Prisma.Decimal | null> {
  return (await obterCustosMedios(db, [produtoId], propriedadeId)).get(produtoId) ?? null;
}

const USO_CAMPO = { sanitario: "usoSanitario", nutricional: "usoNutricional", agricola: "usoAgricola" } as const;

export async function listarSaldos(f?: { centroCustoId?: number; propriedadeId?: number | null; uso?: "sanitario" | "nutricional" | "agricola" }) {
  // O estoque lista os produtos ativos que já tiveram movimento no sítio (qualquer
  // status) — o produto entra no estoque pela operação, não pelo cadastro.
  // Movimento sem propriedade conta como da principal (mesmo escopo do custo médio).
  const sitio = await filtroSitioCusto(f?.propriedadeId ?? null);
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, movimentos: { some: sitio }, ...(f?.uso ? { categoria: { [USO_CAMPO[f.uso]]: true } } : {}) },
    orderBy: { nome: "asc" },
    // Saldo por sítio: com filtro, só os movimentos daquela propriedade contam.
    include: {
      movimentos: { where: { status: statusSaldoEstoque, ...sitio } },
      centrosCusto: { include: { centroCusto: true } },
      categoria: true,
    },
  });
  const bases = await obterBasesCusto(prisma, produtos.map((p) => p.id), f?.propriedadeId ?? null);
  const linhas = produtos.map((p) => {
    const movs: MovIn[] = p.movimentos.map((m) => ({
      tipo: m.tipo,
      quantidade: Number(m.quantidade),
      valorTotal: Number(m.valorTotal),
      data: iso(m.data),
    }));
    const { saldo } = saldoProduto(movs);
    const base = bases.get(p.id) ?? null;
    const custo = base ? custoMedioDaBase(base) : null; // só exibição (4 casas)
    // Valor do estoque = saldo × Σvalor ÷ Σquantidade da base do sítio, com um
    // único arredondamento no fim — mesma matemática das saídas. Multiplicar o
    // saldo pelo custoMedio arredondado erraria até ~11% em produtos por g/mL.
    const valor = base == null ? 0 : valorSaidaDaBase(saldo, base).valorTotal.toNumber();
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

/** Para onde levar o usuário quando o movimento NÃO nasceu de uma operação financeira (saídas automáticas). */
export type VinculoMovimento =
  | { tipo: "LOTE"; id: number; nome: string }
  | { tipo: "ANIMAL"; id: number; numero: string; nome: string | null }
  | { tipo: "TALHAO"; id: number; codigo: string };

export async function listarMovimentos(f?: { produtoId?: number; tipo?: string; propriedadeId?: number | null }) {
  const where: Prisma.MovimentoEstoqueWhereInput = {};
  where.status = statusSaldoEstoque;
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (f?.tipo) where.tipo = f.tipo as TipoMovimento;
  if (f?.propriedadeId) where.propriedadeId = f.propriedadeId;
  const ms = await prisma.movimentoEstoque.findMany({
    where,
    orderBy: [{ data: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      produto: { include: { centrosCusto: { include: { centroCusto: true } } } },
      operacao: { include: { parceiro: true } },
      grupo: true,
      // Origem das saídas automáticas (sem operação financeira): um único join por relação, sem N+1.
      consumoPeriodo: { select: { grupoId: true, grupo: { select: { nome: true } } } },
      eventoSanitario: { select: { animalId: true, animal: { select: { numero: true, nome: true } } } },
      operacaoAgricola: { select: { talhaoId: true, talhao: { select: { codigo: true } } } },
    },
  });
  return ms.map((m) => {
    let vinculo: VinculoMovimento | null = null;
    if (m.consumoPeriodo) vinculo = { tipo: "LOTE", id: m.consumoPeriodo.grupoId, nome: m.consumoPeriodo.grupo.nome };
    else if (m.eventoSanitario) vinculo = { tipo: "ANIMAL", id: m.eventoSanitario.animalId, numero: m.eventoSanitario.animal.numero, nome: m.eventoSanitario.animal.nome };
    else if (m.operacaoAgricola) vinculo = { tipo: "TALHAO", id: m.operacaoAgricola.talhaoId, codigo: m.operacaoAgricola.talhao.codigo };
    return {
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
      /** Operação financeira de origem (compra, ajuste, inventário…); null nas saídas automáticas. */
      operacaoId: m.operacaoId ?? null,
      /** Lote/animal/talhão de origem das saídas automáticas (dieta/sanidade/aplicação); null nos demais. */
      vinculo,
    };
  });
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
    // Sem custo informado, o ajuste é valorizado pela base do custo médio do sítio
    // (quantidade × Σvalor ÷ Σquantidade, arredondado só no fim). Com custo
    // informado, valor = quantidade × custo, sem arredondamento intermediário.
    const { custoUnitario: custo, valorTotal } = input.custoUnitario != null
      ? { custoUnitario: new Prisma.Decimal(input.custoUnitario), valorTotal: new Prisma.Decimal(input.quantidade).mul(input.custoUnitario).toDecimalPlaces(2) }
      : valorSaidaDaBase(input.quantidade, await obterBaseCusto(tx, produto.id, propriedadeId));
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
      const produto = await tx.produto.findFirst({ where: { id: input.produtoId, ativo: true } });
      if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto ativo não encontrado");
      // Mesmo escopo de sítio de listarSaldos (sem propriedade = principal), senão o saldo esperado da tela nunca casaria.
      const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: input.produtoId, status: statusSaldoEstoque, ...(await filtroSitioCusto(propriedadeId)) }, select: { tipo: true, quantidade: true } });
      const saldo = movimentos.reduce((total, m) => m.tipo === "SAIDA" ? total.minus(m.quantidade) : total.plus(m.quantidade), new Prisma.Decimal(0)).toDecimalPlaces(3);
      if (!saldo.equals(new Prisma.Decimal(input.saldoEsperado).toDecimalPlaces(3))) throw new EstoqueError("CONFLITO", "O estoque mudou desde a consulta. Atualize o saldo e confira a diferença antes de confirmar.");
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
