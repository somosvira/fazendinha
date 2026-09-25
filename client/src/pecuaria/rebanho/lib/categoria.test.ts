import { describe, expect, it } from "vitest";
import { calcularCategoriaCliente, idadeEmMesesCliente } from "./categoria";
import type { CategoriaDTO } from "../types";

function criarCategoria(overrides: Partial<CategoriaDTO>): CategoriaDTO {
  return {
    id: "c-1", nome: "Categoria", sexo: "F", automatica: true, ativo: true, ordem: 10,
    idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER",
    ideagriId: null, padrao: false, regra: "", animaisAtivos: 0, manuaisAbertas: 0,
    ...overrides,
  };
}

const categoriasPadrao: CategoriaDTO[] = [
  criarCategoria({ id: "f-vaca", nome: "Vaca", sexo: "F", ordem: 10, partos: "COM" }),
  criarCategoria({ id: "f-crescimento", nome: "Em crescimento", sexo: "F", ordem: 20, idadeMaxMeses: 12, partos: "SEM" }),
  criarCategoria({ id: "f-novilha", nome: "Novilha", sexo: "F", ordem: 30, idadeMinMeses: 12, partos: "SEM" }),
  criarCategoria({ id: "m-crescimento", nome: "Em crescimento", sexo: "M", ordem: 40, partos: "QUALQUER", idadeMaxMeses: 24 }),
  criarCategoria({ id: "m-touro", nome: "Touro", sexo: "M", ordem: 50, idadeMinMeses: 24, partos: "QUALQUER" }),
];

describe("idadeEmMesesCliente", () => {
  it("conta meses completos, não arredonda para cima", () => {
    expect(idadeEmMesesCliente("2025-01-15", "2026-01-14")).toBe(11);
    expect(idadeEmMesesCliente("2025-01-15", "2026-01-15")).toBe(12);
  });
});

describe("calcularCategoriaCliente", () => {
  it("fêmea sem partos: em crescimento antes de 12 meses, novilha depois", () => {
    expect(calcularCategoriaCliente(categoriasPadrao, { sexo: "F", dataNascimento: "2026-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toEqual({ id: "f-crescimento", nome: "Em crescimento" });
    expect(calcularCategoriaCliente(categoriasPadrao, { sexo: "F", dataNascimento: "2024-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toEqual({ id: "f-novilha", nome: "Novilha" });
  });

  it("fêmea com pelo menos um parto é vaca independente da idade", () => {
    expect(calcularCategoriaCliente(categoriasPadrao, { sexo: "F", dataNascimento: "2025-06-01", partosAntesDaEntrada: 1, hoje: "2026-01-01" })).toEqual({ id: "f-vaca", nome: "Vaca" });
  });

  it("macho: em crescimento < 24m, touro >= 24m", () => {
    expect(calcularCategoriaCliente(categoriasPadrao, { sexo: "M", dataNascimento: "2026-01-01", partosAntesDaEntrada: 0, hoje: "2026-06-01" })).toEqual({ id: "m-crescimento", nome: "Em crescimento" });
    expect(calcularCategoriaCliente(categoriasPadrao, { sexo: "M", dataNascimento: "2023-01-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toEqual({ id: "m-touro", nome: "Touro" });
  });

  it("primeira regra que casa vence, na ordem de avaliação", () => {
    const regras: CategoriaDTO[] = [
      criarCategoria({ id: "primeira", nome: "Primeira", sexo: "F", ordem: 1, partos: "QUALQUER" }),
      criarCategoria({ id: "segunda", nome: "Segunda", sexo: "F", ordem: 2, partos: "QUALQUER" }),
    ];
    expect(calcularCategoriaCliente(regras, { sexo: "F", dataNascimento: "2020-01-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toEqual({ id: "primeira", nome: "Primeira" });
  });

  it("regra inativa ou só manual não entra na avaliação automática", () => {
    const regras: CategoriaDTO[] = [
      criarCategoria({ id: "inativa", nome: "Inativa", sexo: "F", ordem: 1, ativo: false, partos: "QUALQUER" }),
      criarCategoria({ id: "manual", nome: "Manual", sexo: "F", ordem: 2, automatica: false, partos: "QUALQUER" }),
      criarCategoria({ id: "valida", nome: "Válida", sexo: "F", ordem: 3, partos: "QUALQUER" }),
    ];
    expect(calcularCategoriaCliente(regras, { sexo: "F", dataNascimento: "2020-01-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toEqual({ id: "valida", nome: "Válida" });
  });

  it("nenhuma regra do sexo casa: retorna null (sem categoria)", () => {
    expect(calcularCategoriaCliente([], { sexo: "F", dataNascimento: "2020-01-01", partosAntesDaEntrada: 0, hoje: "2026-01-01" })).toBeNull();
  });
});
