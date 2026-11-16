import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), atualizar: vi.fn(), transacao: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { automacaoProtocolo: { findMany: mocks.listar, updateMany: mocks.atualizar } } }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: mocks.transacao }));
import { processarAutomacoes, listarLembretesAutomacoes } from "./automacao.js";
import { RebanhoError } from "../rebanho/regras.js";
describe("fila de automação: falhas e revisão concorrente", () => {
  const atualizadaEm = new Date("2026-11-03T08:00Z");
  beforeEach(() => { vi.clearAllMocks(); mocks.listar.mockResolvedValue([{ id: "job", revisao: 3, atualizadaEm, tentativas: 0 }]); mocks.atualizar.mockResolvedValue({ count: 1 }); });
  it("falha antiga só pode atualizar a revisão exata que foi lida", async () => {
    mocks.transacao.mockRejectedValue(new RebanhoError("VALIDACAO", "Saldo insuficiente")); mocks.atualizar.mockResolvedValue({ count: 0 });
    expect(await processarAutomacoes(new Date())).toEqual([{ id: "job", estado: "REVISAO_CONCORRENTE" }]);
    expect(mocks.atualizar).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job", estado: "AGENDADA", revisao: 3, atualizadaEm } }));
  });
  it("impedimento de domínio aguarda revisão explícita", async () => {
    mocks.transacao.mockRejectedValue(new RebanhoError("VALIDACAO", "Saldo insuficiente"));
    expect(await processarAutomacoes(new Date())).toEqual([{ id: "job", estado: "FALHOU" }]);
    expect(mocks.atualizar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: "FALHOU", erro: "Saldo insuficiente" }) }));
  });
  it("falha transitória tenta novamente, com limite de cinco ciclos", async () => {
    mocks.transacao.mockRejectedValue(new Prisma.PrismaClientKnownRequestError("Timeout", { code: "P2024", clientVersion: "teste" }));
    expect(await processarAutomacoes(new Date())).toEqual([{ id: "job", estado: "AGENDADA" }]);
    mocks.listar.mockResolvedValue([{ id: "job", revisao: 3, atualizadaEm, tentativas: 4 }]);
    expect(await processarAutomacoes(new Date())).toEqual([{ id: "job", estado: "FALHOU" }]);
  });
});

it("lembrete inclui execução concluída no dia de Brasília sem disparar ou confirmar fatos", async () => {
  vi.clearAllMocks();
  const concluida = { id: "concluida", estado: "EXECUTADA" };
  mocks.listar.mockResolvedValue([concluida]);
  expect(await listarLembretesAutomacoes(7, "2026-11-03")).toEqual([concluida]);
  expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 7, estado: { in: expect.arrayContaining(["EXECUTADA", "FALHOU", "REVERTIDA"]) }, programadaPara: { gte: new Date("2026-11-03T03:00Z"), lt: new Date("2026-11-04T03:00Z") } }) }));
  expect(mocks.transacao).not.toHaveBeenCalled();
  expect(mocks.atualizar).not.toHaveBeenCalled();
});
