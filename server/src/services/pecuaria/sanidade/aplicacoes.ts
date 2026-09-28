import { Prisma, type OrigemInsumoSanitario, type FinalidadeAplicacao, type UnidadeMedida } from "@prisma/client";
import { prisma } from "../../../db.js";
import { RebanhoError, auditar, travarAnimais } from "../rebanho/regras.js";
import { propriedadePrincipalId } from "../../propriedade.js";
import { obterBaseCusto, statusSaldoEstoque, estornarMovimentoTx } from "../../estoque/estoque.js";
import { valorSaidaDaBase } from "../../estoque/estoque.calc.js";
import { converterQuantidade, UNIDADES } from "../../estoque/unidades.js";
import { exigirPeriodoAberto } from "../../financeiro/regras.js";
import { calcularPrazoCarencia } from "./carencia.calc.js";

export type AplicacaoInput = {
  animalId: string;
  propriedadeId: number;
  data: string;
  aplicadaEm: string;
  finalidade: FinalidadeAplicacao;
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
  justificativaSemOrigem?: string | null;
};

const dia = (valor: string) => new Date(`${valor}T00:00:00.000Z`);

function erro(mensagem: string, campo?: string): never {
  throw new RebanhoError("VALIDACAO", mensagem, campo);
}

async function conferirLocalizacao(tx: Prisma.TransactionClient, input: AplicacaoInput) {
  const animal = await tx.animal.findUnique({ where: { id: input.animalId }, select: { id: true, dataNascimento: true, dataEntrada: true } });
  if (!animal) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado");
  const data = dia(input.data);
  const momento = new Date(input.aplicadaEm);
  if (!Number.isFinite(momento.getTime()) || new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(momento) !== input.data) {
    erro("A data e o horário da aplicação devem corresponder ao mesmo dia no Brasil", "aplicadaEm");
  }
  if (data < animal.dataNascimento || data < animal.dataEntrada) erro("A aplicação não pode anteceder o nascimento ou a entrada do animal", "data");
  const local = await tx.localizacaoAnimal.findFirst({
    where: { animalId: input.animalId, propriedadeId: input.propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }] },
  });
  if (!local) erro("O animal não estava neste sítio na data da aplicação", "propriedadeId");
  const baixa = await tx.baixaAnimal.findFirst({ where: { animalId: input.animalId, estornadaEm: null } });
  if (baixa && data >= baixa.data) erro("A aplicação não pode ocorrer após a baixa do animal", "data");
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
  const produto = input.produtoId ? await tx.produto.findUnique({ where: { id: input.produtoId } }) : null;
  if (input.produtoId && !produto) erro("Produto não encontrado", "produtoId");
  const dose = new Prisma.Decimal(input.dose);
  if (!dose.isFinite() || dose.lte(0) || dose.decimalPlaces() > 3) erro("Informe uma dose positiva com até três casas", "dose");
  let movimentoEstoqueId: string | null = null;
  let itemCompraDiretaId: string | null = null;
  let quantidadeCompraDireta: Prisma.Decimal | null = null;
  let valorProdutoAtribuido: Prisma.Decimal | null = null;
  let situacaoCusto = "NAO_APURADO";
  let partidaCodigo: string | null = input.partidaCodigo ?? null;
  let partidaValidade: Date | null = null;

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
    const usadas = await tx.aplicacaoProduto.aggregate({ where: { itemCompraDiretaId: item.id, status: "VALIDO" }, _sum: { quantidadeCompraDireta: true } });
    if (quantidade!.plus(usadas._sum.quantidadeCompraDireta ?? 0).gt(item.quantidade)) erro("A quantidade da compra já foi destinada a outras aplicações", "itemCompraDiretaId");
    itemCompraDiretaId = item.id;
    quantidadeCompraDireta = quantidade!;
    valorProdutoAtribuido = item.valorTotal.mul(quantidade!).div(item.quantidade).toDecimalPlaces(2);
    situacaoCusto = "CONHECIDO";
  } else if (input.origemInsumo === "BAIXA_ESTOQUE") {
    if (!produto) erro("Selecione o Produto da fazenda para baixar do estoque", "produtoId");
    if (input.itemCompraDiretaId) erro("Compra direta não pode ser baixada do estoque", "itemCompraDiretaId");
    let quantidade: Prisma.Decimal;
    try { quantidade = converterQuantidade(dose, input.unidadeDose, produto.unidade); }
    catch { erro("A dose não pode ser convertida para a unidade do Produto", "unidadeDose"); }
    if (quantidade!.decimalPlaces() > 3) erro("Cadastre o Produto em unidade menor: esta dose perderia precisão", "dose");
    if (produto.rastrearPartidas && !input.partidaId) erro("Selecione a partida do Produto", "partidaId");
    if (!produto.rastrearPartidas && input.partidaId) erro("Este Produto não usa partidas", "partidaId");
    const partida = input.partidaId ? await tx.partidaProduto.findFirst({ where: { id: input.partidaId, produtoId: produto.id } }) : null;
    if (input.partidaId && !partida) erro("Partida não pertence a este Produto", "partidaId");
    if (partida?.validade && partida.validade < data) erro("Partida vencida: corrija a origem ou documente o fato ocorrido com justificativa", "partidaId");
    if ((await obterSaldo(tx, produto.id, input.propriedadeId)).lt(quantidade!)) erro("Saldo de estoque insuficiente neste sítio", "dose");
    if (partida && (await obterSaldo(tx, produto.id, input.propriedadeId, partida.id)).lt(quantidade!)) erro("Saldo da partida insuficiente neste sítio", "partidaId");
    await exigirPeriodoAberto(tx, input.propriedadeId, data);
    const base = await obterBaseCusto(tx, produto.id, input.propriedadeId);
    const valores = valorSaidaDaBase(quantidade!, base);
    const movimento = await tx.movimentoEstoque.create({ data: {
      produtoId: produto.id, tipo: "SAIDA", origem: "SANIDADE", data, quantidade: quantidade!,
      custoUnitario: valores.custoUnitario, valorTotal: valores.valorTotal,
      propriedadeId: input.propriedadeId, criadoPorId: usuarioId,
      observacao: `Aplicação sanitária em ${input.animalId}`,
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

export async function criarAplicacao(input: AplicacaoInput, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
    await travarAnimais(tx, [input.animalId]);
    const data = await conferirLocalizacao(tx, input);
    // Ordem global: animal antes de Produto/sítio. A trava serializa consumo
    // concorrente e reserva de quantidade da mesma compra direta.
    const trava = input.itemCompraDiretaId ? `pec-compra-direta:${input.itemCompraDiretaId}` : `pec-produto:${input.propriedadeId}:${input.produtoId ?? "sem-produto"}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${trava}))`;
    const origem = await prepararOrigem(tx, input, data, usuarioId);
    const criada = await tx.aplicacaoProduto.create({ data: {
      animalId: input.animalId, propriedadeId: input.propriedadeId, produtoId: input.produtoId ?? null,
      nomeProdutoAplicado: origem.nomeProdutoAplicado, ocorrenciaId: input.ocorrenciaId ?? null, tarefaId: input.tarefaId ?? null,
      data, aplicadaEm: new Date(input.aplicadaEm), precisaoTemporal: "HORA", finalidade: input.finalidade,
      dose: new Prisma.Decimal(input.dose), unidadeDose: input.unidadeDose,
      carenciaLeiteHoras: input.carenciaLeiteHoras ?? null, carenciaCarneHoras: input.carenciaCarneHoras ?? null,
      referenciaCarencia: input.referenciaCarencia ?? null, origemInsumo: input.origemInsumo,
      quantidadeUtilizada: new Prisma.Decimal(input.dose),
      movimentoEstoqueId: origem.movimentoEstoqueId, itemCompraDiretaId: origem.itemCompraDiretaId,
      quantidadeCompraDireta: origem.quantidadeCompraDireta, operacaoServicoId: input.operacaoServicoId ?? null,
      valorProdutoAtribuido: origem.valorProdutoAtribuido, situacaoCusto: origem.situacaoCusto,
      partidaCodigoSnapshot: origem.partidaCodigoSnapshot, partidaValidadeSnapshot: origem.partidaValidadeSnapshot,
      justificativaSemOrigem: input.justificativaSemOrigem ?? null,
    } });
    await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: criada.id, animalId: input.animalId, acao: "REGISTRO", usuarioId,
      depois: { origemInsumo: criada.origemInsumo, operacaoServicoId: criada.operacaoServicoId, itemCompraDiretaId: criada.itemCompraDiretaId, movimentoEstoqueId: criada.movimentoEstoqueId } });
    return criada;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listarAplicacoes(animalId: string | undefined, propriedadeId: number | null) {
  return prisma.aplicacaoProduto.findMany({ where: { ...(animalId ? { animalId } : {}), ...(propriedadeId == null ? {} : { propriedadeId }) },
    orderBy: [{ data: "desc" }, { criadoEm: "desc" }], take: 100 });
}

export async function carenciaAnimal(animalId: string, propriedadeId: number | null) {
  if (propriedadeId != null) {
    const ultima = await prisma.localizacaoAnimal.findFirst({ where: { animalId }, orderBy: [{ desde: "desc" }, { criadoEm: "desc" }], select: { propriedadeId: true } });
    if (ultima?.propriedadeId !== propriedadeId) throw new RebanhoError("NAO_ENCONTRADO", "Animal não encontrado neste sítio");
  }
  // A carência acompanha o animal. Uma dose aplicada no sítio anterior ainda
  // importa para o leite/carne no sítio atual; o acesso, porém, é pelo local atual.
  const aplicacoes = await prisma.aplicacaoProduto.findMany({ where: { animalId, status: "VALIDO" },
    select: { data: true, aplicadaEm: true, precisaoTemporal: true, carenciaLeiteHoras: true, carenciaCarneHoras: true } });
  return { leite: calcularPrazoCarencia(aplicacoes, "LEITE"), carne: calcularPrazoCarencia(aplicacoes, "CARNE") };
}

export async function anularAplicacao(id: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  return prisma.$transaction(async (tx) => {
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
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
