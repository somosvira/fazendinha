// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { IncluirAnimal } from "./IncluirAnimal";
import { obterCandidatos } from "./api";
vi.mock("./api", () => ({ obterCandidatos: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("apresenta impedimentos temporais do servidor e inclui somente candidato retornado", async () => {
  const finalidade = { estado: "COMPROVADA" as const, finalidadeId: "leite-antiga", aptidao: "LEITE" as const, dataOperacional: "2026-10-14", regra: "FINALIDADE_LEITE_V1" as const };
  const animal = { animalId: "leite", brinco: "001", nome: "Aurora", lactacaoId: null, pendencias: ["LACTACAO_NAO_INFORMADA"], finalidade };
  vi.mocked(obterCandidatos).mockResolvedValue({ itens: [animal], total: 1, pagina: 1, porPagina: 10, impedimentos: [
    { animalId: "c", brinco: "002", nome: null, codigo: "FINALIDADE_CORTE", motivo: "Corte na data consultada" },
    { animalId: "r", brinco: "003", nome: null, codigo: "FINALIDADE_REPRODUCAO", motivo: "Reprodução na data consultada" },
    { animalId: "a", brinco: "004", nome: null, codigo: "FINALIDADE_AUSENTE", motivo: "Finalidade ausente na data consultada" },
    { animalId: "f", brinco: "005", nome: null, codigo: "FINALIDADE_CONFLITANTE", motivo: "Finalidades sobrepostas na data consultada" },
  ] });
  const aoIncluir = vi.fn();
  render(<IncluirAnimal data="2026-10-14" propriedadeId={1} existentes={[]} aoIncluir={aoIncluir} aoFechar={vi.fn()} />);
  await screen.findByText("Aurora");
  expect(screen.getAllByRole("button", { name: "Incluir" })).toHaveLength(1);
  expect(screen.getByText("002: Corte na data consultada")).toBeTruthy();
  expect(screen.getByText("003: Reprodução na data consultada")).toBeTruthy();
  expect(screen.getByText("004: Finalidade ausente na data consultada")).toBeTruthy();
  expect(screen.getByText("005: Finalidades sobrepostas na data consultada")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Incluir" }));
  expect(aoIncluir).toHaveBeenCalledWith(animal);
  expect(obterCandidatos).toHaveBeenCalledWith("2026-10-14", "", 1, 1);
});
