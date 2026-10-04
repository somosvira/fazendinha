import crypto from "node:crypto";
import { transacaoEstoque } from "./transacao.js";
import { Prisma, type TipoMovimento } from "@prisma/client";
import { prisma } from "../../db.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { EstoqueError, statusSaldoEstoque } from "./estoque.js";
import { obterBaseCusto } from "./estoque.js";
import { exigirPeriodoAberto } from "../financeiro/regras.js";
import { valorSaidaDaBase } from "./estoque.calc.js";
import { nomeLotePadrao, validadeVencida } from "./partidas.calc.js";
export { nomeLotePadrao, validadeVencida } from "./partidas.calc.js";

export type SelecaoPartida = { partidaId?: string; codigo?: string; nome?: string; validade?: string | null; quantidade: number | string; cienciaValidadeDesconhecida?: boolean };

const decimal = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

export async function resolverLotePrincipalTx(tx: Prisma.TransactionClient, partidaId: string, produtoId?: string) {
  const partida = await tx.partidaProduto.findFirst({ where: { id: partidaId, ...(produtoId ? { produtoId } : {}) } });
  if (!partida) throw new EstoqueError("VALIDACAO", "Lote não pertence a este Produto");
  if (!partida.lotePrincipalId) return partida;
  const raiz = await tx.partidaProduto.findFirst({ where: { id: partida.lotePrincipalId, produtoId: partida.produtoId, lotePrincipalId: null } });
  if (!raiz) throw new EstoqueError("CONFLITO", "Agrupamento do lote inválido. Confira o histórico.");
  return raiz;
}

export async function idsGrupoPartidaTx(tx: Prisma.TransactionClient, partidaId: string) {
  const raiz = await resolverLotePrincipalTx(tx, partidaId);
  const aliases = await tx.partidaProduto.findMany({ where: { lotePrincipalId: raiz.id }, select: { id: true } });
  return [raiz.id, ...aliases.map((p) => p.id)];
}

async function obterOuCriarGrupoTx(tx: Prisma.TransactionClient, produtoId: string, escolha: SelecaoPartida) {
  if (escolha.validade === undefined) throw new EstoqueError("VALIDACAO", "Informe a validade ou escolha Validade não informada");
  const validade = escolha.validade === null ? null : new Date(`${escolha.validade}T00:00:00Z`);
  if (validade && (!Number.isFinite(validade.getTime()) || validade.toISOString().slice(0, 10) !== escolha.validade)) throw new EstoqueError("VALIDACAO", "Informe uma validade válida");
  const existente = await tx.partidaProduto.findFirst({ where: { produtoId, validade, lotePrincipalId: null } });
  if (existente) return existente;
  const produto = await tx.produto.findUniqueOrThrow({ where: { id: produtoId }, select: { nome: true } });
  return tx.partidaProduto.create({ data: { produtoId, validade, codigo: `LOTE-${crypto.randomUUID()}`, nome: escolha.nome?.trim() || nomeLotePadrao(produto.nome, validade) } });
}

function resumoAtivacao(movimentos: Array<{ id: string; seq: number; status: string; tipo: TipoMovimento; propriedadeId: number | null; quantidade: Prisma.Decimal; valorTotal: Prisma.Decimal }>, principal: number) {
  const saldos = new Map<number, Prisma.Decimal>();
  for (const m of movimentos) {
    const propriedadeId = m.propriedadeId ?? principal;
    const saldo = saldos.get(propriedadeId) ?? decimal(0);
    saldos.set(propriedadeId, m.tipo === "SAIDA" ? saldo.minus(m.quantidade) : saldo.plus(m.quantidade));
  }
  const revisao = crypto.createHash("sha256").update(JSON.stringify(movimentos.map((m) => [m.id, m.seq, m.status, m.tipo, m.propriedadeId, m.quantidade.toString(), m.valorTotal.toString()]))).digest("hex");
  return { revisao, movimentosLegados: movimentos.length, saldos: [...saldos].map(([propriedadeId, saldo]) => ({ propriedadeId, quantidade: saldo.toString() })), saldosBrutos: saldos };
}

