import crypto from "node:crypto";
import { Prisma, UnidadeMedida } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { calcularAnimalDias } from "./animalDias.calc.js";
import { obterBaseCusto, statusSaldoEstoque, estornarMovimentoTx } from "../../estoque/estoque.js";
import { valorSaidaDaBase } from "../../estoque/estoque.calc.js";
import { prepararPartidasTx, type SelecaoPartida } from "../../estoque/partidas.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { propriedadePrincipalId } from "../../propriedade.js";
import { converterQuantidade } from "../../estoque/unidades.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const decimal = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

type ItemConfirmado = { produtoId: string; quantidadeConfirmada?: number; motivoAjuste?: string | null;
  modoEstoque: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativaSemBaixa?: string | null; partidas?: SelecaoPartida[] };
export type FechamentoInput = { loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; itens: ItemConfirmado[] };

async function contexto(tx: Prisma.TransactionClient, input: Pick<FechamentoInput, "loteId" | "propriedadeId" | "inicio" | "fim" | "centroCustoId">) {
  const inicio = dia(input.inicio); const fim = dia(input.fim);
  if (fim < inicio || inicio.getUTCMonth() !== fim.getUTCMonth() || inicio.getUTCFullYear() !== fim.getUTCFullYear()) {
    throw new RebanhoError("VALIDACAO", "Feche um período inclusivo dentro do mesmo mês", "fim");
  }
  const lote = await tx.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
  if (!lote) throw new RebanhoError("VALIDACAO", "Lote não encontrado neste sítio", "loteId");
  const centroCustoId = input.centroCustoId ?? lote.centroCustoId;
  if (!centroCustoId || !(await tx.centroCusto.findFirst({ where: { id: centroCustoId, ativo: true } }))) {
    throw new RebanhoError("VALIDACAO", "Informe o centro de custo do consumo", "centroCustoId");
  }
  const vigencia = await tx.vigenciaDietaLote.findFirst({ where: { loteId: lote.id, desde: { lte: inicio },
    OR: [{ ate: null }, { ate: { gt: fim } }] }, include: { dieta: { include: { itens: { include: { produto: true } } } } } });
  if (!vigencia || !vigencia.dieta.publicadaEm) throw new RebanhoError("VALIDACAO", "Não há dieta publicada cobrindo todo o período", "inicio");
  const localizacoes = await tx.localizacaoAnimal.findMany({ where: { loteId: lote.id, desde: { lte: fim },
    OR: [{ ate: null }, { ate: { gt: inicio } }] }, select: { animalId: true, desde: true, ate: true } });
  const participacao = calcularAnimalDias(localizacoes, inicio, fim);
  if (!participacao.animalDias) throw new RebanhoError("VALIDACAO", "O lote não teve participantes neste período");
  const itens = vigencia.dieta.itens.map((item) => ({ produtoId: item.produtoId, nome: item.produto.nome,
    unidade: item.unidade, quantidadeCabecaDia: item.quantidadeCabecaDia,
    quantidadePrevista: item.quantidadeCabecaDia.mul(participacao.animalDias),
    materiaSecaPercentual: item.materiaSecaPercentualSnapshot, rastrearPartidas: item.produto.rastrearPartidas }));
  return { lote, vigencia, centroCustoId, inicio, fim, participacao, itens };
}

