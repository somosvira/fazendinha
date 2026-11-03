// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ControlesDocumentaisAnimal } from "./ControlesDocumentaisAnimal";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("preserva kg, parcelas e origem sem convertê-los em litros operacionais", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ animal: { brinco: "123", nome: null }, itens: [], total: 0, tamanho: 100, controlesDocumentais: [{
    id: "doc", inicio: "2026-10-02", fim: "2026-10-02", total: "22.4", unidade: "KG", referenciaUnidade: "Peso informado no documento", versao: 2,
    parcelas: [{ rotulo: "Manhã", hora: null, quantidade: 0 }], lactacaoId: null, origem: { banco: "IDEAGRI", chave: "CONTROLE:0001", evidencia: "Original conferido" },
  }] });
  render(<ControlesDocumentaisAnimal animalId="animal" propriedadeId={3}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Ver origem" }));
  const modal = screen.getByRole("dialog");
  expect(within(modal).getByText("22,4 kg")).toBeTruthy();
  expect(within(modal).getByText("0 kg")).toBeTruthy();
  expect(within(modal).getByText("CONTROLE:0001")).toBeTruthy();
  expect(within(modal).getByText("Peso informado no documento")).toBeTruthy();
  expect(within(modal).getByText("Sem lactação comprovada")).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledTimes(1);
  expect(vi.mocked(consultarLeite).mock.calls[0][1]).toBe(3);
});
it("falha documental é recuperável e não é confundida com vazio", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Falha documental")).mockResolvedValue({ itens: [], total: 0, tamanho: 100, controlesDocumentais: [] });
  render(<ControlesDocumentaisAnimal animalId="animal" propriedadeId={3}/>);
  await screen.findByText("Falha documental");
  expect(screen.queryByText("Nenhum controle histórico no período")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Nenhum controle histórico no período")).toBeTruthy();
});
