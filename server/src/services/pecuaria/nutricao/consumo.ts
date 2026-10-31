import crypto from "node:crypto";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { baixarLeiteNutricionalTx, consultarFornecimentosNutricionaisTx, estornarLeiteNutricionalTx, ingredienteLeiteProducaoTx, previaLeiteNutricionalTx, registrarFornecimentoNutricionalTx } from "../leite/nutricao.js";
import { Prisma, UnidadeMedida } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { calcularAnimalDias } from "./animalDias.calc.js";
import { obterBaseCusto, statusSaldoEstoque, estornarMovimentoTx } from "../../estoque/estoque.js";
import { valorSaidaDaBase } from "../../estoque/estoque.calc.js";
import { planejarSaidaTx, registrarSaidaValorizadaTx, travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { prepararPartidasTx, type SelecaoPartida } from "../../estoque/partidas.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { propriedadePrincipalId } from "../../propriedade.js";
import { converterQuantidade } from "../../estoque/unidades.js";
import { calcularAtribuicao } from "./atribuicao.calc.js";
import type { PaginaNutricao } from "./schemas.js";
import { transacaoPecuaria } from "../transacao.js";
import { ofertasSobrepostasTx, travarAlimentacaoLeiteTx } from "../bezerreiro/alimentacao-compartilhada.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const decimal = (v: number | string | Prisma.Decimal) => new Prisma.Decimal(v);

type ItemConfirmado = { origensLeite?: string[]; produtoId: string; quantidadeConfirmada?: number; motivoAjuste?: string | null;
  modoEstoque: "BAIXA_ESTOQUE" | "SEM_BAIXA_JUSTIFICADA"; justificativaSemBaixa?: string | null; partidas?: SelecaoPartida[] };
export type FechamentoInput = { chave?: string; loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; itens: ItemConfirmado[] };

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
  return { lote, vigencia, centroCustoId, inicio, fim, participacao, itens, localizacoes };
}

