import { buscaAnimal, filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
import crypto from "node:crypto";
import { Prisma, UnidadeMedida, type OrigemInsumoSanitario, type FinalidadeAplicacao } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { propriedadePrincipalId } from "../../propriedade.js";
import { obterBaseCusto, statusSaldoEstoque, estornarMovimentoTx } from "../../estoque/estoque.js";
import { valorSaidaDaBase } from "../../estoque/estoque.calc.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { calcularPrazoCarencia } from "./carencia.calc.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { confirmarFato } from "../idempotencia.js";
import { resolverLotePrincipalTx, saldoPartidaTx, validadeVencida } from "../../estoque/partidas.js";
import { alocacaoLoteSanitario, loteAplicacaoDTO } from "./lotes.js";
import { conferirTarefaProtocoloTx, tipoAplicacaoLegadaId, type DesvioInput } from "./desvios.js";
import { travarUsosProduto } from "../../estoque/usos.js";

export type AplicacaoInput = {
  chave?: string;
  animalId: string;
  propriedadeId: number;
  data: string;
  aplicadaEm: string;
  finalidade?: FinalidadeAplicacao;
  tipoAplicacaoId?: string;
  responsavel?: string | null;
  estadoCarenciaLeite?: "INFORMADO" | "NAO_INFORMADO" | "NAO_APLICAVEL";
  estadoCarenciaCarne?: "INFORMADO" | "NAO_INFORMADO" | "NAO_APLICAVEL";
  justificativaCarenciaLeite?: string | null;
  justificativaCarenciaCarne?: string | null;
  origemInsumo: OrigemInsumoSanitario;
  nomeProdutoAplicado: string;
  produtoId?: string | null;
  dose: string;
  unidadeDose: UnidadeMedida;
  carenciaLeiteHoras?: number | null;
  carenciaCarneHoras?: number | null;
  referenciaCarencia?: string | null;
  ocorrenciaId?: string | null;
  tarefaId?: string | null;
  via?: string | null;
  desvio?: DesvioInput;
  operacaoServicoId?: string | null;
  itemCompraDiretaId?: string | null;
  partidaId?: string | null;
  cienciaValidadeDesconhecida?: boolean;
  partidaCodigo?: string | null;
  partidaValidade?: string | null;
  justificativaSemOrigem?: string | null;
  documentacaoExcepcional?: boolean;
  motivoDocumentacaoExcepcional?: string | null;
};

const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

function erro(mensagem: string, campo?: string): never {
  throw new RebanhoError("VALIDACAO", mensagem, campo);
}

export async function travarOrigensAplicacoesTx(tx: Prisma.TransactionClient, itens: AplicacaoInput[]) {
  if (!itens.length) return;
  const origens = [...new Set(itens.map((i) => i.itemCompraDiretaId ? `pec-compra-direta:${i.itemCompraDiretaId}` : `pec-produto:${i.propriedadeId}:${i.produtoId ?? "sem-produto"}`))].sort();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${origens}::text[]) AS k) AS chaves ORDER BY h`;
  await travarUsosProduto(tx, itens.flatMap((i) => i.produtoId ? [i.produtoId] : []));
  const produtosEstoque = [...new Set(itens.flatMap((i) => i.origemInsumo === "BAIXA_ESTOQUE" && i.produtoId ? [`pec-produto:${i.produtoId}`] : []))].sort();
  if (produtosEstoque.length) await tx.$executeRaw`SELECT pg_advisory_xact_lock(h) FROM (SELECT DISTINCT hashtext(k) AS h FROM unnest(${produtosEstoque}::text[]) AS k) AS chaves ORDER BY h`;
}

async function conferirLocalizacao(tx: Prisma.TransactionClient, input: AplicacaoInput) {
  const data = dia(input.data);
  await conferirAnimalNoFato(tx, input.animalId, input.propriedadeId, data);
  const momento = new Date(input.aplicadaEm);
  if (!Number.isFinite(momento.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(momento) !== input.data) {
    erro("A data e o horário da aplicação devem corresponder ao mesmo dia no Brasil", "aplicadaEm");
  }
  if (momento > new Date()) erro("A aplicação não pode ocorrer no futuro", "aplicadaEm");
  if (input.ocorrenciaId) {
    const ocorrencia = await tx.ocorrenciaSanitaria.findFirst({ where: { id: input.ocorrenciaId, animalId: input.animalId, status: "VALIDO" } });
    if (!ocorrencia) erro("Ocorrência não pertence a este animal", "ocorrenciaId");
  }
  if (input.tarefaId) {
    const tarefa = await tx.tarefaSanitaria.findFirst({ where: { id: input.tarefaId, execucao: { animalId: input.animalId, canceladaEm: null }, dispensadaEm: null } });
    if (!tarefa) erro("Tarefa não pertence a este animal ou não está pendente", "tarefaId");
  }
  return data;
}

async function validarServico(tx: Prisma.TransactionClient, id: string, propriedadeId: number) {
  const servico = await tx.operacao.findFirst({ where: { id, propriedadeId, tipo: "SERVICO", status: "CONFIRMADA" } });
  if (!servico) erro("Selecione um Serviço confirmado deste sítio", "operacaoServicoId");
  return servico;
}

export async function obterSaldo(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, partidaId?: string | null) {
  if (partidaId) return saldoPartidaTx(tx, partidaId, propriedadeId);
  const principal = await propriedadePrincipalId();
  const movimentos = await tx.movimentoEstoque.findMany({
    where: { produtoId, status: statusSaldoEstoque, ...(propriedadeId === principal ? { OR: [{ propriedadeId }, { propriedadeId: null }] } : { propriedadeId }),
      ...(partidaId ? { alocacaoPartidaEstoques: { some: { partidaId } } } : {}) },
    include: { alocacaoPartidaEstoques: { where: { partidaId: partidaId ?? "" } } },
  });
  return movimentos.reduce((saldo, m) => {
    const quantidade = partidaId ? m.alocacaoPartidaEstoques.reduce((s, a) => s.plus(a.quantidade), new Prisma.Decimal(0)) : m.quantidade;
    return m.tipo === "SAIDA" ? saldo.minus(quantidade) : saldo.plus(quantidade);
  }, new Prisma.Decimal(0));
}

async function prepararOrigem(tx: Prisma.TransactionClient, input: AplicacaoInput, data: Date, usuarioId: number | null, previa = false) {
  if (input.produtoId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`produto-usos:${input.produtoId}`}))`;
  const produto = input.produtoId ? await tx.produto.findUnique({ where: { id: input.produtoId } }) : null;
  if (input.produtoId && !produto) erro("Produto não encontrado", "produtoId");
  if (produto && (!produto.ativo || !produto.usoSanitario)) erro("Selecione um produto ativo com uso sanitário", "produtoId");
  const dose = new Prisma.Decimal(input.dose);
  if (!dose.isFinite() || dose.lte(0) || dose.decimalPlaces() > 3) erro("Informe uma dose positiva com até três casas", "dose");
  let movimentoEstoqueId: string | null = null;
  let itemCompraDiretaId: string | null = null;
  let quantidadeCompraDireta: Prisma.Decimal | null = null;
  let valorProdutoAtribuido: Prisma.Decimal | null = null;
  let situacaoCusto = "NAO_APURADO";
  let partidaCodigo: string | null = input.partidaCodigo ?? null;
  let partidaValidade: Date | null = input.partidaValidade ? dia(input.partidaValidade) : null;

  if (input.operacaoServicoId) await validarServico(tx, input.operacaoServicoId, input.propriedadeId);

  if (input.origemInsumo === "INCLUSO_SERVICO") {
    if (!input.operacaoServicoId) erro("Vincule o Serviço que incluiu as doses", "operacaoServicoId");
    if (input.itemCompraDiretaId || input.partidaId) erro("Dose incluída no Serviço não sai do estoque nem de outra compra");
  } else if (input.origemInsumo === "SEM_ORIGEM_JUSTIFICADA") {
    if (!input.justificativaSemOrigem?.trim()) erro("Explique por que a origem da dose ainda não foi localizada", "justificativaSemOrigem");
  } else if (input.origemInsumo === "COMPRA_CONSUMO_DIRETO") {
    if (!produto || !input.itemCompraDiretaId) erro("Selecione o item da compra para consumo direto", "itemCompraDiretaId");
    const item = await tx.itemOperacao.findFirst({ where: { id: input.itemCompraDiretaId, produtoId: produto.id, estocavel: false, operacao: { tipo: "COMPRA_CONSUMO_DIRETO", status: "CONFIRMADA", propriedadeId: input.propriedadeId } }, include: { operacao: true } });
    if (!item) erro("Item de compra direta inválido para este produto e sítio", "itemCompraDiretaId");
    if (item.operacao.data > data) erro("A compra não pode ser posterior à aplicação", "itemCompraDiretaId");
    const unidadeCompra = (Object.keys(UNIDADES) as UnidadeMedida[]).find((u) => UNIDADES[u].rotulo.toLowerCase() === item.unidade.toLowerCase() || u === item.unidade.toUpperCase());
    if (!unidadeCompra) erro("Unidade da compra direta não reconhecida", "itemCompraDiretaId");
    let quantidade: Prisma.Decimal;
    try { quantidade = converterQuantidade(dose, input.unidadeDose, unidadeCompra); }
    catch { erro("A dose e o item comprado têm unidades incompatíveis", "unidadeDose"); }
    if (quantidade!.decimalPlaces() > 3) erro("A unidade da compra não representa esta dose sem arredondamento", "unidadeDose");
    const usadas = await tx.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: item.id, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true, valorProdutoAtribuido: true } });
    if (quantidade!.plus(usadas._sum.quantidadeCompraDireta ?? 0).gt(item.quantidade)) erro("A quantidade da compra já foi destinada a outras aplicações", "itemCompraDiretaId");
    itemCompraDiretaId = item.id;
    quantidadeCompraDireta = quantidade!;
    const valorRestante = Prisma.Decimal.max(0, item.valorTotal.minus(usadas._sum.valorProdutoAtribuido ?? 0));
    valorProdutoAtribuido = quantidade!.plus(usadas._sum.quantidadeCompraDireta ?? 0).eq(item.quantidade)
      ? valorRestante
      : Prisma.Decimal.min(valorRestante, item.valorTotal.mul(quantidade!).div(item.quantidade).toDecimalPlaces(2));
    situacaoCusto = "CONHECIDO";
  } else if (input.origemInsumo === "BAIXA_ESTOQUE") {
    if (!produto) erro("Selecione o Produto da fazenda para baixar do estoque", "produtoId");
    if (input.itemCompraDiretaId) erro("Compra direta não pode ser baixada do estoque", "itemCompraDiretaId");
    let quantidade: Prisma.Decimal;
    try { quantidade = converterQuantidade(dose, input.unidadeDose, produto.unidade); }
    catch { erro("A dose não pode ser convertida para a unidade do Produto", "unidadeDose"); }
    if (quantidade!.decimalPlaces() > 3) erro("Cadastre o Produto em unidade menor: esta dose perderia precisão", "dose");
    if (produto.rastrearPartidas && !input.partidaId) erro("Selecione o lote do produto", "partidaId");
    if (!produto.rastrearPartidas && input.partidaId) erro("Este Produto não usa lotes", "partidaId");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-produto:${produto.id}`}))`;
    const partida = input.partidaId ? await resolverLotePrincipalTx(tx, input.partidaId, produto.id) : null;
    if (input.partidaId && !partida) erro("Lote não pertence a este Produto", "partidaId");
    if (partida && !partida.validade && !input.cienciaValidadeDesconhecida) erro("Confirme a ciência de uso do lote com validade não informada", "cienciaValidadeDesconhecida");
    if (partida?.validade && validadeVencida(partida.validade, data)) {
      if (!input.documentacaoExcepcional || (input.motivoDocumentacaoExcepcional?.trim().length ?? 0) < 5 || new Date(input.aplicadaEm) > new Date()) erro("Lote vencido: uso operacional bloqueado; documentação de fato já ocorrido exige ciência e justificativa", "partidaId");
    } else if (input.documentacaoExcepcional) erro("Documentação excepcional só cabe para fato já ocorrido com lote vencido", "documentacaoExcepcional");
    if ((await obterSaldo(tx, produto.id, input.propriedadeId)).lt(quantidade!)) erro("Saldo de estoque insuficiente neste sítio", "dose");
    if (partida && (await obterSaldo(tx, produto.id, input.propriedadeId, partida.id)).lt(quantidade!)) erro("Saldo do lote insuficiente neste sítio", "partidaId");
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const base = await obterBaseCusto(tx, produto.id, input.propriedadeId);
    const valores = valorSaidaDaBase(quantidade!, base);
    const movimento = previa ? null : await tx.movimentoEstoque.create({ data: {
      produtoId: produto.id, tipo: "SAIDA", origem: "SANIDADE", data, quantidade: quantidade!,
      custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal,
      propriedadeId: input.propriedadeId, criadoPorId: usuarioId,
      observacao: `Aplicação sanitária em ${input.animalId}${input.documentacaoExcepcional ? ` · DOCUMENTAÇÃO EXCEPCIONAL: ${input.motivoDocumentacaoExcepcional}` : ""}`,
      ...(partida ? { alocacaoPartidaEstoques: { create: { partidaId: partida.id, quantidade: quantidade! } } } : {}),
    } });
    movimentoEstoqueId = movimento?.id ?? null;
    valorProdutoAtribuido = base ? valores.valorTotal : null;
    situacaoCusto = base ? "CONHECIDO" : "SEM_BASE";
    partidaCodigo = partida?.codigo ?? null;
    partidaValidade = partida?.validade ?? null;
  } else {
    erro("Origem de insumo inválida para lançamento operacional", "origemInsumo");
  }

  return { nomeProdutoAplicado: produto?.nome ?? input.nomeProdutoAplicado.trim(), movimentoEstoqueId, itemCompraDiretaId,
    quantidadeCompraDireta, valorProdutoAtribuido, situacaoCusto, partidaCodigoSnapshot: partidaCodigo,
    partidaValidadeSnapshot: partidaValidade };
}

