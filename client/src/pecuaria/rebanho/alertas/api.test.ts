// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarAlertas, consultarParticipantes, resumirAlertas } from "./api";

afterEach(() => { setPropriedadeAtiva(null); vi.unstubAllGlobals(); });
describe("escopo das consultas de alertas", () => {
  it("prioriza o sítio explícito da ficha sobre o selecionado na sidebar nas três consultas", async () => {
    setPropriedadeAtiva(1);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const filtros = { animalId: "animal-ficha", propriedadeId: 2 };
    await consultarAlertas(filtros);
    await resumirAlertas(filtros);
    await consultarParticipantes("cuidado", filtros);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toContain("animalId=animal-ficha");
      expect(url).toContain("propriedadeId=2");
      expect(init.headers["X-Propriedade-Id"]).toBe("2");
    }
  });
  it("mantém o sítio da sidebar quando a consulta não informa outro", async () => {
    setPropriedadeAtiva(1);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await consultarAlertas({ animalId: "animal-ficha" });
    expect(fetchMock.mock.calls[0][1].headers["X-Propriedade-Id"]).toBe("1");
  });
});
