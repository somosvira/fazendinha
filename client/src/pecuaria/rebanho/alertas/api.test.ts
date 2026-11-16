// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { consultarAlertas, consultarParticipantes, resumirAlertas, decidirAlertaReprodutivo, registrarRetiradaFisica } from "./api";

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

it("filtra produtor e tipo reprodutivos sem alterar os parâmetros de sítio", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal("fetch", fetchMock);
  await consultarAlertas({ produtor: "reproducao", tipo: "DG_VENCIDO", propriedadeId: 2 });
  expect(fetchMock.mock.calls[0][0]).toContain("produtor=reproducao"); expect(fetchMock.mock.calls[0][0]).toContain("tipo=DG_VENCIDO"); expect(fetchMock.mock.calls[0][1].headers["X-Propriedade-Id"]).toBe("2");
});

it("separa decisão administrativa do fato físico na API e preserva escopo explícito", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal("fetch", fetchMock);
  await decidirAlertaReprodutivo("alerta", { chave: "chave", propriedadeId: 2, revisao: 4, tipo: "SUSPENDER", motivo: "Até conferência", data: "2099-01-01", destino: "Veterinário" });
  await registrarRetiradaFisica("insercao", { chave: "outra", propriedadeId: 2, realizadaEm: "2026-10-01", confirmarRetiradaFisica: true, observacao: "Remoção realizada" });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/alertas/alerta/decisao-reprodutiva");
  expect(fetchMock.mock.calls[1][0]).toBe("/api/pecuaria/rebanho/sanidade/dispositivos/insercao/retirada");
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("participacaoId");
  for (const [, init] of fetchMock.mock.calls) { expect(init.method).toBe("POST"); expect(init.headers["X-Propriedade-Id"]).toBe("2"); }
});
