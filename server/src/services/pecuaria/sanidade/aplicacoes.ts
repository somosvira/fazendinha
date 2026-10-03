import { filtrosFatos, limites, type ConsultaSanitaria } from "./consulta.js";
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
  operacaoServicoId?: string | null;
  itemCompraDiretaId?: string | null;
  partidaId?: string | null;
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

async function obterSaldo(tx: Prisma.TransactionClient, produtoId: string, propriedadeId: number, partidaId?: string | null) {
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

async function prepararOrigem(tx: Prisma.TransactionClient, input: AplicacaoInput, data: Date, usuarioId: number | null) {
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
    const partida = input.partidaId ? await tx.partidaProduto.findFirst({ where: { id: input.partidaId, produtoId: produto.id } }) : null;
    if (input.partidaId && !partida) erro("Lote não pertence a este Produto", "partidaId");
    if (partida?.validade && partida.validade < data) {
      if (!input.documentacaoExcepcional || (input.motivoDocumentacaoExcepcional?.trim().length ?? 0) < 5 || new Date(input.aplicadaEm) > new Date()) erro("Lote vencido: uso operacional bloqueado; documentação de fato já ocorrido exige ciência e justificativa", "partidaId");
    } else if (input.documentacaoExcepcional) erro("Documentação excepcional só cabe para fato já ocorrido com lote vencido", "documentacaoExcepcional");
    if ((await obterSaldo(tx, produto.id, input.propriedadeId)).lt(quantidade!)) erro("Saldo de estoque insuficiente neste sítio", "dose");
    if (partida && (await obterSaldo(tx, produto.id, input.propriedadeId, partida.id)).lt(quantidade!)) erro("Saldo do lote insuficiente neste sítio", "partidaId");
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const base = await obterBaseCusto(tx, produto.id, input.propriedadeId);
    const valores = valorSaidaDaBase(quantidade!, base);
    const movimento = await tx.movimentoEstoque.create({ data: {
      produtoId: produto.id, tipo: "SAIDA", origem: "SANIDADE", data, quantidade: quantidade!,
      custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal,
      propriedadeId: input.propriedadeId, criadoPorId: usuarioId,
      observacao: `Aplicação sanitária em ${input.animalId}${input.documentacaoExcepcional ? ` · DOCUMENTAÇÃO EXCEPCIONAL: ${input.motivoDocumentacaoExcepcional}` : ""}`,
      ...(partida ? { alocacaoPartidaEstoques: { create: { partidaId: partida.id, quantidade: quantidade! } } } : {}),
    } });
    movimentoEstoqueId = movimento.id;
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

async function criarAplicacaoTx(tx: Prisma.TransactionClient, input: AplicacaoInput, usuarioId: number | null) {
    await travarAnimais(tx, [input.animalId]);
    const data = await conferirLocalizacao(tx, input);
    const destino = await tx.destinoAnimal.findFirst({ where: { animalId: input.animalId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] } });
    const tipoLegadoId = input.finalidade === "VACINA" ? "a0300000-0000-4000-8000-000000000002" : input.finalidade === "VERMIFUGO" ? "a0300000-0000-4000-8000-000000000003" : "a0300000-0000-4000-8000-000000000001";
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
    if (input.tarefaId) {
      const tarefa = await tx.tarefaSanitaria.findUnique({ where: { id: input.tarefaId },
        include: { etapa: true, execucao: true, aplicacoes: { where: { status: "VALIDO" } }, exames: { where: { status: "VALIDO" } } } });
      if (!tarefa || tarefa.execucao.animalId !== input.animalId || tarefa.execucao.canceladaEm || tarefa.dispensadaEm || tarefa.aplicacoes.length || tarefa.exames.length || tarefa.etapa.tipo !== "APLICACAO") {
        erro("A tarefa não está disponível para esta aplicação", "tarefaId");
      }
      if (tarefa!.etapa.produtoId !== input.produtoId || (tarefa!.etapa.tipoAplicacaoId ? tarefa!.etapa.tipoAplicacaoId !== tipoAplicacao!.id : tarefa!.etapa.finalidade !== input.finalidade)
        || !tarefa!.etapa.dose?.equals(input.dose) || tarefa!.etapa.unidade !== input.unidadeDose) {
        erro("A aplicação deve corresponder ao Produto, finalidade e dose da etapa", "tarefaId");
      }
      const servicoDoSitio = tarefa!.execucao.propriedadeId === input.propriedadeId ? tarefa!.execucao.operacaoServicoId : null;
      if (servicoDoSitio && input.operacaoServicoId && servicoDoSitio !== input.operacaoServicoId) {
        erro("O Serviço da aplicação diverge do protocolo", "operacaoServicoId");
      }
      dados = { ...input, operacaoServicoId: input.operacaoServicoId ?? servicoDoSitio };
    }
    // Ordem global: animal antes de Produto/sítio. A trava serializa consumo
    // concorrente e reserva de quantidade da mesma compra direta.
    const trava = input.itemCompraDiretaId ? `pec-compra-direta:${input.itemCompraDiretaId}` : `pec-produto:${input.propriedadeId}:${input.produtoId ?? "sem-produto"}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`;
    const origem = await prepararOrigem(tx, dados, data, usuarioId);
    const criada = await tx.aplicacaoProduto.create({ data: {
      animalId: dados.animalId, propriedadeId: dados.propriedadeId, produtoId: dados.produtoId ?? null,
      nomeProdutoAplicado: origem.nomeProdutoAplicado, ocorrenciaId: dados.ocorrenciaId ?? null, tarefaId: dados.tarefaId ?? null,
      data, aplicadaEm: new Date(dados.aplicadaEm), precisaoTemporal: "HORA", finalidade: dados.finalidade,
      tipoAplicacaoId: tipoAplicacao!.id, tipoAplicacaoNomeSnapshot: tipoAplicacao!.nome, responsavel: input.responsavel?.trim() || null,
      estadoCarenciaLeite: estadoLeite, estadoCarenciaCarne: estadoCarne,
      justificativaCarenciaLeite: input.justificativaCarenciaLeite ?? null, justificativaCarenciaCarne: input.justificativaCarenciaCarne ?? null,
      aptidaoCarenciaSnapshot: destino?.aptidao ?? null,
      dose: new Prisma.Decimal(dados.dose), unidadeDose: dados.unidadeDose,
      carenciaLeiteHoras: dados.carenciaLeiteHoras ?? null, carenciaCarneHoras: dados.carenciaCarneHoras ?? null,
      referenciaCarencia: dados.referenciaCarencia ?? null, origemInsumo: dados.origemInsumo,
      quantidadeUtilizada: new Prisma.Decimal(dados.dose),
      movimentoEstoqueId: origem.movimentoEstoqueId, itemCompraDiretaId: origem.itemCompraDiretaId,
      quantidadeCompraDireta: origem.quantidadeCompraDireta, operacaoServicoId: dados.operacaoServicoId ?? null,
      valorProdutoAtribuido: origem.valorProdutoAtribuido, situacaoCusto: origem.situacaoCusto,
      partidaCodigoSnapshot: origem.partidaCodigoSnapshot, partidaValidadeSnapshot: origem.partidaValidadeSnapshot,
      justificativaSemOrigem: dados.justificativaSemOrigem ?? null,
    } });
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: criada.id, animalId: input.animalId, propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId,
      depois: { origemInsumo: criada.origemInsumo, operacaoServicoId: criada.operacaoServicoId, itemCompraDiretaId: criada.itemCompraDiretaId, movimentoEstoqueId: criada.movimentoEstoqueId, cienciaPartidaVencida: !!input.documentacaoExcepcional, motivoDocumentacaoExcepcional: input.motivoDocumentacaoExcepcional ?? null } });
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
    const aplicacoes = [];
    for (const [linha, item] of input.itens.entries()) {
      try { const a = await criarAplicacaoTx(tx, item, usuarioId); aplicacoes.push({ id: a.id, animalId: a.animalId }); }
      catch (e) { if (e instanceof RebanhoError) throw new RebanhoError(e.code, `Linha ${linha + 1}: ${e.message}. Nenhuma aplicação foi gravada.`, `itens.${linha}.${e.campo ?? "animalId"}`); throw e; }
    }
    await tx.requisicaoPecuaria.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, usuarioId, operacao: "APLICACAO_COLETIVA", hashPayload, resultadoIds: aplicacoes } });
    return { aplicacoes };
  });
}