export async function previaAtivacaoRastreio(produtoId: string) {
  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true, rastrearPartidas: true } });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto não encontrado");
  if (produto.rastrearPartidas) throw new EstoqueError("CONFLITO", "O Produto já controla lotes");
  const movimentos = await prisma.movimentoEstoque.findMany({ where: { produtoId, status: statusSaldoEstoque }, orderBy: { seq: "asc" }, select: { id: true, seq: true, status: true, tipo: true, propriedadeId: true, quantidade: true, valorTotal: true } });
  const resumo = resumoAtivacao(movimentos, await propriedadePrincipalId());
  return { produtoId, revisao: resumo.revisao, movimentosLegados: resumo.movimentosLegados, saldos: resumo.saldos, partidaTecnica: "LEGADO_NAO_IDENTIFICADO", alteracaoLiquidaQuantidade: "0", alteracaoLiquidaValor: "0" };
}

export async function saldoPartidaTx(tx: Prisma.TransactionClient, partidaId: string, propriedadeId: number) {
  const principal = await propriedadePrincipalId();
  const alocacoes = await tx.alocacaoPartidaEstoque.findMany({ where: {
    partidaId: { in: await idsGrupoPartidaTx(tx, partidaId) }, movimentoEstoque: { status: statusSaldoEstoque,
      ...(propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }) },
  }, include: { movimentoEstoque: { select: { tipo: true } } } });
  return alocacoes.reduce((saldo, a) => a.movimentoEstoque.tipo === "SAIDA" ? saldo.minus(a.quantidade) : saldo.plus(a.quantidade), decimal(0));
}

