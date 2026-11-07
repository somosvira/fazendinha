import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ transacao: vi.fn(), trava: vi.fn(), auditar: vi.fn(), reconciliar: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), evento: vi.fn(), ultimo: vi.fn(), jobs: vi.fn(), raw: vi.fn() }));
vi.mock("../transacao.js", () => ({ transacaoPecuaria: m.transacao }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<object>(), travarAnimais: m.trava, auditar: m.auditar }));
vi.mock("../sanidade/alertas/protocolos.js", () => ({ reconciliarParticipacaoAlertaTx: m.reconciliar }));
vi.mock("../reproducao/operacoes.js", () => ({ operacaoIdempotenteTx: (_tx: unknown, _input: unknown, _usuario: unknown, _tipo: unknown, executar: () => Promise<unknown>) => executar() }));
import { registrarEventoTarefa } from "./eventos.js";
const entrada = { chave: "9192047d-ab87-4ff6-bbc7-f7c6702eb83a", propriedadeId: 1, ocorridaEm: "2026-10-18T12:00:00-03:00", motivo: "Cuidado dispensado após revisão", tipo: "DISPENSA" as const };
const pendente = () => ({ id: "tarefa", execucaoId: "p", execucao: { animalId: "a", propriedadeId: 1, protocoloId: "protocolo", canceladaEm: null, rodada: null }, etapa: { protocoloId: "protocolo", tipo: "RETIRADA" }, momentoSnapshot: { id: "momento" }, aplicacoes: [], exames: [], tentativas: [], vinculos: [], realizadaEm: null, dispensadaEm: null, regularizacaoPendente: false });
describe("dispensa terminal sob revalidação", () => {
 beforeEach(() => {
  vi.clearAllMocks(); m.findFirst.mockResolvedValue({ id: "tarefa", execucao: { animalId: "a" } }); m.findUniqueOrThrow.mockResolvedValue(pendente()); m.ultimo.mockResolvedValue(null); m.evento.mockImplementation(async ({ data }) => ({ id: "evento", ...data }));
  const tx = { tarefaProtocolo: { findFirst: m.findFirst, findUniqueOrThrow: m.findUniqueOrThrow, update: m.update }, eventoTarefaProtocolo: { findFirst: m.ultimo, create: m.evento }, automacaoProtocolo: { updateMany: m.jobs }, $queryRaw: m.raw };
  m.transacao.mockImplementation((executar: (t: typeof tx) => Promise<unknown>) => executar(tx));
 });
 it("trava, dispensa e cancela autorização do momento sem criar retirada física", async () => {
  await registrarEventoTarefa("tarefa", entrada, 9);
  expect(m.trava).toHaveBeenCalledWith(expect.anything(), ["a"]); expect(m.raw).toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledWith({ where: { id: "tarefa" }, data: { dispensadaEm: new Date(entrada.ocorridaEm), motivoDispensa: entrada.motivo } });
  expect(m.jobs).toHaveBeenCalledWith(expect.objectContaining({ where: { participacaoId: "p", momentoId: "momento", estado: { in: ["AGENDADA", "FALHOU"] } }, data: expect.objectContaining({ estado: "CANCELADA", revisao: { increment: 1 } }) }));
  expect(m.evento).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tipo: "DISPENSA", registradoPorId: 9 }) })); expect(m.auditar).toHaveBeenCalled();
 });
 it.each([{ dispensadaEm: new Date() }, { realizadaEm: new Date() }, { regularizacaoPendente: true }, { exames: [{ id: "exame" }] }])("recusa mudança factual concorrente %j", async alteracao => {
  m.findUniqueOrThrow.mockResolvedValue({ ...pendente(), ...alteracao });
  await expect(registrarEventoTarefa("tarefa", entrada, 9)).rejects.toThrow("não está pendente"); expect(m.evento).not.toHaveBeenCalled(); expect(m.jobs).not.toHaveBeenCalled();
 });
 it("revalida sítio depois da trava", async () => { m.findUniqueOrThrow.mockResolvedValue({ ...pendente(), execucao: { ...pendente().execucao, propriedadeId: 2 } }); await expect(registrarEventoTarefa("tarefa", entrada, 9)).rejects.toThrow("neste sítio"); expect(m.evento).not.toHaveBeenCalled(); });
});
