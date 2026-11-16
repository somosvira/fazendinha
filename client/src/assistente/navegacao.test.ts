import { expect, it } from "vitest";
import { pathToTab, tabToPath, normalizarRotaPecuaria } from "../router";
import { podeAcessarTab } from "../navegacaoAuth";
import { buscar, COMANDOS } from "../lib/searchIndex";
const u = {
  id: 4,
  nome: "Ana",
  email: "ana@teste.local",
  papel: "consulta",
  status: "ATIVO",
  dono: false,
  abas: [],
  areas: ["pecuaria"],
  flags: [],
};
it("IA tem rota própria acessível à pecuária sem liberar o legado", () => {
  expect(pathToTab("/assistente")).toBe("assistente");
  expect(tabToPath("assistente")).toBe("/assistente");
  expect(podeAcessarTab(u, "assistente")).toBe(true);
  expect(podeAcessarTab({ ...u, status: "INATIVO" }, "assistente")).toBe(false);
  expect(pathToTab("/ia")).not.toBe("assistente");
});
it("busca localiza Radar e Metas nos seus destinos exatos", () => {
  expect(
    buscar(COMANDOS, "radar").some(
      (c) => c.caminho === "/assistente?aba=radar",
    ),
  ).toBe(true);
  expect(buscar(COMANDOS, "metas").some((c) => c.caminho === "/metas")).toBe(
    true,
  );
});

it("Metas tem página própria sem depender de permissão financeira", () => {
  expect(pathToTab("/metas")).toBe("metas");
  expect(tabToPath("metas")).toBe("/metas");
  expect(podeAcessarTab(u, "metas")).toBe(true);
});

it("antigo atalho de Metas da IA redireciona para a página independente", () => {
  expect(normalizarRotaPecuaria("/assistente?aba=metas")).toBe("/metas");
});