export async function conferirSaldoEstornoPartidasTx(tx: Prisma.TransactionClient, alocacoes: Array<{ partidaId: string; quantidade: Prisma.Decimal }>, propriedadeId: number) {
  const grupos = new Map<string, Prisma.Decimal>();
  for (const a of alocacoes) {
    const raiz = await resolverLotePrincipalTx(tx, a.partidaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${raiz.produtoId}`}))`;
    grupos.set(raiz.id, (grupos.get(raiz.id) ?? decimal(0)).plus(a.quantidade));
  }
  for (const [id, quantidade] of grupos) if ((await saldoPartidaTx(tx, id, propriedadeId)).lt(quantidade)) throw new EstoqueError("CONFLITO", "O lote da entrada já foi consumido; reconcilie o estoque antes de estornar.");
}

/** Resolve e valida as partidas antes de criar o movimento. Não altera saldo por si só. */
export async function prepararPartidasTx(tx: Prisma.TransactionClient, args: {
  produtoId: string; rastrearPartidas: boolean; propriedadeId: number; tipo: TipoMovimento;
  quantidade: Prisma.Decimal; partidas?: SelecaoPartida[]; data?: Date; descarte?: boolean;
  usuarioId?: number | null;
}) {
  const escolhas = args.partidas ?? [];
  if (!args.rastrearPartidas) {
    if (escolhas.length) throw new EstoqueError("VALIDACAO", "Este Produto não controla lotes");
    return [];
  }
  if (!escolhas.length) throw new EstoqueError("VALIDACAO", "Informe os lotes do Produto rastreado");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${args.produtoId}`}))`;
  const soma = escolhas.reduce((s, p) => s.plus(p.quantidade), decimal(0));
  if (!soma.equals(args.quantidade)) throw new EstoqueError("VALIDACAO", "A soma dos lotes deve ser igual à quantidade do movimento");
  const saida = args.tipo === "SAIDA" || (args.tipo === "AJUSTE" && args.quantidade.lt(0));
  const resultado: Array<{ partidaId: string; quantidade: Prisma.Decimal; codigo: string; nome: string | null; validade: Date | null; cienciaValidadeDesconhecida: boolean }> = [];
  for (const escolha of escolhas) {
    const quantidade = decimal(escolha.quantidade);
    // A saída guarda quantidade positiva; o sinal físico vem de tipo=SAIDA.
    // Apenas um AJUSTE negativo usa quantidade/alocação negativas no razão.
    if (!quantidade.isFinite() || quantidade.isZero() || quantidade.decimalPlaces() > 3
      || (args.quantidade.isNegative() ? quantidade.gte(0) : quantidade.lte(0))) {
      throw new EstoqueError("VALIDACAO", "Quantidade inválida na distribuição por lote");
    }
    let partida = escolha.partidaId ? await resolverLotePrincipalTx(tx, escolha.partidaId, args.produtoId) : null;
    if (saida && !partida) throw new EstoqueError("VALIDACAO", "Selecione um lote existente para a saída");
    if (!saida && !partida) {
      partida = await obterOuCriarGrupoTx(tx, args.produtoId, escolha);
    }
    if (!partida) throw new EstoqueError("VALIDACAO", "Lote inválido");
    if (saida && !args.descarte && args.tipo !== "AJUSTE") {
      if (partida.validade && validadeVencida(partida.validade, args.data ?? new Date())) throw new EstoqueError("VALIDACAO", `Lote ${partida.nome ?? partida.codigo} vencido na data do uso operacional`);
      if (!partida.validade && !escolha.cienciaValidadeDesconhecida) throw new EstoqueError("VALIDACAO", "Confirme a ciência de uso do lote com validade não informada");
    }
    const anterior = resultado.find((p) => p.partidaId === partida.id);
    if (anterior) anterior.quantidade = anterior.quantidade.plus(quantidade);
    else resultado.push({ partidaId: partida.id, quantidade, codigo: partida.codigo, nome: partida.nome, validade: partida.validade, cienciaValidadeDesconhecida: !!escolha.cienciaValidadeDesconhecida });
  }
  for (const p of resultado) if (saida && (await saldoPartidaTx(tx, p.partidaId, args.propriedadeId)).lt(p.quantidade.abs())) throw new EstoqueError("VALIDACAO", `Saldo insuficiente no lote ${p.codigo}`);
  if (saida && !args.descarte && args.tipo !== "AJUSTE") for (const p of resultado.filter((p) => !p.validade)) {
    await tx.auditoriaFinanceira.create({ data: { entidade: "PartidaProduto", entidadeId: p.partidaId, acao: "CIENCIA_VALIDADE_DESCONHECIDA", usuarioId: args.usuarioId && args.usuarioId > 0 ? args.usuarioId : null,
      estadoPosterior: { propriedadeId: args.propriedadeId, produtoId: args.produtoId, quantidade: p.quantidade.toString(), data: (args.data ?? new Date()).toISOString().slice(0, 10), ciencia: true } } });
  }
  return resultado;
}

/** Ativação auditável: o razão antigo permanece intacto e passa a apontar à partida técnica. */
export async function ativarRastreio(produtoId: string, usuarioId: number | null, revisaoConferida?: string) {
  return transacaoEstoque(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${produtoId}`}))`;
    const produto = await tx.produto.findUnique({ where: { id: produtoId } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto não encontrado");
    if (produto.rastrearPartidas) throw new EstoqueError("CONFLITO", "O Produto já controla lotes");
    const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId, status: statusSaldoEstoque }, orderBy: { seq: "asc" } });
    const resumo = resumoAtivacao(movimentos, await propriedadePrincipalId());
    if (revisaoConferida && revisaoConferida !== resumo.revisao) throw new EstoqueError("CONFLITO", "O estoque mudou desde a prévia. Confira novamente antes de ativar o rastreio.");
    if ([...resumo.saldosBrutos.values()].some((saldo) => saldo.lt(0))) throw new EstoqueError("CONFLITO", "Há saldo legado negativo; reconcilie o estoque antes de ativar lotes");
    const legado = movimentos.length ? await obterOuCriarGrupoTx(tx, produtoId, { validade: null, quantidade: 1 }) : null;
    if (legado) await tx.partidaProduto.update({ where: { id: legado.id }, data: { origemRastreio: "LEGADO_NAO_IDENTIFICADO" } });
    if (legado) for (const m of movimentos) await tx.alocacaoPartidaEstoque.create({ data: { movimentoEstoqueId: m.id, partidaId: legado.id, quantidade: m.quantidade } });
    await tx.produto.update({ where: { id: produtoId }, data: { rastrearPartidas: true } });
    await tx.auditoriaFinanceira.create({ data: { entidade: "Produto", entidadeId: produtoId, acao: "ATIVAR_RASTREIO_PARTIDAS",
      usuarioId: usuarioId && usuarioId > 0 ? usuarioId : null, estadoAnterior: { rastrearPartidas: false }, estadoPosterior: { rastrearPartidas: true, movimentosLegados: movimentos.length, partidaId: legado?.id ?? null } } });
    return { produtoId, partidaLegadaId: legado?.id ?? null, movimentosLegados: movimentos.length, saldos: resumo.saldos };
  });
}

