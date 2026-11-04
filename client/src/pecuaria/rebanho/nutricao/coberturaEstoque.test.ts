import { describe, expect, it } from "vitest";
import { calcularCobertura, ingredientesEmFalta, perdaPorValidade } from "./coberturaEstoque";
import type { Dieta, PartidaNutricional, ResumoNutricional } from "./api";
import type { SaldoDTO } from "../../../estoque/api";

const resumo = (id: string, sitio: number, animais: number, dietaId: string | null) => ({
  lote: { id, nome: id, propriedadeId: sitio, animaisAtivos: animais, propriedade: { id: sitio, nome: `Sítio ${sitio}` } },
  vigente: dietaId ? { id: `v-${id}`, desde: "2026-10-01", ate: null, dieta: { id: dietaId, nome: dietaId, versao: 1 } } : null,
}) as unknown as ResumoNutricional;
const dieta = (id: string, itens: Array<[string, string]>) => ({ id, nome: id, versao: 1, publicadaEm: "2026-10-01", itens: itens.map(([produtoId, q]) => ({ produtoId, quantidadeCabecaDia: q, unidade: "KG", produto: { nome: produtoId } })) }) as Dieta;
const saldo = (produtoId: string, saldo: number, saldoProjetado?: number) => ({ produtoId, nome: produtoId, saldo, saldoProjetado }) as SaldoDTO;

describe("cobertura de estoque das dietas", () => {
  it("soma o consumo de todos os lotes do sítio e limita o lote pelo ingrediente que acaba primeiro", () => {
    const lotes = [resumo("lactantes", 1, 10, "lactacao"), resumo("novilhas", 1, 5, "crescimento"), resumo("outro", 2, 100, "crescimento")];
    const dietas = [dieta("lactacao", [["racao", "3"], ["silagem", "10"]]), dieta("crescimento", [["silagem", "4"]])];
    const c = calcularCobertura(lotes, dietas, new Map([[1, [saldo("racao", 300), saldo("silagem", 1200)]], [2, [saldo("silagem", 4000)]]]));
    // Silagem no sítio 1: 10×10 + 5×4 = 120 kg/dia; 1.200 kg cobrem 10 dias. Ração: 30 kg/dia; 300 kg cobrem 10 dias.
    const lactantes = c.get("lactantes")!;
    expect(lactantes.ingredientes.find(i => i.produtoId === "silagem")).toMatchObject({ consumoLoteDia: 100, consumoSitioDia: 120, dias: 10 });
    expect(lactantes.dias).toBe(10);
    // O sítio 2 tem saldo próprio e não entra na conta do sítio 1.
    expect(c.get("outro")!.dias).toBe(10);
  });
  it("usa o saldo disponível, sem o consumo estimado ainda não baixado, e trata produto sem saldo como zero", () => {
    const lotes = [resumo("a", 1, 10, "d")];
    const c = calcularCobertura(lotes, [dieta("d", [["racao", "1"], ["mineral", "0.1"]])], new Map([[1, [saldo("racao", 100, 40)]]]));
    expect(c.get("a")!.ingredientes.find(i => i.produtoId === "racao")!.dias).toBe(4);
    expect(c.get("a")!.limitante).toMatchObject({ produtoId: "mineral", dias: 0 });
    expect(ingredientesEmFalta(c, lotes).map(i => [i.produtoId, i.dias])).toEqual([["mineral", 0], ["racao", 4]]);
  });
  it("desconta o que vence antes do uso, gastando primeiro o lote de estoque que vence antes", () => {
    const partida = (id: string, validade: string | null, saldo: number) => ({ id, codigo: id, validade, saldo: String(saldo), origemRastreio: "ENTRADA" }) as PartidaNutricional;
    // 10 kg/dia a partir de 04/11: até 06/11 (3 dias) usa 30 de 50; até 30/11 cabem mais 240, que gasta os 100 do segundo lote.
    const partidas = [partida("b", "2026-11-30", 100), partida("a", "2026-11-06", 50), partida("sem", null, 500)];
    expect(perdaPorValidade(partidas, 10, "2026-11-04")).toEqual({ vencendo: 20, proximaValidade: "2026-11-06" });
    const lotes = [resumo("a", 1, 10, "d")];
    const c = calcularCobertura(lotes, [dieta("d", [["racao", "1"]])], new Map([[1, [saldo("racao", 650)]]]), new Map([["1:racao", partidas]]), "2026-11-04");
    // 650 − 20 vencendo = 630 utilizáveis a 10 kg/dia.
    expect(c.get("a")!.ingredientes[0]).toMatchObject({ vencendo: 20, dias: 63 });
    expect(ingredientesEmFalta(c, lotes).map(i => i.produtoId)).toEqual(["racao"]);
  });
});
