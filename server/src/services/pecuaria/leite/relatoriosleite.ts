import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { env } from "../../../env.js";
import { getStorage } from "../../../lib/storage.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { consultarCustosLeiteTx } from "./custos.js";
import { calcularBalancoLeite, calcularPrecoFaturadoLeite, csvSnapshotLeite, mascararEmissaoLeite } from "./relatoriosleite.calc.js";
import { emitirRelatorioLeiteSchema, type EmitirRelatorioLeiteInput } from "./relatoriosleite.schemas.js";
import { amostraQualidadeDTO } from "./qualidade.js";

export class RelatorioLeiteAcessoError extends Error {}
export const VERSAO_CALCULO_RELATORIO_LEITE = "LEITE_GERENCIAL_V3";
const data = (s: string) => new Date(`${s}T00:00:00Z`);
const texto = (d: Date) => d.toISOString().slice(0, 10);
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));
const MAX_FATOS = 20_000;
const MAX_AMOSTRAS = 1_000;
function conferirLimite(quantidade: number, limite = MAX_FATOS) {
  if (quantidade > limite) throw new RebanhoError("VALIDACAO", "O relatório contém muitos fatos; reduza o período");
}
/** Todas as seções são lidas na mesma transação; nenhuma fonte é relida na abertura. */
export async function montarSnapshotRelatorioLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, input: EmitirRelatorioLeiteInput) {
  const propriedade = await tx.propriedade.findUnique({ where: { id: propriedadeId }, select: { id: true, nome: true } });
  if (!propriedade) throw new RebanhoError("NAO_ENCONTRADO", "Sítio não encontrado");
  const corteEm = new Date().toISOString();
  const periodo = { gte: data(input.inicio), lte: data(input.fim) };
  const custos = await consultarCustosLeiteTx(tx, propriedadeId, { inicio: input.inicio, fim: input.fim, ...(input.animalId ? { animalId: input.animalId } : {}), ...(input.posicaoId ? { posicaoId: input.posicaoId } : {}) }, input.incluirValores);
  const folhasFonte = await tx.diaProducaoLeite.findMany({ where: { propriedadeId, dataOperacional: periodo },
    select: { id: true, versao: true, dataOperacional: true, configuracaoId: true, sessoes: { select: { id: true, versao: true } },
      participantes: { where: { excluidoEm: null, ...(input.animalId ? { animalId: input.animalId } : {}) }, select: { id: true, animalId: true, finalidadeId: true, finalidadeSnapshot: true,
        medicoes: { ...(input.posicaoId ? { where: { sessao: { posicaoId: input.posicaoId } } } : {}), select: { id: true, versao: true } } } } }, orderBy: { dataOperacional: "asc" } });
  const amostras = await tx.amostraQualidadeLeite.findMany({ where: { propriedadeId, data: periodo, status: "VALIDO",
    OR: [{ exameAnimalId: null }, { exameAnimal: { status: "VALIDO" } }],
    ...(input.animalId ? { exameAnimal: { animalId: input.animalId, status: "VALIDO" } } : {}) },
    include: { formato: { include: { tipoExame: true } }, exameAnimal: { include: { animal: { select: { id: true, brinco: true, nome: true } }, resultados: { where: { vigente: true } } } },
      resultados: { where: { vigente: true } }, laudos: { orderBy: { criadoEm: "asc" } } },
    orderBy: [{ data: "asc" }, { id: "asc" }], take: MAX_AMOSTRAS + 1 });
  conferirLimite(amostras.length, MAX_AMOSTRAS);
  const quantidadeParcelasDestino = await tx.parcelaDestinoLeite.count({ where: { ativo: true, destino: { propriedadeId, data: periodo, status: "CONFIRMADO", movimento: { status: "CONFIRMADO" } } } });
  conferirLimite(quantidadeParcelasDestino);
  const destinos = await tx.destinoInternoLeite.findMany({ where: { propriedadeId, data: periodo, status: "CONFIRMADO", movimento: { status: "CONFIRMADO" } },
    select: { id: true, entradaId: true, movimentoId: true, data: true, natureza: true, quantidadeLitros: true, versao: true,
      parcelas: { where: { ativo: true }, select: { id: true, animalId: true, quantidadeLitros: true, fornecimentoColostroId: true, animal: { select: { brinco: true, nome: true } } } } },
    orderBy: [{ data: "asc" }, { id: "asc" }], take: MAX_FATOS + 1 });
  const fornecimentoWhere = { propriedadeId, data: periodo, status: "CONFIRMADO" };
  const quantidadeParcelasNutricionais = await tx.parcelaFornecimentoNutricionalLeite.count({ where: { fornecimento: fornecimentoWhere } });
  const quantidadeOrigensNutricionais = await tx.movimentoFornecimentoNutricionalLeite.count({ where: { fornecimento: fornecimentoWhere } });
  conferirLimite(quantidadeParcelasNutricionais + quantidadeOrigensNutricionais);
  const fornecimentos = await tx.fornecimentoNutricionalLeite.findMany({ where: fornecimentoWhere,
    include: { movimentos: true, parcelas: true }, orderBy: [{ data: "asc" }, { id: "asc" }], take: MAX_FATOS + 1 });
  conferirLimite(fornecimentos.length);
  const destinatariosIds = [...new Set(fornecimentos.flatMap(f => f.parcelas.map(p => p.animalId)))];
  const destinatarios = destinatariosIds.length ? await tx.animal.findMany({ where: { id: { in: destinatariosIds } }, select: { id: true, brinco: true, nome: true } }) : [];
  const descartes = await tx.descarteLeite.findMany({ where: { propriedadeId, data: periodo, status: "CONFIRMADO", movimento: { status: "CONFIRMADO" } },
    select: { id: true, entradaId: true, movimentoId: true, data: true, quantidadeLitros: true, motivo: true, versao: true }, orderBy: [{ data: "asc" }, { id: "asc" }], take: MAX_FATOS + 1 });
  const movimentos = await tx.movimentoEstoque.findMany({ where: { propriedadeId, data: { lte: data(input.fim) }, status: { in: ["CONFIRMADO", "REVERTIDO"] }, metodoValorizacao: "LEITE_FIFO_V1" },
    select: { id: true, produtoId: true, produto: { select: { nome: true } }, data: true, tipo: true, origem: true, quantidade: true, metodoValorizacao: true, reversaoDeId: true, operacao: { select: { tipo: true, numero: true } }, reversaoDe: { select: { origem: true, operacao: { select: { tipo: true, numero: true } } } } }, orderBy: { seq: "asc" }, take: MAX_FATOS + 1 });
  for (const lista of [amostras, destinos, descartes, movimentos]) conferirLimite(lista.length);
  const conferencias = await tx.conferenciaSaldoLeite.findMany({ where: { propriedadeId, data: { lte: data(input.fim) } }, include: { produto: { select: { nome: true } } }, orderBy: [{ data: "desc" }, { versao: "desc" }], take: MAX_FATOS + 1 });
  conferirLimite(conferencias.length);
  const produtos = [...new Set([...movimentos.map(m => m.produtoId), ...conferencias.map(c => c.produtoId)])];
  // Não confunde estoque legado do mesmo produto com lastro das origens leiteiras.
  const semLastro = produtos.length ? await tx.movimentoEstoque.findMany({ where: { propriedadeId, produtoId: { in: produtos }, data: { lte: data(input.fim) }, status: { in: ["CONFIRMADO", "REVERTIDO"] }, metodoValorizacao: { not: "LEITE_FIFO_V1" } },
    select: { id: true, produtoId: true, produto: { select: { nome: true } }, data: true, tipo: true, origem: true, quantidade: true, metodoValorizacao: true, reversaoDeId: true, operacao: { select: { tipo: true, numero: true } }, reversaoDe: { select: { origem: true, operacao: { select: { tipo: true, numero: true } } } } }, take: MAX_FATOS + 1 }) : [];
  conferirLimite(semLastro.length + movimentos.length);
  const origens = await tx.entradaProducaoLeite.findMany({ where: { status: "CONFIRMADA", movimento: { propriedadeId, status: "CONFIRMADO", data: periodo } },
    select: { id: true, sessaoId: true, versaoSessao: true, movimentoId: true, movimento: { select: { produtoId: true, data: true, quantidade: true } }, vinculosMedicoes: { where: { ativo: true }, select: { medicaoId: true, versaoMedicao: true, quantidade: true } }, classificacoes: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, natureza: true } } }, take: MAX_FATOS + 1 });
  conferirLimite(origens.length);
  const comerciais = input.incluirValores ? await tx.versaoComercialVendaLeite.findMany({ where: { retirada: { propriedadeId, status: "CONFIRMADO", data: periodo }, operacao: { status: "CONFIRMADA" } },
    select: { id: true, retiradaId: true, versao: true, operacaoId: true, retirada: { select: { data: true, quantidade: true, produto: { select: { nome: true } } } }, operacao: { select: { numero: true, parceiro: { select: { nome: true } }, itens: { select: { valorTotal: true } } } } }, take: MAX_FATOS + 1 }) : [];
  conferirLimite(comerciais.length);
  const entregas = await tx.entregaLeite.findMany({ where: { propriedadeId, retirada: { status: "CONFIRMADO", data: periodo, versoesComerciaisLeite: { some: { operacao: { status: "CONFIRMADA" } } } } },
    select: { id: true, retiradaId: true, referencia: true, pontoColeta: true, horarioColeta: true, parceiro: { select: { nome: true } },
      retirada: { select: { produtoId: true, produto: { select: { nome: true } }, data: true, quantidade: true,
        versoesComerciaisLeite: { where: { operacao: { status: "CONFIRMADA" } }, orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, operacao: { select: { numero: true, parceiro: { select: { nome: true } } } } } } } },
      conferencias: { orderBy: { versao: "desc" }, take: 1, select: { id: true, versao: true, volumeAceito: true, situacao: true, motivo: true, destinacaoInformada: true } } },
    orderBy: [{ retirada: { data: "asc" } }, { id: "asc" }], take: MAX_FATOS + 1 });
  conferirLimite(entregas.length);
  const whereDocumentos = { propriedadeId, status: "VALIDO", alocacoes: { some: { ativo: true, entrega: { retirada: { status: "CONFIRMADO" as const, data: periodo } } } } };
  const quantidadeDocumentos = await tx.demonstrativoLeite.count({ where: whereDocumentos });
  const quantidadeParcelasDocumentais = await tx.alocacaoDemonstrativoLeite.count({ where: { ativo: true, demonstrativo: { propriedadeId, status: "VALIDO" }, entrega: { retirada: { status: "CONFIRMADO", data: periodo } } } });
  conferirLimite(quantidadeDocumentos, 200);
  // Teto conservador: cada documento aceita até100componentes no contrato70000.
  // A contagem ocorre ANTES do join, para não materializar milhares de parcelas por documento.
  conferirLimite(quantidadeDocumentos * 100 + quantidadeParcelasDocumentais + quantidadeParcelasDestino + quantidadeParcelasNutricionais + quantidadeOrigensNutricionais + fornecimentos.length + entregas.length + amostras.length + destinos.length + descartes.length + movimentos.length + semLastro.length + origens.length + comerciais.length + conferencias.length);
  const demonstrativos = await tx.demonstrativoLeite.findMany({ where: whereDocumentos,
    select: { id: true, referencia: true, inicio: true, fim: true, versao: true, precoBase: true, volumeReconhecido: true, valorComercial: true, valorPagamentoInformado: true, componentes: true, parceiro: { select: { nome: true } },
      alocacoes: { where: { ativo: true, entrega: { retirada: { status: "CONFIRMADO", data: periodo } } }, select: { id: true, entregaId: true, versaoVendaId: true, quantidade: true, valor: true,
        entrega: { select: { retirada: { select: { data: true } } } }, versaoVenda: { select: { operacao: { select: { numero: true } } } } } } },
    orderBy: [{ inicio: "asc" }, { id: "asc" }], take: MAX_FATOS + 1 });
  conferirLimite(demonstrativos.length);
  const parcelasFaturadas = demonstrativos.flatMap(d => d.alocacoes);
  conferirLimite(parcelasFaturadas.length);
  const qualidade = amostras.map(amostraQualidadeDTO);
  const origemBalanco = (m: (typeof movimentos)[number]) => m.origem === "RETIRADA_LEITE" || m.reversaoDe?.origem === "RETIRADA_LEITE" || m.operacao?.tipo === "VENDA" || m.reversaoDe?.operacao?.tipo === "VENDA" ? "VENDA" : m.origem;
  const balanco = calcularBalancoLeite([...movimentos, ...semLastro].map(m => ({ ...m, origem: origemBalanco(m), produtoNome: m.produto.nome, data: texto(m.data) })), input.inicio, input.fim, conferencias.map(c => ({ ...c, produtoNome: c.produto.nome, data: texto(c.data) })));
  const producaoConfirmadaLitros = origens.reduce((s, o) => s.plus(o.movimento.quantidade), new Prisma.Decimal(0));
  // A produção do indicador pode ter filtro animal/ordenha. A pendência física precisa da fazenda toda.
  const producaoFazenda = input.animalId || input.posicaoId
    ? await consultarCustosLeiteTx(tx, propriedadeId, { inicio: input.inicio, fim: input.fim }, false) : custos;
  const medidaFazenda = producaoFazenda.consolidado.producao.litros;
  const diferencaProducao = medidaFazenda == null ? null : new Prisma.Decimal(medidaFazenda).minus(producaoConfirmadaLitros);
  const naoConfirmada = diferencaProducao?.gte(0) ? diferencaProducao.toString() : null;
  return { versao: 1 as const, versaoCalculo: VERSAO_CALCULO_RELATORIO_LEITE, corteEm, propriedade,
    filtros: { inicio: input.inicio, fim: input.fim, animalId: input.animalId ?? null, posicaoId: input.posicaoId ?? null },
    referenciasProducao: folhasFonte.map(f => ({ ...f, dataOperacional: texto(f.dataOperacional) })),
    unidades: { producao: "L", destinos: "L", balanco: "L", qualidade: "UNIDADE_DO_CAMPO_NO_FORMATO", custos: "BRL", custoPorLitro: "BRL/L" },
    fontes: { producao: ["DiaProducaoLeite", "ParticipanteProducaoLeite", "MedicaoLeite"], custos: ["Componentes de custo pecuário documentados"],
      qualidade: ["AmostraQualidadeLeite", "ExameAnimal", "Resultados vigentes e formato snapshot"], destinos: ["DestinoInternoLeite", "ParcelaDestinoLeite", "FornecimentoNutricionalLeite", "MovimentoFornecimentoNutricionalLeite", "ParcelaFornecimentoNutricionalLeite"],
      comercial: ["RetiradaOperacaoLeite (preço pode estar pendente)", "MovimentoEstoque", "VersaoComercialVendaLeite", "EntregaLeite", "ConferenciaEntregaLeite", "DemonstrativoLeite válido e alocações ativas"], descarte: ["DescarteLeite"], balanco: ["Razão MovimentoEstoque confirmado/revertido com inversos", "ConferenciaSaldoLeite versionada, observação manual sem ajuste"] },
    escopos: { producaoCustos: "SITIO_PERIODO_ANIMAL_ORDENHA", qualidade: input.animalId ? "INDIVIDUAL_DO_ANIMAL_NO_PERIODO" : "INDIVIDUAL_E_COLETIVO_NO_SITIO_PERIODO",
      destinosComercialBalanco: "SITIO_PERIODO_INDEPENDENTE_DO_FILTRO_PRODUTOR", ordenhaQualidade: "NAO_ATRIBUIDA" },
    cobertura: { producao: custos.coberturaPeriodo, qualidade: { amostras: qualidade.length, comResultados: qualidade.filter(a => a.resultados.length).length, semResultados: qualidade.filter(a => !a.resultados.length).length,
        estado: qualidade.length ? "AMOSTRAS_REGISTRADAS_SEM_EXTRAPOLACAO" : "SEM_AMOSTRAS", agregacao: "SEM_MEDIAS_ENTRE_FORMATOS_OU_UNIDADES" },
      producaoFazenda: producaoFazenda.coberturaPeriodo, producaoNaoConfirmadaLitros: naoConfirmada, producaoNaoConfirmadaEstado: diferencaProducao?.lt(0) ? "CONFLITO_DE_FONTES" : !producaoFazenda.coberturaPeriodo.completa ? "PARCIAL" : "CONHECIDA", balanco: { estado: balanco.some(b => b.encerramentoRazao !== null) ? "RAZAO_RECONSTITUIDO" : "SEM_MOVIMENTOS", medicaoCampo: balanco.some(b => b.medicaoCampo !== null) ? "OBSERVACOES_MANUAIS_NO_CORTE" : "NAO_INFORMADA" }, medicaoCampo: balanco.some(b => b.medicaoCampo !== null) ? "OBSERVACOES_MANUAIS_NO_CORTE" : "NAO_INFORMADA" },
    dados: {
      producao: { propriedadeId, periodo: custos.periodo, posicaoId: custos.posicaoId, coberturaPeriodo: custos.coberturaPeriodo, ritmo: custos.ritmo,
        animais: custos.animais.map(a => ({ animalId: a.animalId, brinco: a.brinco, nome: a.nome, producao: a.producao })), consolidado: custos.consolidado.producao },
      qualidade, destinos: [...destinos.map(d => ({ ...d, fonte: "DESTINO_INTERNO", data: texto(d.data), quantidadeLitros: d.quantidadeLitros.toString(), parcelas: d.parcelas.map(p => ({ ...p, quantidadeLitros: p.quantidadeLitros.toString() })) })),
        ...fornecimentos.map(f => ({ id: f.id, fonte: "NUTRICAO", itemId: f.itemId, data: texto(f.data), quantidadeLitros: f.quantidadeLitros.toString(),
          natureza: [...new Set(f.movimentos.map(m => m.natureza))].length === 1 ? f.movimentos[0]?.natureza ?? "NAO_INFORMADA" : "MISTA",
          origens: f.movimentos.map(m => ({ entradaId: m.entradaId, movimentoId: m.movimentoId, natureza: m.natureza, quantidadeLitros: m.quantidadeLitros.toString() })),
          parcelas: f.parcelas.map(p => ({ id: p.id, animalId: p.animalId, quantidadeLitros: p.quantidadeLitros.toString(), baseQuantidade: p.baseQuantidade,
            animal: destinatarios.find(a => a.id === p.animalId) ?? null })) }))],
      descartes: descartes.map(d => ({ ...d, data: texto(d.data), quantidadeLitros: d.quantidadeLitros.toString() })),
      comercial: movimentos.filter(m => m.data >= data(input.inicio) && origemBalanco(m) === "VENDA").map(m => ({ movimentoId: m.id, produtoId: m.produtoId, produtoNome: m.produto.nome, numeroOperacao: m.operacao?.numero ?? m.reversaoDe?.operacao?.numero ?? null, naturezaComercial: m.origem === "RETIRADA_LEITE" || m.reversaoDe?.origem === "RETIRADA_LEITE" ? "RETIRADA_COM_PRECO_NAO_INFERIDO" : "VENDA_LEGADA", data: texto(m.data), quantidadeLitros: m.quantidade.toString(), tipo: m.tipo, reversaoDeId: m.reversaoDeId })),
      origens: origens.map(o => ({ ...o, movimento: { ...o.movimento, data: texto(o.movimento.data), quantidade: o.movimento.quantidade.toString() }, vinculosMedicoes: o.vinculosMedicoes.map(v => ({ ...v, quantidade: v.quantidade.toString() })) })),
      comercialDocumental: { escopoAlocacoes: "ENTREGAS_DO_PERIODO", cabecalhosDocumentais: "PERIODO_INTEGRAL_DECLARADO", entregas: entregas.map(e => {
        const c = e.conferencias[0], v = e.retirada.versoesComerciaisLeite[0];
        return { id: e.id, retiradaId: e.retiradaId, referencia: e.referencia, produtoId: e.retirada.produtoId, produtoNome: e.retirada.produto.nome, data: texto(e.retirada.data),
          numeroOperacao: v?.operacao.numero ?? null, parceiroNome: v?.operacao.parceiro?.nome ?? e.parceiro.nome, pontoColeta: e.pontoColeta, horarioColeta: e.horarioColeta,
          expedidoLitros: e.retirada.quantidade.toString(), volumeAceito: c?.volumeAceito?.toString() ?? null, situacao: c?.situacao ?? "PENDENTE", versaoConferencia: c?.versao ?? null,
          motivo: c?.motivo ?? null, destinacaoInformada: c?.destinacaoInformada ?? null,
          quantidadeFaturadaLitros: parcelasFaturadas.filter(p => p.entregaId === e.id).reduce((s, p) => s.plus(p.quantidade), new Prisma.Decimal(0)).toString() };
      }), demonstrativos: demonstrativos.map(d => ({ id: d.id, referencia: d.referencia, inicio: texto(d.inicio), fim: texto(d.fim), parceiroNome: d.parceiro.nome,
        versao: d.versao, volumeReconhecidoLitros: d.volumeReconhecido.toString(), alocacoes: d.alocacoes.map(a => ({ id: a.id, entregaId: a.entregaId, dataEntrega: texto(a.entrega.retirada.data), numeroOperacao: a.versaoVenda.operacao.numero, quantidadeLitros: a.quantidade.toString(), versaoVendaId: a.versaoVendaId })) })) },
      balanco,
    },
    valoresIncluidos: input.incluirValores,
    valores: input.incluirValores ? { custos,
      documental: { demonstrativos: demonstrativos.map(d => ({ id: d.id, referencia: d.referencia, precoBase: d.precoBase.toFixed(4), valorComercial: d.valorComercial.toFixed(2),
        valorPagamentoInformado: d.valorPagamentoInformado?.toFixed(2) ?? null, componentes: d.componentes, alocacoes: d.alocacoes.map(a => ({ id: a.id, entregaId: a.entregaId, numeroOperacao: a.versaoVenda.operacao.numero, valor: a.valor.toFixed(2), quantidadeLitros: a.quantidade.toString() })) })),
        faturamento: calcularPrecoFaturadoLeite(parcelasFaturadas) },
      comercial: comerciais.map(v => ({ id: v.id, retiradaId: v.retiradaId, versao: v.versao, operacaoId: v.operacaoId, numeroOperacao: v.operacao.numero, data: texto(v.retirada.data), quantidadeLitros: v.retirada.quantidade.toString(), produtoNome: v.retirada.produto.nome, parceiroNome: v.operacao.parceiro?.nome ?? null,
      valorTotal: v.operacao.itens.reduce((s, i) => s.plus(i.valorTotal), new Prisma.Decimal(0)).toFixed(2) })) } : null,
    limitacoes: ["O bloco financeiro desta emissão usa fontes comerciais anteriores: não inclui os novos FechamentoOperacaoLeite nem referências gerenciais do fornecimento nutricional. Não representa o total comercial atual com os dois percursos; consulte Vendas para os novos fechamentos e Nutrição para as referências gerenciais", "Razão e observação manual são fontes separadas; ausência de conferência permanece desconhecida. Observação anterior informa sua data, sem presumir abertura atual ou ajuste automático", "Custo direto parcial não é lucro", "Qualidade preservada por amostra/formato/versão/unidade, sem média incompatível", "Destinos/comercial/balanço usam sítio e período, sem atribuição automática ao produtor filtrado"] };
}
export type SnapshotRelatorioLeite = Awaited<ReturnType<typeof montarSnapshotRelatorioLeiteTx>>;
const envelopeSchema = z.object({ versao: z.literal(1), versaoCalculo: z.enum(["LEITE_GERENCIAL_V1", "LEITE_GERENCIAL_V2", VERSAO_CALCULO_RELATORIO_LEITE]), corteEm: z.string().datetime(), valoresIncluidos: z.boolean(), valores: z.object({}).passthrough().nullable(), dados: z.object({}).passthrough(), propriedade: z.object({ id: z.number(), nome: z.string() }) }).passthrough();
function dto(registro: { id: string; criadoEm: Date; criadoPorId: number | null; snapshot: Prisma.JsonValue }, verValores: boolean) {
  // A validação de envelope impede abrir uma versão desconhecida como se fosse a atual.
  const snapshot = envelopeSchema.parse(registro.snapshot);
  return mascararEmissaoLeite({ id: registro.id, criadoEm: registro.criadoEm.toISOString(), criadoPorId: registro.criadoPorId, snapshot }, verValores);
}
export async function emitirRelatorioLeite(input: EmitirRelatorioLeiteInput & { propriedadeId: number }, usuarioId: number | null, verValores: boolean) {
  const dados = { ...emitirRelatorioLeiteSchema.parse(input), propriedadeId: input.propriedadeId };
  if (dados.incluirValores && !verValores) throw new RelatorioLeiteAcessoError("Sem acesso aos valores financeiros");
  return transacaoPecuaria(async tx => {
    const emissao = await operacaoIdempotenteTx(tx, dados, usuarioId, "EMISSAO_RELATORIO_LEITE", async () => {
      const snapshot = await montarSnapshotRelatorioLeiteTx(tx, dados.propriedadeId, dados);
      const registro = await tx.emissaoRelatorioLeite.create({ data: { propriedadeId: dados.propriedadeId, inicio: data(dados.inicio), fim: data(dados.fim),
        versaoCalculo: VERSAO_CALCULO_RELATORIO_LEITE, corteEm: new Date(snapshot.corteEm), filtros: json(snapshot.filtros), snapshot: json(snapshot), valoresIncluidos: dados.incluirValores, criadoPorId: usuarioId } });
      await auditar(tx, { entidade: "EmissaoRelatorioLeite", entidadeId: registro.id, propriedadeId: dados.propriedadeId, usuarioId, acao: "EMISSAO", depois: { filtros: snapshot.filtros, corteEm: snapshot.corteEm, versaoCalculo: snapshot.versaoCalculo, valoresIncluidos: dados.incluirValores } });
      return { id: registro.id };
    });
    return dto(await tx.emissaoRelatorioLeite.findFirstOrThrow({ where: { id: emissao.id, propriedadeId: dados.propriedadeId } }), verValores);
  });
}
export async function obterRelatorioLeite(id: string, propriedadeId: number, verValores: boolean) {
  const registro = await prisma.emissaoRelatorioLeite.findFirst({ where: { id, propriedadeId } });
  if (!registro) throw new RebanhoError("NAO_ENCONTRADO", "Emissão não encontrada neste sítio");
  return dto(registro, verValores);
}
export async function listarRelatoriosLeite(propriedadeId: number, pagina = 1) {
  const where = { propriedadeId };
  const [itens, total] = await prisma.$transaction([prisma.emissaoRelatorioLeite.findMany({ where, orderBy: [{ criadoEm: "desc" }, { id: "desc" }], skip: (pagina - 1) * 20, take: 20,
    select: { id: true, propriedadeId: true, inicio: true, fim: true, versaoCalculo: true, corteEm: true, valoresIncluidos: true, criadoEm: true, criadoPorId: true } }), prisma.emissaoRelatorioLeite.count({ where })]);
  return { propriedadeId, itens: itens.map(i => ({ ...i, inicio: texto(i.inicio), fim: texto(i.fim), corteEm: i.corteEm.toISOString(), criadoEm: i.criadoEm.toISOString() })), total, pagina, tamanho: 20 };
}
export async function exportarRelatorioLeiteCsv(id: string, propriedadeId: number, verValores: boolean) {
  const emissao = await obterRelatorioLeite(id, propriedadeId, verValores);
  const conteudo = csvSnapshotLeite(emissao);
  const key = `${env.STORAGE_NAMESPACE}/relatorios-leite/${propriedadeId}/${id}/${verValores ? "valores" : "operacional"}.csv`;
  // Arquivo privado por nível de acesso. Não retorna URL assinada que contorne reautorização.
  await (await getStorage()).putObject({ key, body: Buffer.from(conteudo), contentType: "text/csv; charset=utf-8" });
  return { nome: `leite-${id}.csv`, conteudo };
}