export async function listarPartidas(produtoId: string, propriedadeId: number | null) {
  const partidas = await prisma.partidaProduto.findMany({ where: { produtoId }, orderBy: [{ validade: "asc" }, { codigo: "asc" }] });
  const principal = await propriedadePrincipalId();
  const alocacoes = await prisma.alocacaoPartidaEstoque.findMany({ where: {
    partidaId: { in: partidas.map((p) => p.id) }, movimentoEstoque: { status: statusSaldoEstoque,
      ...(propriedadeId == null ? {} : propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }) },
  }, select: { partidaId: true, quantidade: true, movimentoEstoque: { select: { tipo: true } } } });
  const saldos = new Map<string, Prisma.Decimal>();
  const raizes = new Map(partidas.map((p) => [p.id, p.lotePrincipalId ?? p.id]));
  for (const a of alocacoes) { const id = raizes.get(a.partidaId)!; saldos.set(id, (saldos.get(id) ?? decimal(0)).plus(a.movimentoEstoque.tipo === "SAIDA" ? a.quantidade.negated() : a.quantidade)); }
  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, select: { nome: true } });
  return partidas.filter((p) => !p.lotePrincipalId && alocacoes.some((a) => raizes.get(a.partidaId) === p.id)).map((partida) => ({
    id: partida.id, codigo: partida.codigo, nome: partida.nome ?? nomeLotePadrao(produto?.nome ?? "Produto", partida.validade), validade: partida.validade, fabricante: partida.fabricante,
    lotePrincipalId: null, aliases: partidas.filter((p) => p.lotePrincipalId === partida.id).map((p) => ({ id: p.id, codigo: p.codigo })),
    origemRastreio: partida.origemRastreio, saldo: (saldos.get(partida.id) ?? decimal(0)).toString(),
  }));
}

