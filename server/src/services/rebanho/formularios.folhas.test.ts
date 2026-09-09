import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gerarRelatorio: vi.fn(),
  folhaCreate: vi.fn(),
  folhaFindMany: vi.fn(),
  folhaFindFirst: vi.fn(),
  folhaUpdate: vi.fn(),
  linhaFindMany: vi.fn(),
  linhaUpdate: vi.fn(),
  modeloFindFirst: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    folhaCampo: { create: mocks.folhaCreate, findMany: mocks.folhaFindMany, findFirst: mocks.folhaFindFirst, update: mocks.folhaUpdate },
    linhaFolhaCampo: { findMany: mocks.linhaFindMany, update: mocks.linhaUpdate },
    modeloFormularioCampo: { findFirst: mocks.modeloFindFirst },
    $transaction: mocks.transaction,
  },
}));
vi.mock("./relatorios.js", () => ({ gerarRelatorio: mocks.gerarRelatorio }));

import { criarFolhaCampo, salvarLinhasFolha, FormularioFolhaError } from "./formularios.folhas.js";

const config = {
  colunasSistema: ["animal", "data", "reprodutor"],
  camposPapel: ["resultado_dg", "data_evento"],
} satisfies import("./formularios.schemas.js").ConfigFormulario;
const filtros = {
  templateId: "ia-periodo" as const,
  dataInicio: "2026-07-01",
  dataFim: "2026-07-31",
  status: "ATIVO" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    folhaCampo: { create: mocks.folhaCreate, update: mocks.folhaUpdate },
    linhaFolhaCampo: { findMany: mocks.linhaFindMany, update: mocks.linhaUpdate },
  }));
  mocks.gerarRelatorio.mockResolvedValue({
    templateId: "ia-periodo",
    titulo: "Inseminações no período",
    descricao: "Uma linha por tentativa.",
    granularidade: "evento",
    colunas: [
      { chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto" },
      { chave: "protocolo", rotulo: "Protocolo", tipo: "texto" },
    ],
    acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
    linhas: [
      { animalId: 5, numero: "150", nome: "Lua", categoria: "VACA", grupo: "Alta", setor: "Compost", eventoId: 11, data: "2026-07-20", celulas: ["Lance", "IATF"] },
      { animalId: 8, numero: "184", nome: "Estrela", categoria: "VACA", grupo: "Alta", setor: null, eventoId: 12, data: "2026-07-23", celulas: ["Delta", "IATF"] },
    ],
    total: 2,
    truncado: false,
    meta: { geradoEm: "2026-08-03T10:00:00Z", periodo: { inicio: "2026-07-01", fim: "2026-07-31" }, propriedadeId: 7 },
  });
  mocks.folhaCreate.mockResolvedValue({ id: 20 });
  mocks.folhaFindFirst.mockResolvedValue({
    id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "EM_CAMPO",
    filtrosSnapshot: filtros, configSnapshot: config, modeloId: null, totalLinhas: 2, linhasProntas: 0,
    propriedadeId: 7, geradoEm: new Date("2026-08-03T10:00:00Z"), concluidoEm: null,
    linhas: [],
  });
});

describe("folhas de campo", () => {
  it("reexecuta o relatório no backend e congela as linhas no escopo", async () => {
    await criarFolhaCampo({ nome: "Toque julho", filtros, config }, 7);

    expect(mocks.gerarRelatorio).toHaveBeenCalledWith(filtros, 7);
    expect(mocks.folhaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: "Toque julho",
        templateId: "ia-periodo",
        filtrosSnapshot: filtros,
        configSnapshot: config,
        totalLinhas: 2,
        propriedadeId: 7,
        linhas: { create: [
          expect.objectContaining({ ordem: 0, animalId: 5, eventoOrigemId: 11, snapshot: expect.objectContaining({ numero: "150", valores: { reprodutor: "Lance", protocolo: "IATF" } }) }),
          expect.objectContaining({ ordem: 1, animalId: 8, eventoOrigemId: 12, snapshot: expect.objectContaining({ numero: "184", valores: { reprodutor: "Delta", protocolo: "IATF" } }) }),
        ] },
      }),
    });
  });

  it("recusa criar folha de resultado truncado", async () => {
    mocks.gerarRelatorio.mockResolvedValueOnce({ ...(await mocks.gerarRelatorio()), truncado: true });

    await expect(criarFolhaCampo({ nome: "Grande", filtros, config }, 7)).rejects.toMatchObject({ code: "CONFLITO" });
    expect(mocks.folhaCreate).not.toHaveBeenCalled();
  });

  it("salva rascunho apenas nas linhas pertencentes à folha", async () => {
    mocks.folhaFindFirst.mockResolvedValueOnce({ id: 20, status: "EM_CAMPO" });
    mocks.linhaFindMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    mocks.linhaFindMany.mockResolvedValueOnce([
      { status: "PREENCHIDA" },
      { status: "NAO_REALIZADO" },
    ]);
    mocks.folhaFindFirst.mockResolvedValueOnce({
      id: 20, nome: "Toque julho", templateId: "ia-periodo", status: "AGUARDANDO_LANCAMENTO",
      filtrosSnapshot: filtros, configSnapshot: config, modeloId: null, totalLinhas: 2, linhasProntas: 2,
      propriedadeId: 7, geradoEm: new Date("2026-08-03T10:00:00Z"), concluidoEm: null, linhas: [],
    });

    await salvarLinhasFolha(20, { linhas: [
      { id: 1, status: "PREENCHIDA", respostas: { resultado_dg: "positivo", data_evento: "2026-08-03" } },
      { id: 2, status: "NAO_REALIZADO", motivoNaoRealizado: "Animal ausente" },
    ] }, 7);

    expect(mocks.linhaFindMany).toHaveBeenNthCalledWith(1, { where: { folhaId: 20, id: { in: [1, 2] } }, select: { id: true } });
    expect(mocks.linhaUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.folhaUpdate).toHaveBeenCalledWith({ where: { id: 20 }, data: { linhasProntas: 2, status: "AGUARDANDO_LANCAMENTO" } });
  });

  it("recusa id de linha que não pertence à folha", async () => {
    mocks.folhaFindFirst.mockResolvedValueOnce({ id: 20, status: "EM_CAMPO" });
    mocks.linhaFindMany.mockResolvedValueOnce([{ id: 1 }]);

    await expect(salvarLinhasFolha(20, { linhas: [
      { id: 1, status: "PENDENTE" },
      { id: 99, status: "PENDENTE" },
    ] }, 7)).rejects.toBeInstanceOf(FormularioFolhaError);
    expect(mocks.linhaUpdate).not.toHaveBeenCalled();
  });
});
