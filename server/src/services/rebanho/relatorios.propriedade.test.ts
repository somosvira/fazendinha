import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eventoFindMany: vi.fn(),
  eventoCount: vi.fn(),
  animalFindMany: vi.fn(),
  animalCount: vi.fn(),
  getNumero: vi.fn(),
  sugerirAptidao: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: {
    eventoReprodutivo: { findMany: mocks.eventoFindMany, count: mocks.eventoCount },
    animal: { findMany: mocks.animalFindMany, count: mocks.animalCount },
  },
}));
vi.mock("./parametros.js", () => ({ getNumero: mocks.getNumero }));
vi.mock("./aptidao.js", () => ({ sugerirAptidaoAutomatica: mocks.sugerirAptidao }));

import { gerarRelatorio } from "./relatorios.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventoFindMany.mockResolvedValue([]);
  mocks.eventoCount.mockResolvedValue(0);
  mocks.animalFindMany.mockResolvedValue([]);
  mocks.animalCount.mockResolvedValue(0);
  mocks.getNumero.mockResolvedValue(283);
  mocks.sugerirAptidao.mockResolvedValue([]);
});

describe("consulta de relatórios por propriedade", () => {
  it("gera a lista predefinida de novilhas aptas pelos critérios de manejo", async () => {
    mocks.sugerirAptidao.mockResolvedValue([{ animalId: 31, numero: "301", apta: true, motivo: "Atinge idade (13m) e peso (320kg) mínimos." }]);
    mocks.animalFindMany.mockResolvedValue([{
      id: 31, numero: "301", nome: "Jade", categoria: "NOVILHA", setor: "Recria", dataNascimento: new Date("2024-01-01T00:00:00Z"),
      grupo: { nome: "Novilhas" }, pesagens: [{ peso: 358 }],
    }]);

    const r = await gerarRelatorio({ templateId: "novilhas-aptas", status: "ATIVO" }, 7);

    expect(mocks.sugerirAptidao).toHaveBeenCalledWith(7, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: [31] }, propriedadeId: 7, status: "ATIVO" },
    }));
    expect(r).toMatchObject({ templateId: "novilhas-aptas", total: 1 });
    expect(r.linhas[0]?.celulas).toEqual([expect.any(Number), 358, "Atinge idade (13m) e peso (320kg) mínimos."]);
  });

  it("consulta inseminações no período com uma linha por tentativa e todos os filtros", async () => {
    mocks.eventoCount.mockResolvedValue(2);
    mocks.eventoFindMany.mockResolvedValue([
      {
        id: 11, animalId: 5, data: new Date("2026-06-20T00:00:00Z"), reprodutor: "Lance", protocolo: "IATF 11d",
        resultado: null, dtPartoPrevista: null, tipoParto: null, auxilioParto: null, numCrias: null,
        criasVivas: null, criasNatimortas: null, sexoCria: null, motivoSecagem: null, observacao: null,
        doadoraNumero: null, doadoraNome: null,
        animal: { numero: "150", nome: "Lua", categoria: "VACA", setor: "Compost", grupo: { nome: "Alta" } },
      },
      {
        id: 10, animalId: 5, data: new Date("2026-06-02T00:00:00Z"), reprodutor: "Lance", protocolo: "IATF 11d",
        resultado: null, dtPartoPrevista: null, tipoParto: null, auxilioParto: null, numCrias: null,
        criasVivas: null, criasNatimortas: null, sexoCria: null, motivoSecagem: null, observacao: null,
        doadoraNumero: null, doadoraNome: null,
        animal: { numero: "150", nome: "Lua", categoria: "VACA", setor: "Compost", grupo: { nome: "Alta" } },
      },
    ]);

    const r = await gerarRelatorio({
      templateId: "ia-periodo", dataInicio: "2026-06-01", dataFim: "2026-06-30", status: "ATIVO",
      grupoId: 3, setor: "Compost", categoria: "VACA", reprodutor: "Lance", protocolo: "IATF",
    }, 7);

    expect(mocks.eventoFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tipo: "INSEMINACAO",
        data: { gte: new Date("2026-06-01T00:00:00Z"), lte: new Date("2026-06-30T00:00:00Z") },
        reprodutor: { contains: "Lance", mode: "insensitive" },
        protocolo: { contains: "IATF", mode: "insensitive" },
        animal: { propriedadeId: 7, status: "ATIVO", grupoId: 3, setor: "Compost", categoria: "VACA" },
      },
      orderBy: [{ data: "desc" }, { id: "desc" }],
      take: 2000,
    }));
    expect(r.total).toBe(2);
    expect(r.linhas).toHaveLength(2);
    expect(r.linhas.map((l) => l.eventoId)).toEqual([11, 10]);
    expect(r.linhas[0]).toMatchObject({ animalId: 5, numero: "150", nome: "Lua", data: "2026-06-20", celulas: ["Lance", "IATF 11d"] });
  });

  it("consulta o estado atual das gestantes por animal", async () => {
    mocks.animalCount.mockResolvedValue(1);
    mocks.animalFindMany.mockResolvedValue([{
      id: 8, numero: "220", nome: "Estrela", categoria: "VACA", setor: "Maternidade", grupo: { nome: "Pré-parto" },
      resumo: { statusReprodutivo: "PRENHE", diasGestacao: 210, ultimaInseminacao: new Date("2026-01-01T00:00:00Z"), previsaoSecagem: new Date("2026-08-10T00:00:00Z") },
    }]);

    const r = await gerarRelatorio({ templateId: "gestantes-atual", status: "ATIVO" }, 7);

    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { propriedadeId: 7, status: "ATIVO", resumo: { statusReprodutivo: "PRENHE" } },
      take: 2000,
    }));
    expect(r.linhas[0]).toMatchObject({ animalId: 8, data: null, celulas: [210, "2026-01-01", "2026-08-10"] });
  });

  it("deriva a previsão de parto e aplica a janela do template previsto", async () => {
    mocks.animalCount.mockResolvedValue(1);
    mocks.animalFindMany.mockResolvedValue([{
      id: 9, numero: "221", nome: "Aurora", categoria: "VACA", setor: null, grupo: null,
      resumo: { statusReprodutivo: "PRENHE", diasGestacao: 250, ultimaInseminacao: new Date("2025-11-21T00:00:00Z"), previsaoSecagem: new Date("2026-07-02T00:00:00Z") },
    }]);

    const r = await gerarRelatorio({ templateId: "partos-previstos", dataInicio: "2026-08-20", dataFim: "2026-09-10", status: "ATIVO" }, 7);

    expect(mocks.getNumero).toHaveBeenCalledWith("GESTACAO_DIAS");
    expect(mocks.animalFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ resumo: expect.objectContaining({ ultimaInseminacao: { gte: expect.any(Date), lte: expect.any(Date) } }) }),
    }));
    expect(r.linhas[0]).toMatchObject({ data: "2026-08-31", celulas: ["2026-08-31", 250] });
  });

  it("sinaliza truncamento sem confundir total com quantidade retornada", async () => {
    mocks.eventoCount.mockResolvedValue(2001);
    mocks.eventoFindMany.mockResolvedValue([]);
    const r = await gerarRelatorio({ templateId: "partos-periodo", dataInicio: "2026-01-01", dataFim: "2026-12-31", status: "TODOS" }, null);
    expect(r).toMatchObject({ total: 2001, truncado: true });
  });
});