export type ReconciliacaoInput = Pick<AplicacaoInput, "origemInsumo" | "produtoId" | "operacaoServicoId" | "itemCompraDiretaId" | "partidaId" | "partidaCodigo" | "partidaValidade"> & { motivo: string };
export async function reconciliarOrigem(id: string, propriedadeId: number, input: ReconciliacaoInput, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const antes = await tx.aplicacaoProduto.findFirst({ where: { id, propriedadeId, status: "VALIDO", origemInsumo: "SEM_ORIGEM_JUSTIFICADA" } });
    if (!antes) throw new RebanhoError("CONFLITO", "Somente aplicação válida com origem pendente pode ser reconciliada");
    await travarAnimais(tx, [antes.animalId]);
    if (input.origemInsumo === "SEM_ORIGEM_JUSTIFICADA") erro("Selecione a origem localizada");
    if (antes.produtoId && input.produtoId !== antes.produtoId) erro("Não é permitido trocar o medicamento; anule e registre novamente");
    const produto = input.produtoId ? await tx.produto.findUnique({ where: { id: input.produtoId } }) : null;
    if (produto && produto.nome.trim().toLocaleLowerCase() !== antes.nomeProdutoAplicado.trim().toLocaleLowerCase()) erro("Produto deve corresponder ao medicamento registrado; anule para corrigir o medicamento", "produtoId");
    const trava = input.itemCompraDiretaId ? `pec-compra-direta:${input.itemCompraDiretaId}` : `pec-produto:${propriedadeId}:${input.produtoId ?? "sem-produto"}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`;
    const unidade = Object.values(UnidadeMedida).find((u) => u === antes.unidadeDose);
    if (!unidade || !antes.aplicadaEm || !antes.dose) erro("Registro histórico sem quantidade/unidade/horário deve ser corrigido por anulação");
    const origem = await prepararOrigem(tx, { ...input, animalId: antes.animalId, propriedadeId, data: antes.data.toISOString().slice(0, 10), aplicadaEm: antes.aplicadaEm!.toISOString(), nomeProdutoAplicado: antes.nomeProdutoAplicado, dose: antes.dose!.toString(), unidadeDose: unidade! }, antes.data, usuarioId);
    const { nomeProdutoAplicado: _nome, ...vinculos } = origem;
    const depois = await tx.aplicacaoProduto.update({ where: { id }, data: { ...vinculos, origemInsumo: input.origemInsumo, produtoId: input.produtoId ?? null, operacaoServicoId: input.operacaoServicoId ?? null } });
    // A justificativa original permanece no registro e na auditoria. Não há nova
    // despesa: a origem aponta para estoque/compra/Serviço já existente.
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: id, animalId: antes.animalId, propriedadeId, acao: "ORIGEM_RECONCILIADA", usuarioId, antes, depois: { ...depois, motivo: input.motivo } });
    return depois;
  });
}

