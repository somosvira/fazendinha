// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarConsultaComSitio, urlConsultaComSitio } from "./contexto-consulta";
beforeEach(() => { setPropriedadeAtiva(null); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=indicadores&sitio=8&inicio=2025-01-01#origem"); });
afterEach(() => { setPropriedadeAtiva(null); vi.restoreAllMocks(); });
it("transporta seleção local sem copiar filtros de outra tela nem perder query e hash do destino", () => {
  expect(urlConsultaComSitio("/pecuaria/relatorios?tipo=indicadores#emissoes")).toBe("/pecuaria/relatorios?tipo=indicadores&sitio=8#emissoes");
});
it("prioriza sítio efetivo explícito e global sobre a seleção local anterior", () => {
  setPropriedadeAtiva(7);
  expect(urlConsultaComSitio("/pecuaria/relatorios")).toBe("/pecuaria/relatorios?sitio=7");
  expect(urlConsultaComSitio("/configuracoes/pecuaria/reproducao/politica", 9)).toBe("/configuracoes/pecuaria/reproducao/politica?sitio=9");
});
it.each(["-1", "abc", "0", "8x", "99999999999999999999"])("ignora identificador local inválido %s", sitio => {
  window.history.replaceState(null, "", `?sitio=${sitio}`);
  expect(urlConsultaComSitio("/pecuaria/relatorios")).toBe("/pecuaria/relatorios");
});
it("navega pelo roteador leve notificando consumidores e conserva a seleção global", () => {
  const mudou = vi.fn(); window.addEventListener("popstate", mudou);
  navegarConsultaComSitio("/pecuaria/relatorios?tipo=partos#emissoes");
  expect(window.location.pathname + window.location.search + window.location.hash).toBe("/pecuaria/relatorios?tipo=partos&sitio=8#emissoes");
  expect(mudou).toHaveBeenCalledTimes(1);
  window.removeEventListener("popstate", mudou);
});