async function previaConsumoTx(tx: Prisma.TransactionClient, input: Omit<FechamentoInput, "itens">) {
    const c = await contexto(tx, input);
    const animais = await tx.animal.findMany({ where: { id: { in: c.participacao.participacoes.map((p) => p.animalId) } }, select: { id: true, brinco: true, nome: true } });
    const itens = await Promise.all(c.itens.map(async (i) => {
      let materiaSecaKg: string | null = null;
      const unidade = Object.values(UnidadeMedida).find((u) => u === i.unidade);
      if (unidade && i.materiaSecaPercentual != null) try { materiaSecaKg = converterQuantidade(i.quantidadePrevista, unidade, "KG").mul(i.materiaSecaPercentual).div(100).toString(); } catch { /* Volume sem densidade não é convertido em massa. */ }
      let custoPrevisto: string | null = null;
      if (!i.rastrearPartidas && i.quantidadePrevista.gt(0)) {
        try { custoPrevisto = (await planejarSaidaTx(tx, { produtoId: i.produtoId, propriedadeId: input.propriedadeId, data: c.fim, quantidade: i.quantidadePrevista })).valorTotal.toString(); }
        catch (e) { if (!(e instanceof Error) || !["ValorizacaoError","FinanceiroError"].includes(e.constructor.name)) throw e; }
      }
      const leite = i.unidade === "L" ? await previaLeiteNutricionalTx(tx, i.produtoId, input.propriedadeId, c.fim, i.quantidadePrevista) : null;
      if (leite) custoPrevisto = leite.custoPrevisto;
      return { ...i, leite, quantidadeCabecaDia: i.quantidadeCabecaDia.toString(), quantidadePrevista: i.quantidadePrevista.toString(), materiaSecaPercentual: i.materiaSecaPercentual?.toString() ?? null, materiaSecaKg, saldo: leite?.quantidadeDisponivelLitros ?? (await saldoProduto(tx, i.produtoId, input.propriedadeId)).toString(), custoPrevisto };
    }));
    const ofertasBezerreiro = await ofertasSobrepostasTx(tx, input.propriedadeId, c.inicio, c.fim, c.localizacoes);
    return { ofertasBezerreiro, orientacaoLeiteBezerreiro: ofertasBezerreiro.length ? "Há ofertas de leite já registradas para animais neste período. Concilie esses fatos; confirme zero justificado na parcela leiteira e mantenha os demais ingredientes. Novo consumo adicional deve ser registrado explicitamente no Bezerreiro." : null, loteId: c.lote.id, vigenciaId: c.vigencia.id, dieta: { nome: c.vigencia.dieta.nome, versao: c.vigencia.dieta.versao },
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

export async function confirmarConsumoTx(tx: Prisma.TransactionClient, input: FechamentoInput, usuarioId: number | null) {
    // Mesma ordem de locks das ofertas e dos estornos.
    await travarAlimentacaoLeiteTx(tx, input.propriedadeId);
    const c = await contexto(tx, input);
    await travarAnimais(tx, c.participacao.participacoes.map((p) => p.animalId));
    const produtosLeite = await tx.entradaProducaoLeite.findMany({ where: { status: "CONFIRMADA", movimento: { propriedadeId: input.propriedadeId } }, select: { movimento: { select: { produtoId: true } } } });
    await travarValorizacaoTx(tx, [...new Set([...input.itens.map(i => i.produtoId), ...produtosLeite.map(e => e.movimento.produtoId)])].sort());
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${c.lote.id}`}))`;
    await exigirPeriodoAberto(tx, input.propriedadeId, c.inicio);
    if (input.itens.length !== c.itens.length || new Set(input.itens.map((i) => i.produtoId)).size !== input.itens.length) {
      throw new RebanhoError("VALIDACAO", "Confirme todos os ingredientes da dieta uma vez cada", "itens");
    }
    const sobreposicoes = await ofertasSobrepostasTx(tx, input.propriedadeId, c.inicio, c.fim, c.localizacoes);
    // Recusar antes de criar qualquer fato: zero justificado permite fechar os outros ingredientes.
    if (sobreposicoes.length) for (const previsto of c.itens) {
      const informado = input.itens.find(i => i.produtoId === previsto.produtoId);
      const quantidade = informado?.quantidadeConfirmada == null ? previsto.quantidadePrevista : decimal(informado.quantidadeConfirmada);
      if (quantidade.gt(0) && previsto.unidade === "L" && await ingredienteLeiteProducaoTx(tx, previsto.produtoId, input.propriedadeId)) {
        throw new RebanhoError("CONFLITO", `Há leite fornecido pelo Bezerreiro neste período (${[...new Set(sobreposicoes.map(o => o.data))].join(', ')}). Concilie as ofertas: informe zero justificado para o leite no fechamento e confirme os demais ingredientes. Registre novo consumo adicional explicitamente no Bezerreiro.`);
      }
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
      const leiteProducao = previsto.unidade === "L" && await ingredienteLeiteProducaoTx(tx, previsto.produtoId, input.propriedadeId);
      if (leiteProducao && !input.chave) throw new RebanhoError("VALIDACAO", "A confirmação leiteira exige chave idempotente");
      if (!leiteProducao && informado.origensLeite) throw new RebanhoError("VALIDACAO", "Origens de leite só se aplicam ao ingrediente com produção V5 comprovada");
      let leiteBaixado: Awaited<ReturnType<typeof baixarLeiteNutricionalTx>> | null = null;
      let movimentoEstoqueId: string | null = null;
      let situacaoCusto = "NAO_APURADO";
      if (informado.modoEstoque === "BAIXA_ESTOQUE" && quantidade.gt(0) && leiteProducao) {
        if (!informado.origensLeite?.length) throw new RebanhoError("VALIDACAO", "Selecione as origens leiteiras para confirmar a dieta");
        leiteBaixado = await baixarLeiteNutricionalTx(tx, { produtoId: previsto.produtoId, propriedadeId: input.propriedadeId, data: c.fim, quantidade,
          entradaIds: informado.origensLeite, usuarioId, observacao: `Dieta ${c.vigencia.dieta.nome}, lote ${c.lote.nome}: ${input.inicio} a ${input.fim}` });
        situacaoCusto = leiteBaixado.custoProducao == null ? "NAO_APURADO" : "CONHECIDO";
      } else if (informado.modoEstoque === "BAIXA_ESTOQUE" && quantidade.gt(0)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${input.propriedadeId}:${previsto.produtoId}`}))`;
        if ((await saldoProduto(tx, previsto.produtoId, input.propriedadeId)).lt(quantidade)) {
          throw new RebanhoError("CONFLITO", `Saldo insuficiente para ${previsto.nome}`);
        }
        const distribuicao = await prepararPartidasTx(tx, { produtoId: previsto.produtoId, rastrearPartidas: previsto.rastrearPartidas,
          propriedadeId: input.propriedadeId, tipo: "SAIDA", data: c.fim, quantidade, partidas: informado.partidas, usuarioId });
        const plano = await planejarSaidaTx(tx, { produtoId: previsto.produtoId, propriedadeId: input.propriedadeId, quantidade, data: c.fim, partidas: distribuicao });
        const valores = { custoUnitario: plano.custoUnitario, valorTotal: plano.valorTotal };
        const mov = await tx.movimentoEstoque.create({ data: { produtoId: previsto.produtoId, propriedadeId: input.propriedadeId,
          tipo: "SAIDA", origem: "NUTRICAO", data: c.fim, quantidade,
          custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal, centroCustoId: c.centroCustoId,
          criadoPorId: usuarioId, observacao: `Consumo do lote ${c.lote.nome}: ${input.inicio} a ${input.fim}`,
          ...(distribuicao.length ? { alocacaoPartidaEstoques: { create: distribuicao.map((p) => ({ partidaId: p.partidaId, quantidade: p.quantidade })) } } : {}),
        } });
        await registrarSaidaValorizadaTx(tx, mov.id, plano);
        movimentoEstoqueId = mov.id;
        situacaoCusto = "CONHECIDO";
      } else if (informado.modoEstoque === "SEM_BAIXA_JUSTIFICADA") situacaoCusto = "INCOMPLETO";
      const item = await tx.itemFechamentoConsumo.create({ data: { fechamentoId: fechamento.id, produtoId: previsto.produtoId,
        quantidadePrevista: previsto.quantidadePrevista, quantidadeConfirmada: quantidade,
        baseQuantidade: informado.quantidadeConfirmada == null ? "PREVISTA" : "CONFERIDA",
        motivoAjuste: informado.motivoAjuste?.trim() || null, unidade: previsto.unidade,
        movimentoEstoqueId, modoEstoque: informado.modoEstoque, justificativaSemBaixa: informado.justificativaSemBaixa?.trim() || null,
        situacaoCusto } });
      if (leiteBaixado) await registrarFornecimentoNutricionalTx(tx, { itemId: item.id, propriedadeId: input.propriedadeId, data: c.fim,
        quantidade, usuarioId, movimentos: leiteBaixado.movimentos, participacoes: c.participacao.participacoes, animalDias: c.participacao.animalDias });
      resultadoItens.push(item);
    }
    await auditar(tx, { entidade: "FechamentoConsumo", entidadeId: fechamento.id, propriedadeId: input.propriedadeId,
      acao: "CONFIRMACAO", usuarioId, depois: { fechamento, itens: resultadoItens } });
    return { ...fechamento, itens: resultadoItens };
}

export async function confirmarConsumo(input: FechamentoInput, usuarioId: number | null) {
  usuarioId = usuarioId != null && usuarioId > 0 ? usuarioId : null;
  return transacaoPecuaria((tx) => input.chave ? operacaoIdempotenteTx(tx, { ...input, chave: input.chave }, usuarioId, "CONSUMO_NUTRICIONAL", () => confirmarConsumoTx(tx, input, usuarioId)) : confirmarConsumoTx(tx, input, usuarioId));
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

async function montarPreviaPeriodosTx(tx: Prisma.TransactionClient, input: Omit<FechamentoInput, "itens">) {
    const divisao = await dividirPeriodosTx(tx, input);
    const periodos = [];
    const lacunas = [];
    for (const p of divisao) {
      if (!p.vigenciaId) { lacunas.push({ inicio: p.inicio, fim: p.fim }); continue; }
      periodos.push(await previaConsumoTx(tx, { ...input, inicio: p.inicio, fim: p.fim }));
    }
    const baseConferida = periodos.map((p) => ({ inicio: p.inicio, fim: p.fim, vigenciaId: p.vigenciaId, centroCustoId: p.centroCustoId, animalDias: p.animalDias,
      participantes: [...p.participantes].sort((a, b) => a.animalId.localeCompare(b.animalId)).map((a) => [a.animalId, a.dias]),
      itens: [...p.itens].sort((a, b) => a.produtoId.localeCompare(b.produtoId)).map((i) => [i.produtoId, i.quantidadePrevista, i.saldo, i.custoPrevisto, i.materiaSecaKg, i.leite]), ofertasBezerreiro: p.ofertasBezerreiro }));
    const revisao = crypto.createHash("sha256").update(JSON.stringify({ baseConferida, lacunas })).digest("hex");
    return { periodos, lacunas, revisao };
}

export async function previaPeriodos(input: Omit<FechamentoInput, "itens">) {
  return prisma.$transaction((tx) => montarPreviaPeriodosTx(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}

export async function confirmarPeriodos(input: { chave: string; revisao: string; loteId: string; propriedadeId: number; inicio: string; fim: string; centroCustoId?: string | null; periodos: Array<{ inicio: string; fim: string; itens: FechamentoInput["itens"] }> }, usuarioId: number | null) {
  usuarioId = usuarioId != null && usuarioId > 0 ? usuarioId : null;
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.propriedadeId !== input.propriedadeId || anterior.operacao !== "CONSUMO_PERIODOS") throw new RebanhoError("CONFLITO", "Chave já utilizada com outros dados");
      return { fechamentos: anterior.resultadoIds };
    }
    await travarAlimentacaoLeiteTx(tx, input.propriedadeId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${input.loteId}`}))`;
    const previaAtual = await montarPreviaPeriodosTx(tx, input);
    if (previaAtual.revisao !== input.revisao) throw new RebanhoError("CONFLITO", "A dieta, ocupação, estoque ou custo mudou desde a prévia; confira novamente");
    if (previaAtual.lacunas.length || previaAtual.periodos.length !== input.periodos.length || previaAtual.periodos.some((p, i) => p.inicio.toISOString().slice(0, 10) !== input.periodos[i].inicio || p.fim.toISOString().slice(0, 10) !== input.periodos[i].fim)) throw new RebanhoError("CONFLITO", "Vigências mudaram ou há lacunas sem dieta; confira novamente");
    const fechamentos = [];
    for (const p of input.periodos) { const f = await confirmarConsumoTx(tx, { ...input, ...p }, usuarioId); fechamentos.push({ id: f.id, inicio: textoDia(f.inicio), fim: textoDia(f.fim) }); }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao: "CONSUMO_PERIODOS", hashPayload, resultadoIds: fechamentos } });
    return { fechamentos };
  });
}

