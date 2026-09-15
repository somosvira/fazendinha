import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  relatorio: { create: vi.fn(), update: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  rascunho: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), deleteMany: vi.fn() },
  categoria: { findMany: vi.fn() },
  centroCusto: { findMany: vi.fn() },
  operacao: { findMany: vi.fn() },
  gerencial: vi.fn(),
  putObject: vi.fn(),
  getObjectBuffer: vi.fn(),
}));

vi.mock("../../db.js", () => ({ prisma: {
  relatorioFinanceiro: mocks.relatorio, rascunhoRelatorioFinanceiro: mocks.rascunho,
  categoria: mocks.categoria, centroCusto: mocks.centroCusto, operacao: mocks.operacao,
} }));
vi.mock("../../lib/storage.js", () => ({ getStorage: vi.fn(async () => ({ putObject: mocks.putObject, getObjectBuffer: mocks.getObjectBuffer })) }));
vi.mock("../relatorio-gerencial.js", () => ({ gerarRelatorioGerencial: mocks.gerencial }));

import { baixarRelatorio, gerarRelatorio, listarRelatorios, salvarRascunho } from "./relatorios.js";
import { configuracaoRelatorioFinanceiroSchema } from "./relatorios.schemas.js";

const config = configuracaoRelatorioFinanceiroSchema.parse({ nome: "Pecuária — setembro", dataInicio: "2026-09-01", dataFim: "2026-09-30", status: ["CONFIRMADA"], centroCustoIds: [1], categoriaIds: [3] });
const gerencialVazio = {
  meta: { propriedade: { id: 7, nome: "Fazenda Rio Novo" } },
  resumo: { entradas: 0, saidas: 0, resultado: 0, saldoContasFinal: 0, nLancamentos: 0, aPagar: 0, aReceber: 0 },
  saldoContas: null, entradasSaidas: null, resultado: null, compromissos: null, categorias: null, operacoes: [],
  rastreabilidade: { totalLancamentos: 0, estornados: 0, comDocumento: 0, semDocumento: 0, comNotaFiscal: 0, semNotaFiscal: 0, semCentroCusto: 0, mesesFechados: [], mesesAbertos: [] },
};
const linhaLista = { id: 5, nome: config.nome, status: "CONCLUIDO", parametros: config, propriedadeId: 7, autorNome: "Rafael", geradoEm: new Date("2026-09-14T12:00:00Z"), concluidoEm: new Date(), erro: null, propriedade: { nome: "Fazenda Rio Novo" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.categoria.findMany.mockResolvedValue([{ id: 3, nome: "Nutrição" }]);
  mocks.centroCusto.findMany.mockResolvedValue([{ id: 1, nome: "Pecuária" }]);
  mocks.relatorio.create.mockResolvedValue({ id: 5, geradoEm: new Date("2026-09-14T12:00:00Z") });
  mocks.relatorio.update.mockResolvedValue(linhaLista);
  mocks.gerencial.mockResolvedValue(gerencialVazio);
  mocks.operacao.findMany.mockResolvedValue([{
    id: 1, data: new Date("2026-09-03T00:00:00Z"), tipo: "COMPRA_ESTOQUE", status: "CONFIRMADA", descricao: "Compra mista", valorTotal: "1300.00",
    centroCustoId: 1, centroCusto: { nome: "Pecuária" }, parceiro: null, categoriaId: null, categoriaNome: null, classificacao: null,
    itens: [
      { id: 1, descricao: "Ração", quantidade: "10", unidade: "sc", valorTotal: "800.00", categoriaId: 3, categoriaNome: "Nutrição", classificacao: "CUSTEIO" },
      { id: 2, descricao: "Mourões", quantidade: "50", unidade: "un", valorTotal: "500.00", categoriaId: 4, categoriaNome: "Benfeitorias", classificacao: "INVESTIMENTO" },
    ],
  }]);
  mocks.putObject.mockResolvedValue({ storageKey: "x" });
});

