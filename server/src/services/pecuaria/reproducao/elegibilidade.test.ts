import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("../../../db.js", () => ({ prisma: {} }));
vi.mock("../fatos.js", () => ({ conferirAnimalNoFato: vi.fn(async () => ({ sexo: "F" })) }));
import { conferirAnimalNoFato } from "../fatos.js";
import { vincularPoliticaCicloTx, carregarDadosElegibilidadeTx } from "./elegibilidade.js";

const dia = (d: string) => new Date(`${d}T00:00:00Z`);
function fixture() {
  const mock = {
    vinculoPoliticaCiclo: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: unknown }) => ({ id: "vinculo", ...(data as object) })),
    },
    partoAnimal: { findFirst: vi.fn().mockResolvedValue({ id: "parto", data: dia("2026-01-20") }), count: vi.fn().mockResolvedValue(0) },
    situacaoInicialReprodutiva: { findFirst: vi.fn().mockResolvedValue({ id: "inicialB", data: dia("2026-02-05") }) },
    politicaElegibilidadeReprodutiva: { findFirst: vi.fn().mockResolvedValue(null) },
    auditoriaPecuaria: { create: vi.fn().mockResolvedValue({ id: "audit" }) },
  };
  return { mock, tx: mock as unknown as Prisma.TransactionClient };
}
beforeEach(() => vi.clearAllMocks());
describe("vínculo imutável da política no ciclo", () => {
  it("congela ausência de política na data do parto e audita", async () => {
    const { tx, mock } = fixture();
    const salvo = await vincularPoliticaCicloTx(tx, { animalId: "animal", propriedadeId: 1, partoId: "parto" }, 7);
    expect(salvo).toMatchObject({ chaveCiclo: "PARTO:parto", inicioCiclo: dia("2026-01-20"), politicaId: null });
    expect(mock.politicaElegibilidadeReprodutiva.findFirst).toHaveBeenCalledWith({ where: { propriedadeId: 1, vigenteDesde: { lte: dia("2026-01-20") } }, orderBy: { vigenteDesde: "desc" } });
    expect(mock.auditoriaPecuaria.create).toHaveBeenCalledOnce();
  });
  it("reenvio conserva null e não busca uma política criada depois", async () => {
    const { tx, mock } = fixture();
    mock.vinculoPoliticaCiclo.findUnique.mockResolvedValue({ id: "v", propriedadeId: 1, politicaId: null });
    expect(await vincularPoliticaCicloTx(tx, { animalId: "animal", propriedadeId: 1, partoId: "parto" }, 7)).toMatchObject({ politicaId: null });
    expect(mock.politicaElegibilidadeReprodutiva.findFirst).not.toHaveBeenCalled();
    expect(mock.vinculoPoliticaCiclo.create).not.toHaveBeenCalled();
  });
  it("liga política vigente na data e mantém situação inicial escolhida como fonte", async () => {
    const { tx, mock } = fixture();
    mock.politicaElegibilidadeReprodutiva.findFirst.mockResolvedValue({ id: "p2" });
    const salvo = await vincularPoliticaCicloTx(tx, { animalId: "animal", propriedadeId: 1, situacaoInicialId: "inicialB" }, 7);
    expect(salvo).toMatchObject({ chaveCiclo: "INICIAL", inicioCiclo: dia("2026-02-05"), situacaoInicialId: "inicialB", politicaId: "p2" });
    expect(conferirAnimalNoFato).toHaveBeenCalledWith(tx, "animal", 1, dia("2026-02-05"));
  });
  it("recusa situação inicial usada para substituir ciclo de parto", async () => {
    const { tx, mock } = fixture(); mock.partoAnimal.count.mockResolvedValue(1);
    await expect(vincularPoliticaCicloTx(tx, { animalId: "animal", propriedadeId: 1, situacaoInicialId: "inicialB" }, 7)).rejects.toThrow("não substitui ciclo");
    expect(mock.vinculoPoliticaCiclo.create).not.toHaveBeenCalled();
  });
  it("recusa fonte ambígua antes de escrever", async () => {
    const { tx, mock } = fixture();
    await expect(vincularPoliticaCicloTx(tx, { animalId: "animal", propriedadeId: 1, partoId: "p", situacaoInicialId: "i" }, 7)).rejects.toThrow("parto ou situação inicial");
    expect(mock.vinculoPoliticaCiclo.create).not.toHaveBeenCalled();
  });
});
describe("histórico em lote", () => {
  it("carrega uma consulta por fonte para vários animais, sem escrita ou consulta por dia", async () => {
    const nomes = ["animal", "partoAnimal", "tentativaReprodutiva", "lactacaoAnimal", "gestacaoAnimal", "localizacaoAnimal", "avaliacaoReprodutiva",
      "situacaoInicialReprodutiva", "vinculoPoliticaCiclo", "restricaoReprodutiva", "periodoReprodutivoAnimal", "baixaAnimal", "politicaElegibilidadeReprodutiva", "decisaoElegibilidadeCiclo", "pesagem", "exameAnimal"];
    const mock = Object.fromEntries(nomes.map(nome => [nome, { findMany: vi.fn().mockResolvedValue([]) }]));
    const dados = await carregarDadosElegibilidadeTx(mock as unknown as Prisma.TransactionClient, ["a", "b", "a"], dia("2026-03-01"));
    expect(dados.animais).toEqual([]);
    for (const fonte of Object.values(mock)) expect(fonte.findMany).toHaveBeenCalledOnce();
    expect(mock.localizacaoAnimal.findMany).toHaveBeenCalledWith({ where: { animalId: { in: ["a", "b"] }, desde: { lte: dia("2026-03-01") } } });
  });
});