const detalheInclude = {
  lote: { select: { id: true, nome: true } }, centroCusto: { select: { nome: true } },
  vigencia: { select: { dieta: { select: { nome: true, versao: true } } } },
  itens: { include: { produto: { select: { nome: true } }, movimentoEstoque: { select: { id: true, quantidade: true, valorTotal: true, custoUnitario: true,
    alocacaoPartidaEstoques: { select: { partidaId: true, quantidade: true, partida: { select: { id: true, codigo: true, nome: true, validade: true, lotePrincipalId: true, lotePrincipal: { select: { nome: true } } } } } } } } } },
  participacoes: { include: { animal: { select: { brinco: true } } } },
} satisfies Prisma.FechamentoConsumoInclude;
type Detalhe = Prisma.FechamentoConsumoGetPayload<{ include: typeof detalheInclude }>;

/** Só a base CONHECIDO representa valor apurado; zero sem base não é gratuidade. */
type ResumoLeite = Awaited<ReturnType<typeof consultarFornecimentosNutricionaisTx>>;
export function apresentarFechamento(f: Detalhe, verValores: boolean, leites: ResumoLeite = new Map(), verReferenciasComerciais = verValores) {
  const atribuicao = calcularAtribuicao(f.participacoes, f.animalDias, f.itens.map((i) => ({ produtoId: i.produtoId, unidade: i.unidade,
    quantidadeConfirmada: i.quantidadeConfirmada,
    custoConhecido: i.quantidadeConfirmada.isZero() ? "0" : leites.has(i.id) ? leites.get(i.id)!.custoProducao : i.situacaoCusto === "CONHECIDO" ? i.movimentoEstoque?.valorTotal ?? null : null,
  })));
  return { ...f, verValores, verReferenciasComerciais, custoConhecido: verValores ? atribuicao.custoConhecido : null, coberturaCustoCompleta: atribuicao.coberturaCustoCompleta,
    itens: f.itens.map((i) => ({ ...i, leite: leites.get(i.id) ?? null, movimentoEstoque: i.movimentoEstoque ? { ...i.movimentoEstoque,
      alocacaoPartidaEstoques: i.movimentoEstoque.alocacaoPartidaEstoques.map((a) => ({ ...a, partida: { ...a.partida, nome: a.partida.lotePrincipal?.nome ?? a.partida.nome, lotePrincipalId: a.partida.lotePrincipalId ?? a.partidaId } })),
      valorTotal: verValores && i.situacaoCusto === "CONHECIDO" ? i.movimentoEstoque.valorTotal : null,
      custoUnitario: verValores && i.situacaoCusto === "CONHECIDO" ? i.movimentoEstoque.custoUnitario : null } : null })),
    participacoes: atribuicao.participacoes.map((p) => ({ ...p, id: f.participacoes.find((a) => a.animalId === p.animalId)!.id, animal: f.participacoes.find((a) => a.animalId === p.animalId)!.animal,
      custoConhecido: verValores ? p.custoConhecido : null,
      custoConhecidoPorDia: verValores ? p.custoConhecidoPorDia : null,
      itens: p.itens.map((i) => ({ ...i, custoConhecido: verValores ? i.custoConhecido : null })),
    })),
  };
}

