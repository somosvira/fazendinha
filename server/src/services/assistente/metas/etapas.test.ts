import { describe, it, expect } from "vitest";
import { conferirEtapasMedicao, definicaoSchema } from "./regras.js";
const etapas = [
  { id: "10000000-0000-4000-8000-000000000001", titulo: "Equipamento" },
  { id: "10000000-0000-4000-8000-000000000002", titulo: "Instalação" },
];
const marco = {
  titulo: "Ordenha",
  indicadorId: "marco_operacional",
  indicadorVersao: 1,
  tipo: "marco" as const,
  minimo: null,
  maximo: null,
  periodo: "ciclo",
  prazo: "2027-01-01",
  fonte: "manual",
  observacao: "",
  etapas,
};
describe("etapas de marco", () => {
  it("aceita medições parciais e conclusão integral sem percentual", () => {
    expect(() =>
      conferirEtapasMedicao(marco, {
        concluido: false,
        etapasConcluidas: [etapas[0]!.id],
      }),
    ).not.toThrow();
    expect(() =>
      conferirEtapasMedicao(marco, {
        concluido: true,
        etapasConcluidas: etapas.map((e) => e.id),
      }),
    ).not.toThrow();
  });
  it("recusa IDs alheios, duplicatas e conclusão incoerente", () => {
    expect(() =>
      conferirEtapasMedicao(marco, {
        concluido: false,
        etapasConcluidas: ["10000000-0000-4000-8000-000000000003"],
      }),
    ).toThrow("pertence");
    expect(() =>
      conferirEtapasMedicao(marco, {
        concluido: true,
        etapasConcluidas: [etapas[0]!.id, etapas[0]!.id],
      }),
    ).toThrow("repetida");
    expect(() =>
      conferirEtapasMedicao(marco, { concluido: true, etapasConcluidas: [] }),
    ).toThrow("todas");
    expect(() =>
      conferirEtapasMedicao(marco, {
        concluido: false,
        etapasConcluidas: etapas.map((e) => e.id),
      }),
    ).toThrow("todas");
  });
  it("não admite etapas numéricas, mais de20 ou IDs repetidos na definição", () => {
    expect(
      definicaoSchema.safeParse({ ...marco, etapas: [etapas[0], etapas[0]] })
        .success,
    ).toBe(false);
    expect(
      definicaoSchema.safeParse({ ...marco, etapas: Array(21).fill(etapas[0]) })
        .success,
    ).toBe(false);
    expect(
      definicaoSchema.safeParse({
        ...marco,
        tipo: "minimo",
        indicadorId: "leite_volume",
        minimo: 1,
      }).success,
    ).toBe(false);
    expect(() =>
      conferirEtapasMedicao(
        { tipo: "minimo" },
        { concluido: null, etapasConcluidas: [] },
      ),
    ).toThrow("numéricos");
  });
  it("preserva compatibilidade de marcos anteriores sem etapas", () => {
    expect(() =>
      conferirEtapasMedicao({ tipo: "marco" }, { concluido: true }),
    ).not.toThrow();
    expect(
      definicaoSchema.safeParse({ ...marco, etapas: undefined }).success,
    ).toBe(true);
  });
});
