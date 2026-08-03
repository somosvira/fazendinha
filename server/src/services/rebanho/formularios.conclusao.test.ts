import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  folhaFindFirst: vi.fn(),
  folhaUpdate: vi.fn(),
  linhaUpdate: vi.fn(),
  transaction: vi.fn(),
  registrarEvento: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    folhaCampo: { findFirst: mocks.folhaFindFirst, update: mocks.folhaUpdate },
    linhaFolhaCampo: { update: mocks.linhaUpdate },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./eventos.js", () => ({ registrarEventoNaTransacao: mocks.registrarEvento }));
vi.mock("./relatorios.js", () => ({ gerarRelatorio: vi.fn() }));

import { concluirFolhaCampo, FormularioFolhaError } from "./formularios.folhas.js";

const config = { colunasSistema: ["animal", "data"], camposPapel: ["resultado_dg", "data_evento"] };
const snapshot = { numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: null, data: "2026-07-20", valores: {} };
const base = {
  id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "AGUARDANDO_LANCAMENTO",
  filtrosSnapshot: {}, configSnapshot: config, modeloId: null, totalLinhas: 2, linhasProntas: 2,
  propriedadeId: 7, geradoEm: new Date("2026-08-03T10:00:00Z"), concluidoEm: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    folhaCampo: { findFirst: mocks.folhaFindFirst, update: mocks.folhaUpdate },
    linhaFolhaCampo: { update: mocks.linhaUpdate },
  }));
  mocks.registrarEvento.mockResolvedValue({ id: "901", animalId: "5", data: "2026-08-03", dominio: "reproducao", titulo: "Diagnóstico" });
  mocks.folhaFindFirst.mockResolvedValue({
    ...base,
    linhas: [
      { id: 1, ordem: 0, animalId: 5, eventoOrigemId: 11, snapshot, status: "PREENCHIDA", respostas: { resultado_dg: "positivo", data_evento: "2026-08-03" }, motivoNaoRealizado: null, eventoGeradoId: null },
      { id: 2, ordem: 1, animalId: 8, eventoOrigemId: 12, snapshot: { ...snapshot, numero: "184" }, status: "NAO_REALIZADO", respostas: null, motivoNaoRealizado: "Animal ausente", eventoGeradoId: null },
    ],
  });
});

describe("conclusão da folha de campo", () => {
  it("registra somente linhas preenchidas e conclui na mesma transação", async () => {
    await concluirFolhaCampo(20, 7);

    expect(mocks.registrarEvento).toHaveBeenCalledWith(expect.anything(), 5, {
      tipo: "DIAGNOSTICO",
      data: "2026-08-03",
      resultado: "positivo",
    }, 7);
    expect(mocks.registrarEvento).toHaveBeenCalledTimes(1);
    expect(mocks.linhaUpdate).toHaveBeenCalledWith({ where: { id: 1 }, data: { status: "REGISTRADA", eventoGeradoId: 901 } });
    expect(mocks.folhaUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { status: "CONCLUIDA", concluidoEm: expect.any(Date), linhasProntas: 2 } });
  });

  it("bloqueia conclusão enquanto houver pendência", async () => {
    mocks.folhaFindFirst.mockResolvedValueOnce({
      ...base,
      linhas: [{ id: 1, ordem: 0, animalId: 5, eventoOrigemId: 11, snapshot, status: "PENDENTE", respostas: null, motivoNaoRealizado: null, eventoGeradoId: null }],
    });

    await expect(concluirFolhaCampo(20, 7)).rejects.toBeInstanceOf(FormularioFolhaError);
    expect(mocks.registrarEvento).not.toHaveBeenCalled();
    expect(mocks.folhaUpdate).not.toHaveBeenCalled();
  });

  it("é idempotente quando a folha já está concluída", async () => {
    mocks.folhaFindFirst.mockResolvedValueOnce({ ...base, status: "CONCLUIDA", concluidoEm: new Date(), linhas: [] });

    await concluirFolhaCampo(20, 7);

    expect(mocks.registrarEvento).not.toHaveBeenCalled();
    expect(mocks.folhaUpdate).not.toHaveBeenCalled();
  });

  it("aborta sem marcar a folha quando um evento falha", async () => {
    mocks.registrarEvento.mockRejectedValueOnce(new Error("data incompatível"));

    await expect(concluirFolhaCampo(20, 7)).rejects.toThrow("data incompatível");
    expect(mocks.folhaUpdate).not.toHaveBeenCalled();
  });
});
