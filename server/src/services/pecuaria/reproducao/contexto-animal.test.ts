import { describe, expect, it, vi } from "vitest";
import { obterContextosAnimaisNaDataTx } from "./contexto-animal.js";

const dia = (data: string) => new Date(`${data}T00:00:00Z`);
const fonte = () => ({
  animal: { findMany: vi.fn().mockResolvedValue([
    { id: "a", dataEntrada: dia("2023-01-01"), partosAntesDaEntrada: 1 },
    { id: "b", dataEntrada: dia("2023-01-01"), partosAntesDaEntrada: 0 },
  ]) },
  partoAnimal: { findMany: vi.fn().mockResolvedValue([]) },
  tentativaReprodutiva: { findMany: vi.fn().mockResolvedValue([]) },
  lactacaoAnimal: { findMany: vi.fn().mockResolvedValue([
    { id: "lactacao", animalId: "a", propriedadeId: 1, partoId: null, inicio: dia("2026-01-01"), encerradaEm: null, origem: "HISTORICO_IMPORTADO" },
  ]) },
  gestacaoAnimal: { findMany: vi.fn().mockResolvedValue([]) },
  localizacaoAnimal: { findMany: vi.fn().mockResolvedValue([
    { id: "destino", animalId: "a", propriedadeId: 2, loteId: "lote", desde: dia("2026-02-01"), ate: null },
  ]) },
  avaliacaoReprodutiva: { findMany: vi.fn().mockResolvedValue([]) },
  situacaoInicialReprodutiva: { findMany: vi.fn().mockResolvedValue([]) },
});
type Leitor = Parameters<typeof obterContextosAnimaisNaDataTx>[0];

describe("leitura de contexto animal em lote", () => {
  it("agrupa os fatos por animal com uma consulta por fonte, sem escopo clínico do sítio atual", async () => {
    const tx = fonte();
    const contextos = await obterContextosAnimaisNaDataTx(tx as unknown as Leitor, ["a", "b", "a", "inexistente"], dia("2026-02-10"));
    expect([...contextos.keys()]).toEqual(["a", "b"]);
    expect(contextos.get("a")).toMatchObject({ del: 40, partosRealizados: 1, lactacaoVigente: { propriedadeId: 1 }, localizacaoNaData: { propriedadeId: 2 } });
    expect(contextos.get("b")).toMatchObject({ situacaoProdutiva: "NAO_INFORMADA", del: null, partosRealizados: 0 });
    for (const modelo of Object.values(tx)) expect(modelo.findMany).toHaveBeenCalledTimes(1);
    expect(tx.lactacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { animalId: { in: ["a", "b", "inexistente"] }, inicio: { lte: dia("2026-02-10") } },
    }));
    expect(tx.gestacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { animalId: { in: ["a", "b", "inexistente"] }, status: "VALIDO", confirmadaEm: { lte: dia("2026-02-10") } },
    }));
  });

  it("lote vazio não consulta banco e referência inválida é recusada", async () => {
    const tx = fonte();
    expect(await obterContextosAnimaisNaDataTx(tx as unknown as Leitor, [], dia("2026-02-10"))).toEqual(new Map());
    for (const modelo of Object.values(tx)) expect(modelo.findMany).not.toHaveBeenCalled();
    await expect(obterContextosAnimaisNaDataTx(tx as unknown as Leitor, ["a"], new Date("inválida"))).rejects.toThrow("Data de contexto inválida");
  });
});
