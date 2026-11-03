import { describe, expect, it } from "vitest";
import { iaPrevistaNoModelo } from "./historico-participacao.calc.js";

describe("IA prevista na versão do modelo", () => {
  it("não exige IA de modelo preparatório ou TETF com apenas TE declarada", () => {
    expect(iaPrevistaNoModelo([{ tipo: "APLICACAO", configuracao: {} }, { tipo: "MANEJO", configuracao: {} }])).toBe(false);
    expect(iaPrevistaNoModelo([{ tipo: "TENTATIVA", configuracao: { tentativaTipo: "TE" } }])).toBe(false);
  });
  it("usa o tipo factual configurado mesmo quando o nome sugeriria o contrário", () => {
    expect(iaPrevistaNoModelo([{ tipo: "TENTATIVA", configuracao: { tentativaTipo: "IA" } }])).toBe(true);
    expect(iaPrevistaNoModelo([{ tipo: "TENTATIVA", configuracao: { planoTentativa: { tipo: "TE" } } }])).toBe(false);
  });
  it("preserva desconhecimento quando a versão não tem etapas ou tentativa sem tipo", () => {
    expect(iaPrevistaNoModelo([])).toBeNull();
    expect(iaPrevistaNoModelo([{ tipo: "TENTATIVA", configuracao: null }])).toBeNull();
    expect(iaPrevistaNoModelo([{ tipo: "TENTATIVA", configuracao: { tentativaTipo: "TE", planoTentativa: { tipo: "IA" } } }])).toBeNull();
  });
});
