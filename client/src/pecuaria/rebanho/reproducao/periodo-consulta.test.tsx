// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { buildPresets, isoDate } from "../../../components/DateRangePicker";
import { periodoPadrao, usePeriodoConsulta } from "./periodo-consulta";
vi.mock("../../../lib/hoje", () => ({ getHoje: () => new Date(2026, 9, 17) }));
beforeEach(() => window.history.replaceState({ contexto: "preservado" }, "", "/pecuaria/reproducao?rotina=indicadores&sitio=7#periodos"));
afterEach(cleanup);
it("preserva os padrões de 90 dias inclusivos e doze meses até hoje sem escrever datas implícitas", () => {
  expect(periodoPadrao("partos")).toEqual({ inicio: "2026-07-20", fim: "2026-10-17" });
  const { result } = renderHook(() => usePeriodoConsulta("indicadores"));
  expect(result.current).toMatchObject({ inicio: "2025-11-01", fim: "2026-10-17", aviso: null });
  expect(window.location.search).toBe("?rotina=indicadores&sitio=7");
});
it("Ano atual termina hoje na consulta e no intervalo apresentado, preservando query, hash e history state", () => {
  const { result } = renderHook(() => usePeriodoConsulta("indicadores"));
  const ano = buildPresets(new Date(2026, 9, 17)).find(p => p.id === "ano-atual")!;
  act(() => result.current.alterar(ano.range));
  expect(result.current).toMatchObject({ inicio: "2026-01-01", fim: "2026-10-17" });
  expect(isoDate(result.current.range.end!)).toBe("2026-10-17");
  expect(result.current.aviso).toMatch(/limitado a hoje/);
  expect(window.location.search).toBe("?rotina=indicadores&sitio=7&inicio=2026-01-01&fim=2026-10-17");
  expect(window.location.hash).toBe("#periodos");
  expect(window.history.state).toEqual({ contexto: "preservado" });
});
it.each([
  ["2026-01-01", "2027-01-01", "2026-01-01"],
  ["2027-01-01", "2027-02-01", "2026-10-17"],
])("limita URL futura %s a %s antes de expor datas ao consumidor", (inicio, fim, esperado) => {
  window.history.replaceState(null, "", `?inicio=${inicio}&fim=${fim}&sitio=8#dados`);
  const consultas: string[] = [];
  const { result } = renderHook(() => { const periodo = usePeriodoConsulta("indicadores"); consultas.push(periodo.fim); return periodo; });
  expect(consultas.every(data => data <= "2026-10-17")).toBe(true);
  expect(result.current).toMatchObject({ inicio: esperado, fim: "2026-10-17" });
  expect(new URLSearchParams(window.location.search).get("fim")).toBe("2026-10-17");
  expect(window.location.hash).toBe("#dados");
});
it.each([
  ["2026-02-30", "2026-03-10"], ["2026-10-18", "2026-10-01"],
  ["2026-2-01", "2026-03-01"], ["2026-01-01", ""],
])("não aceita ISO inválido ou intervalo invertido: %s a %s", (inicio, fim) => {
  window.history.replaceState(null, "", `?inicio=${inicio}&fim=${fim}&sitio=7`);
  const { result } = renderHook(() => usePeriodoConsulta("partos"));
  expect(result.current).toMatchObject(periodoPadrao("partos"));
  expect(result.current.aviso).toMatch(/inválido/);
  expect(new URLSearchParams(window.location.search).get("inicio")).toBe("2026-07-20");
});
it("recupera período multianual e intervalo bissexto no histórico, sem manter consulta futura", () => {
  const { result } = renderHook(() => usePeriodoConsulta("indicadores"));
  act(() => { window.history.pushState(null, "", "?inicio=2024-02-29&fim=2026-02-01&sitio=8#dados"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current).toMatchObject({ inicio: "2024-02-29", fim: "2026-02-01", aviso: null });
  act(() => { window.history.pushState(null, "", "?inicio=2026-01-01&fim=2028-01-01&sitio=7"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current.fim).toBe("2026-10-17");
  act(() => { window.history.pushState(null, "", "/pecuaria/reproducao?rotina=indicadores"); window.dispatchEvent(new PopStateEvent("popstate")); });
  expect(result.current).toMatchObject({ ...periodoPadrao("indicadores"), aviso: null });
});
it("ignora seleção incompleta, inválida ou invertida", () => {
  const { result } = renderHook(() => usePeriodoConsulta("partos"));
  act(() => result.current.alterar({ start: null, end: new Date(2026, 0, 1) }));
  act(() => result.current.alterar({ start: new Date("inválida"), end: new Date(2026, 0, 1) }));
  act(() => result.current.alterar({ start: new Date(2026, 1, 1), end: new Date(2026, 0, 1) }));
  expect(result.current).toMatchObject(periodoPadrao("partos"));
  expect(window.location.search).toBe("?rotina=indicadores&sitio=7");
});

it("mantém aviso de limite sob StrictMode após normalizar a URL", () => {
  window.history.replaceState(null, "", "?inicio=2026-01-01&fim=2027-01-01");
  const { result } = renderHook(() => usePeriodoConsulta("indicadores"), { wrapper: StrictMode });
  expect(result.current.aviso).toMatch(/limitado a hoje/);
  expect(result.current.fim).toBe("2026-10-17");
});
