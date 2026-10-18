import { describe, expect, it } from "vitest";
import { podeConsultarCustosPecuaria, podeVerValoresFinanceiros } from "./permissoes.js";

describe("política dos custos operacionais da Pecuária", () => {
  it.each([
    { areas: ["pecuaria"], flags: [] },
    { areas: ["pecuaria"], flags: ["lancar"] },
    { areas: ["pecuaria", "financeiro"], flags: [] },
    { areas: ["rebanho"], flags: [] },
  ])("permite leitura sem conceder visibilidade financeira: %j", permissoes => {
    const usuario = { dono: false, ...permissoes };
    expect(podeConsultarCustosPecuaria(usuario)).toBe(true);
    expect(podeVerValoresFinanceiros(usuario)).toBe(false);
  });

  it("nega leitura sem sessão/área e conserva privilégios financeiros existentes", () => {
    expect(podeConsultarCustosPecuaria(null)).toBe(false);
    expect(podeConsultarCustosPecuaria({ dono: false, areas: ["financeiro"], flags: ["verValores"] })).toBe(false);
    expect(podeVerValoresFinanceiros({ dono: false, areas: ["financeiro"], flags: ["verValores"] })).toBe(true);
    expect(podeConsultarCustosPecuaria({ dono: true, areas: [], flags: [] })).toBe(true);
  });
});
