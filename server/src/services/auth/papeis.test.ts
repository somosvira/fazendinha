import { describe, it, expect } from "vitest";
import { PAPEIS, aplicarPreset, temPermissao } from "./papeis.js";

describe("papeis", () => {
  it("proprietario tem todas as flags", () => {
    expect(PAPEIS.proprietario.flags).toContain("gerenciarAcessos");
    expect(PAPEIS.proprietario.flags).toContain("verSalarios");
  });

  it("aplicarPreset devolve cópias (mutar o retorno não afeta o preset)", () => {
    const p = aplicarPreset("secretaria");
    p.abas.push("x");
    expect(PAPEIS.secretaria.abas).not.toContain("x");
  });

  it("aplicarPreset de papel desconhecido → vazio", () => {
    expect(aplicarPreset("personalizado")).toEqual({ abas: [], flags: [] });
  });

  it("temPermissao respeita a flag", () => {
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "lancar")).toBe(true);
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "exportar")).toBe(false);
  });

  it("dono implica qualquer permissão", () => {
    expect(temPermissao({ dono: true, flags: [] }, "gerenciarAcessos")).toBe(true);
  });
});