async function previaConsumoTx(tx: Prisma.TransactionClient, input: Omit<FechamentoInput, "itens">) {
    const c = await contexto(tx, input);
    const animais = await tx.animal.findMany({ where: { id: { in: c.participacao.participacoes.map((p) => p.animalId) } }, select: { id: true, brinco: true, nome: true } });
    const itens = await Promise.all(c.itens.map(async (i) => {
      let materiaSecaKg: string | null = null;
      const unidade = Object.values(UnidadeMedida).find((u) => u === i.unidade);
      if (unidade && i.materiaSecaPercentual != null) try { materiaSecaKg = converterQuantidade(i.quantidadePrevista, unidade, "KG").mul(i.materiaSecaPercentual).div(100).toString(); } catch { /* Volume sem densidade não é convertido em massa. */ }
      const base = await obterBaseCusto(tx, i.produtoId, input.propriedadeId);
      return { ...i, quantidadeCabecaDia: i.quantidadeCabecaDia.toString(), quantidadePrevista: i.quantidadePrevista.toString(), materiaSecaPercentual: i.materiaSecaPercentual?.toString() ?? null, materiaSecaKg, saldo: (await saldoProduto(tx, i.produtoId, input.propriedadeId)).toString(), custoPrevisto: base ? valorSaidaDaBase(i.quantidadePrevista, base).valorTotal.toString() : null };
    }));
    return { loteId: c.lote.id, vigenciaId: c.vigencia.id, dieta: { nome: c.vigencia.dieta.nome, versao: c.vigencia.dieta.versao },
      inicio: c.inicio, fim: c.fim, centroCustoId: c.centroCustoId, animalDias: c.participacao.animalDias,
      participantes: c.participacao.participacoes.map((p) => ({ ...p, brinco: animais.find((a) => a.id === p.animalId)?.brinco ?? p.animalId })), itens,
      materiaSecaConhecidaKg: itens.reduce((s, i) => s.plus(i.materiaSecaKg ?? 0), decimal(0)).toString(), coberturaMateriaSecaCompleta: itens.every((i) => i.materiaSecaKg != null) };
}

export async function previaConsumo(input: Omit<FechamentoInput, "itens">) {
  return prisma.$transaction((tx) => previaConsumoTx(tx, input));
}

async function saldoProduto(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number) {
  const principal = await propriedadePrincipalId();
  const movimentos = await tx.movimentoEstoque.findMany({ where: { produtoId, status: statusSaldoEstoque,
    ...(propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }) }, select: { tipo: true, quantidade: true } });
  return movimentos.reduce((saldo, m) => m.tipo === "SAIDA" ? saldo.minus(m.quantidade) : saldo.plus(m.quantidade), decimal(0));
}

