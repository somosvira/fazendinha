import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { conferirAnimalNoFato, conferirFatosNaBaixa, conferirHistoricoDosFatos } from "./fatos.js";

const dia = (s: string) => new Date(s);
const animal = { id: "animal", sexo: "M", dataNascimento: dia("2024-01-01"), dataEntrada: dia("2026-08-01") };
const local = { id: "local", animalId: animal.id, propriedadeId: 1, desde: animal.dataEntrada, ate: null };
const db = {
  animal: { findUnique: vi.fn(), findMany: vi.fn() },
  localizacaoAnimal: { findFirst: vi.fn(), findMany: vi.fn() },
  baixaAnimal: { findFirst: vi.fn(), findMany: vi.fn() },
  aplicacaoProduto: { count: vi.fn(), findMany: vi.fn() },
  exameAnimal: { count: vi.fn(), findMany: vi.fn() },
  manejoAnimal: { count: vi.fn(), findMany: vi.fn() },
  ocorrenciaSanitaria: { count: vi.fn(), findMany: vi.fn() },
};
// Fronteira de mock: somente os métodos usados pelas guardas são necessários.
const tx = db as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks();
  db.animal.findUnique.mockResolvedValue(animal);
  db.animal.findMany.mockResolvedValue([animal]);
  db.localizacaoAnimal.findFirst.mockResolvedValue(local);
  db.localizacaoAnimal.findMany.mockResolvedValue([local]);
  db.baixaAnimal.findFirst.mockResolvedValue(null);
  db.baixaAnimal.findMany.mockResolvedValue([]);
  for (const modelo of [db.aplicacaoProduto, db.exameAnimal, db.manejoAnimal, db.ocorrenciaSanitaria]) {
    modelo.count.mockResolvedValue(0);
    modelo.findMany.mockResolvedValue([]);
  }
});

describe("datas e sítio dos fatos pecuários", () => {
  it("aceita fato retroativo de animal baixado e consulta a localização na data", async () => {
    db.baixaAnimal.findFirst.mockResolvedValue({ data: dia("2026-09-20"), localizacaoFechadaId: local.id });
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-10"))).resolves.toEqual(animal);
    expect(db.localizacaoAnimal.findFirst).toHaveBeenCalledWith({ where: { animalId: animal.id, propriedadeId: 1, desde: { lte: dia("2026-09-10") }, OR: [{ ate: null }, { ate: { gt: dia("2026-09-10") } }] } });
    await conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-20"));
    expect(db.localizacaoAnimal.findFirst.mock.lastCall?.[0].where.OR).toContainEqual({ id: local.id });
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-09-21"))).rejects.toThrow(/após a baixa/);
  });
  it("recusa fato antes da entrada, no futuro ou sem localização comprovada", async () => {
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2026-07-31"))).rejects.toThrow(/anteceder/);
    await expect(conferirAnimalNoFato(tx, animal.id, 1, dia("2099-01-01"))).rejects.toThrow(/até hoje/);
    db.localizacaoAnimal.findFirst.mockResolvedValue(null);
    await expect(conferirAnimalNoFato(tx, animal.id, 2, dia("2026-09-10"))).rejects.toThrow(/não estava/);
  });
  it("protege uma baixa retroativa contra fatos posteriores", async () => {
    db.exameAnimal.count.mockResolvedValue(1);
    await expect(conferirFatosNaBaixa(tx, animal.id, dia("2026-09-10"))).rejects.toThrow(/antecede fatos/);
    expect(db.exameAnimal.count).toHaveBeenCalledWith({ where: { animalId: animal.id, status: "VALIDO", data: { gt: dia("2026-09-10") } } });
  });
  it("protege sítio e entrada contra correções que alterariam fatos já realizados", async () => {
    db.exameAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 2, data: dia("2026-09-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/sítio de fatos/);
    db.exameAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 1, data: dia("2026-07-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/anteriores/);
  });
  it("preserva sítio desconhecido e permite fato no dia da baixa sem mudar ocupação", async () => {
    db.localizacaoAnimal.findMany.mockResolvedValue([{ ...local, ate: dia("2026-09-20") }]);
    db.baixaAnimal.findMany.mockResolvedValue([{ animalId: animal.id, data: dia("2026-09-20"), localizacaoFechadaId: local.id }]);
    db.exameAnimal.findMany.mockResolvedValue([
      { animalId: animal.id, propriedadeId: 1, data: dia("2026-09-20"), origem: "MANUAL" },
      { animalId: animal.id, propriedadeId: null, data: dia("2026-07-10"), origem: "IDEAGRI" },
    ]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).resolves.toBeUndefined();
  });
  it("impede mudar para fêmea quando existe castração válida", async () => {
    db.animal.findMany.mockResolvedValue([{ ...animal, sexo: "F" }]);
    db.manejoAnimal.findMany.mockResolvedValue([{ animalId: animal.id, propriedadeId: 1, tipo: "CASTRACAO", data: dia("2026-09-10"), origem: "MANUAL" }]);
    await expect(conferirHistoricoDosFatos(tx, [animal.id])).rejects.toThrow(/mudar para fêmea/);
  });
});
