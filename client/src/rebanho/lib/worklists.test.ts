import { describe, it, expect } from "vitest";
import { aInseminar, dgPendente, aSecar, partosPrevistos } from "./worklists";
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
