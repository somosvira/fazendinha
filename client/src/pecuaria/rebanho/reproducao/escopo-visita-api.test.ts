import { afterEach, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { buscarFichaAnimal, listarAnimais, listarGenitores, listarLotes, listarMaterialGenetico } from "../api";
import { listarTiposAplicacao, listarComprasDiretas } from "../sanidade/api";
import { listarPartidasNutricionais } from "../nutricao/api";
import { listarProdutos } from "../../../estoque/api";
import { reqV4 } from "./api";
import { obterSugestoesVisita } from "./visitas-api";
import { previaGrupo } from "./planner-api";
afterEach(() => { setPropriedadeAtiva(null); vi.unstubAllGlobals(); });
it.each([99, null])("o sítio da visita prevalece sobre a seleção global %s em todos os catálogos", async (ativo) => {
  setPropriedadeAtiva(ativo);
  const fetch = vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  await reqV4("/visitas/v", undefined, "GET", 7);
  await listarAnimais({}, 7);
  await buscarFichaAnimal("a", undefined, 7);
  await listarGenitores({}, 7);
  await listarLotes(undefined, 7);
  await listarMaterialGenetico({}, 7);
  await listarTiposAplicacao(7);
  await listarComprasDiretas(7);
  await listarPartidasNutricionais("p", 7);
  await listarProdutos({}, 7);
  await obterSugestoesVisita("2026-10-14", {}, 7);
  await previaGrupo(7, "2026-10-14", { origem: "PROTOCOLO", identidade: "a".repeat(64) });
  for (const chamada of fetch.mock.calls as unknown as [string, RequestInit][]) {
    expect(new Headers(chamada[1].headers).get("X-Propriedade-Id")).toBe("7");
  }
  const [url, init] = fetch.mock.calls.at(-1)! as unknown as [string, RequestInit];
  expect(url).toContain("/visitas/planner/previa?");
  expect(init.method).toBe("GET");
});
it("mantém o escopo global quando o chamador não fornece substituição", async () => {
  setPropriedadeAtiva(99);
  const fetch = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await listarAnimais({});
  expect(new Headers((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get("X-Propriedade-Id")).toBe("99");
});