describe("geração de relatório financeiro", () => {
  it("monta o snapshot filtrado por item, grava o PDF e consome o rascunho", async () => {
    const r = await gerarRelatorio(7, { id: 2, nome: "Rafael" }, config);

    expect(mocks.relatorio.create).toHaveBeenCalledWith({ data: expect.objectContaining({ propriedadeId: 7, autorId: 2, autorNome: "Rafael", parametros: config }) });
    expect(mocks.gerencial).toHaveBeenCalledWith({ inicio: "2026-09-01", fim: "2026-09-30", regime: "ambos" }, 7, config);
    expect(mocks.operacao.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 7, status: { in: ["CONFIRMADA"] } }) }));
    expect(mocks.putObject).toHaveBeenCalledWith(expect.objectContaining({ key: "relatorios-financeiros/7/5.pdf", contentType: "application/pdf" }));
    expect(mocks.putObject.mock.calls[0][0].body.subarray(0, 8).toString()).toBe("%PDF-1.4");

    const { data } = mocks.relatorio.update.mock.calls[0][0];
    expect(data.status).toBe("CONCLUIDO");
    expect(data.snapshot.filtros).toMatchObject({ categorias: ["Nutrição"], centrosCusto: ["Pecuária"], status: ["Confirmada"] });
    expect(data.snapshot.composicao.linhas.map((l: { item: string; valor: string }) => [l.item, l.valor])).toEqual([["Ração", "800.00"]]);
    expect(data.snapshot.composicao.despesas.porCategoria).toEqual([expect.objectContaining({ nome: "Nutrição", total: "800.00" })]);
    expect(mocks.rascunho.deleteMany).toHaveBeenCalledWith({ where: { propriedadeId: 7, criadoPorId: 2 } });
    expect(r).toMatchObject({ id: 5, autor: "Rafael", propriedade: "Fazenda Rio Novo" });
  });

  it("recusa cadastro inexistente antes de registrar o relatório", async () => {
    mocks.categoria.findMany.mockResolvedValue([]);
    await expect(gerarRelatorio(7, { id: 2, nome: "Rafael" }, config)).rejects.toMatchObject({ code: "VALIDACAO", campo: "categoriaIds" });
    expect(mocks.relatorio.create).not.toHaveBeenCalled();
  });

  it("marca FALHOU e preserva o rascunho quando o storage falha", async () => {
    mocks.putObject.mockRejectedValue(new Error("R2 indisponível"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(gerarRelatorio(7, { id: 2, nome: "Rafael" }, config)).rejects.toThrow("R2 indisponível");
    expect(mocks.relatorio.update).toHaveBeenCalledWith({ where: { id: 5 }, data: expect.objectContaining({ status: "FALHOU" }) });
    expect(mocks.rascunho.deleteMany).not.toHaveBeenCalled();
  });
});

describe("rascunho da configuração", () => {
  it("cria o primeiro rascunho do usuário na propriedade", async () => {
    mocks.rascunho.findUnique.mockResolvedValue(null);
    mocks.rascunho.create.mockResolvedValue({ id: 1, versao: 1 });
    await salvarRascunho(7, 2, { nome: "Rascunho" });
    expect(mocks.rascunho.create).toHaveBeenCalledWith({ data: { propriedadeId: 7, criadoPorId: 2, configuracao: { nome: "Rascunho" } } });
  });

  it("versão enviada para rascunho já descartado é conflito, não recriação", async () => {
    mocks.rascunho.findUnique.mockResolvedValue(null);
    await expect(salvarRascunho(7, 2, { nome: "x" }, 4)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.rascunho.create).not.toHaveBeenCalled();
  });

  it("não sobrescreve versão mais nova", async () => {
    mocks.rascunho.findUnique.mockResolvedValue({ id: 1, versao: 4 });
    await expect(salvarRascunho(7, 2, { nome: "x" }, 3)).rejects.toMatchObject({ code: "CONFLITO" });
    await expect(salvarRascunho(7, 2, { nome: "x" })).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.rascunho.updateMany).not.toHaveBeenCalled();
  });

  it("detecta gravação concorrente entre a leitura e a escrita", async () => {
    mocks.rascunho.findUnique.mockResolvedValue({ id: 1, versao: 4 });
    mocks.rascunho.updateMany.mockResolvedValue({ count: 0 });
    await expect(salvarRascunho(7, 2, { nome: "x" }, 4)).rejects.toMatchObject({ code: "CONFLITO" });
  });
});

describe("histórico e download", () => {
  it("lista do mais recente para o mais antigo, restrito à propriedade ativa", async () => {
    mocks.relatorio.findMany.mockResolvedValue([linhaLista]);
    expect(await listarRelatorios(7)).toEqual([expect.objectContaining({ id: 5, autor: "Rafael", propriedade: "Fazenda Rio Novo" })]);
    expect(mocks.relatorio.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 7 }, orderBy: [{ geradoEm: "desc" }, { id: "desc" }] }));
  });

  it("não baixa relatório de outra propriedade", async () => {
    mocks.relatorio.findFirst.mockResolvedValue(null);
    await expect(baixarRelatorio(5, 8)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.relatorio.findFirst).toHaveBeenCalledWith({ where: { id: 5, status: "CONCLUIDO", propriedadeId: 8 } });
    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("devolve o arquivo com nome seguro", async () => {
    mocks.relatorio.findFirst.mockResolvedValue({ nome: "Fechamento 09/2026", storageKey: "relatorios-financeiros/7/5.pdf" });
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF"));
    expect(await baixarRelatorio(5, 7)).toMatchObject({ nome: "Fechamento 09 2026.pdf" });
  });
});
