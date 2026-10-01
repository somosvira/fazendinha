import crypto from "node:crypto";
import { Prisma, type TipoMovimento } from "@prisma/client";
import { prisma } from "../../db.js";
import { propriedadePrincipalId } from "../propriedade.js";
import { EstoqueError, statusSaldoEstoque } from "./estoque.js";
import { obterBaseCusto } from "./estoque.js";
import { exigirPeriodoAberto } from "../financeiro/regras.js";
import { valorSaidaDaBase } from "./estoque.calc.js";

export type SelecaoPartida = { partidaId?: string; codigo?: string; validade?: string | null; quantidade: number | string };

const decimal = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

export async function saldoPartidaTx(tx: Prisma.TransactionClient, partidaId: string, propriedadeId: number) {
  const principal = await propriedadePrincipalId();
  const alocacoes = await tx.alocacaoPartidaEstoque.findMany({ where: {
    partidaId, movimentoEstoque: { status: statusSaldoEstoque,
      ...(propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }) },
  }, include: { movimentoEstoque: { select: { tipo: true } } } });
  return alocacoes.reduce((saldo, a) => a.movimentoEstoque.tipo === "SAIDA" ? saldo.minus(a.quantidade) : saldo.plus(a.quantidade), decimal(0));
}

/** Resolve e valida as partidas antes de criar o movimento. Não altera saldo por si só. */
export async function prepararPartidasTx(tx: Prisma.TransactionClient, args: {
  produtoId: string; rastrearPartidas: boolean; propriedadeId: number; tipo: TipoMovimento;
  quantidade: Prisma.Decimal; partidas?: SelecaoPartida[]; data?: Date; descarte?: boolean;
}) {
  const escolhas = args.partidas ?? [];
  if (!args.rastrearPartidas) {
    if (escolhas.length) throw new EstoqueError("VALIDACAO", "Este Produto não controla partidas");
    return [];
  }
  if (!escolhas.length) throw new EstoqueError("VALIDACAO", "Informe as partidas do Produto rastreado");
  const soma = escolhas.reduce((s, p) => s.plus(p.quantidade), decimal(0));
  if (!soma.equals(args.quantidade)) throw new EstoqueError("VALIDACAO", "A soma das partidas deve ser igual à quantidade do movimento");
  const saida = args.tipo === "SAIDA" || (args.tipo === "AJUSTE" && args.quantidade.lt(0));
  const resultado: Array<{ partidaId: string; quantidade: Prisma.Decimal; codigo: string; validade: Date | null }> = [];
  const ids = new Set<string>();
  for (const escolha of escolhas) {
    const quantidade = decimal(escolha.quantidade);
    // A saída guarda quantidade positiva; o sinal físico vem de tipo=SAIDA.
    // Apenas um AJUSTE negativo usa quantidade/alocação negativas no razão.
    if (!quantidade.isFinite() || quantidade.isZero() || quantidade.decimalPlaces() > 3
      || (args.quantidade.isNegative() ? quantidade.gte(0) : quantidade.lte(0))) {
      throw new EstoqueError("VALIDACAO", "Quantidade inválida na distribuição por partida");
    }
    let partida = escolha.partidaId ? await tx.partidaProduto.findFirst({ where: { id: escolha.partidaId, produtoId: args.produtoId } }) : null;
    if (saida && !partida) throw new EstoqueError("VALIDACAO", "Selecione uma partida existente para a saída");
    if (!saida && !partida) {
      const codigo = escolha.codigo?.trim();
      if (!codigo) throw new EstoqueError("VALIDACAO", "Informe o código da partida na entrada");
      const validade = escolha.validade ? new Date(`${escolha.validade}T00:00:00Z`) : null;
      partida = await tx.partidaProduto.upsert({ where: { produtoId_codigo: { produtoId: args.produtoId, codigo } },
        create: { produtoId: args.produtoId, codigo, validade }, update: {} });
      if (partida.validade?.getTime() !== validade?.getTime()) throw new EstoqueError("CONFLITO", "A validade informada diverge da partida cadastrada");
    }
    if (!partida) throw new EstoqueError("VALIDACAO", "Partida inválida");
    if (ids.has(partida.id)) throw new EstoqueError("VALIDACAO", "Uma partida não pode aparecer duas vezes no mesmo movimento");
    ids.add(partida.id);
    if (saida && !args.descarte && args.tipo !== "AJUSTE" && partida.validade && partida.validade < (args.data ?? new Date())) throw new EstoqueError("VALIDACAO", `Partida ${partida.codigo} vencida na data do uso operacional`);
    if (saida && (await saldoPartidaTx(tx, partida.id, args.propriedadeId)).lt(quantidade.abs())) {
      throw new EstoqueError("VALIDACAO", `Saldo insuficiente na partida ${partida.codigo}`);
    }
    resultado.push({ partidaId: partida.id, quantidade, codigo: partida.codigo, validade: partida.validade });
  }
  return resultado;
}

