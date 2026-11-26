import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ produto: vi.fn(), cobertura: vi.fn(), sitios: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: async (f: (tx: unknown) => unknown) => f({ produto: { findUnique: m.produto }, propriedade: { findMany: m.sitios } }) } }));
vi.mock("../../estoque/valorizacao.js", () => ({ coberturaSaldoTx: m.cobertura, saldosBasesTx: vi.fn() }));
import { estimarModelo, estimativaModeloSchema } from "./estimativa-modelo.js";
const id = "00000000-0000-4000-8000-000000000001";
const D = (v: string) => new Prisma.Decimal(v);
const etapa = { nome: "Produto", tipo: "APLICACAO", produtoId: id, quantidade: "50", unidade: "ML" };
beforeEach(() => { vi.resetAllMocks(); m.sitios.mockResolvedValue([{ id: 1 }, { id: 2 }]); m.produto.mockResolvedValue({ unidade: "L" }); });
it("consolida valores ponderados por quantidade e inclui apenas serviço declarado", async () => {
  m.cobertura.mockResolvedValueOnce({ fisico: D("2"), completa: true, quantidade: D("2"), valor: D("20") }).mockResolvedValueOnce({ fisico: D("8"), completa: true, quantidade: D("8"), valor: D("160") });
  const i = estimativaModeloSchema.parse({ propriedadeId: 99, etapas: [{ ...etapa, referenciasCusto: { material: { valorUnitario: "999", unidade: "ML", origem: "Antiga", data: "2026-01-01" }, servico: { valorUnitario: "0", unidade: "POR_ATENDIMENTO", origem: "Contratado", data: "2026-01-01" } } }, { nome: "Retirada", tipo: "RETIRADA" }] });
  const r = await estimarModelo(i, null);
  expect(r).toMatchObject({ situacao: "COMPLETO", total: "0.90", componentesConhecidos: 2, componentesPendentes: 0, escopo: { tipo: "CONSOLIDADO", propriedadeIds: [1, 2] }, referencias: { total: 2 } });
  expect(r.referencias.itens[0]).toMatchObject({ situacao: "CONHECIDO", quantidade: "0.05", valorUnitario: "18", valor: "0.90" });
  expect(m.cobertura.mock.calls.map(c => c[2])).toEqual([1, 2]);
});
it("saldo com cobertura insuficiente em qualquer sítio permanece pendente e conserva subtotal conhecido", async () => {
  m.cobertura.mockResolvedValueOnce({ fisico: D("3"), completa: false, quantidade: D("2"), valor: D("20") }).mockResolvedValueOnce({ fisico: D("8"), completa: true, quantidade: D("8"), valor: D("160") });
  const r = await estimarModelo(estimativaModeloSchema.parse({ etapas: [{ ...etapa, referenciasCusto: { servico: { valorUnitario: "5", unidade: "POR_ATENDIMENTO", origem: "Tabela", data: "2026-01-01" } } }] }), null);
  expect(r).toMatchObject({ situacao: "PARCIAL", totalConhecido: "5.00", componentesPendentes: 1 });
  expect(r.referencias.itens[0]).toMatchObject({ situacao: "COBERTURA_INSUFICIENTE", valor: null });
});
it("distingue saldo zero, valor zero documentado e unidade incompatível", async () => {
  m.sitios.mockResolvedValue([{ id: 1 }]);
  m.cobertura.mockResolvedValueOnce({ fisico: D("0"), completa: true, quantidade: D("0"), valor: D("0") });
  const input = estimativaModeloSchema.parse({ etapas: [etapa] });
  expect((await estimarModelo(input, 1)).referencias.itens[0].situacao).toBe("SALDO_ZERO");
  m.cobertura.mockResolvedValue({ fisico: D("1"), completa: true, quantidade: D("1"), valor: D("0") });
  expect((await estimarModelo(input, 1))).toMatchObject({ situacao: "COMPLETO", total: "0.00" });
  expect((await estimarModelo(estimativaModeloSchema.parse({ etapas: [{ ...etapa, unidade: "KG" }] }), 1)).referencias.itens[0].situacao).toBe("UNIDADE_INCOMPATIVEL");
});
it("sítio inválido é recusado, enquanto catálogo e material indefinido ficam pendentes", async () => {
  m.sitios.mockResolvedValueOnce([]);
  await expect(estimarModelo(estimativaModeloSchema.parse({ etapas: [] }), 42)).rejects.toMatchObject({ code: "VALIDACAO", campo: "propriedadeId" });
  const r = await estimarModelo(estimativaModeloSchema.parse({ etapas: [{ nome: "IA", tipo: "TENTATIVA" }, { nome: "Catálogo", tipo: "APLICACAO", produtoCatalogoId: id }] }), null);
  expect(r).toMatchObject({ situacao: "NAO_APURADO", componentesPendentes: 2 });
  expect(r.referencias.itens.map(i => i.situacao)).toEqual(["PRODUTO_NAO_INFORMADO", "CATALOGO_NAO_ADOTADO"]);
  expect(m.produto).not.toHaveBeenCalled();
});
it("serviço declarado incompleto permanece pendente, inclusive preço zero sem evidência", async () => {
  const r = await estimarModelo(estimativaModeloSchema.parse({ etapas: [{ nome: "Serviço", tipo: "RETIRADA", referenciasCusto: { servico: { valorUnitario: "0", unidade: "POR_ATENDIMENTO" } } }] }), null);
  expect(r).toMatchObject({ situacao: "NAO_APURADO", componentesPendentes: 1 });
  expect(r.referencias.itens[0]).toMatchObject({ situacao: "REFERENCIA_INCOMPLETA", valor: null });
});