export async function listarAplicacoes(animalId: string | undefined, propriedadeId: number | null, filtro?: ConsultaSanitaria) {
  return prisma.aplicacaoProduto.findMany({ where: { ...filtrosFatos(filtro), ...(filtro?.situacao === "ORIGEM_PENDENTE" ? { origemInsumo: "SEM_ORIGEM_JUSTIFICADA" } : {}), ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }], ...limites(filtro) });
}

export async function carenciaAnimal(animalId: string, propriedadeId: number | null) {
  if (propriedadeId != null) {
    const ultima = await prisma.localizacaoAnimal.findFirst({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }], select: { propriedadeId: true } });
    if (ultima?.propriedadeId !== propriedadeId) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio");
  }
  return carenciaAnimalTx(prisma, animalId);
}

export async function listarCarencias(propriedadeId: number | null, filtro: ConsultaSanitaria) {
  const animais = await prisma.animal.findMany({
    where: {
      ...(filtro.animalId ? { id: filtro.animalId } : {}),
      ...(propriedadeId == null ? {} : { localizacoes: { some: { propriedadeId, ate: null } } }),
      aplicacaoProdutos: { some: { ...filtrosFatos(filtro) } },
    },
    select: { id: true, brinco: true, nome: true }, orderBy: [{ brinco: "asc" }, { id: "asc" }], ...limites(filtro),
  });
  // O período filtra os animais consultados, não elimina doses ainda relevantes.
  return Promise.all(animais.map(async (animal) => ({ animal, ...await carenciaAnimalTx(prisma, animal.id) })));
}

export async function carenciaAnimalTx(tx: Prisma.TransactionClient, animalId: string) {
  // A carência acompanha o animal. Uma dose aplicada no sítio anterior ainda
  // importa para o leite/carne no sítio atual; o acesso, porém, é pelo local atual.
  const aplicacoes = await tx.aplicacaoProduto.findMany({ where: { animalId, status: "VALIDO" },
    select: { data: true, aplicadaEm: true, precisaoTemporal: true, carenciaLeiteHoras: true, carenciaCarneHoras: true, estadoCarenciaLeite: true, estadoCarenciaCarne: true, aptidaoCarenciaSnapshot: true } });
  const animal = await tx.animal.findUnique({ where: { id: animalId }, select: { sexo: true, destinos: { where: { ate: null }, take: 1 } } });
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
