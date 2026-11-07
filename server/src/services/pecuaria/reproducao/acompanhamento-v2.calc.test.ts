import { describe, expect, it } from "vitest";
import { parametrosAcompanhamentoSchema } from "./acompanhamento.schemas.js";
import { proporAcompanhamentos } from "./acompanhamento.calc.js";

const regra = { finalidade: "DIAGNOSTICO", ocorrencia: 1, publico: "IA", referencia: "IA", intervalo: 30, unidade: "DIAS", antecedencia: 3, tolerancia: 2, resolucao: "DIAGNOSTICO_CONCLUSIVO" } as const;
const parametros = parametrosAcompanhamentoSchema.parse({ versao: 2, efeito: "ALERTA", regras: [regra, { ...regra, publico: "TE", referencia: "TE", intervalo: 20 }] });
const politica = { id: "politica", versao: 3, parametros };
describe("prazos de acompanhamento versionados", () => {
 it("distingue a referência de IA e TE e congela parâmetros sem confundir idade gestacional", () => {
  const ia = proporAcompanhamentos(politica, { tentativaId: "ia", tipoTentativa: "IA", data: "2026-01-01" });
  const te = proporAcompanhamentos(politica, { tentativaId: "te", tipoTentativa: "TE", data: "2026-01-01" });
  expect(ia[0]).toMatchObject({ previstaPara: "2026-01-31", regraSnapshot: { origem: "SITIO", politicaVersao: 3, referencia: "IA", antecedencia: 3, tolerancia: 2 } });
  expect(te[0]).toMatchObject({ previstaPara: "2026-01-21", regraSnapshot: { referencia: "TE", intervalo: 20 } });
  expect(proporAcompanhamentos(politica, { tentativaId: "t", tipoTentativa: "COBERTURA", data: "2026-01-01" })).toEqual([]);
 });
 it("rejeita referência e público divergentes ou duplicados", () => {
  expect(parametrosAcompanhamentoSchema.safeParse({ versao: 2, efeito: "ALERTA", regras: [{ ...regra, referencia: "TE" }] }).success).toBe(false);
  expect(parametrosAcompanhamentoSchema.safeParse({ versao: 2, efeito: "ALERTA", regras: [regra, regra] }).success).toBe(false);
 });
});
