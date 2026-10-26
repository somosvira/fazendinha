import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ destinos: { count: vi.fn(), findMany: vi.fn() }, nutricao: { count: vi.fn(), findMany: vi.fn() }, descartes: { count: vi.fn(), findMany: vi.fn() }, movimentos: { count: vi.fn(), findMany: vi.fn() }, origens: { count: vi.fn() }, alocacoes: { count: vi.fn() }, transacao: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { $transaction: m.transacao } }));
import { consultarResumoOperacionalProducaoLeite, consultaResumoOperacionalProducaoSchema } from "./resumo-operacional-producao.js";
const filtro = { inicio: "2026-10-01", fim: "2026-10-02" };
const data = new Date(filtro.inicio), litros = (n: string) => new Prisma.Decimal(n);
beforeEach(() => {
  vi.resetAllMocks();
  for (const d of [m.destinos, m.nutricao, m.descartes, m.movimentos]) { d.count.mockResolvedValue(0); d.findMany.mockResolvedValue([]); }
  m.origens.count.mockResolvedValue(0); m.alocacoes.count.mockResolvedValue(0);
  m.transacao.mockImplementation(async f => f({ destinoInternoLeite: m.destinos, fornecimentoNutricionalLeite: m.nutricao, descarteLeite: m.descartes, movimentoEstoque: m.movimentos, movimentoFornecimentoNutricionalLeite: m.origens, alocacaoLeiteEstoque: m.alocacoes }));
});
it("agrega consumo preciso sem duplicar movimento nutricional e deixa Casa/Funcionários abertos", async () => {
  m.destinos.findMany.mockResolvedValue([{ data, movimentoId: "d", natureza: "LEITE_COMUM", quantidadeLitros: litros("1.125") }]);
  m.nutricao.findMany.mockResolvedValue([{ data, quantidadeLitros: litros("3.625"), movimentos: [{ movimentoId: "d", natureza: "COMERCIAL", quantidadeLitros: litros("1.125") }, { movimentoId: "n", natureza: "NAO_COMERCIAL", quantidadeLitros: litros("2.5") }] }]);
  const r = await consultarResumoOperacionalProducaoLeite(2, filtro);
  expect(r.dias[0].consumo).toEqual({ totalLitros: "3.625", comumLitros: "1.125", naoComercialLitros: "2.5", colostroLitros: "0", nutricaoLitros: "2.5", funcionariosLitros: null, casaLitros: null });
  expect(r.dias[1].consumo.totalLitros).toBeNull();
});
it("usa classificação preservada da alocação do descarte e não soma descarte ao consumo", async () => {
  m.descartes.findMany.mockResolvedValue([{ data, quantidadeLitros: litros("4"), movimento: { alocacoesLeite: [{ quantidade: litros("1"), classificacao: { natureza: "COMERCIAL" } }, { quantidade: litros("2"), classificacao: { natureza: "COLOSTRO" } }] } }]);
  const r = await consultarResumoOperacionalProducaoLeite(2, filtro);
  expect(r.dias[0].descarte).toEqual({ totalLitros: "4", comercialLitros: "1", naoComercialLitros: "0", colostroLitros: "2", semClassificacaoLitros: "1" });
  expect(r.dias[0].consumo.totalLitros).toBeNull();
});
it("agrupa retirada física por comprador vigente e identifica coleta sem preço sem ler dinheiro", async () => {
  m.movimentos.findMany.mockResolvedValue([
    { data, quantidade: litros("10"), retiradaOperacaoLeite: { comercial: { status: "ABERTA", parceiro: { id: "p", nome: "Comprador" } } }, versoesComerciaisLeite: [], operacao: null },
    { data, quantidade: litros("5"), retiradaOperacaoLeite: null, versoesComerciaisLeite: [{ operacao: { parceiro: { id: "p", nome: "Comprador" } } }], operacao: { parceiro: { id: "anterior", nome: "Anterior" } } },
  ]);
  const r = await consultarResumoOperacionalProducaoLeite(2, filtro);
  expect(r.dias[0].vendas).toEqual({ totalLitros: "15", compradores: [{ id: "p", nome: "Comprador", litros: "15" }], coletasSemPreco: 1 });
  const consulta = JSON.stringify(m.movimentos.findMany.mock.calls[0]);
  expect(consulta).not.toMatch(/valorTotal|precoUnitario|recebimento/);
  expect(consulta).toContain('"status":"CONFIRMADO"');
  expect(consulta).toContain('"propriedadeId":2');
  expect(consulta).toContain('"ANULADA"');
  expect(m.transacao).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
});
it("recusa período inválido e limita o total antes de materializar fontes ou joins", async () => {
  expect(consultaResumoOperacionalProducaoSchema.safeParse({ inicio: "2026-02-30", fim: "2026-03-01" }).success).toBe(false);
  expect(consultaResumoOperacionalProducaoSchema.safeParse({ inicio: "2025-01-01", fim: "2026-01-02" }).success).toBe(false);
  m.origens.count.mockResolvedValue(50_001);
  await expect(consultarResumoOperacionalProducaoLeite(2, filtro)).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(m.destinos.findMany).not.toHaveBeenCalled();
  expect(m.movimentos.findMany).not.toHaveBeenCalled();
});
it("filtra estornos nas fontes, conserva colostro separado e soma teto entre fontes", async () => {
  m.destinos.findMany.mockResolvedValue([
    { data, movimentoId: "c", natureza: "COLOSTRO", quantidadeLitros: litros("0.125") },
    { data, movimentoId: "n", natureza: "LEITE_NAO_COMERCIAL", quantidadeLitros: litros("1") },
  ]);
  const r = await consultarResumoOperacionalProducaoLeite(2, filtro);
  expect(r.dias[0].consumo).toMatchObject({ totalLitros: "1.125", colostroLitros: "0.125", naoComercialLitros: "1", comumLitros: "0" });
  for (const delegate of [m.destinos, m.descartes]) expect(delegate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 2, data: { gte: new Date(filtro.inicio), lte: new Date(filtro.fim) }, status: "CONFIRMADO", movimento: { propriedadeId: 2, status: "CONFIRMADO" } } }));
  expect(m.nutricao.findMany.mock.calls[0][0]).toMatchObject({ where: { propriedadeId: 2, status: "CONFIRMADO" }, select: { movimentos: { where: { MovimentoEstoque: { propriedadeId: 2, status: "CONFIRMADO" } } } } });
  m.destinos.count.mockResolvedValue(30_000); m.movimentos.count.mockResolvedValue(20_001);
  m.destinos.findMany.mockClear();
  await expect(consultarResumoOperacionalProducaoLeite(2, filtro)).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(m.destinos.findMany).not.toHaveBeenCalled();
});