export async function listarFechamentos(loteId: string | undefined, propriedadeId: number | null, pagina: PaginaNutricao = { pagina: 1, limite: 25 }, verValores = false, animalId?: string, status?: "CONFIRMADO" | "ESTORNADO", periodo: {de?:string;ate?:string} = {}, verReferenciasComerciais = verValores) {
  const where: Prisma.FechamentoConsumoWhereInput = { ...(periodo.de ? {fim:{gte:dia(periodo.de)}} : {}), ...(periodo.ate ? {inicio:{lte:dia(periodo.ate)}} : {}), ...(loteId ? { loteId } : {}), ...(status ? { status } : {}), ...(propriedadeId == null ? {} : { propriedadeId }), ...(animalId ? { participacoes: { some: { animalId } } } : {}) };
  return prisma.$transaction(async (tx) => {
    const [fechamentos, total] = await Promise.all([
      tx.fechamentoConsumo.findMany({ where, include: detalheInclude, orderBy: [{ inicio: "desc" }, { id: "asc" }], skip: (pagina.pagina - 1) * pagina.limite, take: pagina.limite }),
      tx.fechamentoConsumo.count({ where }),
    ]);
    const leites = await consultarFornecimentosNutricionaisTx(tx, fechamentos.flatMap(f => f.itens.map(i => i.id)), verValores, verReferenciasComerciais);
    return { itens: fechamentos.map((f) => apresentarFechamento(f, verValores, leites, verReferenciasComerciais)), total, ...pagina };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function detalheFechamento(id: string, propriedadeId: number | null, verValores: boolean, verReferenciasComerciais = verValores) {
  return prisma.$transaction(async tx => {
    const f = await tx.fechamentoConsumo.findFirst({ where: { id, ...(propriedadeId == null ? {} : { propriedadeId }) }, include: detalheInclude });
    if (!f) throw new RebanhoError("NAO_ENCONTRADO", "Fechamento não encontrado neste sítio");
    const leites = await consultarFornecimentosNutricionaisTx(tx, f.itens.map(i => i.id), verValores, verReferenciasComerciais);
    return apresentarFechamento(f, verValores, leites, verReferenciasComerciais);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function consumoAnimal(animalId: string, propriedadeId: number | null, pagina: PaginaNutricao, verValores: boolean, verReferenciasComerciais = verValores) {
  const animal = await prisma.animal.findFirst({ where: { id: animalId, ...(propriedadeId == null ? {} : { localizacoes: { some: { propriedadeId } } }) }, select: { id: true } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio");
  const lista = await listarFechamentos(undefined, propriedadeId, pagina, verValores, animalId, undefined, {}, verReferenciasComerciais);
  return { ...lista, animalId, verValores, verReferenciasComerciais, itens: lista.itens.map((f) => ({ inicio: f.inicio, fim: f.fim, status: f.status, lote: f.lote,
    dieta: f.vigencia.dieta, propriedadeId: f.propriedadeId, ...f.participacoes.find((p) => p.animalId === animalId)!, participacaoId: f.participacoes.find((p) => p.animalId === animalId)!.id, id: f.id,
    itens: f.participacoes.find((p) => p.animalId === animalId)!.itens.map((i) => ({ ...i, nome: f.itens.find((item) => item.produtoId === i.produtoId)!.produto.nome, leite: f.itens.find(item => item.produtoId === i.produtoId)!.leite })),
  })) };
}

export async function estornarFechamento(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    await travarAlimentacaoLeiteTx(tx, propriedadeId);
    const fechamento = await tx.fechamentoConsumo.findFirst({ where: { id, propriedadeId },
      include: { itens: true, participacoes: true } });
    if (!fechamento) throw new RebanhoError("NAO_ENCONTRADO", "Fechamento não encontrado");
    if (fechamento.status !== "CONFIRMADO") throw new RebanhoError("CONFLITO", "Fechamento já estornado");
    await travarAnimais(tx, fechamento.participacoes.map((p) => p.animalId));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-lote-consumo:${fechamento.loteId}`}))`;
    await exigirPeriodoAberto(tx, propriedadeId, fechamento.inicio);
    const produtosLeite = await tx.entradaProducaoLeite.findMany({ where: { movimento: { propriedadeId } }, select: { movimento: { select: { produtoId: true } } } });
    await travarValorizacaoTx(tx, [...new Set([...fechamento.itens.map(i => i.produtoId), ...produtosLeite.map(e => e.movimento.produtoId)])].sort());
    for (const item of fechamento.itens) {
      await estornarLeiteNutricionalTx(tx, item.id, propriedadeId, usuarioId, motivo);
      if (item.movimentoEstoqueId) await estornarMovimentoTx(tx, item.movimentoEstoqueId, { propriedadeId, data: fechamento.fim, usuarioId, observacao: motivo });
    }
    const salvo = await tx.fechamentoConsumo.update({ where: { id }, data: { status: "ESTORNADO", motivoEstorno: motivo, estornadoEm: new Date() } });
    await auditar(tx, { entidade: "FechamentoConsumo", entidadeId: id, propriedadeId, acao: "ESTORNO", usuarioId,
      antes: fechamento, depois: { status: salvo.status, motivo } });
    return salvo;
  });
}
