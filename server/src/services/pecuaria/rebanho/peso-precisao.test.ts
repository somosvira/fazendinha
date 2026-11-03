import { expect, it } from "vitest";
import { gmdEntre, gmdPeriodo, resumoPeso } from "./peso.calc.js";
import { pesagemSchema } from "./schemas.js";
it("estimativas e pesos apenas informados não viram GMD aferido", () => {
  for (const precisao of ["ESTIMADO", "INFORMADO"]) {
    expect(gmdEntre({ data: "2024-01-01", pesoKg: 100, precisao }, { data: "2024-01-11", pesoKg: 200, precisao: "MEDIDO" })).toBeNull();
  }
});
it("GMD operacional exclui histórico externo e conserva medidas da fazenda", () => {
  const registros = [
    { data: "2024-01-01", pesoKg: 100, precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    { data: "2024-01-06", pesoKg: 999, precisao: "ESTIMADO", contextoHistorico: "INTERNO" },
    { data: "2024-01-11", pesoKg: 200, precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    { data: "2024-01-15", pesoKg: 500, precisao: "MEDIDO", contextoHistorico: "EXTERNO" },
  ];
  expect(gmdPeriodo(registros, null, "2024-01-20")).toEqual({ dias: 10, valor: 10, pesagens: 2 });
  expect(resumoPeso(registros, { hoje: "2024-01-20", periodoDias: null })).toMatchObject({
    ultimo: { kg: 200, data: "2024-01-11" },
    cobertura: { medidas: 3, estimadas: 1, informadas: 0, precisaoNaoInformada: 0, externas: 1 },
  });
});
it("histórico legado sem precisão explícita permanece identificável sem receber medição fictícia", () => {
  expect(resumoPeso([{ data: "2024-01-01", pesoKg: 100, precisao: "NAO_INFORMADO" }], { hoje: "2024-01-20", periodoDias: null })).toMatchObject({ cobertura: { precisaoNaoInformada: 1 }, gmdRecente: null });
});
it("origem balança não aceita estimativa e preserva parto/secagem", () => {
  const base = { data: "2024-01-01", pesoKg: 200, origem: "MANUAL", precisao: "ESTIMADO" };
  expect(pesagemSchema.safeParse({ ...base, tipo: "PARTO" }).success).toBe(true);
  expect(pesagemSchema.safeParse({ ...base, tipo: "SECAGEM" }).success).toBe(true);
  expect(pesagemSchema.safeParse({ ...base, tipo: "ROTINA", origem: "BALANCA" }).success).toBe(false);
});
