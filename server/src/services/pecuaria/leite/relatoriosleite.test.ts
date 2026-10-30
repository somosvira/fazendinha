import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { $executeRaw: vi.fn(), propriedade: { findUnique: vi.fn() }, diaProducaoLeite: { findMany: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() },
  operacaoComercialLeite: { count: vi.fn(), findMany: vi.fn() }, vinculoQualidadeFechamentoLeite: { count: vi.fn() }, animal: { findMany: vi.fn() }, fornecimentoNutricionalLeite: { findMany: vi.fn() }, parcelaFornecimentoNutricionalLeite: { count: vi.fn() }, movimentoFornecimentoNutricionalLeite: { count: vi.fn() }, entregaLeite: { findMany: vi.fn() }, alocacaoDemonstrativoLeite: { count: vi.fn() }, demonstrativoLeite: { count: vi.fn(), findMany: vi.fn() }, conferenciaSaldoLeite: { findMany: vi.fn() }, parcelaDestinoLeite: { count: vi.fn() }, amostraQualidadeLeite: { findMany: vi.fn() }, retiradaInternaLeite: { findMany: vi.fn() }, destinoInternoLeite: { findMany: vi.fn() }, descarteLeite: { findMany: vi.fn() }, movimentoEstoque: { findMany: vi.fn() }, entradaProducaoLeite: { findMany: vi.fn() }, versaoComercialVendaLeite: { findMany: vi.fn() }, emissaoRelatorioLeite: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn() } }, custos: vi.fn(), put: vi.fn(), reqs: new Map<string, Record<string, unknown>>() }));
vi.mock("../../../db.js", () => ({ prisma: m.tx }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: (f: (tx: typeof m.tx) => Promise<unknown>) => f(m.tx) }));
vi.mock("../../../lib/storage.js", () => ({ getStorage: async () => ({ putObject: m.put }) }));
vi.mock("./custos.js", () => ({ consultarCustosLeiteTx: m.custos }));
vi.mock("./qualidade.js", () => ({ amostraQualidadeDTO: (a: unknown) => a }));
import { emitirRelatorioLeite, obterRelatorioLeite, exportarRelatorioLeiteCsv, RelatorioLeiteAcessoError } from "./relatoriosleite.js";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { chave: id(1), propriedadeId: 7, inicio: "2026-10-01", fim: "2026-10-01", incluirValores: true };
const producao = (litros: number) => ({ litros, esperadas: 1, medidas: 1, resolvidas: 1, naoOrdenhadas: 0, pendentes: 0, completa: true });
const custos = (litros = 12, custo = "24.00") => ({ propriedadeId: 7, periodo: { inicio: input.inicio, fim: input.fim }, posicaoId: null,
  coberturaPeriodo: { diasInformados: 1, diasSemFolha: [], diasParciais: [], completa: true }, ritmo: [{ data: input.inicio, litros, estado: "COMPLETA", esperadas: 1, resolvidas: 1, pendentes: 0 }],
  animais: [{ animalId: id(20), brinco: "V1", nome: null, producao: producao(litros), custos: { totalConhecido: custo }, custoPorLitro: "2.00", situacao: "APURADO" }], consolidado: { producao: producao(litros), custos: { totalConhecido: custo }, custoPorLitro: "2.00", situacao: "APURADO" } });
