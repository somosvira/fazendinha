import { describe, it, expect } from "vitest";
import { AREAS_IDS, PAPEIS, aplicarPreset, temArea, temPermissao } from "./papeis.js";

describe("papeis", () => {
  it("proprietario tem todas as flags", () => {
    expect(PAPEIS.proprietario.flags).toContain("gerenciarAcessos");
    expect(PAPEIS.proprietario.flags).toContain("verSalarios");
  });

  it("aplicarPreset devolve cópias (mutar o retorno não afeta o preset)", () => {
    const p = aplicarPreset("secretaria");
    p.abas.push("x");
    p.areas.push("rebanho");
    expect(PAPEIS.secretaria.abas).not.toContain("x");
    expect(PAPEIS.secretaria.areas).not.toContain("rebanho");
  });

  it("aplicarPreset de papel desconhecido → vazio", () => {
    expect(aplicarPreset("personalizado")).toEqual({ abas: [], areas: [], flags: [] });
  });

  it("temPermissao respeita a flag", () => {
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "lancar")).toBe(true);
    expect(temPermissao({ dono: false, flags: ["lancar"] }, "exportar")).toBe(false);
  });

  it("dono implica qualquer permissão", () => {
    expect(temPermissao({ dono: true, flags: [] }, "gerenciarAcessos")).toBe(true);
  });

  it("restringe áreas operacionais e preserva acesso total do dono", () => {
    expect(temArea({ dono: false, areas: ["rebanho"] }, "rebanho")).toBe(true);
    expect(temArea({ dono: false, areas: ["rebanho"] }, "agricultura")).toBe(false);
    expect(temArea({ dono: true, areas: [] }, "agricultura")).toBe(true);
    expect(PAPEIS.proprietario.areas).toEqual([...AREAS_IDS]);
  });
});
