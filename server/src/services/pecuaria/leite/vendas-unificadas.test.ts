import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { consultarVendasUnificadasLeiteTx, consultaVendasUnificadasLeiteSchema } from "./vendas-unificadas.js";
vi.mock("../../../db.js", () => ({ prisma: {} }));
const D = (v: number) => new Prisma.Decimal(v), dia = (v: string) => new Date(v);
const db = { operacaoComercialLeite: { findMany: vi.fn() }, versaoComercialVendaLeite: { findMany: vi.fn() }, retiradaOperacaoLeite: { findMany: vi.fn() } };
const tx = db as unknown as Prisma.TransactionClient;
const periodo = (id: string, fechada = false) => ({ id, status: fechada ? "FECHADA" : "ABERTA", referencia: "Outubro", inicio: dia("2026-10-01"), fim: dia("2026-10-31"), parceiroId: "comprador", parceiro: { nome: "Cooperativa" },
  fechamentos: fechada ? [{ operacaoId: "financeira", versao: 2, volumeReconhecido: D(90), operacao: { data: dia("2026-11-02"), status: "CONFIRMADA", valorTotal: D(180) } }] : [] });
const avulsa = (id: string, versao = 1, ultima = id, parceiroId = "comprador", status = "CONFIRMADA") => ({ id, versao, operacaoId: `operacao-${id}`, operacao: { numero: 42, data: dia("2026-10-15"), status, parceiroId, parceiro: { nome: "Outro comprador" }, valorTotal: D(40) }, retirada: { quantidade: D(20), versoesComerciaisLeite: [{ id: ultima }] } });
beforeEach(() => {
  vi.resetAllMocks(); db.operacaoComercialLeite.findMany.mockResolvedValue([periodo("aberta"), periodo("fechada", true)]);
  db.versaoComercialVendaLeite.findMany.mockResolvedValue([avulsa("v1", 1, "v2"), avulsa("v2", 2)]);
  db.retiradaOperacaoLeite.findMany.mockResolvedValue([{ comercialId: "aberta", movimento: { quantidade: D(10) } }, { comercialId: "aberta", movimento: { quantidade: D(15) } }]);
});
it("unifica modalidades e versões vigentes com resumo sobre todas as páginas", async () => {
  const r = await consultarVendasUnificadasLeiteTx(tx, 3, { porPagina: 1 }, true);
  expect(r.total).toBe(3); expect(r.itens).toHaveLength(1);
  expect(r.resumo).toEqual({ vendas: 3, canceladas: 0, totalLitros: "135", valorTotal: null, precoPendente: 1 });
  const tudo = await consultarVendasUnificadasLeiteTx(tx, 3, { porPagina: 100 }, true);
  expect(tudo.itens.find(i => i.id === "fechada")).toMatchObject({ quantidadeLitros: "90", valorTotal: "180.00", data: "2026-11-02", inicio: "2026-10-01", fim: "2026-10-31" });
  expect(tudo.itens.find(i => i.id === "aberta")).toMatchObject({ quantidadeLitros: "25", valorTotal: null, operacaoId: null });
  expect(tudo.itens.some(i => i.id === "v1")).toBe(false);
  expect(db.retiradaOperacaoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { comercialId: { in: ["aberta"] }, movimento: { propriedadeId: 3, status: "CONFIRMADO", reversaoDeId: null } } }));
});
it("usa intervalo comercial para período e data do fato para avulsas", async () => {
  await consultarVendasUnificadasLeiteTx(tx, 3, { de: "2026-10-01", ate: "2026-10-31" }, false);
  expect(db.operacaoComercialLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { propriedadeId: 3, fim: { gte: dia("2026-10-01") }, inicio: { lte: dia("2026-10-31") } } }));
  expect(db.versaoComercialVendaLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { operacao: { propriedadeId: 3, fechamentoComercialLeite: null, data: { gte: dia("2026-10-01"), lte: dia("2026-10-31") } }, retirada: { retiradaOperacaoLeite: null } } }));
});
it("mascara valores auxiliares e conserva metadados sem permissão financeira", async () => {
  const r = await consultarVendasUnificadasLeiteTx(tx, 3, {}, false);
  expect(r.itens.every(i => i.valorTotal === null)).toBe(true); expect(r.resumo.valorTotal).toBeNull(); expect(r.resumo.totalLitros).toBe("135");
});
it("cálculo financeiro soma apenas versões vigentes e canceladas não viram venda ativa", async () => {
  db.operacaoComercialLeite.findMany.mockResolvedValue([periodo("fechada", true)]);
  db.versaoComercialVendaLeite.findMany.mockResolvedValue([avulsa("v1", 1, "v2"), avulsa("v2", 2), avulsa("cancelada", 1, "cancelada", "comprador", "CANCELADA")]);
  const r = await consultarVendasUnificadasLeiteTx(tx, 3, {}, true);
  expect(r.total).toBe(3); expect(r.resumo).toMatchObject({ totalLitros: "110", valorTotal: "220.00", canceladas: 1 });
  const canceladas = await consultarVendasUnificadasLeiteTx(tx, 3, { situacao: "CANCELADA" }, true);
  expect(canceladas.total).toBe(1); expect(canceladas.resumo.totalLitros).toBe("0");
});
it("filtrar comprador não ressuscita a versão substituída de outro comprador", async () => {
  db.operacaoComercialLeite.findMany.mockResolvedValue([]);
  db.versaoComercialVendaLeite.findMany.mockResolvedValue([avulsa("v1", 1, "v2", "00000000-0000-4000-8000-000000000001"), avulsa("v2", 2, "v2", "00000000-0000-4000-8000-000000000002")]);
  const r = await consultarVendasUnificadasLeiteTx(tx, 3, { parceiroId: "00000000-0000-4000-8000-000000000001" }, true);
  expect(r.total).toBe(0);
});
it("modalidade restringe consultas e exceder limite recusa totais truncados", async () => {
  await consultarVendasUnificadasLeiteTx(tx, 3, { modalidade: "PERIODO" }, true);
  expect(db.versaoComercialVendaLeite.findMany).not.toHaveBeenCalled();
  db.operacaoComercialLeite.findMany.mockResolvedValue(Array.from({ length: 5001 }, (_, i) => periodo(`p${i}`)));
  await expect(consultarVendasUnificadasLeiteTx(tx, 3, {}, true)).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(consultaVendasUnificadasLeiteSchema.safeParse({ de: "2026-02-30" }).success).toBe(false);
});