let registro: { id: string; criadoEm: Date; criadoPorId: number; snapshot: Prisma.JsonValue } | null;
beforeEach(() => {
  vi.resetAllMocks(); m.reqs.clear(); registro = null;
  m.tx.requisicaoPecuaria.findUnique.mockImplementation(async ({ where }: { where: { chave: string } }) => m.reqs.get(where.chave) ?? null);
  m.tx.requisicaoPecuaria.create.mockImplementation(async ({ data }: { data: Record<string, unknown> & { chave: string } }) => { m.reqs.set(data.chave, data); return data; });
  m.tx.operacaoComercialLeite.count.mockResolvedValue(0); m.tx.vinculoQualidadeFechamentoLeite.count.mockResolvedValue(0); m.tx.operacaoComercialLeite.findMany.mockResolvedValue([]);
  m.tx.parcelaFornecimentoNutricionalLeite.count.mockResolvedValue(0); m.tx.movimentoFornecimentoNutricionalLeite.count.mockResolvedValue(0); m.tx.parcelaDestinoLeite.count.mockResolvedValue(0); m.tx.demonstrativoLeite.count.mockResolvedValue(0); m.tx.alocacaoDemonstrativoLeite.count.mockResolvedValue(0);
  m.tx.propriedade.findUnique.mockResolvedValue({ id: 7, nome: "Sítio leite" }); m.custos.mockResolvedValue(custos());
  for (const tabela of [m.tx.retiradaInternaLeite, m.tx.animal, m.tx.fornecimentoNutricionalLeite, m.tx.entregaLeite, m.tx.demonstrativoLeite, m.tx.diaProducaoLeite, m.tx.conferenciaSaldoLeite, m.tx.amostraQualidadeLeite, m.tx.destinoInternoLeite, m.tx.descarteLeite, m.tx.movimentoEstoque, m.tx.entradaProducaoLeite, m.tx.versaoComercialVendaLeite]) tabela.findMany.mockResolvedValue([]);
  m.tx.emissaoRelatorioLeite.create.mockImplementation(async ({ data }: { data: { snapshot: Prisma.JsonValue } }) => { registro = { id: id(9), criadoEm: new Date("2026-10-01"), criadoPorId: 5, snapshot: data.snapshot }; return registro; });
  m.tx.emissaoRelatorioLeite.findFirstOrThrow.mockImplementation(async () => registro);
  m.tx.emissaoRelatorioLeite.findFirst.mockImplementation(async ({ where }: { where: { propriedadeId: number } }) => where.propriedadeId === 7 ? registro : null);
});
describe("emissões persistidas de leite", () => {
  it("reabre e exporta a emissão original após corrigir produção/custos/qualidade sem reler fontes", async () => {
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([{ id: id(50), data: input.inicio, dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", criadoEm: "2026-10-23T12:00:00Z", resultados: [{ campo: "CCS", valor: "100", unidade: "mil/mL" }], formatoSnapshot: { nome: "Qualidade A", versao: 1 }, sujeito: { tipo: "COLETIVO", origem: "Tanque" } }]);
    m.tx.conferenciaSaldoLeite.findMany.mockResolvedValue([{ id: id(60), produtoId: id(61), produto: { nome: "Leite" }, data: new Date(input.fim), litrosObservados: new Prisma.Decimal(10), versao: 1, referencia: "Régua do tanque", responsavel: "João" }]);
    const emitida = await emitirRelatorioLeite(input, 5, true);
    m.custos.mockResolvedValue(custos(99, "999.99")); m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([]); m.tx.conferenciaSaldoLeite.findMany.mockResolvedValue([]);
    const reaberta = await obterRelatorioLeite(emitida.id, 7, true);
    expect(reaberta).toEqual(emitida); expect(JSON.stringify(reaberta)).toContain('"litros":12'); expect(JSON.stringify(reaberta)).toContain("24.00"); expect(JSON.stringify(reaberta)).toContain("mil/mL"); expect(JSON.stringify(reaberta)).toContain('"litrosObservados":"10"');
    const arquivo = await exportarRelatorioLeiteCsv(emitida.id, 7, true);
    expect(arquivo.conteudo).toContain('"12"'); expect(arquivo.conteudo).toContain('"24.00"'); expect(arquivo.conteudo).not.toContain("999.99"); expect(arquivo.conteudo).toContain("Resultado laboratorial"); expect(arquivo.conteudo).toContain('"2026-10-15";"2026-10-16";"2026-10-23T12:00:00Z"');
    expect(m.custos).toHaveBeenCalledTimes(1); expect(m.tx.amostraQualidadeLeite.findMany).toHaveBeenCalledTimes(1); expect(m.put).toHaveBeenCalledTimes(1);
    expect(await emitirRelatorioLeite(input, 5, true)).toEqual(emitida); expect(m.tx.emissaoRelatorioLeite.create).toHaveBeenCalledTimes(1);
  });
  it("re-mascara snapshot e CSV após perder acesso financeiro e não reaproveita arquivo com dinheiro", async () => {
    const emissao = await emitirRelatorioLeite(input, 5, true);
    const mascarada = await obterRelatorioLeite(emissao.id, 7, false);
    expect(mascarada.snapshot.valores).toBeNull(); expect(JSON.stringify(mascarada)).not.toContain("24.00");
    const arquivo = await exportarRelatorioLeiteCsv(emissao.id, 7, false);
    expect(arquivo.conteudo).not.toContain("24.00"); expect(m.put.mock.calls[0][0].key).toContain("operacional.csv");
    expect((await obterRelatorioLeite(emissao.id, 7, true)).snapshot.valores).not.toBeNull();
  });
  it("emissão operacional não exige acesso a dinheiro nem inclui custos no snapshot", async () => {
    const resposta = await emitirRelatorioLeite({ ...input, incluirValores: false }, 5, false);
    expect(resposta.snapshot.valores).toBeNull(); expect(JSON.stringify(resposta)).not.toContain("24.00"); expect(m.tx.versaoComercialVendaLeite.findMany).not.toHaveBeenCalled();
    await expect(emitirRelatorioLeite({ ...input, chave: id(3) }, 5, false)).rejects.toBeInstanceOf(RelatorioLeiteAcessoError);
    await expect(obterRelatorioLeite(resposta.id, 8, true)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
  });
  it("preserva faturamento por parcelas ativas separado da venda e oculta composição documental sem valores", async () => {
    const entrega = { id: id(70), retiradaId: id(71), referencia: "Coleta de outubro", pontoColeta: null, horarioColeta: "06:00", parceiro: { nome: "Comprador" }, retirada: { produtoId: id(72), produto: { nome: "Leite" }, data: new Date(input.inicio), quantidade: new Prisma.Decimal(100), versoesComerciaisLeite: [{ id: id(73), versao: 1, operacao: { numero: 42, parceiro: { nome: "Comprador" } } }] }, conferencias: [{ id: id(74), versao: 2, volumeAceito: new Prisma.Decimal(90), situacao: "ACEITE_INFORMADO", motivo: "Aceite declarado", destinacaoInformada: null }] };
    m.tx.entregaLeite.findMany.mockResolvedValue([entrega]);
    m.tx.demonstrativoLeite.findMany.mockResolvedValue([{ id: id(80), referencia: "Demonstrativo outubro", inicio: new Date(input.inicio), fim: new Date("2026-10-31"), versao: 1, precoBase: new Prisma.Decimal(2), volumeReconhecido: new Prisma.Decimal(90), valorComercial: new Prisma.Decimal(180), valorPagamentoInformado: new Prisma.Decimal(99), componentes: [{ natureza: "RETENCAO", valor: 17, referencia: "Composição declarada" }], parceiro: { nome: "Comprador" }, alocacoes: [{ id: id(81), entregaId: entrega.id, versaoVendaId: id(73), quantidade: new Prisma.Decimal(20), valor: new Prisma.Decimal(60), entrega: { retirada: { data: new Date(input.inicio) } }, versaoVenda: { operacao: { numero: 42 } } }] }]);
    const emitida = await emitirRelatorioLeite(input, 5, true);
    expect(emitida.snapshot.dados).toMatchObject({ comercialDocumental: { entregas: [{ numeroOperacao: 42, expedidoLitros: "100", volumeAceito: "90", quantidadeFaturadaLitros: "20" }] } });
    expect(emitida.snapshot.valores).toMatchObject({ documental: { faturamento: { quantidadeLitros: "20", valorFaturado: "60.00", precoFaturadoPorLitro: "3.0000" } } });
    m.tx.demonstrativoLeite.findMany.mockResolvedValue([]);
    expect((await obterRelatorioLeite(emitida.id, 7, true)).snapshot).toEqual(emitida.snapshot);
    const oculto = await obterRelatorioLeite(emitida.id, 7, false);
    expect(oculto.snapshot.valores).toBeNull(); expect(JSON.stringify(oculto)).not.toContain("RETENCAO"); expect(JSON.stringify(oculto)).not.toContain("PagamentoInformado");
    expect((await exportarRelatorioLeiteCsv(emitida.id, 7, true)).conteudo).toContain("Preço documental das parcelas faturadas");
  });
  it("limita expansão combinada documental antes do join sem materializar milhões de parcelas", async () => {
    m.tx.demonstrativoLeite.count.mockResolvedValue(100); m.tx.alocacaoDemonstrativoLeite.count.mockResolvedValue(15_000);
    await expect(emitirRelatorioLeite(input, 5, true)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(m.tx.demonstrativoLeite.findMany).not.toHaveBeenCalled(); expect(m.tx.emissaoRelatorioLeite.create).not.toHaveBeenCalled();
  });
  it("limita expansão de parcelas antes de materializar os destinatários", async () => {
    m.tx.parcelaDestinoLeite.count.mockResolvedValueOnce(20_001);
    await expect(emitirRelatorioLeite(input, 5, true)).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(m.tx.destinoInternoLeite.findMany).not.toHaveBeenCalled(); expect(m.tx.emissaoRelatorioLeite.create).not.toHaveBeenCalled();
  });
  it("preserva zero informado, não inventa resultado médio ou encerramento medido e registra venda pela operação", async () => {
    m.custos.mockResolvedValue(custos(0, "0.00"));
    m.tx.movimentoEstoque.findMany.mockResolvedValueOnce([{ id: id(70), produtoId: id(80), produto: { nome: "Leite" }, data: new Date(input.inicio), tipo: "SAIDA", origem: "AJUSTE_INVENTARIO", quantidade: new Prisma.Decimal(4), metodoValorizacao: "LEITE_FIFO_V1", reversaoDeId: null, operacao: { tipo: "VENDA" }, reversaoDe: null }]);
    const resposta = await emitirRelatorioLeite(input, 5, true);
    expect(resposta.snapshot.dados).toMatchObject({ producao: { consolidado: { litros: 0 } }, qualidade: [], balanco: [{ vendas: "4", medicaoCampo: null, conciliacaoCampo: "NAO_REALIZADA" }] });
    expect(resposta.snapshot.valores).toMatchObject({ custos: { consolidado: { custos: { totalConhecido: "0.00" } } } });
  });
});

it("preserva retirada sem operação financeira e alimentação nutricional mista no snapshot e CSV sem dinheiro", async () => {
  const movimento = { id: id(70), produtoId: id(80), produto: { nome: "Leite" }, data: new Date(input.inicio), tipo: "SAIDA", origem: "RETIRADA_LEITE", quantidade: new Prisma.Decimal(4), metodoValorizacao: "LEITE_FIFO_V1", reversaoDeId: null, operacao: null, reversaoDe: null };
  m.tx.movimentoEstoque.findMany.mockResolvedValueOnce([movimento]);
  m.tx.fornecimentoNutricionalLeite.findMany.mockResolvedValue([{ id: id(90), itemId: id(91), data: new Date(input.inicio), quantidadeLitros: new Prisma.Decimal(6), movimentos: [{ entradaId: id(92), movimentoId: id(93), natureza: "COMERCIAL", quantidadeLitros: new Prisma.Decimal(2) }, { entradaId: id(94), movimentoId: id(95), natureza: "NAO_COMERCIAL", quantidadeLitros: new Prisma.Decimal(4) }], parcelas: [{ id: id(96), animalId: id(20), quantidadeLitros: new Prisma.Decimal(6), baseQuantidade: "ATRIBUIDA" }] }]);
  m.tx.animal.findMany.mockResolvedValue([{ id: id(20), brinco: "Bezerra", nome: null }]);
  const resposta = await emitirRelatorioLeite({ ...input, incluirValores: false }, 5, false);
  expect(resposta.snapshot.versaoCalculo).toBe("LEITE_GERENCIAL_V6");
  expect(resposta.snapshot.dados).toMatchObject({ comercial: [{ numeroOperacao: null, quantidadeLitros: "4", naturezaComercial: "RETIRADA_COM_PRECO_NAO_INFERIDO" }], destinos: [{ fonte: "NUTRICAO", natureza: "MISTA", quantidadeLitros: "6", parcelas: [{ quantidadeLitros: "6", baseQuantidade: "ATRIBUIDA" }] }], balanco: [{ vendas: "4", outrosMovimentos: "0" }] });
  const csv = (await exportarRelatorioLeiteCsv(resposta.id, 7, false)).conteudo;
  expect(csv).not.toContain("não inclui os novos FechamentoOperacaoLeite"); expect(csv).toContain("Nutrição para as referências gerenciais"); expect(csv).toContain("Retirada física; preço não inferido"); expect(csv).toContain("Bezerra"); expect(csv).toContain("ATRIBUIDA"); expect(resposta.snapshot.valores).toBeNull();
});
it("continua abrindo envelope V1 sem reconstruir o snapshot", async () => {
  const resposta = await emitirRelatorioLeite(input, 5, true);
  registro!.snapshot = { ...(registro!.snapshot as Prisma.JsonObject), versaoCalculo: "LEITE_GERENCIAL_V1" };
  expect((await obterRelatorioLeite(resposta.id, 7, false)).snapshot.versaoCalculo).toBe("LEITE_GERENCIAL_V1");
});

const comercialPeriodo = (versao = 1, statusFinanceiro = "CONFIRMADA") => ({
  id: id(100), parceiroId: id(101), parceiro: { nome: "Laticínio período" }, inicio: new Date("2026-09-25"), fim: new Date("2026-10-24"), referencia: "Período integral", status: "FECHADA", versao: versao + 1,
  fechamentos: [{ id: id(110 + versao), versao, operacaoId: id(120 + versao), volumeReconhecido: new Prisma.Decimal(10), precoUnitario: new Prisma.Decimal(versao === 1 ? 2 : 3), ajuste: new Prisma.Decimal(0),
    operacao: { numero: 400 + versao, data: new Date("2026-10-25"), status: statusFinanceiro, valorTotal: new Prisma.Decimal(versao === 1 ? 20 : 30) },
    amostras: [{ amostraId: id(130), versaoAmostra: 2, snapshot: { data: "2026-10-01", dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", criadoEm: "2026-10-23T12:00:00Z", valores: { segredo: "segredo monetário" }, motivoComercial: "segredo monetário" } }] }],
});
it("preserva fechamento integral por sobreposição, deduplica a versão financeira e mantém o legado", async () => {
  const o = comercialPeriodo();
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([o]);
  const venda = (operacaoId: string) => ({ id: id(140), retiradaId: id(141), versao: 1, operacaoId, retirada: { data: new Date(input.inicio), quantidade: new Prisma.Decimal(10), produto: { nome: "Leite" } }, operacao: { numero: 401, parceiro: { nome: "Comprador" }, itens: [{ valorTotal: new Prisma.Decimal(20) }] } });
  m.tx.versaoComercialVendaLeite.findMany.mockResolvedValue([venda(o.fechamentos[0].operacaoId), venda(id(142))]);
  const e = await emitirRelatorioLeite(input, 5, true);
  expect(e.snapshot.versaoCalculo).toBe("LEITE_GERENCIAL_V6");
  expect(e.snapshot.dados).toMatchObject({ operacoesComerciais: [{ id: o.id, inicio: "2026-09-25", fim: "2026-10-24", parcialForaFiltro: true, situacao: "FECHADA", fechamento: { id: id(111), versao: 1, volumeReconhecidoLitros: "10", statusFinanceiro: "CONFIRMADA", amostras: [{ amostraId: id(130), versaoAmostra: 2, dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16" }] } }] });
  expect(e.snapshot.valores).toMatchObject({ operacoesComerciais: [{ comercialId: o.id, fechamentoId: id(111), precoUnitario: "2.0000", valorTotal: "20.00" }], comercial: [{ operacaoId: id(142) }] });
  expect((e.snapshot.valores as { comercial: unknown[] }).comercial).toHaveLength(1);
  expect(JSON.stringify(e.snapshot.dados)).not.toContain("segredo monetário");
  expect(m.tx.operacaoComercialLeite.findMany.mock.calls[0][0]).toMatchObject({ where: { propriedadeId: 7, fim: { gte: new Date(input.inicio) }, inicio: { lte: new Date(input.fim) } }, select: { fechamentos: { orderBy: { versao: "desc" }, take: 1 } } });
  const csv = (await exportarRelatorioLeiteCsv(e.id, 7, true)).conteudo;
  expect(csv).toContain("Operações comerciais por período integral"); expect(csv).toContain("Abrange datas fora do filtro"); expect(csv).toContain('"2.0000";"0.00";"20.00"');
});
it("não relê ou retifica a emissão comercial depois de revisão; nova emissão captura a nova versão", async () => {
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([comercialPeriodo()]);
  const anterior = await emitirRelatorioLeite(input, 5, true);
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([comercialPeriodo(2)]);
  expect(await obterRelatorioLeite(anterior.id, 7, true)).toEqual(anterior);
  const nova = await emitirRelatorioLeite({ ...input, chave: id(2) }, 5, true);
  expect(nova.snapshot.valores).toMatchObject({ operacoesComerciais: [{ versao: 2, valorTotal: "30.00" }] });
  expect(anterior.snapshot.valores).toMatchObject({ operacoesComerciais: [{ versao: 1, valorTotal: "20.00" }] });
});
it.each(["CANCELADA", "ANULADA", "ESTORNADA"])("fechamento financeiro %s não vira receita ativa", async status => {
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([comercialPeriodo(1, status)]);
  const e = await emitirRelatorioLeite(input, 5, true);
  expect(e.snapshot.valores).toMatchObject({ operacoesComerciais: [] });
  expect(e.snapshot.dados).toMatchObject({ operacoesComerciais: [{ situacao: "INATIVA", fechamento: { statusFinanceiro: status } }] });
});
it("operação aberta fica com preço pendente e valores não escapam no DTO/CSV sem acesso", async () => {
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([{ ...comercialPeriodo(), id: id(150), status: "ABERTA", fechamentos: [] }, comercialPeriodo()]);
  const e = await emitirRelatorioLeite(input, 5, true);
  expect(e.snapshot.dados).toMatchObject({ operacoesComerciais: [{ situacao: "PRECO_PENDENTE", fechamento: null }, { situacao: "FECHADA" }] });
  const oculto = await obterRelatorioLeite(e.id, 7, false);
  const csv = (await exportarRelatorioLeiteCsv(e.id, 7, false)).conteudo;
  expect(oculto.snapshot.valores).toBeNull(); expect(JSON.stringify(oculto)).not.toContain("precoUnitario"); expect(JSON.stringify(oculto)).not.toContain("valorTotal"); expect(JSON.stringify(oculto)).not.toContain("segredo monetário");
  expect(csv).not.toContain("20.00"); expect(csv).not.toContain("2.0000"); expect(csv).toContain("Preço pendente");
});
it("limita operações e vínculos de qualidade antes do join comercial", async () => {
  m.tx.operacaoComercialLeite.count.mockResolvedValue(10_000); m.tx.vinculoQualidadeFechamentoLeite.count.mockResolvedValue(10_001);
  await expect(emitirRelatorioLeite(input, 5, true)).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(m.tx.operacaoComercialLeite.findMany).not.toHaveBeenCalled();
});
it.each([1, 2, 3, 4, 5])("abre V%s sem acrescentar operações ou novas datas ao snapshot histórico", async versao => {
  const e = await emitirRelatorioLeite(input, 5, true);
  const antigo = JSON.parse(JSON.stringify(registro!.snapshot));
  antigo.versaoCalculo = `LEITE_GERENCIAL_V${versao}`;
  delete antigo.dados.operacoesComerciais; delete antigo.valores.operacoesComerciais;
  registro!.snapshot = antigo;
  const atual = await obterRelatorioLeite(e.id, 7, true);
  expect(atual.snapshot).toEqual(antigo);
  expect(m.tx.operacaoComercialLeite.findMany).toHaveBeenCalledTimes(1);
});

it("emissão operacional conserva volume do fechamento sem consultar dinheiro ou copiar seu snapshot bruto", async () => {
  const o = comercialPeriodo();
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([o]);
  const e = await emitirRelatorioLeite({ ...input, incluirValores: false }, 5, false);
  expect(e.snapshot.dados).toMatchObject({ operacoesComerciais: [{ fechamento: { volumeReconhecidoLitros: "10" } }] });
  expect(e.snapshot.valores).toBeNull();
  expect(JSON.stringify(e)).not.toContain("precoUnitario"); expect(JSON.stringify(e)).not.toContain("valorTotal"); expect(JSON.stringify(e)).not.toContain("segredo monetário");
  const selecao = m.tx.operacaoComercialLeite.findMany.mock.calls[0][0].select.fechamentos.select;
  expect(selecao).not.toHaveProperty("precoUnitario"); expect(selecao).not.toHaveProperty("ajuste"); expect(selecao.operacao.select).not.toHaveProperty("valorTotal");
});
it("período integral contido no filtro é identificado sem parcialidade nem agregação com outras competências", async () => {
  m.tx.operacaoComercialLeite.findMany.mockResolvedValue([{ ...comercialPeriodo(), inicio: new Date(input.inicio), fim: new Date(input.fim) }]);
  const e = await emitirRelatorioLeite(input, 5, true);
  expect(e.snapshot.dados).toMatchObject({ operacoesComerciais: [{ parcialForaFiltro: false }] });
  expect((await exportarRelatorioLeiteCsv(e.id, 7, true)).conteudo).toContain("Integral dentro do filtro");
  expect(e.snapshot.valores).not.toHaveProperty("totalComercial");
});
it("preserva Casa como retirada interna na emissão, separada do descarte físico",async()=>{
 m.tx.retiradaInternaLeite.findMany.mockResolvedValue([{id:id(83),entradaId:id(84),movimentoId:id(85),data:new Date(input.inicio),destino:"CASA",responsavel:"Responsável da casa",quantidadeLitros:new Prisma.Decimal("2.125"),versao:1}]);
 const r=await emitirRelatorioLeite({...input,incluirValores:false},5,false);
 expect(r.snapshot).toMatchObject({versaoCalculo:"LEITE_GERENCIAL_V6",dados:{destinos:[{fonte:"RETIRADA_INTERNA",natureza:"CASA",quantidadeLitros:"2.125",responsavel:"Responsável da casa"}],descartes:[]}});
 expect(m.tx.retiradaInternaLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({propriedadeId:7,status:"CONFIRMADO",movimento:{status:"CONFIRMADO"}})}));
});
