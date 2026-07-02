import { describe, it, expect } from "vitest";
import { aInseminar, dgPendente, aSecar, partosPrevistos, aDesmamar, criterioDesmame } from "./worklists";
import type { ResumoAnimal } from "../types";
import { resumos } from "../mock/animais";

const HOJE = "2026-06-16";

describe("aInseminar", () => {
  it("inclui PEV e VAZIA (aptas a inseminar)", () => {
    const ids = aInseminar(resumos).map((r) => r.animalId).sort();
    expect(ids).toEqual(["0877", "0942", "1188", "1305", "1421"]);
  });
  it("não inclui prenhes", () => {
    expect(aInseminar(resumos).some((r) => r.statusReprodutivo === "PRENHE")).toBe(false);
  });
});

describe("dgPendente", () => {
  it("inclui apenas INSEMINADA", () => {
    const so = [{ animalId: "x", statusReprodutivo: "INSEMINADA" as const }];
    expect(dgPendente(so as any).map((r) => r.animalId)).toEqual(["x"]);
    expect(dgPendente(resumos).length).toBe(0);
  });
});

describe("aSecar", () => {
  it("nenhuma prenhe tem secagem vencida no mock (regra: previsaoSecagem ≤ hoje)", () => {
    expect(aSecar(resumos, HOJE)).toHaveLength(0);
  });
});

describe("partosPrevistos", () => {
  it("prenhes com gestação avançada entram", () => {
    expect(partosPrevistos(resumos).every((r) => r.statusReprodutivo === "PRENHE")).toBe(true);
  });
});

// ── A desmamar (parâmetro DESMAME_MODO / DESMAME_DIAS / DESMAME_PESO_KG) ────

const cria = (over: Partial<ResumoAnimal>): ResumoAnimal =>
  ({ animalId: "x", statusReprodutivo: "VAZIA", ...over }) as ResumoAnimal;

const rebanhoDesmame: ResumoAnimal[] = [
  // bezerra de 150 dias, 190 kg → entra nos dois modos
  cria({ animalId: "b1", categoria: "BEZERRA", dataNascimento: "2026-01-17", ultimoPesoKg: 190 }),
  // bezerro de 60 dias, 100 kg → não entra em nenhum modo
  cria({ animalId: "b2", categoria: "BEZERRO", dataNascimento: "2026-04-17", ultimoPesoKg: 100 }),
  // bezerra de 130 dias SEM pesagem → entra por DIAS; por PESO fica de fora (conta em semPeso)
  cria({ animalId: "b3", categoria: "BEZERRA", dataNascimento: "2026-02-06" }),
  // bezerro SEM data de nascimento, 200 kg → entra por PESO; por DIAS fica de fora
  cria({ animalId: "b4", categoria: "BEZERRO", dataNascimento: null, ultimoPesoKg: 200 }),
  // cabrita de 140 dias → espécie caprina também é candidata
  cria({ animalId: "c1", categoria: "CABRITA", dataNascimento: "2026-01-27", ultimoPesoKg: 30 }),
  // vaca adulta com peso alto → categoria errada, nunca entra
  cria({ animalId: "v1", categoria: "VACA", dataNascimento: "2020-01-01", ultimoPesoKg: 520 }),
];

describe("aDesmamar", () => {
  it("modo DIAS: crias com idade ≥ limite entram; sem dataNascimento fica de fora", () => {
    const r = aDesmamar(rebanhoDesmame, { modo: "DIAS", dias: 120, pesoKg: 180 }, HOJE);
    expect(r.lista.map((x) => x.animalId).sort()).toEqual(["b1", "b3", "c1"]);
    expect(r.semPeso).toBe(0); // contagem de sem-pesagem só interessa no modo PESO
  });

  it("modo PESO: crias com último peso ≥ limite entram; sem pesagem fica de fora e é contada", () => {
    const r = aDesmamar(rebanhoDesmame, { modo: "PESO", dias: 120, pesoKg: 180 }, HOJE);
    expect(r.lista.map((x) => x.animalId).sort()).toEqual(["b1", "b4"]);
    expect(r.semPeso).toBe(1); // b3 não tem pesagem registrada
  });

  it("categoria errada (adultos) nunca entra, mesmo acima dos limites", () => {
    const dias = aDesmamar(rebanhoDesmame, { modo: "DIAS", dias: 120, pesoKg: 180 }, HOJE);
    const peso = aDesmamar(rebanhoDesmame, { modo: "PESO", dias: 120, pesoKg: 180 }, HOJE);
    expect([...dias.lista, ...peso.lista].some((x) => x.animalId === "v1")).toBe(false);
  });

  it("limites vêm do critério (parametrizado, não hardcoded)", () => {
    const r = aDesmamar(rebanhoDesmame, { modo: "DIAS", dias: 200, pesoKg: 180 }, HOJE);
    expect(r.lista).toHaveLength(0);
    const p = aDesmamar(rebanhoDesmame, { modo: "PESO", dias: 120, pesoKg: 195 }, HOJE);
    expect(p.lista.map((x) => x.animalId)).toEqual(["b4"]);
  });
});

describe("criterioDesmame", () => {
  it("sem parâmetros → defaults Embrapa (DIAS / 120 / 180)", () => {
    expect(criterioDesmame(null)).toEqual({ modo: "DIAS", dias: 120, pesoKg: 180 });
    expect(criterioDesmame(undefined)).toEqual({ modo: "DIAS", dias: 120, pesoKg: 180 });
    expect(criterioDesmame([])).toEqual({ modo: "DIAS", dias: 120, pesoKg: 180 });
  });

  it("lê modo e valores da lista de parâmetros da API", () => {
    const params = [
      { chave: "DESMAME_MODO", valorNumero: null, modo: "PESO" },
      { chave: "DESMAME_DIAS", valorNumero: 150, modo: null },
      { chave: "DESMAME_PESO_KG", valorNumero: 200, modo: null },
    ];
    expect(criterioDesmame(params)).toEqual({ modo: "PESO", dias: 150, pesoKg: 200 });
  });

  it("modo desconhecido ou nulo cai em DIAS", () => {
    expect(criterioDesmame([{ chave: "DESMAME_MODO", valorNumero: null, modo: "XYZ" }]).modo).toBe("DIAS");
    expect(criterioDesmame([{ chave: "DESMAME_MODO", valorNumero: null, modo: null }]).modo).toBe("DIAS");
  });
});
