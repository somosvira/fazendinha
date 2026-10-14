import { describe, expect, it } from "vitest";
import { compararExecucaoIatf, snapshotIatf } from "./iatf.calc.js";
import { protocoloSchema } from "./schemas.js";
const momento = new Date("2026-10-01T12:00:00Z");
const material = "00000000-0000-4000-8000-000000000001";
const produto = "00000000-0000-4000-8000-000000000002";
describe("planejado e realizado IATF", () => {
  it("afere produto, dose, unidade, via e horário preservando zero e ausência", () => {
    const p = snapshotIatf(
      {
        nome: "Aplicação",
        tipo: "APLICACAO",
        intervalo: 0,
        unidade: "DIAS",
        planoAplicacao: {
          produtoId: produto,
          dose: "2.000",
          unidadeDose: "ML",
          via: "IM",
        },
      },
      {},
      momento,
      momento,
      momento,
    );
    expect(
      compararExecucaoIatf(p, momento.toISOString(), {
        produtoId: produto,
        dose: "2",
        unidadeDose: "ML",
        via: "IM",
      }),
    ).toEqual({ aferido: true, diferencas: [] });
    expect(
      compararExecucaoIatf(p, "2026-10-01T13:00:00Z", {
        produtoId: null,
        dose: "3",
        unidadeDose: "L",
        via: null,
      }).diferencas.map((d) => d.campo),
    ).toEqual(["dataHora", "produtoId", "dose", "unidadeDose", "via"]);
  });
  it("mudança material, tipo ou quantidade é desvio explícito", () => {
    const p = snapshotIatf(
      {
        nome: "IA",
        tipo: "TENTATIVA",
        intervalo: 10,
        unidade: "DIAS",
        planoTentativa: { tipo: "IA", materialId: material, quantidade: 1 },
      },
      {},
      momento,
      momento,
      momento,
    );
    expect(
      compararExecucaoIatf(p, momento.toISOString(), {
        tipo: "TE",
        materialId: produto,
        quantidade: 2,
      }).diferencas.map((d) => d.campo),
    ).toEqual(["tipoTentativa", "materialId", "quantidade"]);
  });
  it("diagnóstico planejado não presume resultado positivo", () => {
    const p = snapshotIatf(
      {
        nome: "Diagnóstico",
        tipo: "AVALIACAO",
        intervalo: 20,
        unidade: "DIAS",
        planoAvaliacao: { tipo: "DIAGNOSTICO" },
      },
      {},
      momento,
      momento,
      momento,
    );
    expect(
      compararExecucaoIatf(p, momento.toISOString(), { resultado: "NEGATIVO" })
        .diferencas,
    ).toEqual([]);
    expect(
      compararExecucaoIatf(p, momento.toISOString(), { resultado: "POSITIVO" })
        .diferencas,
    ).toEqual([]);
    expect(
      compararExecucaoIatf(p, momento.toISOString(), { resultado: "SEXAGEM" })
        .diferencas[0].campo,
    ).toBe("tipoAvaliacao");
  });
  it("snapshot ausente ou parâmetros ausentes não significam execução conforme", () => {
    expect(compararExecucaoIatf(null, momento.toISOString(), {}).aferido).toBe(
      false,
    );
    const p = snapshotIatf(
      { nome: "IA legada", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS" },
      {},
      momento,
      momento,
      momento,
    );
    expect(compararExecucaoIatf(p, momento.toISOString(), {}).aferido).toBe(
      false,
    );
  });
  it("publicação exige planos compatíveis; rascunho pode conservar parâmetros pendentes", () => {
    const e = { nome: "IA", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS" };
    expect(
      protocoloSchema.safeParse({
        nome: "Protocolo",
        versao: 1,
        publicado: true,
        etapas: [e],
      }).success,
    ).toBe(false);
    expect(
      protocoloSchema.safeParse({
        nome: "Protocolo",
        versao: 1,
        publicado: false,
        etapas: [e],
      }).success,
    ).toBe(true);
    expect(
      protocoloSchema.safeParse({
        nome: "Protocolo",
        versao: 1,
        publicado: true,
        etapas: [
          {
            ...e,
            planoTentativa: { tipo: "IA", materialId: material, quantidade: 1 },
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      protocoloSchema.safeParse({
        nome: "Protocolo",
        versao: 1,
        publicado: false,
        etapas: [
          {
            ...e,
            tipo: "MANEJO",
            planoTentativa: { tipo: "IA", materialId: material, quantidade: 1 },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
it("tipos de exames diferentes exigem desvio sem prever o resultado clínico", () => {
  const p = snapshotIatf({ nome: "Ultrassom", tipo: "AVALIACAO", intervalo: 0, unidade: "DIAS", planoAvaliacao: { tipo: "DIAGNOSTICO", tipoExameId: produto } }, {}, momento, momento, momento);
  expect(compararExecucaoIatf(p, momento.toISOString(), { finalidade: "DIAGNOSTICO", tipoExameId: produto, resultado: "NEGATIVO" }).diferencas).toEqual([]);
  expect(compararExecucaoIatf(p, momento.toISOString(), { finalidade: "DIAGNOSTICO", tipoExameId: material, resultado: "POSITIVO" }).diferencas).toMatchObject([{ campo: "tipoExameId", planejado: produto, realizado: material }]);
});