export async function prepararAplicacaoTx(tx: Prisma.TransactionClient, input: AplicacaoInput, usuarioId: number | null, previa = false) {
    await travarAnimais(tx, [input.animalId]);
    const data = await conferirLocalizacao(tx, input);
    const destino = await tx.destinoAnimal.findFirst({ where: { animalId: input.animalId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    const tipoLegadoId = tipoAplicacaoLegadaId(input.finalidade);
    const tipoAplicacao = await tx.tipoAplicacaoSanitaria.findFirst({ where: {
      id: input.tipoAplicacaoId ?? tipoLegadoId, ativo: true } });
    if (!tipoAplicacao) erro("Selecione um tipo de aplicação ativo", "tipoAplicacaoId");
    const estadoLeite = input.estadoCarenciaLeite ?? (input.carenciaLeiteHoras == null ? "NAO_INFORMADO" : "INFORMADO");
    const estadoCarne = input.estadoCarenciaCarne ?? (input.carenciaCarneHoras == null ? "NAO_INFORMADO" : "INFORMADO");
    for (const [estado, horas, campo] of [[estadoLeite, input.carenciaLeiteHoras, "carenciaLeiteHoras"], [estadoCarne, input.carenciaCarneHoras, "carenciaCarneHoras"]] as const) {
      if (estado === "INFORMADO" && (horas == null || !Number.isInteger(horas) || horas < 0)) erro("Informe o prazo em horas inteiras", campo);
      if (estado !== "INFORMADO" && horas != null) erro("Prazo só pode ser preenchido quando informado", campo);
    }
    if (estadoCarne === "NAO_APLICAVEL" && !input.justificativaCarenciaCarne?.trim()) erro("Justifique por que a carência de carne não se aplica", "justificativaCarenciaCarne");
    let dados = input;
    let desvioProtocoloSnapshot: Awaited<ReturnType<typeof conferirTarefaProtocoloTx>>["desvioProtocoloSnapshot"] | null = null;
    if (input.tarefaId) {
      const conferida = await conferirTarefaProtocoloTx(tx, input.tarefaId, input.animalId, { tipo: "APLICACAO", data: input.data,
        produtoId: input.produtoId, dose: input.dose, unidade: input.unidadeDose, via: input.via,
        tipoAplicacaoId: tipoAplicacao!.id, finalidade: input.finalidade }, input.desvio, !previa);
      const tarefa = conferida.tarefa;
      desvioProtocoloSnapshot = conferida.desvioProtocoloSnapshot;
      const servicoDoSitio = tarefa!.execucao.propriedadeId === input.propriedadeId ? tarefa!.execucao.operacaoServicoId : null;
      if (servicoDoSitio && input.operacaoServicoId && servicoDoSitio !== input.operacaoServicoId) {
        erro("O Serviço da aplicação diverge do protocolo", "operacaoServicoId");
      }
      dados = { ...input, operacaoServicoId: input.operacaoServicoId ?? servicoDoSitio };
    }
    // Ordem global: animal antes de Produto/sítio. A trava serializa consumo
    // concorrente e reserva de quantidade da mesma compra direta.
    await travarOrigensAplicacoesTx(tx, [input]);
    const origem = await prepararOrigem(tx, dados, data, usuarioId, previa);
    if (desvioProtocoloSnapshot) {
      desvioProtocoloSnapshot.exibicao.realizado.produtoId = origem.nomeProdutoAplicado;
      desvioProtocoloSnapshot.exibicao.realizado.tipoAplicacaoId = tipoAplicacao!.nome;
    }
    const dadosCriacao: Prisma.AplicacaoProdutoUncheckedCreateInput = {
      animalId: dados.animalId, propriedadeId: dados.propriedadeId, produtoId: dados.produtoId ?? null,
      nomeProdutoAplicado: origem.nomeProdutoAplicado, ocorrenciaId: dados.ocorrenciaId ?? null, tarefaId: dados.tarefaId ?? null,
      data, aplicadaEm: new Date(dados.aplicadaEm), precisaoTemporal: "HORA", finalidade: dados.finalidade,
      tipoAplicacaoId: tipoAplicacao!.id, tipoAplicacaoNomeSnapshot: tipoAplicacao!.nome, responsavel: input.responsavel?.trim() || null,
      estadoCarenciaLeite: estadoLeite, estadoCarenciaCarne: estadoCarne,
      justificativaCarenciaLeite: input.justificativaCarenciaLeite ?? null, justificativaCarenciaCarne: input.justificativaCarenciaCarne ?? null,
      aptidaoCarenciaSnapshot: destino?.aptidao ?? null,
      dose: new Prisma.Decimal(dados.dose), unidadeDose: dados.unidadeDose,
      via: dados.via?.trim() || null,
      ...(desvioProtocoloSnapshot ? { desvioProtocoloSnapshot } : {}),
      carenciaLeiteHoras: dados.carenciaLeiteHoras ?? null, carenciaCarneHoras: dados.carenciaCarneHoras ?? null,
      referenciaCarencia: dados.referenciaCarencia ?? null, origemInsumo: dados.origemInsumo,
      quantidadeUtilizada: new Prisma.Decimal(dados.dose),
      movimentoEstoqueId: origem.movimentoEstoqueId, itemCompraDiretaId: origem.itemCompraDiretaId,
      quantidadeCompraDireta: origem.quantidadeCompraDireta, operacaoServicoId: dados.operacaoServicoId ?? null,
      valorProdutoAtribuido: origem.valorProdutoAtribuido, situacaoCusto: origem.situacaoCusto,
      partidaCodigoSnapshot: origem.partidaCodigoSnapshot, partidaValidadeSnapshot: origem.partidaValidadeSnapshot,
      justificativaSemOrigem: dados.justificativaSemOrigem ?? null,
    };
    return { dadosCriacao, desvioProtocoloSnapshot };
}

export async function criarAplicacaoTx(tx: Prisma.TransactionClient, input: AplicacaoInput, usuarioId: number | null) {
    const { dadosCriacao } = await prepararAplicacaoTx(tx, input, usuarioId);
    const criada = await tx.aplicacaoProduto.create({ data: dadosCriacao });
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: criada.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId,
      depois: { origemInsumo: criada.origemInsumo, operacaoServicoId: criada.operacaoServicoId, itemCompraDiretaId: criada.itemCompraDiretaId, movimentoEstoqueId: criada.movimentoEstoqueId, via: criada.via, desvioProtocoloSnapshot: criada.desvioProtocoloSnapshot, cienciaValidadeDesconhecida: !!input.cienciaValidadeDesconhecida, cienciaPartidaVencida: !!input.documentacaoExcepcional, motivoDocumentacaoExcepcional: input.motivoDocumentacaoExcepcional ?? null } });
    return criada;
}

export async function criarAplicacao(input: AplicacaoInput, usuarioId: number | null) {
  return confirmarFato(input, usuarioId, "APLICACAO", criarAplicacaoTx, (tx, id) => tx.aplicacaoProduto.findUniqueOrThrow({ where: { id } }));
}

export async function criarAplicacoesColetivas(input: { chave: string; propriedadeId: number; itens: AplicacaoInput[] }, usuarioId: number | null) {
  const ids = input.itens.map((i) => i.animalId);
  if (!ids.length || ids.length > 100 || new Set(ids).size !== ids.length || input.itens.some((i) => i.propriedadeId !== input.propriedadeId)) erro("Selecione de 1 a 100 animais distintos do mesmo sítio", "itens");
  const hashPayload = crypto.createHash("sha256").update(JSON.stringify({ ...input, itens: [...input.itens].sort((a, b) => a.animalId.localeCompare(b.animalId)) })).digest("hex");
  return transacaoPecuaria(async (tx) => {
    await travarAnimais(tx, ids);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-requisicao:${input.chave}`}))`;
    const anterior = await tx.requisicaoPecuaria.findUnique({ where: { chave: input.chave } });
    if (anterior) {
      if (anterior.hashPayload !== hashPayload || anterior.usuarioId !== usuarioId || anterior.propriedadeId !== input.propriedadeId || anterior.operacao !== "APLICACAO_COLETIVA") throw new RebanhoError("CONFLITO", "Chave já utilizada com outros dados");
      return { aplicacoes: anterior.resultadoIds };
    }
    await travarOrigensAplicacoesTx(tx, input.itens);
    const aplicacoes = [];
    for (const [linha, item] of input.itens.entries()) {
      try { const a = await criarAplicacaoTx(tx, item, usuarioId); aplicacoes.push({ id: a.id, animalId: a.animalId }); }
      catch (e) { if (e instanceof RebanhoError) throw new RebanhoError(e.code, `Linha ${linha + 1}: ${e.message}. Nenhuma aplicação foi gravada.`, `itens.${linha}.${e.campo ?? "animalId"}`); throw e; }
    }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao: "APLICACAO_COLETIVA", hashPayload, resultadoIds: aplicacoes } });
    return { aplicacoes };
  });
}

