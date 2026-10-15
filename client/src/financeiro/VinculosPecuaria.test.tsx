// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { VinculosPecuaria } from "./VinculosPecuaria";

vi.mock("../estoque/navegacao", () => ({ podeAcessarArea: () => true }));
vi.mock("../propriedadeScope", () => ({ comPropriedade: () => ({}) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Vínculos da operação", () => {
  it("oculta a seção após confirmar que não há procedimentos nem itens diretos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ fatos: [], itensDiretos: [] }) }));
    render(<VinculosPecuaria operacaoId="operacao" />);
    await waitFor(() => expect(screen.queryByRole("region", { name: "Vínculos com a Pecuária" })).toBeNull());
  });
  it("preserva itens de consumo direto mesmo sem procedimentos destinados", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ fatos: [], itensDiretos: [{ id: "item", descricao: "Medicamento", unidade: "mL", quantidadeComprada: "10", quantidadeDestinada: "0", quantidadeDisponivel: "10" }] }) }));
    render(<VinculosPecuaria operacaoId="operacao" />);
    expect(await screen.findByText("Medicamento")).toBeTruthy();
  });
  it("não esconde falhas de consulta", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Falha de rede")));
    render(<VinculosPecuaria operacaoId="operacao" />);
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeTruthy();
  });
});
