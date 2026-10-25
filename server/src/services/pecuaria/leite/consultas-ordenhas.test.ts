import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { consultarOrdenhasPeriodoTx, consultaOrdenhasPeriodoSchema } from "./consultas-ordenhas.js";
const mocks = vi.hoisted(() => ({ gerais: vi.fn(), folha: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("./producao-geral-consulta.js", () => ({ linhasProducaoGeralTx: mocks.gerais }));
vi.mock("./producao.js", () => ({ folhaLeiteDTO: mocks.folha }));
const filtro = { inicio: "2026-10-01", fim: "2026-10-02", porPagina: 1 };
const dia = { id: "dia", configuracao: { fonteProducao: "GERAL" }, dataOperacional: new Date("2026-10-01") };
const db = { medicaoLeite: { count: vi.fn() }, diaProducaoLeite: { findMany: vi.fn() } };
beforeEach(() => {
  vi.resetAllMocks(); db.medicaoLeite.count.mockResolvedValue(1); db.diaProducaoLeite.findMany.mockResolvedValue([dia]);
  mocks.folha.mockReturnValue({ id: "dia", dataOperacional: "2026-10-01", sessoes: [
    { id: "s1", posicaoId: "manha", nome: "Manhã", ordem: 1 }, { id: "s2", posicaoId: "tarde", nome: "Tarde", ordem: 2 },
  ], animais: [{ medicoes: [{ posicaoId: "manha", litros: 99, confirmacaoEstoque: null }] }] });
  mocks.gerais.mockResolvedValue([
    { sessaoId: "s1", medicaoGeralId: "m1", tanqueId: "t", recipiente: null, natureza: "COMERCIAL", litros: 20, confirmada: true },
    { sessaoId: "s1", medicaoGeralId: "m2", tanqueId: null, recipiente: "Balde", natureza: "COLOSTRO", litros: 5, confirmada: false },
    { sessaoId: "s2", medicaoGeralId: null, tanqueId: null, recipiente: null, natureza: "A_CLASSIFICAR", litros: null, confirmada: false },
  ]);
});
it("consulta todas as parcelas históricas sem somar controle individual e pagina só linhas", async () => {
  const r = await consultarOrdenhasPeriodoTx(db as unknown as Prisma.TransactionClient, 3, filtro);
  expect(r.total).toBe(2); expect(r.itens).toHaveLength(1);
  expect(r.itens[0]).toMatchObject({ id: "s1", litros: 25, situacao: "PARCIAL_ESTOQUE", fonteProducao: "GERAL" });
  expect(r.resumo).toMatchObject({ totalLitros: 25, sessoes: 2, semAfericao: 1, pendentesEstoque: 1 });
  expect(r.itens[0].porNatureza).toEqual([{ natureza: "COMERCIAL", litros: 20 }, { natureza: "COLOSTRO", litros: 5 }]);
  expect(db.diaProducaoLeite.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 3 }) }));
});
it("filtros têm efeito no resumo completo e a ausência nunca vira zero", async () => {
  const comercial = await consultarOrdenhasPeriodoTx(db as unknown as Prisma.TransactionClient, 3, { ...filtro, natureza: "COMERCIAL" });
  expect(comercial.resumo.totalLitros).toBe(20); expect(comercial.total).toBe(1); expect(comercial.itens[0].situacao).toBe("CONFIRMADA");
  const sem = await consultarOrdenhasPeriodoTx(db as unknown as Prisma.TransactionClient, 3, { ...filtro, situacao: "SEM_AFERICAO" });
  expect(sem.resumo.totalLitros).toBeNull(); expect(sem.itens[0].litros).toBeNull();
});
it("zero medido continua conhecido e fora do saldo de estoque", async () => {
  mocks.gerais.mockResolvedValue([{ sessaoId: "s1", medicaoGeralId: "m0", tanqueId: null, recipiente: "Balde", natureza: "COMERCIAL", litros: 0, confirmada: false }]);
  const r = await consultarOrdenhasPeriodoTx(db as unknown as Prisma.TransactionClient, 3, filtro);
  expect(r.resumo.totalLitros).toBe(0); expect(r.itens[0].situacao).toBe("PENDENTE_ESTOQUE");
});
it("recusa recorte inválido e excesso de células antes da materialização", async () => {
  expect(consultaOrdenhasPeriodoSchema.safeParse({ ...filtro, inicio: "2026-02-30" }).success).toBe(false);
  expect(consultaOrdenhasPeriodoSchema.safeParse({ ...filtro, porPagina: 101 }).success).toBe(false);
  db.medicaoLeite.count.mockResolvedValue(50001);
  await expect(consultarOrdenhasPeriodoTx(db as unknown as Prisma.TransactionClient, 3, filtro)).rejects.toMatchObject({ code: "VALIDACAO" });
  expect(db.diaProducaoLeite.findMany).not.toHaveBeenCalled();
});
