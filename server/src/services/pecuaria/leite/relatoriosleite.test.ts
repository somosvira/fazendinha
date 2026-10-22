import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ tx: { $executeRaw: vi.fn(), propriedade: { findUnique: vi.fn() }, diaProducaoLeite: { findMany: vi.fn() }, requisicaoPecuaria: { findUnique: vi.fn(), create: vi.fn() }, auditoriaPecuaria: { create: vi.fn() },
  animal: { findMany: vi.fn() }, fornecimentoNutricionalLeite: { findMany: vi.fn() }, parcelaFornecimentoNutricionalLeite: { count: vi.fn() }, movimentoFornecimentoNutricionalLeite: { count: vi.fn() }, entregaLeite: { findMany: vi.fn() }, alocacaoDemonstrativoLeite: { count: vi.fn() }, demonstrativoLeite: { count: vi.fn(), findMany: vi.fn() }, conferenciaSaldoLeite: { findMany: vi.fn() }, parcelaDestinoLeite: { count: vi.fn() }, amostraQualidadeLeite: { findMany: vi.fn() }, destinoInternoLeite: { findMany: vi.fn() }, descarteLeite: { findMany: vi.fn() }, movimentoEstoque: { findMany: vi.fn() }, entradaProducaoLeite: { findMany: vi.fn() }, versaoComercialVendaLeite: { findMany: vi.fn() }, emissaoRelatorioLeite: { create: vi.fn(), findFirst: vi.fn(), findFirstOrThrow: vi.fn() } }, custos: vi.fn(), put: vi.fn(), reqs: new Map<string, Record<string, unknown>>() }));
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
  m.tx.parcelaFornecimentoNutricionalLeite.count.mockResolvedValue(0); m.tx.movimentoFornecimentoNutricionalLeite.count.mockResolvedValue(0); m.tx.parcelaDestinoLeite.count.mockResolvedValue(0); m.tx.demonstrativoLeite.count.mockResolvedValue(0); m.tx.alocacaoDemonstrativoLeite.count.mockResolvedValue(0);
  m.tx.propriedade.findUnique.mockResolvedValue({ id: 7, nome: "Sítio leite" }); m.custos.mockResolvedValue(custos());
  for (const tabela of [m.tx.animal, m.tx.fornecimentoNutricionalLeite, m.tx.entregaLeite, m.tx.demonstrativoLeite, m.tx.diaProducaoLeite, m.tx.conferenciaSaldoLeite, m.tx.amostraQualidadeLeite, m.tx.destinoInternoLeite, m.tx.descarteLeite, m.tx.movimentoEstoque, m.tx.entradaProducaoLeite, m.tx.versaoComercialVendaLeite]) tabela.findMany.mockResolvedValue([]);
  m.tx.emissaoRelatorioLeite.create.mockImplementation(async ({ data }: { data: { snapshot: Prisma.JsonValue } }) => { registro = { id: id(9), criadoEm: new Date("2026-10-01"), criadoPorId: 5, snapshot: data.snapshot }; return registro; });
  m.tx.emissaoRelatorioLeite.findFirstOrThrow.mockImplementation(async () => registro);
  m.tx.emissaoRelatorioLeite.findFirst.mockImplementation(async ({ where }: { where: { propriedadeId: number } }) => where.propriedadeId === 7 ? registro : null);
});
describe("emissões persistidas de leite", () => {
  it("reabre e exporta a emissão original após corrigir produção/custos/qualidade sem reler fontes", async () => {
    m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([{ id: id(50), data: input.inicio, resultados: [{ campo: "CCS", valor: "100", unidade: "mil/mL" }], formatoSnapshot: { nome: "Qualidade A", versao: 1 }, sujeito: { tipo: "COLETIVO", origem: "Tanque" } }]);
    m.tx.conferenciaSaldoLeite.findMany.mockResolvedValue([{ id: id(60), produtoId: id(61), produto: { nome: "Leite" }, data: new Date(input.fim), litrosObservados: new Prisma.Decimal(10), versao: 1, referencia: "Régua do tanque", responsavel: "João" }]);
    const emitida = await emitirRelatorioLeite(input, 5, true);
    m.custos.mockResolvedValue(custos(99, "999.99")); m.tx.amostraQualidadeLeite.findMany.mockResolvedValue([]); m.tx.conferenciaSaldoLeite.findMany.mockResolvedValue([]);
    const reaberta = await obterRelatorioLeite(emitida.id, 7, true);
    expect(reaberta).toEqual(emitida); expect(JSON.stringify(reaberta)).toContain('"litros":12'); expect(JSON.stringify(reaberta)).toContain("24.00"); expect(JSON.stringify(reaberta)).toContain("mil/mL"); expect(JSON.stringify(reaberta)).toContain('"litrosObservados":"10"');
    const arquivo = await exportarRelatorioLeiteCsv(emitida.id, 7, true);
    expect(arquivo.conteudo).toContain('"12"'); expect(arquivo.conteudo).toContain('"24.00"'); expect(arquivo.conteudo).not.toContain("999.99");
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
  expect(resposta.snapshot.versaoCalculo).toBe("LEITE_GERENCIAL_V3");
  expect(resposta.snapshot.dados).toMatchObject({ comercial: [{ numeroOperacao: null, quantidadeLitros: "4", naturezaComercial: "RETIRADA_COM_PRECO_NAO_INFERIDO" }], destinos: [{ fonte: "NUTRICAO", natureza: "MISTA", quantidadeLitros: "6", parcelas: [{ quantidadeLitros: "6", baseQuantidade: "ATRIBUIDA" }] }], balanco: [{ vendas: "4", outrosMovimentos: "0" }] });
  const csv = (await exportarRelatorioLeiteCsv(resposta.id, 7, false)).conteudo;
  expect(csv).toContain("não inclui os novos FechamentoOperacaoLeite"); expect(csv).toContain("Nutrição para as referências gerenciais"); expect(csv).toContain("Retirada física; preço não inferido"); expect(csv).toContain("Bezerra"); expect(csv).toContain("ATRIBUIDA"); expect(resposta.snapshot.valores).toBeNull();
});
it("continua abrindo envelope V1 sem reconstruir o snapshot", async () => {
  const resposta = await emitirRelatorioLeite(input, 5, true);
  registro!.snapshot = { ...(registro!.snapshot as Prisma.JsonObject), versaoCalculo: "LEITE_GERENCIAL_V1" };
  expect((await obterRelatorioLeite(resposta.id, 7, false)).snapshot.versaoCalculo).toBe("LEITE_GERENCIAL_V1");
});
