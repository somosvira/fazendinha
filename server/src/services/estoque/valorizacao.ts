import crypto from "node:crypto";
import { Prisma, type MovimentoEstoque } from "@prisma/client";
import { prisma } from "../../db.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { auditar, exigirPeriodoAberto } from "../financeiro/regras.js";
import { transacaoEstoque } from "./transacao.js";
import { repartirValor, valorizarSaida, ValorizacaoError, type MetodoValorizacao, type ParcelaSaida } from "./valorizacao.calc.js";

export { ValorizacaoError } from "./valorizacao.calc.js";
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const dia = (d: Date) => d.toISOString().slice(0, 10);
const estadosSaldo = { in: ["CONFIRMADO", "REVERTIDO"] as ("CONFIRMADO" | "REVERTIDO")[] };
type Db = Prisma.TransactionClient;
export type DistribuicaoValor = { partidaId: string; quantidade: Prisma.Decimal.Value };
export type PlanoSaida = { metodo: MetodoValorizacao; parcelas: ParcelaSaida[]; valorTotal: Prisma.Decimal; custoUnitario: Prisma.Decimal };

/** Trava comum a TODOS os gravadores antes de consultar bases ou saldo. */
export async function travarValorizacaoTx(tx: Db, produtoIds: string[]) {
  const chaves = [...new Set(produtoIds)].map(id => `valorizacao-estoque:${id}`);
  if (chaves.length) await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${chaves}::text[]) AS k) chaves ORDER BY h`;
}
async function escopo(propriedadeId: number) {
  return propriedadeId === await propriedadePrincipalId() ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId };
}
async function metodoProduto(tx: Db, produtoId: string): Promise<MetodoValorizacao> {
  const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId }, select: { rastrearPartidas: true } });
  return produto.rastrearPartidas ? "MEDIA_SALDO_V1" : "FIFO_AQUISICAO_V1";
}
async function grupos(tx: Db, distribuicao: DistribuicaoValor[]) {
  const resultado = new Map<string, Prisma.Decimal>();
  for (const item of distribuicao) {
    const partida = await tx.partidaProduto.findUniqueOrThrow({ where: { id: item.partidaId } });
    const id = partida.lotePrincipalId ?? partida.id;
    resultado.set(id, (resultado.get(id) ?? D(0)).plus(item.quantidade));
  }
  return [...resultado].map(([partidaId, quantidade]) => ({ partidaId, quantidade }));
}
export async function saldosBasesTx(tx: Db, produtoId: string, propriedadeId: number, data?: Date) {
  const metodo = await metodoProduto(tx, produtoId);
  const bases = await tx.baseValorizacaoEstoque.findMany({ where: { produtoId, propriedadeId, metodo, ...(data ? { disponivelDesde: { lte: data }, OR: [{ corteAbertura: null }, { corteAbertura: { lte: data } }] } : {}) },
    include: { parcelas: { orderBy: [{ ordem: "asc" }, { id: "asc" }], ...(data ? { where: { movimentoEstoque: { data: { lte: data } } } } : {}) } }, orderBy: [{ disponivelDesde: "asc" }, { ordem: "asc" }, { id: "asc" }] });
  return bases.map(b => ({ ...b, quantidade: b.parcelas.reduce((s, p) => s.plus(p.quantidade), b.quantidadeAbertura),
    valor: b.parcelas.reduce((s, p) => s.plus(p.valorTotal), b.valorAbertura) }));
}
async function saldoFisicoTx(tx: Db, produtoId: string, propriedadeId: number, partidaId?: string | null, excluirMovimentoId?: string, data?: Date) {
  const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId, status: estadosSaldo, ...await escopo(propriedadeId), ...(data ? { data: { lte: data } } : {}), ...(excluirMovimentoId ? { id: { not: excluirMovimentoId } } : {}) },
    include: { alocacaoPartidaEstoques: { orderBy: [{ partidaId: "asc" }, { id: "asc" }], include: { partida: { select: { lotePrincipalId: true } } } } } });
  return movimentos.reduce((s, m) => {
    const qtd = partidaId == null ? m.quantidade : m.alocacaoPartidaEstoques.filter(a => (a.partida.lotePrincipalId ?? a.partidaId) === partidaId).reduce((t, a) => t.plus(a.quantidade), D(0));
    return s.plus(m.tipo === "SAIDA" ? qtd.negated() : qtd);
  }, D(0));
}
async function conferirLastroTx(tx: Db, produtoId: string, propriedadeId: number, excluirMovimentoId?: string) {
  const bases = await saldosBasesTx(tx, produtoId, propriedadeId);
  const fisico = await saldoFisicoTx(tx, produtoId, propriedadeId, null, excluirMovimentoId);
  if (!fisico.eq(bases.reduce((s, b) => s.plus(b.quantidade), D(0))))
    throw new ValorizacaoError("SEM_LASTRO", "O saldo físico ainda não tem abertura de valor documentada. Confira a valorização na ficha do produto.");
  if (await metodoProduto(tx, produtoId) === "MEDIA_SALDO_V1") {
    for (const base of bases) if (!base.quantidade.eq(await saldoFisicoTx(tx, produtoId, propriedadeId, base.partidaId, excluirMovimentoId)))
      throw new ValorizacaoError("SEM_LASTRO", "O saldo do grupo diverge da base de valor; regularize a abertura documentada");
  }
  return bases;
}
export async function previaRetroatividadeTx(tx: Db, produtoId: string, propriedadeId: number, data: Date, excluirMovimentoId?: string) {
  const posteriores = await tx.movimentoEstoque.findMany({ where: { produtoId, ...await escopo(propriedadeId), status: estadosSaldo,
    data: { gt: data }, ...(excluirMovimentoId ? { id: { not: excluirMovimentoId } } : {}) }, select: { id: true, seq: true, data: true, origem: true }, orderBy: { seq: "asc" }, take: 20 });
  const aberturasPosteriores = await tx.baseValorizacaoEstoque.count({ where: { produtoId, propriedadeId, corteAbertura: { gt: data }, aberturaDocumentada: { not: Prisma.DbNull } } });
  return { permitido: posteriores.length === 0 && aberturasPosteriores === 0, posteriores, aberturasPosteriores,
    motivo: posteriores.length || aberturasPosteriores ? "O registro antecede movimentos ou abertura já existentes. Regularize os dependentes; não há recálculo histórico automático." : null };
}
async function conferirCronologiaTx(tx: Db, produtoId: string, propriedadeId: number, data: Date, excluir?: string) {
  const previa = await previaRetroatividadeTx(tx, produtoId, propriedadeId, data, excluir);
  if (!previa.permitido) throw new ValorizacaoError("CONFLITO", previa.motivo!);
}
export async function planejarSaidaTx(tx: Db, input: { produtoId: string; propriedadeId: number; data: Date; quantidade: Prisma.Decimal.Value; partidas?: DistribuicaoValor[] }): Promise<PlanoSaida> {
  await travarValorizacaoTx(tx, [input.produtoId]);
  await exigirPeriodoAberto(tx, input.propriedadeId, input.data);
  await conferirCronologiaTx(tx, input.produtoId, input.propriedadeId, input.data);
  await conferirLastroTx(tx, input.produtoId, input.propriedadeId);
  const metodo = await metodoProduto(tx, input.produtoId);
  const bases = await saldosBasesTx(tx, input.produtoId, input.propriedadeId, input.data);
  const parcelas: ParcelaSaida[] = [];
  const converter = (b: typeof bases[number]) => ({ id: b.id, quantidade: b.quantidade, valor: b.valor, estadoValor: "CONHECIDO" as const, data: dia(b.disponivelDesde), ordem: b.ordem });
  if (metodo === "MEDIA_SALDO_V1") {
    const distribuicao = await grupos(tx, input.partidas ?? []);
    if (!distribuicao.reduce((s, p) => s.plus(p.quantidade), D(0)).eq(input.quantidade)) throw new ValorizacaoError("VALIDACAO", "Informe os grupos da saída com a quantidade total");
    for (const p of distribuicao) {
      const base = bases.find(b => b.partidaId === p.partidaId);
      if (!base) throw new ValorizacaoError("SEM_LASTRO", "Grupo sem valor comprovado: registre a abertura documentada");
      parcelas.push(...valorizarSaida({ quantidade: p.quantidade, metodo, bases: [converter(base)], dataReferencia: dia(input.data) }).parcelas);
    }
  } else parcelas.push(...valorizarSaida({ quantidade: input.quantidade, metodo, bases: bases.map(converter), dataReferencia: dia(input.data) }).parcelas);
  const valorTotal = parcelas.reduce((s, p) => s.plus(p.valorTotal), D(0));
  return { metodo, parcelas, valorTotal, custoUnitario: valorTotal.div(input.quantidade).toDecimalPlaces(4) };
}
export async function registrarSaidaValorizadaTx(tx: Db, movimentoId: string, plano: PlanoSaida) {
  await tx.movimentoEstoque.update({ where: { id: movimentoId }, data: { metodoValorizacao: plano.metodo } });
  await tx.parcelaValorizacaoEstoque.createMany({ data: plano.parcelas.map((p, ordem) => ({ movimentoEstoqueId: movimentoId, baseId: p.baseId, ordem, quantidade: p.quantidade.negated(), valorTotal: p.valorTotal.negated() })) });
}
export async function registrarEntradaValorizadaTx(tx: Db, movimento: MovimentoEstoque, distribuicao: DistribuicaoValor[], origemPlano?: PlanoSaida) {
  if (movimento.valorTotal == null || movimento.custoUnitario == null)
    throw new ValorizacaoError("VALIDACAO", "Valor pendente é permitido somente pelo fluxo próprio de produção de leite");
  const propriedadeId = movimento.propriedadeId ?? await propriedadePrincipalId();
  if (["INVENTARIO_INICIAL", "BONIFICACAO", "PRODUCAO"].includes(movimento.origem)) {
    const evidencia = movimento.evidenciaValor as { referencia?: unknown; evidencia?: unknown } | null;
    if (!evidencia || typeof evidencia.referencia !== "string" || evidencia.referencia.trim().length < 2 || typeof evidencia.evidencia !== "string" || evidencia.evidencia.trim().length < 5)
      throw new ValorizacaoError("VALIDACAO", "Entrada sem compra exige referência e evidência explícitas do valor, inclusive zero");
  }
  await travarValorizacaoTx(tx, [movimento.produtoId]);
  await conferirCronologiaTx(tx, movimento.produtoId, propriedadeId, movimento.data, movimento.id);
  await conferirLastroTx(tx, movimento.produtoId, propriedadeId, movimento.id);
  const metodo = await metodoProduto(tx, movimento.produtoId);
  if (metodo === "FIFO_AQUISICAO_V1" && origemPlano) {
    if (!origemPlano.parcelas.reduce((q,p) => q.plus(p.quantidade),D(0)).eq(movimento.quantidade) || !origemPlano.valorTotal.eq(movimento.valorTotal)) throw new ValorizacaoError("CONFLITO", "Parcelas de aquisição não conciliam a transferência");
    for (const [ordem, parcela] of origemPlano.parcelas.entries()) {
      const base = await tx.baseValorizacaoEstoque.create({ data: { produtoId: movimento.produtoId, propriedadeId, metodo, origemMovimentoId: movimento.id, baseOrigemId: parcela.baseId, disponivelDesde: movimento.data } });
      await tx.parcelaValorizacaoEstoque.create({ data: { movimentoEstoqueId: movimento.id, baseId: base.id, ordem, quantidade: parcela.quantidade, valorTotal: parcela.valorTotal } });
    }
    await tx.movimentoEstoque.update({ where: { id: movimento.id }, data: { metodoValorizacao: metodo } });
    return;
  }
  const partes = metodo === "MEDIA_SALDO_V1" ? await grupos(tx, distribuicao) : [{ partidaId: null, quantidade: movimento.quantidade }];
  if (!partes.reduce((s, p) => s.plus(p.quantidade), D(0)).eq(movimento.quantidade)) throw new ValorizacaoError("VALIDACAO", "Grupos da entrada não fecham a quantidade");
  const valores = repartirValor(movimento.valorTotal, partes.map(p => p.quantidade));
  if (origemPlano && metodo === "MEDIA_SALDO_V1") {
    const origens = await tx.baseValorizacaoEstoque.findMany({ where: { id: { in: origemPlano.parcelas.map(p => p.baseId) } } });
    partes.forEach((p, i) => { valores[i] = origemPlano.parcelas.filter(o => origens.find(b => b.id === o.baseId)?.partidaId === p.partidaId).reduce((s, o) => s.plus(o.valorTotal), D(0)); });
    if (!valores.reduce((s, v) => s.plus(v), D(0)).eq(movimento.valorTotal)) throw new ValorizacaoError("CONFLITO", "Parcelas transferidas não fecham o valor recebido");
  }
  for (const [ordem, p] of partes.entries()) {
    let base = p.partidaId ? await tx.baseValorizacaoEstoque.findFirst({ where: { produtoId: movimento.produtoId, propriedadeId, partidaId: p.partidaId, metodo } }) : null;
    if (!base) base = await tx.baseValorizacaoEstoque.create({ data: { produtoId: movimento.produtoId, propriedadeId, partidaId: p.partidaId,
      origemMovimentoId: movimento.id, metodo, disponivelDesde: movimento.data } });
    await tx.parcelaValorizacaoEstoque.create({ data: { movimentoEstoqueId: movimento.id, baseId: base.id, ordem, quantidade: p.quantidade, valorTotal: valores[ordem] } });
  }
  await tx.movimentoEstoque.update({ where: { id: movimento.id }, data: { metodoValorizacao: metodo } });
}
export async function registrarInversoValorizadoTx(tx: Db, originalId: string, inversoId: string) {
  const original = await tx.movimentoEstoque.findUniqueOrThrow({ where: { id: originalId }, include: { parcelasValorizacao: { include: { base: true } } } });
  const propriedadeId = original.propriedadeId ?? await propriedadePrincipalId();
  await travarValorizacaoTx(tx, [original.produtoId]);
  if (original.metodoValorizacao === "LEGADO") {
    if (await tx.baseValorizacaoEstoque.count({ where: { produtoId: original.produtoId, propriedadeId } }))
      throw new ValorizacaoError("CONFLITO", "Movimento legado já abrangido pela abertura: a correção exige regularização documentada");
    return;
  }
  if (original.metodoValorizacao !== await metodoProduto(tx, original.produtoId)) throw new ValorizacaoError("CONFLITO", "O rastreio mudou após este movimento; regularize a transição antes de estornar");
  const inverso = await tx.movimentoEstoque.findUniqueOrThrow({ where: { id: inversoId } });
  await conferirCronologiaTx(tx, original.produtoId, propriedadeId, inverso.data, inversoId);
  const entrada = original.tipo === "ENTRADA" || original.tipo === "AJUSTE" && original.quantidade.gt(0);
  if (entrada && await tx.parcelaValorizacaoEstoque.count({ where: { baseId: { in: original.parcelasValorizacao.map(p => p.baseId) }, quantidade: { lt: 0 }, movimentoEstoque: { seq: { gt: original.seq }, status: "CONFIRMADO", reversaoDeId: null } } }))
    throw new ValorizacaoError("CONFLITO", "A entrada tem consumidores posteriores; regularize antes de estornar");
  await tx.movimentoEstoque.update({ where: { id: inversoId }, data: { metodoValorizacao: original.metodoValorizacao } });
  await tx.parcelaValorizacaoEstoque.createMany({ data: original.parcelasValorizacao.map(p => ({ movimentoEstoqueId: inversoId, baseId: p.baseId, ordem: p.ordem, quantidade: p.quantidade.negated(), valorTotal: p.valorTotal.negated() })) });
}

export async function diagnosticarValorizacaoTx(tx: Db, produtoId: string, propriedadeId: number, data: Date) {
  const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId }, select: { id: true, rastrearPartidas: true } });
  const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId, ...await escopo(propriedadeId), status: estadosSaldo, data: { lte: data } }, orderBy: { seq: "asc" },
    include: { alocacaoPartidaEstoques: { orderBy: [{ partidaId: "asc" }, { id: "asc" }], include: { partida: { select: { lotePrincipalId: true } } } } } });
  const bases = await saldosBasesTx(tx, produtoId, propriedadeId, data);
  const idsGrupo = produto.rastrearPartidas ? [...new Set(movimentos.flatMap(m => m.alocacaoPartidaEstoques.map(a => a.partida.lotePrincipalId ?? a.partidaId)))] : [null];
  const gruposSaldo = await Promise.all(idsGrupo.map(async partidaId => {
    const partida = partidaId ? await tx.partidaProduto.findUnique({ where: { id: partidaId }, select: { nome: true, codigo: true, validade: true } }) : null;
    const quantidade = await saldoFisicoTx(tx, produtoId, propriedadeId, partidaId, undefined, data);
    const existentes = bases.filter(b => b.partidaId === partidaId);
    const quantidadeValorizada = existentes.reduce((s, b) => s.plus(b.quantidade), D(0));
    const conhecido = quantidade.eq(quantidadeValorizada);
    return { partidaId, grupoNome: partida?.nome ?? partida?.codigo ?? "Sem rastreio — aquisições", codigo: partida?.codigo ?? null, validade: partida?.validade ? dia(partida.validade) : null, quantidade: quantidade.toString(), quantidadeValorizada: quantidadeValorizada.toString(), estadoValor: conhecido ? "CONHECIDO" as const : "DESCONHECIDO" as const,
      valor: conhecido ? existentes.reduce((s, b) => s.plus(b.valor), D(0)).toFixed(2) : null, metodo: produto.rastrearPartidas ? "MEDIA_SALDO_V1" : "FIFO_AQUISICAO_V1" };
  }));
  const revisao = crypto.createHash("sha256").update(JSON.stringify({ produto, propriedadeId, data: dia(data), movimentos, bases })).digest("hex");
  return { produtoId, propriedadeId, data: dia(data), revisao, grupos: gruposSaldo, retroatividade: await previaRetroatividadeTx(tx, produtoId, propriedadeId, data),
    legado: "Consumidores anteriores conservam seus valores e método. Quantidade sem valor comprovado exige abertura documentada." };
}
export async function diagnosticarValorizacao(produtoId: string, propriedadeId: number, data: Date) {
  return prisma.$transaction(tx => diagnosticarValorizacaoTx(tx, produtoId, propriedadeId, data));
}
export async function abrirValorizacao(input: { chave: string; produtoId: string; propriedadeId: number; data: string; revisao: string; motivo: string; evidencia: string; bases: { partidaId?: string | null; quantidade: string; valor: string; disponivelDesde?: string; referencia: string }[] }, usuarioId: number | null) {
  return transacaoEstoque(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`abertura-valorizacao:${input.chave}`}))`;
    await travarValorizacaoTx(tx, [input.produtoId]);
    const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
    const anterior = await tx.auditoriaFinanceira.findFirst({ where: { entidade: "AberturaValorizacaoEstoque", entidadeId: input.chave } });
    if (anterior) {
      const estado = anterior.estadoPosterior as { hash: string };
      if (estado.hash !== hash || anterior.usuarioId !== usuarioId) throw new ValorizacaoError("CONFLITO", "Chave de abertura utilizada com outros dados");
      return { salvo: true, reenvio: true };
    }
    const data = new Date(`${input.data}T00:00:00Z`);
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const previa = await diagnosticarValorizacaoTx(tx, input.produtoId, input.propriedadeId, data);
    if (previa.revisao !== input.revisao) throw new ValorizacaoError("CONFLITO", "O estoque mudou desde a prévia. Confira novamente a abertura.");
    if (!previa.retroatividade.permitido) throw new ValorizacaoError("CONFLITO", previa.retroatividade.motivo!);
    const metodo = await metodoProduto(tx, input.produtoId);
    const porGrupo = new Map<string | null, typeof input.bases>();
    for (const item of input.bases) {
      const partidaId = item.partidaId ?? null;
      if ((metodo === "MEDIA_SALDO_V1") !== !!partidaId) throw new ValorizacaoError("VALIDACAO", "Grupo de abertura incompatível com o rastreio");
      if (partidaId && !await tx.partidaProduto.findFirst({ where: { id: partidaId, produtoId: input.produtoId, lotePrincipalId: null } })) throw new ValorizacaoError("VALIDACAO", "Selecione um grupo raiz deste produto");
      const itens = porGrupo.get(partidaId) ?? []; itens.push(item); porGrupo.set(partidaId, itens);
    }
    for (const [partidaId, itens] of porGrupo) {
      if (await tx.baseValorizacaoEstoque.count({ where: { produtoId: input.produtoId, propriedadeId: input.propriedadeId, metodo, partidaId } })) throw new ValorizacaoError("CONFLITO", "Grupo já tem abertura ou movimentos valorizados; não duplique o saldo");
      if (metodo === "MEDIA_SALDO_V1" && itens.length !== 1) throw new ValorizacaoError("VALIDACAO", "Informe uma abertura por grupo");
      const quantidade = itens.reduce((s, i) => s.plus(i.quantidade), D(0));
      if (!quantidade.gt(0) || !quantidade.eq(await saldoFisicoTx(tx, input.produtoId, input.propriedadeId, partidaId))) throw new ValorizacaoError("VALIDACAO", "A abertura deve corresponder exatamente ao saldo físico do grupo");
      for (const item of [...itens].sort((a,b) => (a.disponivelDesde ?? input.data).localeCompare(b.disponivelDesde ?? input.data))) {
        const disponivel = new Date(`${item.disponivelDesde ?? input.data}T00:00:00Z`);
        if (disponivel > data) throw new ValorizacaoError("VALIDACAO", "Disponibilidade não pode ser posterior ao corte de abertura");
        await tx.baseValorizacaoEstoque.create({ data: { produtoId: input.produtoId, propriedadeId: input.propriedadeId, partidaId, metodo,
          disponivelDesde: disponivel, corteAbertura: data, quantidadeAbertura: item.quantidade, valorAbertura: item.valor,
          aberturaDocumentada: { chave: input.chave, corte: input.data, disponibilidadeOrigem: item.disponivelDesde ?? input.data, referencia: item.referencia, motivo: input.motivo, evidencia: input.evidencia, usuarioId, revisao: input.revisao } } });
      }
    }
    await auditar(tx, { entidade: "AberturaValorizacaoEstoque", entidadeId: input.chave, acao: "ABERTURA_DOCUMENTADA", usuarioId, motivo: input.motivo, antes: previa,
      depois: { hash, produtoId: input.produtoId, propriedadeId: input.propriedadeId, data: input.data, bases: input.bases, evidencia: input.evidencia } });
    return { salvo: true, reenvio: false };
  });
}
