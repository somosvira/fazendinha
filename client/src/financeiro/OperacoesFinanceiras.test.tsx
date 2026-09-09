// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { useRascunhoOperacao, type RascunhoOperacao } from "./novo-api";
import { ToastProvider } from "../components/Toast";

// vi.mocked(useRascunhoOperacao) preserva o tipo real (UseQueryResult completo,
// ~20 campos) — o mock só precisa do que o componente lê, daí o cast.
function resultadoRascunho(data: RascunhoOperacao | null) {
  return { data, error: null, isPending: false, refetch: vi.fn().mockResolvedValue(undefined) } as unknown as UseQueryResult<RascunhoOperacao | null, Error>;
}
// mutate simula o patch otimista real de useDescartarRascunho (aplicar: () =>
// null): o sucesso já deixa useRascunhoOperacao() resolvendo null no próximo
// render, sem precisar de refetch nenhum — é exatamente o que evita o bug
// original (`.refetch()` incondicional nunca resolvia offline).
const { mutateDescartarRascunho } = vi.hoisted(() => ({
  mutateDescartarRascunho: vi.fn(),
}));
vi.mock("./novo-api", () => ({
  useOperacoesFinanceiras: vi.fn().mockReturnValue({ data: undefined, error: null, isPending: false, refetch: vi.fn() }),
  useConfiguracoesFinanceiras: vi.fn().mockReturnValue({ data: { contas: [], parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [] }, error: null, isPending: false, refetch: vi.fn() }),
  useRascunhoOperacao: vi.fn(),
  useDescartarRascunho: vi.fn().mockReturnValue({ mutate: mutateDescartarRascunho, pendentes: [] }),
}));

vi.mock("./FormOperacao", () => ({
  FormOperacao: ({ rascunho }: { rascunho: unknown }) => <div>{rascunho ? "Formulário com rascunho" : "Formulário novo"}</div>,
}));

// Implementação fica fora do vi.hoisted (precisa de `useRascunhoOperacao` já
// importado) — sobrevive ao vi.clearAllMocks() do beforeEach, que só limpa
// histórico de chamadas, não a implementação.
mutateDescartarRascunho.mockImplementation((_input: unknown, opts?: { onSuccess?: (item: unknown) => void }) => {
  vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(null));
  opts?.onSuccess?.(null);
});

function renderComToast(node: React.ReactElement) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const rascunho = { id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { descricao: "Compra mensal" } } };

beforeEach(() => {
  cleanup(); vi.clearAllMocks();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(rascunho));
});

describe("OperacoesFinanceiras — rascunho", () => {
  it("oferece continuar quando existe um rascunho", async () => {
    renderComToast(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Continuar operação" }));
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
    expect(mutateDescartarRascunho).not.toHaveBeenCalled();
  });

  it("descarta o rascunho antes de iniciar uma nova operação", async () => {
    renderComToast(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    await waitFor(() => expect(mutateDescartarRascunho).toHaveBeenCalledOnce());
    expect(await screen.findByText("Formulário novo")).toBeTruthy();
  });

  it("sem rascunho existente, abre o formulário direto — sem chamar a mutation", async () => {
    vi.mocked(useRascunhoOperacao).mockReturnValue(resultadoRascunho(null));
    renderComToast(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Nova operação" }));
    expect(await screen.findByText("Formulário novo")).toBeTruthy();
    expect(mutateDescartarRascunho).not.toHaveBeenCalled();
  });
});
