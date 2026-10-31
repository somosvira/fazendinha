import { transacaoValidada } from "../../lib/transacao-validada.js";
import { prisma } from "../../db.js";
import { Prisma, type OrigemMovimentoEstoque, type TipoMovimento } from "@prisma/client";
import { z } from "zod";
import { saldoProduto, custoMedioDaBase, valorSaidaDaBase, ORIGENS_CUSTO_MEDIO, type BaseCusto, type MovIn } from "./estoque.calc.js";
import { auditar } from "../financeiro/regras.js";
import { propriedadePrincipalId, escopoPadraoLeitura } from "../propriedade.js";
import { resolverCentroSaida } from "./centro.calc.js";
import { rotuloUnidade } from "./unidades.js";
import { SEM_VINCULO } from "../../lib/ids.js";
import { planejarSaidaTx, registrarEntradaValorizadaTx, registrarSaidaValorizadaTx, registrarInversoValorizadoTx, saldosBasesTx, travarValorizacaoTx, ValorizacaoError } from "./valorizacao.js";
import { conferirSaldoEstornoPartidasTx, idsGrupoPartidaTx, prepararPartidasTx } from "./partidas.js";
import { METODO_LEITE, valoresMovimentosLeiteTx } from "./leite.js";

export class EstoqueError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "MES_FECHADO" | "ORIGEM_AUTOMATICA" | "CONFLITO" | "VALIDACAO", m: string, public campo?: string) {
    super(m);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
// O original e seu movimento inverso se anulam no razão físico.
export const statusSaldoEstoque: Prisma.EnumStatusMovimentoEstoqueFilter = { in: ["CONFIRMADO", "REVERTIDO"] };
const naoFutura = z.string().refine((s) => new Date(s) <= new Date(), "data não pode ser futura");

// MAX_QTD compatível com MovimentoEstoque.quantidade Decimal(12,3); MAX_CUSTO com
// custoUnitario Decimal(14,4) truncado à mesma ordem de grandeza — evita Postgres 22003
// antes de chegar ao Prisma.
const MAX_QTD = 999_999_999.999;
const MAX_CUSTO = 9_999_999_999.99;
const distribuicaoPartidasSchema = z.array(z.object({
  partidaId: z.string().uuid().optional(), codigo: z.string().trim().min(1).max(100).optional(),
  nome: z.string().trim().min(1, "Informe o nome do lote").max(160, "O nome do lote aceita até 160 caracteres").optional(), cienciaValidadeDesconhecida: z.boolean().optional(),
  validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma validade válida").nullish(), quantidade: z.number().finite(),
})).optional();

export const movimentoSchema = z
  .object({
    produtoId: z.string().uuid(),
    // Entradas e saídas nascem de operações financeiras ou eventos operacionais; aqui só ajuste de inventário.
    tipo: z.literal("AJUSTE"),
    data: naoFutura,
    // 3 casas = MovimentoEstoque.quantidade Decimal(12,3); 0,0004 seria gravado como 0,000.
    quantidade: z.number().finite().min(-MAX_QTD, "quantidade muito alta").max(MAX_QTD, "quantidade muito alta").multipleOf(0.001, "quantidade aceita no máximo 3 casas decimais"),
    custoUnitario: z.number().nonnegative().max(MAX_CUSTO, "custo unitário muito alto").optional(),
    referenciaValor: z.string().trim().min(2).max(200).optional(),
    evidenciaValor: z.string().trim().min(5).max(2000).optional(),
    observacao: z.string().min(5, "justificativa é obrigatória").max(200),
    propriedadeId: z.number().int().optional(), // sítio (multi-propriedade)
    centroCustoId: z.string().uuid().nullable().optional(),
    partidas: distribuicaoPartidasSchema,
  })
  // AJUSTE aceita negativa (correção de saldo) mas nunca zero.
  .superRefine((v, ctx) => {
    if (v.quantidade === 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quantidade não pode ser zero", path: ["quantidade"] });
  });
export type MovimentoInput = z.infer<typeof movimentoSchema>;

export const ajusteContagemSchema = z.object({
  produtoId: z.string().uuid(),
  quantidadeContada: z.number().finite().min(0).max(MAX_QTD).multipleOf(0.001),
  saldoEsperado: z.number().finite().min(-MAX_QTD).max(MAX_QTD).multipleOf(0.001),
  partidas: distribuicaoPartidasSchema,
  observacao: z.string().trim().min(5, "justificativa é obrigatória").max(200),
  propriedadeId: z.number().int().positive().optional(),
  centroCustoId: z.string().uuid().nullable().optional(),
});

type DbCusto = Pick<Prisma.TransactionClient, "$queryRaw">;

// Escopo de sítio do custo médio: movimento sem propriedade pertence à principal
// (mesma convenção do resto do estoque). null = consolidado (todas as propriedades).
async function filtroSitioCusto(propriedadeId: number | null): Promise<Prisma.MovimentoEstoqueWhereInput> {
  if (propriedadeId == null) return {};
  const principal = await propriedadePrincipalId();
  return propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
}

type DbTemEstoque = Pick<Prisma.TransactionClient, "movimentoEstoque">;

// "O produto tem estoque neste sítio" = existe ao menos uma ENTRADA ou um AJUSTE
// POSITIVO CONFIRMADO (não estornado e que não seja ele mesmo um estorno) do
// produto no sítio. AJUSTE negativo é baixa manual — não põe o produto no
// estoque. Não é atributo do produto: quem põe um produto no estoque é a
// operação (compra para estoque, inventário, bonificação, produção, ajuste).
// Mesmo escopo de sítio do custo médio (movimento sem propriedade = principal;
// propriedadeId null = consolidado, qualquer sítio). O sítio vai num AND porque
// o escopo da principal também é um OR.
// Atenção: isto decide só o que PODE ser baixado (aplicação agrícola, venda);
// a lista de saldos (listarSaldos) continua mostrando qualquer produto com
// movimento no sítio.
async function filtroTemEstoque(propriedadeId: number | null): Promise<Prisma.MovimentoEstoqueWhereInput> {
  return {
    status: "CONFIRMADO",
    reversaoDeId: null,
    AND: [
      { OR: [{ tipo: "ENTRADA" }, { tipo: "AJUSTE", quantidade: { gt: 0 } }] },
      await filtroSitioCusto(propriedadeId),
    ],
  };
}

/** Baixas automáticas (aplicação agrícola) só consomem produto que tem estoque no sítio. */
export async function produtoTemEstoque(db: DbTemEstoque, produtoId: string, propriedadeId: number | null): Promise<boolean> {
  const mov = await db.movimentoEstoque.findFirst({ where: { produtoId, ...(await filtroTemEstoque(propriedadeId)) }, select: { id: true } });
  return mov != null;
}

/** Versão em lote de produtoTemEstoque: devolve o conjunto dos produtos com estoque no sítio. */
export async function produtosComEstoque(db: DbTemEstoque, produtoIds: string[], propriedadeId: number | null): Promise<Set<string>> {
  const ids = [...new Set(produtoIds)];
  if (ids.length === 0) return new Set();
  const grupos = await db.movimentoEstoque.groupBy({ by: ["produtoId"], where: { produtoId: { in: ids }, ...(await filtroTemEstoque(propriedadeId)) } });
  return new Set(grupos.map((g) => g.produtoId));
}

/** Valor residual das bases atuais, sem recalcular consumidores históricos. */
export async function obterBasesCusto(db: DbCusto, produtoIds: string[], propriedadeId: number | null): Promise<Map<string, BaseCusto>> {
  const resultado = new Map<string, BaseCusto>();
  if (!produtoIds.length) return resultado;
  // Aberturas entram uma vez por base; parcelas são agregadas no banco, sem
  // transportar o histórico inteiro em cada atualização da lista de estoque.
  const bases = await db.$queryRaw<{ produtoId: string; quantidade: Prisma.Decimal; valor: Prisma.Decimal }[]>(Prisma.sql`
    SELECT valor_base."produtoId", SUM(valor_base.quantidade) AS quantidade, SUM(valor_base.valor) AS valor FROM (
    SELECT b."produtoId", b."quantidadeAbertura" + COALESCE(p.quantidade, 0) AS quantidade,
      b."valorAbertura" + COALESCE(p.valor, 0) AS valor
    FROM "public"."BaseValorizacaoEstoque" b
    JOIN "public"."Produto" produto ON produto.id = b."produtoId"
    LEFT JOIN LATERAL (SELECT SUM(parcela.quantidade) AS quantidade, SUM(parcela."valorTotal") AS valor
      FROM "public"."ParcelaValorizacaoEstoque" parcela WHERE parcela."baseId" = b.id) p ON true
    WHERE b."produtoId" IN (${Prisma.join([...new Set(produtoIds)])})
      AND b.metodo = CASE WHEN produto."rastrearPartidas" THEN 'MEDIA_SALDO_V1' ELSE 'FIFO_AQUISICAO_V1' END
      ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND b."propriedadeId" = ${propriedadeId}`}
    UNION ALL
    SELECT m."produtoId", m.quantidade-COALESCE(consumos.quantidade,0) AS quantidade,
      ap."valorTotal"-COALESCE(consumos.valor,0) AS valor
    FROM pecuaria."EntradaProducaoLeite" e JOIN public."MovimentoEstoque" m ON m.id=e."movimentoId"
    JOIN LATERAL (SELECT a.id,a."valorTotal" FROM pecuaria."ApuracaoValorLeite" a WHERE a."entradaId"=e.id ORDER BY a.versao DESC LIMIT 1) ap ON true
    LEFT JOIN LATERAL (SELECT SUM(a.quantidade) AS quantidade,SUM(COALESCE(p."valorTotal",a."valorTotal")) AS valor,
      bool_or(COALESCE(p."valorTotal",a."valorTotal") IS NULL) AS pendente
      FROM pecuaria."AlocacaoLeiteEstoque" a JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId"
      LEFT JOIN pecuaria."ApropriacaoValorLeite" p ON p."alocacaoId"=a.id AND p."apuracaoId"=ap.id
      WHERE a."entradaId"=e.id AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL) consumos ON true
    WHERE e.status='CONFIRMADA' AND m.status='CONFIRMADO' AND m."produtoId" IN (${Prisma.join([...new Set(produtoIds)])})
      AND COALESCE(consumos.pendente,false)=false
      ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND m."propriedadeId" = ${propriedadeId}`}
    ) valor_base
    WHERE NOT EXISTS (
      SELECT 1 FROM pecuaria."EntradaProducaoLeite" pendente
      JOIN public."MovimentoEstoque" mp ON mp.id=pendente."movimentoId"
      WHERE pendente.status='CONFIRMADA' AND mp.status='CONFIRMADO' AND mp."produtoId"=valor_base."produtoId"
        ${propriedadeId == null ? Prisma.empty : Prisma.sql`AND mp."propriedadeId" = ${propriedadeId}`}
        AND NOT EXISTS (SELECT 1 FROM pecuaria."ApuracaoValorLeite" ap WHERE ap."entradaId"=pendente.id)
        AND mp.quantidade > COALESCE((SELECT SUM(a.quantidade) FROM pecuaria."AlocacaoLeiteEstoque" a
          JOIN public."MovimentoEstoque" sm ON sm.id=a."movimentoId"
          WHERE a."entradaId"=pendente.id AND sm.status='CONFIRMADO' AND sm."reversaoDeId" IS NULL),0)
    ) GROUP BY valor_base."produtoId"`);
  for (const base of bases) resultado.set(base.produtoId, { quantidade: new Prisma.Decimal(base.quantidade), valor: new Prisma.Decimal(base.valor) });
  return resultado;
}

export async function obterBaseCusto(db: DbCusto, produtoId: string, propriedadeId: number | null): Promise<BaseCusto | null> {
  return (await obterBasesCusto(db, [produtoId], propriedadeId)).get(produtoId) ?? null;
}

/**
 * Custo médio ponderado (4 casas) por produto num sítio — só para EXIBIÇÃO.
 * Saídas são valorizadas por planejarSaidaTx, com parcelas autoritativas.
 */
export async function obterCustosMedios(db: DbCusto, produtoIds: string[], propriedadeId: number | null): Promise<Map<string, Prisma.Decimal>> {
  const resultado = new Map<string, Prisma.Decimal>();
  for (const [produtoId, base] of await obterBasesCusto(db, produtoIds, propriedadeId)) {
    const custo = custoMedioDaBase(base);
    if (custo != null) resultado.set(produtoId, custo);
  }
  return resultado;
}

export async function obterCustoMedio(db: DbCusto, produtoId: string, propriedadeId: number | null): Promise<Prisma.Decimal | null> {
  return (await obterCustosMedios(db, [produtoId], propriedadeId)).get(produtoId) ?? null;
}

const USO_CAMPO = { genetico: "usoGenetico" } as const;

export async function listarSaldos(f?: { centroCustoId?: string; propriedadeId?: number | null; uso?: keyof typeof USO_CAMPO; produtoIds?: string[]; materialGeneticoVisivel?: boolean }) {
  // O estoque lista os produtos ativos que já tiveram movimento no sítio (qualquer
  // status) — o produto entra no estoque pela operação, não pelo cadastro.
  // Movimento sem propriedade conta como da principal (mesmo escopo do custo médio).
  const sitio = await filtroSitioCusto(f?.propriedadeId ?? null);
  const produtos = await prisma.produto.findMany({
    // com produtoIds, o chamador já sabe quais produtos quer: ignora ativo/uso
    where: f?.produtoIds
      ? { id: { in: f.produtoIds }, movimentos: { some: sitio } }
      : { ativo: true, movimentos: { some: sitio }, ...(f?.uso ? { [USO_CAMPO[f.uso]]: true } : {}) },
    orderBy: { nome: "asc" },
    // Saldo por sítio: com filtro, só os movimentos daquela propriedade contam.
    include: {
      movimentos: { where: { status: statusSaldoEstoque, ...sitio } },
      centrosCusto: { include: { centroCusto: true } },
      categoria: true,
      materialGenetico: { select: { id: true } },
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
    const conhecido = base != null && base.quantidade.eq(saldo);
    const custo = conhecido ? custoMedioDaBase(base) : null; // só exibição (4 casas)
    // Valor do estoque = saldo × Σvalor ÷ Σquantidade da base do sítio, com um
    // único arredondamento no fim — mesma matemática das saídas. Multiplicar o
    // saldo pelo custoMedio arredondado erraria até ~11% em produtos por g/mL.
    const valor = conhecido ? base.valor.toNumber() : saldo === 0 ? 0 : null;
    const minimo = p.minimoEstoque != null ? Number(p.minimoEstoque) : null;
    return {
      produtoId: p.id,
      usoGenetico: p.usoGenetico, usoSanitario: p.usoSanitario, usoNutricional: p.usoNutricional,
      nome: p.nome,
      materialGeneticoId: f?.materialGeneticoVisivel === false ? null : p.materialGenetico?.id ?? null,
      categoria: p.categoria
        ? { id: p.categoria.id, nome: p.categoria.nome, usoGenetico: p.categoria.usoGenetico }
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
  if (f?.centroCustoId === SEM_VINCULO) return linhas.filter((l) => l.centrosCusto.length === 0);
  if (f?.centroCustoId) return linhas.filter((l) => l.centrosCusto.some((cc) => cc.id === f.centroCustoId));
  return linhas;
}

/** Para onde levar o usuário quando o movimento NÃO nasceu de uma operação financeira (saídas automáticas). */
export type VinculoMovimento =
  | { tipo: "TENTATIVA_REPRODUTIVA"; id: string; animalId: string }
  | { tipo: "APLICACAO_SANITARIA"; id: string; animalId: string }
  | { tipo: "FECHAMENTO_NUTRICIONAL"; id: string; loteId: string };

/** Quais vínculos operacionais o leitor pode ver (quem só tem financeiro não vê o fato da pecuária). Ausente = todos. */
export type VinculosVisiveis = { pecuaria?: boolean };

export type FiltroMovimentos = {
  movimentoId?: string; produtoId?: string; partidaId?: string; tipo?: string; q?: string; origem?: string; centroCustoId?: string;
  de?: string; ate?: string; pagina?: number; porPagina?: number;
  propriedadeId?: number | null; vinculosVisiveis?: VinculosVisiveis;
};

// "OP-0011", "op-11" ou só "11" também procuram pelo número sequencial da operação de origem.
function numeroOperacaoDaBusca(q: string): number | null {
  const m = /^(?:op-?)?(\d{1,9})$/i.exec(q.trim());
  return m ? Number(m[1]) : null;
}

export async function listarMovimentos(f?: FiltroMovimentos) {
  const visiveis = f?.vinculosVisiveis ?? { pecuaria: true };
  const pagina = f?.pagina ?? 1;
  const porPagina = f?.porPagina ?? 15;
  const and: Prisma.MovimentoEstoqueWhereInput[] = [
    // Mesmo escopo de sítio de listarSaldos: na principal, movimento sem propriedade também aparece.
    await filtroSitioCusto(f?.propriedadeId ?? null),
  ];
  const where: Prisma.MovimentoEstoqueWhereInput = { status: statusSaldoEstoque, AND: and };
  const idsGrupo = f?.partidaId ? await idsGrupoPartidaTx(prisma, f.partidaId) : null;
  if (f?.movimentoId) where.id = f.movimentoId;
  if (f?.produtoId) where.produtoId = f.produtoId;
  if (idsGrupo) where.alocacaoPartidaEstoques = { some: { partidaId: { in: idsGrupo } } };
  if (f?.tipo) where.tipo = f.tipo as TipoMovimento;
  if (f?.origem) where.origem = f.origem as OrigemMovimentoEstoque;
  if (f?.centroCustoId === SEM_VINCULO) and.push({ produto: { centrosCusto: { none: {} } } });
  else if (f?.centroCustoId) and.push({ produto: { centrosCusto: { some: { centroCustoId: f.centroCustoId } } } });
  if (f?.de || f?.ate) {
    and.push({ data: {
      ...(f.de ? { gte: new Date(`${f.de}T00:00:00.000Z`) } : {}),
      ...(f.ate ? { lte: new Date(`${f.ate}T23:59:59.999Z`) } : {}),
    } });
  }
  const termo = f?.q?.trim();
  if (termo) {
    const numeroOperacao = numeroOperacaoDaBusca(termo);
    and.push({ OR: [
      { produto: { nome: { contains: termo, mode: "insensitive" } } },
      { operacao: { parceiro: { nome: { contains: termo, mode: "insensitive" } } } },
      ...(numeroOperacao != null ? [{ operacao: { numero: numeroOperacao } }] : []),
    ] });
  }
  const [total, ms] = await Promise.all([
    prisma.movimentoEstoque.count({ where }),
    prisma.movimentoEstoque.findMany({
      where,
      orderBy: [{ data: "desc" }, { seq: "desc" }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      include: {
        produto: { include: { centrosCusto: { include: { centroCusto: true } }, materialGenetico: { select: { id: true } } } },
        operacao: { include: { parceiro: true } },
        revertidoPor: { select: { id: true } },
        // Origem das saídas automáticas (sem operação financeira): um único join por relação, sem N+1.
        aplicacaoProduto: { select: { id: true, animalId: true } },
        itemFechamentoConsumo: { select: { fechamento: { select: { id: true, loteId: true } } } },
        parcelasValorizacao: { include: { base: { select: { partidaId: true } } } },
        alocacaoPartidaEstoques: { include: { partida: { select: { codigo: true, nome: true, validade: true, lotePrincipalId: true, lotePrincipal: { select: { nome: true } } } } } },
      },
    }),
  ]);
  const idsReproducao = [...new Set(ms.filter((m) => m.origem === "REPRODUCAO" || m.reversaoDeId).map((m) => m.reversaoDeId ?? m.id))];
  const tentativas = idsReproducao.length ? await prisma.tentativaReprodutiva.findMany({ where: { movimentoEstoqueId: { in: idsReproducao } }, select: { id: true, animalId: true, movimentoEstoqueId: true } }) : [];
  const tentativaPorMovimento = new Map(tentativas.map((t) => [t.movimentoEstoqueId, t]));
  const valoresLeite = await valoresMovimentosLeiteTx(prisma, ms.filter(m => m.metodoValorizacao === METODO_LEITE).map(m => m.id));
  const itens = ms.map((original) => {
    const m = valoresLeite.has(original.id) ? { ...original, ...valoresLeite.get(original.id)! } : original;
    const quantidadeConsulta = idsGrupo ? (m.alocacaoPartidaEstoques ?? []).filter((a) => idsGrupo.includes(a.partidaId)).reduce((s, a) => s.plus(a.quantidade), new Prisma.Decimal(0)) : m.quantidade;
    // Apenas recorte de exibição do valor já gravado, sem recalcular o custo médio
    // nem atribuir um método de custeio independente ao lote.
    const parcelasDoGrupo = idsGrupo ? (m.parcelasValorizacao ?? []).filter(p => p.base.partidaId != null && idsGrupo.includes(p.base.partidaId)) : [];
    const valorConsulta = !idsGrupo || quantidadeConsulta.eq(m.quantidade) ? m.valorTotal
      : parcelasDoGrupo.length > 0 ? parcelasDoGrupo.reduce((v,p) => v.plus(p.valorTotal), new Prisma.Decimal(0)).mul(m.tipo === "SAIDA" ? -1 : 1) : null;
    let vinculo: VinculoMovimento | null = null;
    let oculto = false;
    const tentativa = tentativaPorMovimento.get(m.reversaoDeId ?? m.id);
    if (tentativa) {
      if (visiveis.pecuaria !== false) vinculo = { tipo: "TENTATIVA_REPRODUTIVA", id: tentativa.id, animalId: tentativa.animalId };
      else oculto = true;
    } else if (m.origem === "REPRODUCAO" && visiveis.pecuaria === false) {
      oculto = true;
    } else if (m.aplicacaoProduto) {
      if (visiveis.pecuaria !== false) vinculo = { tipo: "APLICACAO_SANITARIA", id: m.aplicacaoProduto.id, animalId: m.aplicacaoProduto.animalId };
      else oculto = true;
    } else if (m.itemFechamentoConsumo?.fechamento) {
      if (visiveis.pecuaria !== false) vinculo = { tipo: "FECHAMENTO_NUTRICIONAL", id: m.itemFechamentoConsumo.fechamento.id, loteId: m.itemFechamentoConsumo.fechamento.loteId };
      else oculto = true;
    }
    return {
      id: m.id,
      propriedadeId: m.propriedadeId,
      seq: m.seq,
      produtoId: m.produtoId,
      partidas: (m.alocacaoPartidaEstoques ?? []).filter((a) => !idsGrupo || idsGrupo.includes(a.partidaId)).map((a) => ({ partidaId: a.partidaId, lotePrincipalId: a.partida.lotePrincipalId ?? a.partidaId, nome: a.partida.lotePrincipal?.nome ?? a.partida.nome, codigo: a.partida.codigo, validade: a.partida.validade, quantidade: a.quantidade.toString() })),
      produto: m.produto.nome,
      materialGeneticoId: visiveis.pecuaria !== false ? m.produto.materialGenetico?.id ?? null : null,
      centrosCusto: m.produto.centrosCusto.map(({ centroCusto }) => ({ id: centroCusto.id, nome: centroCusto.nome })),
      tipo: m.tipo,
      origem: m.origem, // COMPRA | CONSUMO_DIRETO | TRANSFERENCIA | PRODUCAO | DEVOLUCAO | BONIFICACAO | INVENTARIO_INICIAL | APLICACAO | PERDA | AJUSTE_INVENTARIO
      status: m.status,
      reversaoDeId: m.reversaoDeId,
      estorno: m.revertidoPor ?? null,
      data: iso(m.data),
      quantidade: Number(quantidadeConsulta),
      quantidadeMovimento: Number(m.quantidade),
      custoUnitario: m.custoUnitario == null ? null : Number(m.custoUnitario),
      metodoValorizacao: m.metodoValorizacao ?? "LEGADO",
      valorTotal: valorConsulta == null ? null : Number(valorConsulta),
      valorTotalMovimento: m.valorTotal == null ? null : Number(m.valorTotal),
      fornecedor: m.tipo === "ENTRADA" && !m.reversaoDeId ? m.operacao?.parceiro?.nome ?? null : null,
      observacao: oculto ? null : m.observacao ?? null,
      /** Operação financeira de origem (compra, ajuste, inventário…); null nas saídas automáticas. */
      operacaoId: m.operacaoId ?? null,
      operacaoNumero: m.operacao?.numero ?? null,
      /** Talhão de origem das saídas automáticas (aplicação agrícola); null nos demais. */
      vinculo,
    };
  });
  return { itens, total };
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

  return transacaoValidada(async (tx) => {
    const resultado = await registrarMovimentoTx(tx, input, propriedadeId, input.usuarioId);
    await auditar(tx, { entidade: "Operacao", entidadeId: resultado.operacaoId, acao: "AJUSTE_MANUAL", usuarioId: input.usuarioId, motivo: input.observacao,
      depois: { produtoId: input.produtoId, propriedadeId, quantidade: input.quantidade, data: input.data, centroCustoId: input.centroCustoId ?? null, movimentoId: resultado.id } });
    return resultado;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function registrarMovimentoTx(tx: Prisma.TransactionClient, input: MovimentoInput, propriedadeId: number, usuarioId?: number | null) {
    await travarValorizacaoTx(tx, [input.produtoId]);
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId }, include: { centrosCusto: { select: { centroCustoId: true } } } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "produto não encontrado");
    if (input.centroCustoId != null && !(await tx.centroCusto.findFirst({ where: { id: input.centroCustoId, ativo: true } }))) throw new EstoqueError("NAO_ENCONTRADO", "centro de custo não encontrado");
    const centroCustoId = resolverCentroSaida({ produtoCentroIds: produto.centrosCusto.map((cc) => cc.centroCustoId), contextoCentroId: input.centroCustoId });
    const distribuicao = await prepararPartidasTx(tx, { produtoId: produto.id, rastrearPartidas: produto.rastrearPartidas,
      propriedadeId, tipo: "AJUSTE", quantidade: new Prisma.Decimal(input.quantidade), partidas: input.partidas });
    const negativo = input.quantidade < 0;
    if (negativo && !(await produtoTemEstoque(tx, produto.id, propriedadeId))) throw new EstoqueError("VALIDACAO", "Este produto não tem estoque neste sítio — registre uma compra ou um inventário antes de dar baixa");
    const plano = negativo ? await planejarSaidaTx(tx, { produtoId: produto.id, propriedadeId, quantidade: new Prisma.Decimal(input.quantidade).abs(), data: new Date(input.data), partidas: distribuicao.map(p => ({ ...p, quantidade: p.quantidade.abs() })) }) : null;
    let planoEntrada: import("./valorizacao.js").PlanoSaida | undefined;
    let valorTotal: Prisma.Decimal;
    if (plano) valorTotal = plano.valorTotal.negated();
    else {
      const bases = await saldosBasesTx(tx, produto.id, propriedadeId);
      const basesAplicaveis = produto.rastrearPartidas ? bases.filter(b => distribuicao.some(p => p.partidaId === b.partidaId)) : bases;
      const quantidadeBase = basesAplicaveis.reduce((q,b) => q.plus(b.quantidade), new Prisma.Decimal(0));
      if (!quantidadeBase.gt(0)) {
        if (input.custoUnitario == null) throw new ValorizacaoError("SEM_LASTRO", "Ajuste positivo sem base exige valor documentado ou abertura na ficha do produto");
        if (!input.referenciaValor || !input.evidenciaValor) throw new ValorizacaoError("VALIDACAO", "Inventário inicial exige referência e evidência explícitas do valor");
        valorTotal = new Prisma.Decimal(input.quantidade).mul(input.custoUnitario).toDecimalPlaces(2);
      } else if (produto.rastrearPartidas) {
        valorTotal = new Prisma.Decimal(0);
        const parcelasEntrada: import("./valorizacao.calc.js").ParcelaSaida[] = [];
        for (const p of distribuicao) {
          const b = bases.find(b => b.partidaId === p.partidaId);
          if (!b?.quantidade.gt(0)) throw new ValorizacaoError("SEM_LASTRO", "Separe o ajuste dos grupos novos dos grupos já valorizados e informe valor documentado para os novos");
          const valorGrupo = b.valor.mul(p.quantidade).div(b.quantidade).toDecimalPlaces(2);
          valorTotal = valorTotal.plus(valorGrupo);
          parcelasEntrada.push({ baseId: b.id, quantidade: p.quantidade, valorTotal: valorGrupo });
        }
        planoEntrada = { metodo: "MEDIA_SALDO_V1", parcelas: parcelasEntrada, valorTotal, custoUnitario: valorTotal.div(input.quantidade).toDecimalPlaces(4) };
      } else valorTotal = bases.reduce((v,b) => v.plus(b.valor), new Prisma.Decimal(0)).mul(input.quantidade).div(quantidadeBase).toDecimalPlaces(2);
      if (quantidadeBase.gt(0) && input.custoUnitario != null && !valorTotal.eq(new Prisma.Decimal(input.quantidade).mul(input.custoUnitario).toDecimalPlaces(2))) throw new ValorizacaoError("VALIDACAO", "O ajuste conserva o valor da base existente; o custo informado é diferente");
    }
    const custo = valorTotal.div(input.quantidade).toDecimalPlaces(4);
    const data = new Date(input.data);
    if (input.tipo !== "AJUSTE") {
      throw new EstoqueError("ORIGEM_AUTOMATICA", "Entradas e saídas devem nascer de uma operação financeira ou de um evento operacional; aqui só é permitido ajuste justificado de inventário");
    }
    if (await mesFechado(tx, propriedadeId, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
    // Baixa manual só de produto que já entrou no estoque do sítio — senão o
    // saldo nasceria negativo de um produto que a fazenda nunca estocou.

    const operacao = await tx.operacao.create({ data: {
      tipo: "AJUSTE_ESTOQUE", status: "CONFIRMADA", data, descricao: input.observacao,
      valorTotal: valorTotal.abs(), propriedadeId, criadoPorId: usuarioId ?? null,
      itens: { create: { ordem: 1, produtoId: produto.id, descricao: `Ajuste: ${produto.nome}`, quantidade: new Prisma.Decimal(input.quantidade).abs(), unidade: rotuloUnidade(produto.unidade), valorUnitario: custo, valorTotal: valorTotal.abs(), estocavel: true,
        ...(distribuicao.length ? { partidasSnapshot: distribuicao.map((p) => ({ partidaId: p.partidaId, codigo: p.codigo, validade: p.validade?.toISOString().slice(0, 10) ?? null, quantidade: p.quantidade.toString() })) } : {}) } },
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
        ...(input.referenciaValor && input.evidenciaValor ? { evidenciaValor: { referencia: input.referenciaValor, evidencia: input.evidenciaValor, usuarioId: usuarioId ?? null, valorTotal: valorTotal.toFixed(2) } } : {}),
        operacaoId: operacao.id,
        itemOperacaoId: operacao.itens[0]?.id,
        propriedadeId,
        centroCustoId,
        observacao: input.observacao,
        criadoPorId: usuarioId ?? null,
        ...(distribuicao.length ? { alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } : {}),
      },
    });

    if (plano) await registrarSaidaValorizadaTx(tx, m.id, plano);
    else await registrarEntradaValorizadaTx(tx, m, distribuicao, planoEntrada);
    return { id: m.id, operacaoId: operacao.id };
}

export async function ajustarContagem(input: z.infer<typeof ajusteContagemSchema> & { usuarioId?: number | null }) {
  const propriedadeId = input.propriedadeId ?? await escopoPadraoLeitura();
  if (propriedadeId == null) throw new EstoqueError("VALIDACAO", "Selecione uma fazenda para ajustar o estoque.");
  try {
    return await transacaoValidada(async tx => {
      const produto = await tx.produto.findFirst({ where: { id: input.produtoId, ativo: true } });
      if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto ativo não encontrado");
      // Mesmo escopo de sítio de listarSaldos (sem propriedade = principal), senão o saldo esperado da tela nunca casaria.
      const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId: input.produtoId, status: statusSaldoEstoque, ...(await filtroSitioCusto(propriedadeId)) }, select: { tipo: true, quantidade: true } });
      const saldo = movimentos.reduce((total, m) => m.tipo === "SAIDA" ? total.minus(m.quantidade) : total.plus(m.quantidade), new Prisma.Decimal(0)).toDecimalPlaces(3);
      if (!saldo.equals(new Prisma.Decimal(input.saldoEsperado).toDecimalPlaces(3))) throw new EstoqueError("CONFLITO", "O estoque mudou desde a consulta. Atualize o saldo e confira a diferença antes de confirmar.");
      const delta = new Prisma.Decimal(input.quantidadeContada).minus(saldo);
      if (delta.isZero()) throw new EstoqueError("VALIDACAO", "A quantidade contada já corresponde ao estoque. Nenhum ajuste é necessário.");
      if (delta.abs().greaterThan(MAX_QTD)) throw new EstoqueError("VALIDACAO", "A diferença excede o limite permitido para um ajuste.");
      const resultado = await registrarMovimentoTx(tx, { produtoId: input.produtoId, tipo: "AJUSTE", quantidade: delta.toNumber(), data: iso(new Date()), observacao: input.observacao, centroCustoId: input.centroCustoId, partidas: input.partidas }, propriedadeId, input.usuarioId);
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
 * o original como REVERTIDO. A validação da origem cabe ao domínio que chama.
 */
export async function estornarMovimentoTx(
  tx: Prisma.TransactionClient,
  movimentoId: string,
  opts: { usuarioId?: number | null; observacao?: string; data?: Date; propriedadeId?: number | null } = {},
) {
  const filtroPropriedade = opts.propriedadeId != null ? { propriedadeId: opts.propriedadeId } : {};
  const referencia = await tx.movimentoEstoque.findFirst({ where: { id: movimentoId, ...filtroPropriedade }, select: { operacaoId: true, produtoId: true } });
  if (!referencia) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");

  await travarValorizacaoTx(tx, [referencia.produtoId]);
  // Usa o mesmo lock do cancelamento financeiro. Depois de obtê-lo, relê o
  // movimento para decidir com o estado que venceu a corrida.
  if (referencia.operacaoId != null) {
    await tx.$queryRaw`SELECT "id" FROM "Operacao" WHERE "id" = ${referencia.operacaoId} FOR NO KEY UPDATE`;
  } else {
    await tx.$queryRaw`SELECT "id" FROM "MovimentoEstoque" WHERE "id" = ${movimentoId} FOR NO KEY UPDATE`;
  }
  const mov = await tx.movimentoEstoque.findFirst({ where: { id: movimentoId, ...filtroPropriedade }, include: { revertidoPor: true, alocacaoPartidaEstoques: true } });
  if (!mov) throw new EstoqueError("NAO_ENCONTRADO", "movimento não encontrado");
  const alocacoes = mov.alocacaoPartidaEstoques ?? [];
  if (mov.revertidoPor || mov.status === "REVERTIDO") throw new EstoqueError("ORIGEM_AUTOMATICA", "movimento já estornado");
  if (mov.reversaoDeId != null) throw new EstoqueError("ORIGEM_AUTOMATICA", "um movimento de estorno não pode ser estornado novamente");

  if (mov.origem === "RETIRADA_LEITE") {
    throw new EstoqueError("ORIGEM_AUTOMATICA", "Retirada de leite não permite estorno genérico. Correção comercial não devolve litros ao estoque.");
  }

  if (mov.origem === "NUTRICAO" && mov.metodoValorizacao === "LEITE_FIFO_V1") {
    const fornecimento = await tx.movimentoFornecimentoNutricionalLeite.findUnique({ where: { movimentoId: mov.id }, select: { id: true } });
    if (fornecimento) throw new EstoqueError("ORIGEM_AUTOMATICA", "Este leite pertence a um fechamento de Nutrição. Estorne o fechamento para preservar suas origens e atribuições aos animais.");
  }

  if (mov.origem === "REPRODUCAO") {
    const tentativa = await tx.tentativaReprodutiva.findFirst({ where: { movimentoEstoqueId: mov.id, status: "VALIDO" }, select: { id: true } });
    if (tentativa) throw new EstoqueError("CONFLITO", "Este consumo pertence a uma tentativa reprodutiva válida. Anule a tentativa no fluxo de reprodução antes de estornar o consumo.");
  }
  const pid = mov.propriedadeId ?? await propriedadePrincipalId();
  if (mov.tipo === "ENTRADA" || (mov.tipo === "AJUSTE" && mov.quantidade.gt(0))) {
    await conferirSaldoEstornoPartidasTx(tx, alocacoes, pid);
  }
  const data = opts.data ?? new Date();
  if (await mesFechado(tx, pid, data)) throw new EstoqueError("MES_FECHADO", "período financeiro fechado");
  const inverso = await tx.movimentoEstoque.create({ data: {
    produtoId: mov.produtoId,
    tipo: mov.tipo === "ENTRADA" ? "SAIDA" : mov.tipo === "SAIDA" ? "ENTRADA" : "AJUSTE",
    origem: "AJUSTE_INVENTARIO", data,
    quantidade: mov.tipo === "AJUSTE" ? mov.quantidade.negated() : mov.quantidade,
    custoUnitario: mov.custoUnitario, valorTotal: mov.tipo === "AJUSTE" ? mov.valorTotal?.negated() ?? null : mov.valorTotal,
    propriedadeId: pid, operacaoId: mov.operacaoId, reversaoDeId: mov.id, centroCustoId: mov.centroCustoId,
    observacao: opts.observacao ?? `Estorno do movimento #${mov.seq}`,
    criadoPorId: opts.usuarioId ?? null,
    ...(alocacoes.length ? { alocacaoPartidaEstoques: { create: alocacoes.map((a) => ({ partidaId: a.partidaId, quantidade: mov.tipo === "AJUSTE" ? a.quantidade.negated() : a.quantidade })) } } : {}),
  } });
  await registrarInversoValorizadoTx(tx, mov.id, inverso.id);
  await tx.movimentoEstoque.update({ where: { id: movimentoId }, data: { status: "REVERTIDO" } });
  await auditar(tx, { entidade: "MovimentoEstoque", entidadeId: mov.id, acao: "ESTORNO_MOVIMENTO", usuarioId: opts.usuarioId, motivo: opts.observacao,
    antes: { produtoId: mov.produtoId, tipo: mov.tipo, origem: mov.origem, quantidade: mov.quantidade.toNumber(), operacaoId: mov.operacaoId, centroCustoId: mov.centroCustoId },
    depois: { status: "REVERTIDO", movimentoInversoId: inverso.id } });
  return { original: mov, inverso };
}
