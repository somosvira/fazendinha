/* Teste da função pura de agregação da folha (agregarTotais). Não toca no Prisma
 * — usa DTOs sintéticos. O objetivo é blindar contra drift de ponto flutuante ao
 * somar `number` (o bug anterior era `Math.round((a+b) * 100) / 100`, que perde
 * precisão em decimais fracionários — a soma agora usa Prisma.Decimal). */
import { describe, it, expect } from "vitest";
import { agregarTotais } from "./folha.service.js";
import type { FolhaLinhaDTO } from "./folha.js";

const linha = (over: Partial<FolhaLinhaDTO> = {}): FolhaLinhaDTO => ({
  funcionarioId: "1",
  nome: "Teste",
  cargo: null,
  salarioMensal: 2200,
  valorHora: 10,
  diasTrabalhados: 20,
  totalHoras: 180,
  horasNormais: 176,
  extra50: 4,
  extra100: 0,
  valorExtra: 60,
  totalPagar: 2260,
  ...over,
});

describe("agregarTotais", () => {
  it("array vazio → todos os totais zerados", () => {
    expect(agregarTotais([])).toEqual({
      salarios: 0,
      valorExtra: 0,
      totalPagar: 0,
      totalHoras: 0,
    });
  });

  it("uma linha só → totais espelham a linha", () => {
    const t = agregarTotais([linha()]);
    expect(t.salarios).toBe(2200);
    expect(t.valorExtra).toBe(60);
    expect(t.totalPagar).toBe(2260);
    expect(t.totalHoras).toBe(180);
  });

  it("três linhas com decimais fracionários — sem drift de float", () => {
    // 210.33 + 315.67 + 120.05 = 646.05 (exato). Se somasse com float,
    // apareceria .04999999… ou .05000000001 dependendo da ordem.
    const t = agregarTotais([
      linha({ salarioMensal: 2199.99, valorExtra: 210.33, totalPagar: 2410.32, totalHoras: 180.1 }),
      linha({ salarioMensal: 2333.33, valorExtra: 315.67, totalPagar: 2649.0, totalHoras: 175.2 }),
      linha({ salarioMensal: 3011.11, valorExtra: 120.05, totalPagar: 3131.16, totalHoras: 190.3 }),
    ]);
    expect(t.salarios).toBe(7544.43); // 2199.99 + 2333.33 + 3011.11
    expect(t.valorExtra).toBe(646.05); // 210.33 + 315.67 + 120.05
    expect(t.totalPagar).toBe(8190.48); // 2410.32 + 2649.00 + 3131.16
    expect(t.totalHoras).toBe(545.6); // 180.1 + 175.2 + 190.3
  });

  it("horas inteiras somadas continuam inteiras (sem casa decimal artificial)", () => {
    const t = agregarTotais([
      linha({ totalHoras: 200 }),
      linha({ totalHoras: 190 }),
    ]);
    expect(t.totalHoras).toBe(390);
  });
});