async function confirmarConsumoTx(tx: Prisma.TransactionClient, input: FechamentoInput, usuarioId: number | null) {
    // Leitura serializável do histórico, dentro da mesma transação da baixa.
    const c = await contexto(tx, input);
    await travarAnimais(tx, c.participacao.participacoes.map((p) => p.animalId));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${c.lote.id}`}))`;
    await exigirPeriodoAberto(tx, input.propriedadeId, c.inicio);
    if (input.itens.length !== c.itens.length || new Set(input.itens.map((i) => i.produtoId)).size !== input.itens.length) {
      throw new RebanhoError("VALIDACAO", "Confirme todos os ingredientes da dieta uma vez cada", "itens");
    }
    const fechamento = await tx.fechamentoConsumo.create({ data: { loteId: c.lote.id, propriedadeId: input.propriedadeId,
      vigenciaId: c.vigencia.id, inicio: c.inicio, fim: c.fim, centroCustoId: c.centroCustoId, animalDias: c.participacao.animalDias,
      participacoes: { create: c.participacao.participacoes.map((p) => ({ animalId: p.animalId, dias: p.dias })) } } });
    const resultadoItens = [];
    for (const previsto of c.itens) {
      const informado = input.itens.find((i) => i.produtoId === previsto.produtoId);
      if (!informado) throw new RebanhoError("VALIDACAO", "Ingrediente ausente na confirmação", "itens");
      const quantidade = informado.quantidadeConfirmada == null ? previsto.quantidadePrevista : decimal(informado.quantidadeConfirmada);
      if (!quantidade.isFinite() || quantidade.lt(0) || quantidade.decimalPlaces() > 3 || quantidade.gt("999999999.999")) {
        throw new RebanhoError("VALIDACAO", "Quantidade confirmada inválida", "quantidadeConfirmada");
      }
      if (!quantidade.equals(previsto.quantidadePrevista) && !informado.motivoAjuste?.trim()) {
        throw new RebanhoError("VALIDACAO", "Explique a diferença entre previsão e consumo real", "motivoAjuste");
      }
      if (informado.modoEstoque === "SEM_BAIXA_JUSTIFICADA" && !informado.justificativaSemBaixa?.trim()) {
        throw new RebanhoError("VALIDACAO", "Explique por que não houve baixa de estoque", "justificativaSemBaixa");
      }
      let movimentoEstoqueId: string | null = null;
      let situacaoCusto = "NAO_APURADO";
      if (informado.modoEstoque === "BAIXA_ESTOQUE" && quantidade.gt(0)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${input.propriedadeId}:${previsto.produtoId}`}))`;
        if ((await saldoProduto(tx, previsto.produtoId, input.propriedadeId)).lt(quantidade)) {
          throw new RebanhoError("CONFLITO", `Saldo insuficiente para ${previsto.nome}`);
        }
        const distribuicao = await prepararPartidasTx(tx, { produtoId: previsto.produtoId, rastrearPartidas: previsto.rastrearPartidas,
          propriedadeId: input.propriedadeId, tipo: "SAIDA", data: c.fim, quantidade, partidas: informado.partidas });
        const base = await obterBaseCusto(tx, previsto.produtoId, input.propriedadeId);
        const valores = valorSaidaDaBase(quantidade, base);
        const mov = await tx.movimentoEstoque.create({ data: { produtoId: previsto.produtoId, propriedadeId: input.propriedadeId,
          tipo: "SAIDA", origem: "NUTRICAO", data: c.fim, quantidade,
          custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal, centroCustoId: c.centroCustoId,
          criadoPorId: usuarioId, observacao: `Consumo do lote ${c.lote.nome}: ${input.inicio} a ${input.fim}`,
          ...(distribuicao.length ? { alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } : {}),
        } });
        movimentoEstoqueId = mov.id;
        situacaoCusto = base ? "CONHECIDO" : "SEM_BASE";
      } else if (informado.modoEstoque === "SEM_BAIXA_JUSTIFICADA") situacaoCusto = "INCOMPLETO";
      const item = await tx.itemFechamentoConsumo.create({ data: { fechamentoId: fechamento.id, produtoId: previsto.produtoId,
        quantidadePrevista: previsto.quantidadePrevista, quantidadeConfirmada: quantidade,
        baseQuantidade: informado.quantidadeConfirmada == null ? "PREVISTA" : "CONFERIDA",
        motivoAjuste: informado.motivoAjuste?.trim() || null, unidade: previsto.unidade,
        movimentoEstoqueId, modoEstoque: informado.modoEstoque, justificativaSemBaixa: informado.justificativaSemBaixa?.trim() || null,
        situacaoCusto } });
      resultadoItens.push(item);
    }
    await auditar(tx, { entidade: "FechamentoConsumo", entidadeId: fechamento.id, propriedadeId: input.propriedadeId,
      acao: "CONFIRMACAO", usuarioId, depois: { fechamento, itens: resultadoItens } });
    return { ...fechamento, itens: resultadoItens };
}

export async function confirmarConsumo(input: FechamentoInput, usuarioId: number | null) {
  return prisma.$transaction((tx) => confirmarConsumoTx(tx, input, usuarioId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

const textoDia = (d: Date) => d.toISOString().slice(0, 10);
async function dividirPeriodosTx(tx: Prisma.TransactionClient, input: Omit<FechamentoInput, "itens">) {
  const inicio = dia(input.inicio); const fim = dia(input.fim);
  if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || fim < inicio || fim.getTime() - inicio.getTime() > 366 * 86400000) throw new RebanhoError("VALIDACAO", "Informe até 366 dias em ordem cronológica");
  const lote = await tx.lote.findFirst({ where: { id: input.loteId, propriedadeId: input.propriedadeId, ativo: true } });
  if (!lote) throw new RebanhoError("NAO_ENCONTRADO", "Lote não encontrado neste sítio");
  const vigencias = await tx.vigenciaDietaLote.findMany({ where: { loteId: input.loteId, desde: { lte: fim }, OR: [{ ate: null }, { ate: { gt: inicio } }] }, orderBy: { desde: "asc" } });
  const fimExclusivo = new Date(fim.getTime() + 86400000);
  const cortes = new Set([inicio.getTime(), fimExclusivo.getTime()]);
  for (let mes = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 1)); mes < fimExclusivo; mes = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth() + 1, 1))) cortes.add(mes.getTime());
  for (const v of vigencias) for (const d of [v.desde, v.ate]) if (d && d > inicio && d < fimExclusivo) cortes.add(d.getTime());
  const ordenados = [...cortes].sort((a, b) => a - b);
  return ordenados.slice(0, -1).map((t, i) => {
    const desde = new Date(t); const ate = new Date(ordenados[i + 1] - 86400000);
    const v = vigencias.find((v) => v.desde <= desde && (!v.ate || v.ate > ate));
    return { inicio: textoDia(desde), fim: textoDia(ate), vigenciaId: v?.id ?? null };
  });
}