export async function identificarLegado(input: { chave: string; produtoId: string; propriedadeId: number; codigo?: string; nome?: string; validade?: string | null; quantidade: string; motivo: string; data: string }, usuarioId: number | null) {
  usuarioId = usuarioId && usuarioId > 0 ? usuarioId : null;
  const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return transacaoEstoque(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${input.produtoId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`estoque-identificacao:${input.chave}`}))`;
    const anterior = await tx.auditoriaFinanceira.findFirst({ where: { acao: "IDENTIFICAR_ESTOQUE_LEGADO", estadoPosterior: { path: ["chave"], equals: input.chave } } });
    if (anterior) {
      const resultado = anterior.estadoPosterior as { hash: string; partidaId: string; movimentos: string[] };
      if (resultado.hash !== hash || anterior.usuarioId !== usuarioId) throw new EstoqueError("CONFLITO", "Chave de reenvio usada com outros dados");
      return { partidaId: resultado.partidaId, movimentos: resultado.movimentos };
    }
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    const legado = await tx.partidaProduto.findFirst({ where: { produtoId: input.produtoId, validade: null, lotePrincipalId: null } });
    const quantidade = decimal(input.quantidade);
    if (!produto?.rastrearPartidas || !legado) throw new EstoqueError("VALIDACAO", "Produto sem lote técnico de legado");
    if (!quantidade.isFinite() || quantidade.lte(0) || quantidade.decimalPlaces() > 3) throw new EstoqueError("VALIDACAO", "Quantidade inválida");
    if ((await saldoPartidaTx(tx, legado.id, input.propriedadeId)).lt(quantidade)) throw new EstoqueError("VALIDACAO", "Quantidade maior que o saldo não identificado");
    if (!input.validade) throw new EstoqueError("VALIDACAO", "Informe a validade identificada; validade não informada já pertence ao grupo de origem");
    const data = new Date(`${input.data}T00:00:00Z`);
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const identificada = await obterOuCriarGrupoTx(tx, produto.id, input);
    const base = await obterBaseCusto(tx, produto.id, input.propriedadeId);
    const { custoUnitario, valorTotal: valor } = valorSaidaDaBase(quantidade, base);
    const movimentos = [];
    for (const [partidaId, sinal] of [[legado.id, -1], [identificada.id, 1]] as const) {
      movimentos.push(await tx.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: input.propriedadeId, data, tipo: "AJUSTE", origem: "IDENTIFICACAO_PARTIDA", quantidade: quantidade.mul(sinal), custoUnitario, valorTotal: valor.mul(sinal), criadoPorId: usuarioId, observacao: `Identificação de legado: ${input.motivo}`, alocacaoPartidaEstoques: { create: { partidaId, quantidade: quantidade.mul(sinal) } } } }));
    }
    await tx.auditoriaFinanceira.create({ data: { entidade: "Produto", entidadeId: produto.id, acao: "IDENTIFICAR_ESTOQUE_LEGADO", usuarioId, estadoAnterior: { partidaId: legado.id }, estadoPosterior: { chave: input.chave, hash, propriedadeId: input.propriedadeId, partidaId: identificada.id, quantidade: quantidade.toString(), motivo: input.motivo, movimentos: movimentos.map((m) => m.id), quantidadeLiquida: "0", valorLiquido: "0" } } });
    return { partidaId: identificada.id, movimentos: movimentos.map((m) => m.id) };
  });
}

export async function previaGrupoEntrada(produtoId: string, validadeInformada: string | null) {
  const produto = await prisma.produto.findUnique({ where: { id: produtoId }, select: { nome: true } });
  if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto não encontrado");
  const validade = validadeInformada === null ? null : new Date(`${validadeInformada}T00:00:00Z`);
  if (validade && (!Number.isFinite(validade.getTime()) || validade.toISOString().slice(0, 10) !== validadeInformada)) throw new EstoqueError("VALIDACAO", "Informe uma validade válida");
  const raiz = await prisma.partidaProduto.findFirst({ where: { produtoId, validade, lotePrincipalId: null }, include: { aliases: { select: { id: true, codigo: true } } } });
  if (!raiz) return { existente: null };
  const consulta = (await listarPartidas(produtoId, null)).find((p) => p.id === raiz.id);
  return { existente: consulta ?? { id: raiz.id, codigo: raiz.codigo, nome: raiz.nome ?? nomeLotePadrao(produto.nome, raiz.validade), validade: raiz.validade, fabricante: raiz.fabricante,
    origemRastreio: raiz.origemRastreio, lotePrincipalId: null, aliases: raiz.aliases, saldo: "0" } };
}

export async function renomearLote(partidaId: string, nome: string, usuarioId: number | null) {
  return transacaoEstoque(async (tx) => {
    const raiz = await resolverLotePrincipalTx(tx, partidaId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${raiz.produtoId}`}))`;
    const atual = await resolverLotePrincipalTx(tx, raiz.id);
    const atualizado = await tx.partidaProduto.update({ where: { id: atual.id }, data: { nome } });
    await tx.auditoriaFinanceira.create({ data: { entidade: "PartidaProduto", entidadeId: atual.id, acao: "RENOMEAR_LOTE", usuarioId: usuarioId && usuarioId > 0 ? usuarioId : null, estadoAnterior: { nome: atual.nome }, estadoPosterior: { nome, produtoId: atual.produtoId } } });
    return { id: atualizado.id, nome: atualizado.nome };
  });
}
