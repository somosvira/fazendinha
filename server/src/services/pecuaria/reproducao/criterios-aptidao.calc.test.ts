import type { GrupoCriteriosAptidao } from "./elegibilidade.schemas.js";
import { describe, expect, it } from "vitest";
import { avaliarCriteriosAptidao } from "./criterios-aptidao.calc.js";
const referencia = new Date("2026-10-29T00:00:00Z");
const grupo: GrupoCriteriosAptidao = { idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ["MEDIDO"], escalaEcc: null, validadeEccDias: null };
const entrada = { classeReprodutiva: "NOVILHA" as const, animalId: "a", chaveCiclo: "INICIAL", referencia, dataNascimento: new Date("2025-01-01"), parto: null, pesagens: [], escores: [], vacas: grupo, novilhas: grupo, diasAvaliacaoPosParto: null };
describe("critérios selecionados indicam necessidade, sem liberação", () => {
  it("sem disparadores preserva agendamento manual e ignora evidências ausentes", () => {
    expect(avaliarCriteriosAptidao(entrada)).toMatchObject({ estado: "MANUAL", pendencias: [], necessidadeId: "APTIDAO:a:INICIAL" });
  });
  it("idade e percentual juntos exigem ambos; peso ausente é pendência", () => {
    const novilhas = { ...grupo, idadeMinimaMeses: 15, percentualPesoAdulto: 55, pesoAdultoReferenciaKg: 600, validadePesoDias: 30 };
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas })).toMatchObject({ estado: "PENDENCIA_DADOS", pendencias: ["PESO_AUSENTE_OU_VENCIDO"] });
    const pesagens = [{ id: "p", data: referencia, pesoKg: 340, precisao: "MEDIDO" }];
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, pesagens }).estado).toBe("AVALIACAO_DEVIDA");
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, pesagens: [{ ...pesagens[0], pesoKg: 320 }] }).estado).toBe("CRITERIOS_NAO_ATINGIDOS");
  });
  it("estimativa não vira medida e validade inclui o último dia", () => {
    const novilhas = { ...grupo, pesoMinimoKg: 300, validadePesoDias: 30 };
    const pesagens = [{ id: "p", data: new Date("2026-09-29"), pesoKg: 340, precisao: "ESTIMADO" }];
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, pesagens }).estado).toBe("PENDENCIA_DADOS");
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, pesagens: [{ ...pesagens[0], precisao: "MEDIDO" }] }).estado).toBe("AVALIACAO_DEVIDA");
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, referencia: new Date("2026-10-30"), pesagens: [{ ...pesagens[0], precisao: "MEDIDO" }] }).estado).toBe("PENDENCIA_DADOS");
  });
  it("ECC exige escala compatível e não converte desconhecido", () => {
    const novilhas = { ...grupo, eccMinimo: 3, escalaEcc: { minimo: 1, maximo: 5 }, validadeEccDias: 15 };
    const escores = [{ id: "e", data: referencia, valor: 4, escalaMin: 1, escalaMax: 9 }];
    expect(avaliarCriteriosAptidao({ ...entrada, novilhas, escores }).estado).toBe("PENDENCIA_DADOS");
  });
  it("45 dias pós-parto gera necessidade estável, sem agenda ou decisão", () => {
    const vaca = { ...entrada, classeReprodutiva: "VACA" as const, chaveCiclo: "PARTO:p", parto: new Date("2026-09-14"), diasAvaliacaoPosParto: 45 };
    expect(avaliarCriteriosAptidao(vaca)).toMatchObject({ estado: "AVALIACAO_DEVIDA", devidaDesde: "2026-10-29", necessidadeId: "APTIDAO:a:PARTO:p" });
  });
});

it("vaca comprovada pelo saldo de partos exige a data do parto quando o disparo pós-parto está ativo", () => {
  const resultado = avaliarCriteriosAptidao({ ...entrada, classeReprodutiva: "VACA", parto: null, diasAvaliacaoPosParto: 45,
    vacas: grupo, novilhas: { ...grupo, idadeMinimaMeses: 15 } });
  expect(resultado).toMatchObject({ estado: "PENDENCIA_DADOS", pendencias: ["DATA_PARTO_NAO_COMPROVADA"] });
});
it("vaca histórica sem disparo pós-parto ativo não exige a data nem usa os critérios da novilha", () => {
  expect(avaliarCriteriosAptidao({ ...entrada, classeReprodutiva: "VACA", parto: null, diasAvaliacaoPosParto: null,
    vacas: grupo, novilhas: { ...grupo, idadeMinimaMeses: 15 } })).toMatchObject({ estado: "MANUAL", pendencias: [] });
});
