// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { descartarRascunhoOperacao, useRascunhoOperacao, type RascunhoOperacao } from "./novo-api";

// vi.mocked(useRascunhoOperacao) preserva o tipo real (UseQueryResult completo,
// ~20 campos) — o mock só precisa do que o componente lê, daí o cast.
function resultadoRascunho(data: RascunhoOperacao | null, refetch: () => Promise<unknown> = vi.fn().mockResolvedValue(undefined)) {
  return { data, error: null, isPending: false, refetch } as unknown as UseQueryResult<RascunhoOperacao | null, Error>;
}
vi.mock("./novo-api", () => ({
  useOperacoesFinanceiras: vi.fn().mockReturnValue({ data: undefined, error: null, isPending: false, refetch: vi.fn() }),
  useConfiguracoesFinanceiras: vi.fn().mockReturnValue({ data: { contas: [], parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [] }, error: null, isPending: false, refetch: vi.fn() }),
  useRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./FormOperacao", () => ({
  FormOperacao: ({ rascunho }: { rascunho: unknown }) => <div>{rascunho ? "Formulário com rascunho" : "Formulário novo"}</div>,
}));

const rascunho = { id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { descricao: "Compra mensal" } } };

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(rascunho));
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
    // refetch precisa refletir, no mock, o que a query real faria — reler o
    // rascunho (agora nulo, pós-descarte) e devolver o novo valor no próximo render.
    vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(rascunho, vi.fn().mockImplementation(async () => {
      vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(null));
    })));
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await waitFor(() => expect(descartarRascunhoOperacao).toHaveBeenCalledOnce());
    expect(await screen.findByText("Formulário novo")).toBeTruthy();
  });
});
