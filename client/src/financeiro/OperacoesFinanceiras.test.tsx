// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";

vi.mock("./novo-api", () => ({
  listarOperacoes: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./FormOperacao", () => ({
  FormOperacao: ({ rascunho }: { rascunho: unknown }) => <div>{rascunho ? "Formulário com rascunho" : "Formulário novo"}</div>,
}));

const rascunho = { id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { descricao: "Compra mensal" } } };

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  vi.mocked(obterRascunhoOperacao).mockResolvedValue(rascunho);
  vi.mocked(descartarRascunhoOperacao).mockResolvedValue(undefined);
});

describe("OperacoesFinanceiras — rascunho", () => {
  it("oferece continuar quando existe um rascunho", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar operação" }));
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
    expect(descartarRascunhoOperacao).not.toHaveBeenCalled();
  });

  it("descarta o rascunho antes de iniciar uma nova operação", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    expect(await screen.findByText("Formulário novo")).toBeTruthy();
  });
});