export async function previaPeriodos(input: Omit<FechamentoInput, "itens">) {
  return prisma.$transaction(async (tx) => {
    const divisao = await dividirPeriodosTx(tx, input);
    const periodos = [];
    const lacunas = [];
    for (const p of divisao) {
      if (!p.vigenciaId) { lacunas.push({ inicio: p.inicio, fim: p.fim }); continue; }
      periodos.push(await previaConsumoTx(tx, { ...input, inicio: p.inicio, fim: p.fim }));
    }
    return { periodos, lacunas };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

export async function confirmarPeriodos(input: { chave: string; loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; periodos: Array<{ inicio: string; fim: string; itens: FechamentoInput["itens"] }> }, usuarioId: number | null) {
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return prisma.$transaction(async (tx) => {
    const divisao = await dividirPeriodosTx(tx, input);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.propriedadeId !== input.propriedadeId || anterior.operacao !== "CONSUMO_PERIODOS") throw new RebanhoError("CONFLITO", "Chave já utilizada com outros dados");
      return { fechamentos: anterior.resultadoIds };
    }
    if (divisao.some((p) => !p.vigenciaId) || divisao.length !== input.periodos.length || divisao.some((p, i) => p.inicio !== input.periodos[i].inicio || p.fim !== input.periodos[i].fim)) throw new RebanhoError("CONFLITO", "Vigências mudaram ou há lacunas sem dieta; confira novamente");
    const fechamentos = [];
    for (const p of input.periodos) { const f = await confirmarConsumoTx(tx, { ...input, ...p }, usuarioId); fechamentos.push({ id: f.id, inicio: textoDia(f.inicio), fim: textoDia(f.fim) }); }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao: "CONSUMO_PERIODOS", hashPayload, resultadoIds: fechamentos } });
    return { fechamentos };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

export async function listarFechamentos(loteId: string | undefined, propriedadeId: number | null) {
  return prisma.fechamentoConsumo.findMany({ where: { ...(loteId ? { loteId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    include: { centroCusto: { select: { nome: true } }, vigencia: { select: { dieta: { select: { nome: true, versao: true } } } }, itens: { include: { produto: { select: { nome: true } }, movimentoEstoque: { select: { quantidade: true, valorTotal: true, custoUnitario: true, alocacaoPartidaEstoques: { select: { quantidade: true, partida: { select: { codigo: true, validade: true } } } } } } } }, participacoes: { include: { animal: { select: { brinco: true } } } } },
    orderBy: { inicio: "desc" }, take: 100 });
}

export async function estornarFechamento(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const fechamento = await tx.fechamentoConsumo.findFirst({ where: { id, propriedadeId },
      include: { itens: true, participacoes: true } });
    if (!fechamento) throw new RebanhoError("NAO_ENCONTRADO", "Fechamento não encontrado");
    if (fechamento.status !== "CONFIRMADO") throw new RebanhoError("CONFLITO", "Fechamento já estornado");
    await travarAnimais(tx, fechamento.participacoes.map((p) => p.animalId));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${fechamento.loteId}`}))`;
    await exigirPeriodoAberto(tx, propriedadeId, fechamento.inicio);
    for (const item of fechamento.itens) if (item.movimentoEstoqueId) {
      await estornarMovimentoTx(tx, item.movimentoEstoqueId, { propriedadeId, data: fechamento.fim, usuarioId, observacao: motivo });
    }
    const salvo = await tx.fechamentoConsumo.update({ where: { id }, data: { status: "ESTORNADO", motivoEstorno: motivo, estornadoEm: new Date() } });
    await auditar(tx, { entidade: "FechamentoConsumo", entidadeId: id, propriedadeId, acao: "ESTORNO", usuarioId,
      antes: fechamento, depois: { status: salvo.status, motivo } });
    return salvo;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