/** Ativação auditável: o razão antigo permanece intacto e passa a apontar à partida técnica. */
export async function ativarRastreio(produtoId: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${produtoId}`}))`;
    const produto = await tx.produto.findUnique({ where: { id: produtoId } });
    if (!produto) throw new EstoqueError("NAO_ENCONTRADO", "Produto não encontrado");
    if (produto.rastrearPartidas) throw new EstoqueError("CONFLITO", "O Produto já controla partidas");
    const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId, status: statusSaldoEstoque }, orderBy: { seq: "asc" } });
    const principal = await propriedadePrincipalId();
    const saldos = new Map<number, Prisma.Decimal>();
    for (const m of movimentos) {
      const propriedadeId = m.propriedadeId ?? principal;
      const saldo = saldos.get(propriedadeId) ?? decimal(0);
      saldos.set(propriedadeId, m.tipo === "SAIDA" ? saldo.minus(m.quantidade) : saldo.plus(m.quantidade));
    }
    if ([...saldos.values()].some((saldo) => saldo.lt(0))) throw new EstoqueError("CONFLITO", "Há saldo legado negativo; reconcilie o estoque antes de ativar partidas");
    const legado = await tx.partidaProduto.create({ data: { produtoId, codigo: "LEGADO_NAO_IDENTIFICADO", origemRastreio: "LEGADO_NAO_IDENTIFICADO" } });
    for (const m of movimentos) await tx.alocacaoPartidaEstoque.create({ data: { movimentoEstoqueId: m.id, partidaId: legado.id, quantidade: m.quantidade } });
    await tx.produto.update({ where: { id: produtoId }, data: { rastrearPartidas: true } });
    await tx.auditoriaFinanceira.create({ data: { entidade: "Produto", entidadeId: produtoId, acao: "ATIVAR_RASTREIO_PARTIDAS",
      usuarioId, estadoAnterior: { rastrearPartidas: false }, estadoPosterior: { rastrearPartidas: true, movimentosLegados: movimentos.length, partidaId: legado.id } } });
    return { produtoId, partidaLegadaId: legado.id, movimentosLegados: movimentos.length,
      saldos: [...saldos].map(([propriedadeId, saldo]) => ({ propriedadeId, quantidade: saldo.toString() })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listarPartidas(produtoId: string, propriedadeId: number) {
  const partidas = await prisma.partidaProduto.findMany({ where: { produtoId }, orderBy: [{ validade: "asc" }, { codigo: "asc" }] });
  return Promise.all(partidas.map(async (partida) => ({
    id: partida.id, codigo: partida.codigo, validade: partida.validade, fabricante: partida.fabricante,
    origemRastreio: partida.origemRastreio, saldo: (await saldoPartidaTx(prisma, partida.id, propriedadeId)).toString(),
  })));
}

export async function identificarLegado(input: { chave: string; produtoId: string; propriedadeId: number; codigo: string; validade?: string | null; quantidade: string; motivo: string; data: string }, usuarioId: number | null) {
  const hash = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${input.propriedadeId}:${input.produtoId}`}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`estoque-identificacao:${input.chave}`}))`;
    const anterior = await tx.auditoriaFinanceira.findFirst({ where: { acao: "IDENTIFICAR_ESTOQUE_LEGADO", estadoPosterior: { path: ["chave"], equals: input.chave } } });
    if (anterior) {
      const resultado = anterior.estadoPosterior as { hash: string; partidaId: string; movimentos: string[] };
      if (resultado.hash !== hash || anterior.usuarioId !== usuarioId) throw new EstoqueError("CONFLITO", "Chave de reenvio usada com outros dados");
      return { partidaId: resultado.partidaId, movimentos: resultado.movimentos };
    }
    const produto = await tx.produto.findUnique({ where: { id: input.produtoId } });
    const legado = await tx.partidaProduto.findFirst({ where: { produtoId: input.produtoId, origemRastreio: "LEGADO_NAO_IDENTIFICADO" } });
    const quantidade = decimal(input.quantidade);
    if (!produto?.rastrearPartidas || !legado) throw new EstoqueError("VALIDACAO", "Produto sem partida técnica de legado");
    if (!quantidade.isFinite() || quantidade.lte(0) || quantidade.decimalPlaces() > 3) throw new EstoqueError("VALIDACAO", "Quantidade inválida");
    if ((await saldoPartidaTx(tx, legado.id, input.propriedadeId)).lt(quantidade)) throw new EstoqueError("VALIDACAO", "Quantidade maior que o saldo não identificado");
    if (input.codigo === legado.codigo) throw new EstoqueError("VALIDACAO", "Informe uma partida identificada, não a técnica");
    const data = new Date(`${input.data}T00:00:00Z`);
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const validade = input.validade ? new Date(`${input.validade}T00:00:00Z`) : null;
    const identificada = await tx.partidaProduto.upsert({ where: { produtoId_codigo: { produtoId: produto.id, codigo: input.codigo } }, create: { produtoId: produto.id, codigo: input.codigo, validade }, update: {} });
    if (identificada.validade?.getTime() !== validade?.getTime()) throw new EstoqueError("CONFLITO", "Validade diverge da partida identificada");
    const base = await obterBaseCusto(tx, produto.id, input.propriedadeId);
    const { custoUnitario, valorTotal: valor } = valorSaidaDaBase(quantidade, base);
    const movimentos = [];
    for (const [partidaId, sinal] of [[legado.id, -1], [identificada.id, 1]] as const) {
      movimentos.push(await tx.movimentoEstoque.create({ data: { produtoId: produto.id, propriedadeId: input.propriedadeId, data, tipo: "AJUSTE", origem: "IDENTIFICACAO_PARTIDA", quantidade: quantidade.mul(sinal), custoUnitario, valorTotal: valor.mul(sinal), criadoPorId: usuarioId, observacao: `Identificação de legado: ${input.motivo}`, alocacaoPartidaEstoques: { create: { partidaId, quantidade: quantidade.mul(sinal) } } } }));
    }
    await tx.auditoriaFinanceira.create({ data: { entidade: "Produto", entidadeId: produto.id, acao: "IDENTIFICAR_ESTOQUE_LEGADO", usuarioId, estadoAnterior: { partidaId: legado.id }, estadoPosterior: { chave: input.chave, hash, propriedadeId: input.propriedadeId, partidaId: identificada.id, quantidade: quantidade.toString(), motivo: input.motivo, movimentos: movimentos.map((m) => m.id), quantidadeLiquida: "0", valorLiquido: "0" } } });
    return { partidaId: identificada.id, movimentos: movimentos.map((m) => m.id) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
