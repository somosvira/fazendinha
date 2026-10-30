import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { conferirControlesHistoricosLeiteTx, validarContextoControleHistoricoLeiteTx } from "./controle-historico-contexto.js";

const dia = (s: string) => new Date(s);
const animalId = "7be84110-86c2-49b0-bf27-70f666c711ee";
const animal = { id: animalId, sexo: "F", dataNascimento: dia("2020-01-01"), dataEntrada: dia("2024-01-01") };
const dados = { animalId, propriedadeId: 1, contexto: "INTERNO" as const, inicio: "2024-10-20", fim: "2024-10-20", lactacaoId: null, evidencia: "Controle original comprovado" };
const db = {
  animal: { findUnique: vi.fn() }, baixaAnimal: { findFirst: vi.fn() },
  localizacaoAnimal: { findMany: vi.fn() }, lactacaoAnimal: { findUnique: vi.fn() },
  controleHistoricoLeite: { findMany: vi.fn() },
};
// Fronteira de persistência: os mesmos validadores reais atendem criação e revisão.
const tx = db as unknown as Prisma.TransactionClient;
const documento = (contexto: "INTERNO" | "EXTERNO" = "INTERNO") => ({
  id: "documento-conferido", animalId, propriedadeId: contexto === "INTERNO" ? 1 : null,
  contextoHistorico: contexto, inicio: dia(dados.inicio), fim: dia(dados.fim), lactacaoId: null,
});
beforeEach(() => {
  vi.resetAllMocks();
  db.animal.findUnique.mockResolvedValue(animal);
  db.baixaAnimal.findFirst.mockResolvedValue(null);
  db.localizacaoAnimal.findMany.mockResolvedValue([{ id: "local", propriedadeId: 1 }]);
  db.controleHistoricoLeite.findMany.mockResolvedValue([documento()]);
});

describe("mesmo contexto temporal na criação e na guarda inversa do leite documental", () => {
  it("conserva controle sem lactação e aceita cadastro compatível", async () => {
    await expect(validarContextoControleHistoricoLeiteTx(tx, dados)).resolves.toBeNull();
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).resolves.toBeUndefined();
  });
  it.each([
    ["sexo", { ...animal, sexo: "M" }],
    ["nascimento", { ...animal, dataNascimento: dia("2024-10-21") }],
    ["entrada", { ...animal, dataEntrada: dia("2024-10-21") }],
  ])("recusa alteração de %s que invalida documento existente", async (_caso, proposto) => {
    db.animal.findUnique.mockResolvedValue(proposto);
    await expect(validarContextoControleHistoricoLeiteTx(tx, dados)).rejects.toMatchObject({ code: "VALIDACAO" });
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).rejects.toMatchObject({ code: "CONFLITO", message: expect.stringContaining("documento-conferido") });
  });
  it("recusa baixa anterior, preserva limite inclusivo na baixa e exclusivo na localização", async () => {
    db.baixaAnimal.findFirst.mockResolvedValue({ data: dia("2024-10-19"), localizacaoFechadaId: "local" });
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).rejects.toThrow(/baixa/);
    db.baixaAnimal.findFirst.mockResolvedValue({ data: dia("2024-10-20"), localizacaoFechadaId: "local" });
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).resolves.toBeUndefined();
    expect(db.localizacaoAnimal.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ ate: null }, { ate: { gt: dia("2024-10-20") } }, { id: "local" }] }) }));
  });
  it.each([[], [{ id: "outro-local", propriedadeId: 2 }], [{ id: "local", propriedadeId: 1 }, { id: "duplicado", propriedadeId: 1 }]])("recusa ausência, troca e ambiguidade do sítio", async (...locais) => {
    db.localizacaoAnimal.findMany.mockResolvedValue(locais);
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).rejects.toMatchObject({ code: "CONFLITO" });
  });
  it("externo anterior à entrada permanece válido; inclusão de localização interna o contradiz", async () => {
    db.animal.findUnique.mockResolvedValue({ ...animal, dataEntrada: dia("2024-11-01") });
    db.localizacaoAnimal.findMany.mockResolvedValue([]);
    db.controleHistoricoLeite.findMany.mockResolvedValue([documento("EXTERNO")]);
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).resolves.toBeUndefined();
    db.localizacaoAnimal.findMany.mockResolvedValue([{ id: "novo", propriedadeId: 1 }]);
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).rejects.toThrow(/externo contradiz localização/);
  });
  it("coletivos não são consultados como dependência de animal", async () => {
    db.controleHistoricoLeite.findMany.mockResolvedValue([]);
    await conferirControlesHistoricosLeiteTx(tx, [animalId]);
    expect(db.controleHistoricoLeite.findMany).toHaveBeenCalledWith({ where: { animalId: { in: [animalId] } } });
    expect(db.animal.findUnique).not.toHaveBeenCalled();
  });
  it("revalida sítio, animal e intervalo de lactação vinculada", async () => {
    const lactacaoId = "f7e84110-86c2-49b0-bf27-70f666c711ee";
    const lactacao = { id: lactacaoId, animalId, propriedadeId: 1, inicio: dia("2024-10-20"), encerradaEm: dia("2024-10-21") };
    db.controleHistoricoLeite.findMany.mockResolvedValue([{ ...documento(), lactacaoId }]);
    db.lactacaoAnimal.findUnique.mockResolvedValue(lactacao);
    await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).resolves.toBeUndefined();
    for (const alterada of [null, { ...lactacao, propriedadeId: 2 }, { ...lactacao, animalId: "outro" }, { ...lactacao, inicio: dia("2024-10-21") }, { ...lactacao, encerradaEm: dia("2024-10-20") }]) {
      db.lactacaoAnimal.findUnique.mockResolvedValue(alterada);
      await expect(conferirControlesHistoricosLeiteTx(tx, [animalId])).rejects.toMatchObject({ code: "CONFLITO", campo: "lactacaoId" });
    }
  });
});
