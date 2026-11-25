// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConsultaPorSitio } from "./ConsultaPorSitio";
import { listarPropriedades } from "../../../api/propriedades";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("../../../api/propriedades", () => ({ listarPropriedades: vi.fn() }));
const sitio = (id: number, nome: string, ativo = true) => ({ id, nome, apelido: null, cidade: null, uf: null, principal: id === 7, ativo, ordem: id });
beforeEach(() => { vi.resetAllMocks(); setPropriedadeAtiva(null); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=partos"); });
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });
it("no consolidado com vários sítios orienta a escolha pela sidebar sem assumir um sítio", async () => {
  vi.mocked(listarPropriedades).mockResolvedValue([sitio(7, "Escola"), sitio(8, "Destino")]);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByRole("heading", { name: "Escolha um sítio na barra lateral" });
  expect(screen.queryByText(/Dados/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Escola/ })).toBeNull();
  expect(getPropriedadeAtiva()).toBeNull();
});
it("ignora sítio vindo do endereço: o escopo é só o da sidebar", async () => {
  window.history.replaceState(null, "", "/pecuaria/relatorios?sitio=8");
  vi.mocked(listarPropriedades).mockResolvedValue([sitio(7, "Escola"), sitio(8, "Destino")]);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByRole("heading", { name: "Escolha um sítio na barra lateral" });
  expect(screen.queryByText("Dados 8")).toBeNull();
});
it("com um único sítio ativo consulta esse sítio direto", async () => {
  vi.mocked(listarPropriedades).mockResolvedValue([sitio(7, "Escola"), sitio(8, "Arquivado", false)]);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByText("Dados 7");
});
it("não disfarça falha de leitura como ausência de sítios", async () => {
  vi.mocked(listarPropriedades).mockRejectedValueOnce(new Error("Falha ao carregar"));
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  await screen.findByRole("alert"); expect(screen.queryByText(/Nenhum sítio/)).toBeNull();
  vi.mocked(listarPropriedades).mockResolvedValue([]);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Nenhum sítio disponível para consulta.");
});
it("usa sítio global diretamente sem consultar a lista", () => {
  setPropriedadeAtiva(7);
  render(<ConsultaPorSitio>{id => <p>Dados {id}</p>}</ConsultaPorSitio>);
  expect(screen.getByText("Dados 7")).toBeTruthy(); expect(listarPropriedades).not.toHaveBeenCalled();
});
