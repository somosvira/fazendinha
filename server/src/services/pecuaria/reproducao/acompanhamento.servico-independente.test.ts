import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tx: {
  demandaAcompanhamentoReprodutivo: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  exameAnimal: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  partoAnimal: { findMany: vi.fn() }, tentativaReprodutiva: { findMany: vi.fn() }, tarefaProtocolo: { findMany: vi.fn() },
  politicaAcompanhamentoReprodutivo: { findFirst: vi.fn(), create: vi.fn() }, localizacaoAnimal: { findMany: vi.fn() },
}, auditar: vi.fn(), conferir: vi.fn() }));
vi.mock("../../../db.js", () => ({ prisma: { ...mocks.tx, $transaction: async (f: (tx: typeof mocks.tx) => Promise<unknown>) => f(mocks.tx) } }));
vi.mock("../rebanho/regras.js", async original => ({ ...await original<typeof import("../rebanho/regras.js")>(), auditar: mocks.auditar }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: mocks.conferir }));
import { criarDemandasDoFatoTx, listarAcompanhamentos, reconciliarDemandasAnimalTx, vincularExameDemandaTx } from "./acompanhamento.js";
import type { Prisma } from "@prisma/client";
const tx = mocks.tx as unknown as Prisma.TransactionClient;
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
function demanda(id: string, ocorrencia = 1, gestacao = false) {
  return { id, animalId: "animal", propriedadeOrigemId: 7, finalidade: gestacao ? "RECONFIRMACAO" : "DIAGNOSTICO", ocorrencia,
    tentativaId: gestacao ? null : "t", gestacaoId: gestacao ? "g" : null, tarefaId: null,
    tentativa: gestacao ? null : { id: "t", status: "VALIDO", data: dia("2026-01-01"), ordem: 1, tarefa: null },
    gestacao: gestacao ? { id: "g", status: "VALIDO", encerradaEm: null, tentativaId: "t" } : null,
    regraSnapshot: { politicaId: "p1", politicaVersao: 1 }, dataReferencia: dia("2026-01-01"), previstaPara: dia(ocorrencia === 1 ? "2026-01-10" : "2026-01-20"),
    estado: "PENDENTE", exameResolucaoId: null as string | null, motivoEncerramento: null, versao: 1 };
}
function exame(conclusao = "POSITIVO", gestacao = false, demandaId: string | null = null) {
  return { id: "exame", animalId: "animal", data: dia("2026-01-25"), tipoExameId: "tipo", status: "VALIDO", realizacao: "REALIZADO",
    demandaAcompanhamentoId: demandaId, finalidades: [gestacao ? "RECONFIRMACAO" : "DIAGNOSTICO"], formatoSnapshot: { versao: 1 },
    interpretacao: { tentativaId: gestacao ? null : "t", gestacaoId: gestacao ? "g" : null }, resultados: [{ campo: "CONCLUSAO_GESTACIONAL", valor: conclusao }] };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([]);
  mocks.tx.exameAnimal.findMany.mockResolvedValue([]); mocks.tx.partoAnimal.findMany.mockResolvedValue([]);
  mocks.tx.tentativaReprodutiva.findMany.mockResolvedValue([]); mocks.tx.tarefaProtocolo.findMany.mockResolvedValue([]);
  mocks.tx.localizacaoAnimal.findMany.mockResolvedValue([{ animalId: "animal" }]);
  mocks.tx.demandaAcompanhamentoReprodutivo.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
});
describe("contraprovas de serviço: identidade, continuidade e leitura sem escrita", () => {
  it("inconclusivo mantém acompanhamento mesmo após prazo e tarefa já realizada", async () => {
    const d = { ...demanda("d"), tarefaId: "tarefa-concluida" };
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([d]); mocks.tx.exameAnimal.findMany.mockResolvedValue([exame("INCONCLUSIVO")]);
    await reconciliarDemandasAnimalTx(tx, "animal", null);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled(); expect(mocks.auditar).not.toHaveBeenCalled();
  });
  it("exame explicitamente vinculado à ocorrência2 não satisfaz a primeira", async () => {
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([demanda("d1", 1, true), demanda("d2", 2, true)]);
    mocks.tx.exameAnimal.findMany.mockResolvedValue([exame("POSITIVO", true, "d2")]);
    await reconciliarDemandasAnimalTx(tx, "animal", null);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledWith({ where: { id: "d2" }, data: expect.objectContaining({ estado: "RESOLVIDA", exameResolucaoId: "exame" }) });
  });
  it("sem vínculo explícito uma prova conclusiva é usada por uma única ocorrência compatível", async () => {
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([demanda("d1", 1, true), demanda("d2", 2, true)]);
    mocks.tx.exameAnimal.findMany.mockResolvedValue([exame("POSITIVO", true)]);
    await reconciliarDemandasAnimalTx(tx, "animal", null);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenCalledWith({ where: { id: "d1" }, data: expect.objectContaining({ exameResolucaoId: "exame" }) });
  });
  it("origem anulada encerra mesmo com prova válida e conserva o motivo factual", async () => {
    const d = { ...demanda("d"), estado: "RESOLVIDA", exameResolucaoId: "exame", tentativa: { ...demanda("d").tentativa!, status: "ANULADO" } };
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([d]); mocks.tx.exameAnimal.findMany.mockResolvedValue([exame()]);
    await reconciliarDemandasAnimalTx(tx, "animal", null);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenLastCalledWith({ where: { id: "d" }, data: expect.objectContaining({ estado: "ENCERRADA", exameResolucaoId: null, motivoEncerramento: "ORIGEM_ANULADA" }) });
    expect(mocks.tx.exameAnimal.update).not.toHaveBeenCalled();
  });
  it("prova anulada reabre demanda e limpa referência antes de realocar conclusões", async () => {
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([{ ...demanda("d"), estado: "RESOLVIDA", exameResolucaoId: "exame" }]);
    await reconciliarDemandasAnimalTx(tx, "animal", null);
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update.mock.calls[0][0]).toEqual({ where: { id: "d" }, data: expect.objectContaining({ exameResolucaoId: null }) });
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).toHaveBeenLastCalledWith({ where: { id: "d" }, data: expect.objectContaining({ estado: "PENDENTE", exameResolucaoId: null }) });
  });
  it("formato de exame de outra versão e finalidade distinta não resolvem a necessidade", async () => {
    const d = { ...demanda("d"), regraSnapshot: { politicaId: "p1", politicaVersao: 1, tipoExameId: "tipo", tipoExameVersao: 2 } };
    mocks.tx.demandaAcompanhamentoReprodutivo.findMany.mockResolvedValue([d]); mocks.tx.exameAnimal.findMany.mockResolvedValue([exame()]);
    await reconciliarDemandasAnimalTx(tx, "animal", null); expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
    mocks.tx.exameAnimal.findMany.mockResolvedValue([{ ...exame(), formatoSnapshot: { versao: 2 }, finalidades: ["SEXAGEM"] }]);
    await reconciliarDemandasAnimalTx(tx, "animal", null); expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled();
  });
  it("identidade da demanda não inclui versão da política ao preservar fato já adotado", async () => {
    mocks.tx.politicaAcompanhamentoReprodutivo.findFirst.mockResolvedValue({ id: "nova", versao: 2, parametros: { versao: 1, efeito: "ALERTA", diagnostico: { diasAposTentativa: 20 }, reconfirmacoes: [] } });
    mocks.tx.demandaAcompanhamentoReprodutivo.findFirst.mockResolvedValue({ id: "existente", politicaId: "antiga" });
    await criarDemandasDoFatoTx(tx, { tentativaId: "t", animalId: "animal", propriedadeId: 7, data: dia("2026-01-01") }, null, "nova");
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.findFirst).toHaveBeenCalledWith({ where: { tentativaId: "t", gestacaoId: null, finalidade: "DIAGNOSTICO", ocorrencia: 1 } });
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.create).not.toHaveBeenCalled();
  });
  it("sem política vigente o escritor não inventa previsão e a leitura não cria fatos", async () => {
    mocks.tx.politicaAcompanhamentoReprodutivo.findFirst.mockResolvedValue(null);
    await criarDemandasDoFatoTx(tx, { tentativaId: "t", animalId: "animal", propriedadeId: 7, data: dia("2026-01-01") }, null);
    await listarAcompanhamentos(7, undefined, "2026-01-25");
    expect(mocks.tx.demandaAcompanhamentoReprodutivo.create).not.toHaveBeenCalled(); expect(mocks.tx.demandaAcompanhamentoReprodutivo.update).not.toHaveBeenCalled(); expect(mocks.tx.politicaAcompanhamentoReprodutivo.create).not.toHaveBeenCalled();
    expect(mocks.tx.localizacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ propriedadeId: 7, desde: { lte: dia("2026-01-25") } }) }));
  });
  it("vínculo explícito exige demanda pendente do mesmo animal e origem", async () => {
    mocks.tx.demandaAcompanhamentoReprodutivo.findUnique.mockResolvedValue(demanda("d")); mocks.tx.exameAnimal.findUnique.mockResolvedValue({ ...exame(), animalId: "outro" });
    await expect(vincularExameDemandaTx(tx, "d", "exame")).rejects.toMatchObject({ code: "VALIDACAO" });
    mocks.tx.exameAnimal.findUnique.mockResolvedValue({ ...exame(), interpretacao: { tentativaId: "outra", gestacaoId: null } });
    await expect(vincularExameDemandaTx(tx, "d", "exame")).rejects.toMatchObject({ code: "VALIDACAO" });
    expect(mocks.tx.exameAnimal.update).not.toHaveBeenCalled();
  });
});
