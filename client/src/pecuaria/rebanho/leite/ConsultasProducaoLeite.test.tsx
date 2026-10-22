// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsultasProducaoLeite } from "./ConsultasProducaoLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
vi.mock("./RitmoLeite", () => ({ RitmoLeite: () => null }));
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null, "", "/"); });
it("abre mês pela URL e muda para dia sem perder parâmetro externo", async () => {
  history.replaceState(null, "", "/?leiteSecao=producao&producaoData=2026-10-31&producaoVisao=mes");
  vi.mocked(consultarLeite).mockResolvedValue({ itens: [{ data: "2026-10-31", animalId: "a", brinco: "123", nome: null, ordenha: "Manhã", natureza: "A_CLASSIFICAR", estado: "MEDIDO", litros: 10 }], total: 1, tamanho: 30, mesEmAndamento: true, coberturaCompleta: false, totais: { litros: 10 }, ritmo: [] });
  render(<ConsultasProducaoLeite />);
  await screen.findByText("A classificar");
  expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("inicio=2026-10-01&fim=2026-10-31"), 2);
  fireEvent.change(screen.getByLabelText("Consultar produção por"), { target: { value: "dia" } });
  await waitFor(() => expect(consultarLeite).toHaveBeenLastCalledWith(expect.stringContaining("inicio=2026-10-31&fim=2026-10-31"), 2));
  expect(location.search).toContain("leiteSecao=producao");
  expect(screen.getByText(/Produção parcial/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Exportar produção do período" })).toBeNull();
});
it("preserva litros legados pendentes ao lado da evidência histórica comprovada", async () => {
  const linha = { data: "2026-10-14", animalId: "a", brinco: "123", nome: null, ordenha: "Manhã", natureza: "A_CLASSIFICAR", estado: "MEDIDO", litros: 10, confirmada: false };
  vi.mocked(consultarLeite).mockResolvedValue({ itens: [
    { ...linha, finalidade: { estado: "COMPROVADA", finalidadeId: "f", aptidao: "LEITE", dataOperacional: linha.data, regra: "FINALIDADE_LEITE_V1" } },
    { ...linha, animalId: "b", brinco: "456", litros: 8, finalidade: { estado: "PENDENTE_CONCILIACAO", finalidadeId: null, aptidao: null, dataOperacional: linha.data, regra: null } },
  ], total: 2, tamanho: 30, mesEmAndamento: false, coberturaCompleta: false, totais: { litros: 18 }, ritmo: [] });
  render(<ConsultasProducaoLeite />);
  await screen.findByText("18 L medidos no período");
  expect(screen.getByText("Leite comprovada na data")).toBeTruthy();
  expect(screen.getByText("Finalidade histórica a conciliar")).toBeTruthy();
  expect(screen.getByText("8 L")).toBeTruthy();
});
