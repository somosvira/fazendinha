// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConsultaPorSitio } from "./ConsultaPorSitio";
import { listarPropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("../../../api/propriedades", () => ({ listarPropriedades: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); setPropriedadeAtiva(null); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=partos"); });
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
it("seleciona sítio no consolidado, mantém seleção global e responde ao histórico", async () => {
  vi.mocked(listarPropriedades).mockResolvedValue([{ id: 7, nome: "Escola" }, { id: 8, nome: "Destino" }].map(s => ({ ...s, apelido: null, cidade: null, uf: null, principal: s.id === 7, ativo: true, ordem: s.id })));
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  expect(screen.queryByRole("combobox", { name: "Sítio da consulta" })).toBeNull();
  await screen.findByText("Em qual sítio você quer trabalhar?");
  fireEvent.click(await screen.findByRole("button", {name:/Escola/}));
  await screen.findByText("Dados 7");
  expect(screen.queryByRole("region", {name:"Seleção do sítio"})).toBeNull();
  expect(listarPropriedades).toHaveBeenCalledTimes(1);
  expect(getPropriedadeAtiva()).toBeNull();
  expect(window.location.search).toBe("?rotina=partos&sitio=7");
  window.history.pushState(null, "", "/pecuaria/reproducao?rotina=partos&sitio=8");
  fireEvent(window, new PopStateEvent("popstate"));
  await screen.findByText("Dados 8"); expect(screen.queryByText("Dados 7")).toBeNull();
});
it("não consulta sítio que não aparece na lista autorizada nem disfarça falha de leitura como ausência", async () => {
  window.history.replaceState(null, "", "/pecuaria/relatorios?sitio=999");
  vi.mocked(listarPropriedades).mockRejectedValueOnce(new Error("Falha ao carregar"));
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByRole("alert"); expect(screen.queryByText(/Nenhum sítio/)).toBeNull();
  vi.mocked(listarPropriedades).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum sítio disponível para consulta.");
  expect(screen.queryByText("Dados 999")).toBeNull();
});
it("usa sítio global diretamente sem montar outro seletor", () => {
  setPropriedadeAtiva(7);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  expect(screen.getByText("Dados 7")).toBeTruthy(); expect(listarPropriedades).not.toHaveBeenCalled();
});
it("preserva filtros e fragmento ao escolher o sítio no estado inicial", async () => {
  window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=indicadores&inicio=2026-01-01&fim=2026-10-17&sitio=999#periodos");
  vi.mocked(listarPropriedades).mockResolvedValue([{ id: 7, nome: "Escola", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 1 }, { id: 8, nome: "Destino", apelido: null, cidade: null, uf: null, principal: false, ativo: true, ordem: 2 }]);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  fireEvent.click(await screen.findByRole("button", { name: /Escola/ }));
  await screen.findByText("Dados 7");
  expect(window.location.search).toBe("?rotina=indicadores&inicio=2026-01-01&fim=2026-10-17&sitio=7");
  expect(window.location.hash).toBe("#periodos");
  expect(screen.queryByLabelText("Sítio da consulta")).toBeNull();
});
it("não substitui um sítio inválido da URL pelo único disponível silenciosamente", async () => {
  window.history.replaceState(null, "", "/pecuaria/relatorios?sitio=999");
  vi.mocked(listarPropriedades).mockResolvedValue([{ id: 7, nome: "Escola", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 1 }]);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByText(/O sítio do endereço não está disponível/);
  expect(screen.queryByText("Dados 7")).toBeNull();
  expect(screen.getByRole("button", { name: /Escola/ })).toBeTruthy();
});