export type ReconciliacaoInput = Pick<AplicacaoInput, "origemInsumo" | "produtoId" | "operacaoServicoId" | "itemCompraDiretaId" | "partidaId" | "partidaCodigo" | "partidaValidade" | "cienciaValidadeDesconhecida"> & { motivo: string; confirmarEquivalencia?: boolean };
export async function reconciliarOrigem(id: string, propriedadeId: number, input: ReconciliacaoInput, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.aplicacaoProduto.findFirst({ where: { id, propriedadeId } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada neste sítio");
    await travarAnimais(tx, [referencia.animalId]);
    const antes = await tx.aplicacaoProduto.findFirst({ where: { id, propriedadeId, status: "VALIDO", origemInsumo: "SEM_ORIGEM_JUSTIFICADA" } });
    if (!antes) throw new RebanhoError("CONFLITO", "Somente aplicação válida com origem pendente pode ser reconciliada");
    await conferirAnimalNoFato(tx, antes.animalId, propriedadeId, antes.data);
    if ((input.motivo?.trim().length ?? 0) < 5) erro("Explique como a origem foi conferida", "motivo");
    if (input.origemInsumo === "SEM_ORIGEM_JUSTIFICADA") erro("Selecione a origem localizada", "origemInsumo");
    if (antes.produtoId && input.produtoId !== antes.produtoId) erro("Não é permitido trocar o medicamento; anule e registre novamente", "produtoId");
    const trava = input.itemCompraDiretaId ? `pec-compra-direta:${input.itemCompraDiretaId}` : `pec-produto:${propriedadeId}:${input.produtoId ?? "sem-produto"}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`;
    if (input.produtoId) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`produto-usos:${input.produtoId}`}))`;
    const produto = input.produtoId ? await tx.produto.findUnique({ where: { id: input.produtoId } }) : null;
    if (!antes.produtoId && produto && produto.nome.trim().toLocaleLowerCase("pt-BR") !== antes.nomeProdutoAplicado.trim().toLocaleLowerCase("pt-BR") && input.confirmarEquivalencia !== true) {
      erro("Confirme que o Produto corresponde ao medicamento aplicado", "confirmarEquivalencia");
    }
    const unidade = Object.values(UnidadeMedida).find((u) => u === antes.unidadeDose);
    if (!unidade || !antes.aplicadaEm || !antes.dose) erro("Registro histórico sem quantidade/unidade/horário deve ser corrigido por anulação");
    if (produto) {
      try { converterQuantidade(antes.dose!, unidade!, produto.unidade); }
      catch { erro("A dose e o Produto têm unidades incompatíveis", "produtoId"); }
    }
    const origem = await prepararOrigem(tx, { ...input, animalId: antes.animalId, propriedadeId, data: antes.data.toISOString().slice(0, 10), aplicadaEm: antes.aplicadaEm!.toISOString(), nomeProdutoAplicado: antes.nomeProdutoAplicado, dose: antes.dose!.toString(), unidadeDose: unidade! }, antes.data, usuarioId);
    const { nomeProdutoAplicado: _nome, ...vinculos } = origem;
    const depois = await tx.aplicacaoProduto.update({ where: { id }, data: { ...vinculos, origemInsumo: input.origemInsumo, produtoId: input.produtoId ?? null, operacaoServicoId: input.operacaoServicoId ?? null } });
    // A justificativa original permanece no registro e na auditoria. Não há nova
    // despesa: a origem aponta para estoque/compra/Serviço já existente.
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: id, animalId: antes.animalId, propriedadeId, acao: "ORIGEM_RECONCILIADA", usuarioId, antes, depois: { ...depois, motivo: input.motivo.trim(), confirmarEquivalencia: input.confirmarEquivalencia === true, cienciaValidadeDesconhecida: !!input.cienciaValidadeDesconhecida } });
    return depois;
  });
}

function filtroAplicacoes(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  return { ...filtrosFatos(filtro), ...(filtro?.situacao === "ORIGEM_PENDENTE" ? { origemInsumo: "SEM_ORIGEM_JUSTIFICADA" as const } : {}), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) };
}

export async function listarAplicacoes(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  const fatos = await prisma.aplicacaoProduto.findMany({ where: filtroAplicacoes(animalId, propriedadeId, filtro),
    include: { animal: { select: { id: true, brinco: true, nome: true } }, produto: { select: { id: true, nome: true, unidade: true } }, movimentoEstoque: { select: { alocacaoPartidaEstoques: alocacaoLoteSanitario } } },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
  return fatos.map((fato) => { const { movimentoEstoque: _movimento, ...historico } = fato; return { ...historico, ...loteAplicacaoDTO(fato) }; });
}

export async function listarAplicacoesPaginadas(animalId: string | undefined, propriedadeId: number | null, filtro: ConsultaSanitaria) {
  const [itens, total] = await Promise.all([
    listarAplicacoes(animalId, propriedadeId, filtro),
    prisma.aplicacaoProduto.count({ where: filtroAplicacoes(animalId, propriedadeId, filtro) }),
  ]);
  return { itens, total, pagina: filtro.pagina, porPagina: filtro.porPagina };
}

export async function carenciaAnimal(animalId: string, propriedadeId: number | null, dataReferencia?: string) {
  if (propriedadeId != null) {
    const ultima = await prisma.localizacaoAnimal.findFirst({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }], select: { propriedadeId: true } });
    if (ultima?.propriedadeId !== propriedadeId) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio");
  }
  return carenciaAnimalTx(prisma, animalId, dataReferencia);
}

export async function listarCarencias(propriedadeId: number | null, filtro: ConsultaSanitaria) {
  const animais = await prisma.animal.findMany({
    where: {
      ...buscaAnimal(filtro),
      ...(filtro.animalId ? { id: filtro.animalId } : {}),
      ...(propriedadeId == null ? {} : { localizacoes: { some: { propriedadeId, ate: null } } }),
      aplicacaoProdutos: { some: { ...filtrosFatos(filtro) } },
    },
    select: { id: true, brinco: true, nome: true }, orderBy: [{ brinco: "asc" }, { id: "asc" }], ...limites(filtro),
  });
  // O período filtra os animais consultados, não elimina doses ainda relevantes.
  return Promise.all(animais.map(async (animal) => ({ animal, ...await carenciaAnimalTx(prisma, animal.id) })));
}

export async function carenciaAnimalTx(tx: Prisma.TransactionClient, animalId: string, dataReferencia?: string) {
  // A carência acompanha o animal. Uma dose aplicada no sítio anterior ainda
  // importa para o leite/carne no sítio atual; o acesso, porém, é pelo local atual.
  const aplicacoes = await tx.aplicacaoProduto.findMany({ where: { animalId, status: "VALIDO", ...(dataReferencia ? { data: { lte: new Date(dataReferencia + "T00:00:00Z") } } : {}) },
    select: { data: true, aplicadaEm: true, precisaoTemporal: true, carenciaLeiteHoras: true, carenciaCarneHoras: true, estadoCarenciaLeite: true, estadoCarenciaCarne: true, aptidaoCarenciaSnapshot: true } });
  const animal = await tx.animal.findUnique({ where: { id: animalId }, select: { sexo: true, destinos: { where: dataReferencia ? { desde: { lte: new Date(dataReferencia + "T00:00:00Z") }, OR: [{ ate: null }, { ate: { gt: new Date(dataReferencia + "T00:00:00Z") } }] } : { ate: null }, take: 1 } } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  const revisarLeite = animal?.sexo === "F" && animal.destinos[0]?.aptidao === "LEITE" && aplicacoes.some((a) => a.estadoCarenciaLeite === "NAO_APLICAVEL" && a.aptidaoCarenciaSnapshot !== "LEITE");
  return { leite: revisarLeite ? { estado: "NAO_INFORMADO" as const } : calcularPrazoCarencia(aplicacoes, "LEITE"), carne: calcularPrazoCarencia(aplicacoes, "CARNE"), revisaoLeitePendente: revisarLeite };
}

export async function anularAplicacao(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const existente = await tx.aplicacaoProduto.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!existente) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada ou já anulada");
    await travarAnimais(tx, [existente.animalId]);
    const atual = await tx.aplicacaoProduto.findUnique({ where: { id } });
    if (atual?.status !== "VALIDO") throw new RebanhoError("CONFLITO", "A aplicação já foi anulada");
    if (existente.movimentoEstoqueId) await estornarMovimentoTx(tx, existente.movimentoEstoqueId, { usuarioId, observacao: motivo, data: existente.data, propriedadeId });
    const salva = await tx.aplicacaoProduto.update({ where: { id }, data: { status: "ANULADO", motivoAnulacao: motivo, anuladoEm: new Date() } });
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: id, animalId: existente.animalId, acao: "ANULACAO", usuarioId,
      antes: existente, depois: { status: salva.status, motivo } });
    return salva;
  });
}

export async function corrigirCarencia(id: string, propriedadeId: number, input: Pick<AplicacaoInput, "estadoCarenciaLeite" | "estadoCarenciaCarne" | "carenciaLeiteHoras" | "carenciaCarneHoras" | "justificativaCarenciaCarne" | "justificativaCarenciaLeite"> & { motivo: string }, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    const original = await tx.aplicacaoProduto.findFirst({ where: { id, propriedadeId, status: "VALIDO" } });
    if (!original) throw new RebanhoError("NAO_ENCONTRADO", "Aplicação não encontrada ou anulada");
    await travarAnimais(tx, [original.animalId]);
    for (const [estado, horas] of [[input.estadoCarenciaLeite, input.carenciaLeiteHoras], [input.estadoCarenciaCarne, input.carenciaCarneHoras]] as const) {
      if (!estado || (estado === "INFORMADO" ? horas == null || !Number.isInteger(horas) || horas < 0 : horas != null)) erro("Confira os estados e prazos de carência");
    }
    if (input.estadoCarenciaCarne === "NAO_APLICAVEL" && !input.justificativaCarenciaCarne?.trim()) erro("Justifique a não aplicabilidade para carne");
    const destino = await tx.destinoAnimal.findFirst({ where: { animalId: original.animalId, ate: null } });
    const { motivo, ...dados } = input;
    const salva = await tx.aplicacaoProduto.update({ where: { id }, data: { ...dados, aptidaoCarenciaSnapshot: destino?.aptidao ?? original.aptidaoCarenciaSnapshot } });
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: id, animalId: original.animalId, propriedadeId, acao: "CARENCIA_CORRIGIDA", usuarioId, antes: original, depois: { ...salva, motivo } });
    return salva;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
