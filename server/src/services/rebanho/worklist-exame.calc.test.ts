import { describe, it, expect } from "vitest";
import { precisaExame, type AnimalExame, EXAME_VALIDADE_DIAS } from "./worklist-exame.calc.js";

const HOJE = "2026-07-19";
const base: AnimalExame = { animalId: 1, statusReprodutivo: "VAZIA", del: 90, ultimoExameGinecologico: null };

describe("precisaExame", () => {
  it("vaca vazia além do PEV sem exame → precisa", () => {
    expect(precisaExame({ ...base }, 60, HOJE)).toBe(true);
  });

  it("vaca vazia mas dentro do PEV → não precisa ainda", () => {
    expect(precisaExame({ ...base, del: 30 }, 60, HOJE)).toBe(false);
  });

  it("gestante confirmada → não precisa", () => {
    expect(precisaExame({ ...base, statusReprodutivo: "GESTANTE" }, 60, HOJE)).toBe(false);
  });

  it("status PRENHE (vocabulário do dashboard) → não precisa", () => {
    expect(precisaExame({ ...base, statusReprodutivo: "PRENHE" }, 60, HOJE)).toBe(false);
  });

  it("status INSEMINADA (aguardando DG, não palpação de rotina) → não precisa", () => {
    expect(precisaExame({ ...base, statusReprodutivo: "INSEMINADA" }, 60, HOJE)).toBe(false);
  });

  it("exame recente (< validade) → não precisa", () => {
    expect(precisaExame({ ...base, ultimoExameGinecologico: "2026-06-20" }, 60, HOJE)).toBe(false);
  });

  it("exame antigo (> validade) → precisa de novo", () => {
    expect(precisaExame({ ...base, ultimoExameGinecologico: "2026-01-10" }, 60, HOJE)).toBe(true);
  });

  it("validade padrão é 60 dias", () => {
    expect(EXAME_VALIDADE_DIAS).toBe(60);
  });
});
