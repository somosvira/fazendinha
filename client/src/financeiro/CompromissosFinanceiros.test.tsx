// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CompromissosFinanceiros } from "./CompromissosFinanceiros";
import { useRascunhoOperacao } from "./novo-api";
import { ToastProvider } from "../components/Toast";

// Mutate dispara onSuccess na hora — o mock representa o caminho online de
// useSalvarOffline (navigator.onLine é true por padrão no jsdom).
const { resultadoVazio, mutateDescartarRascunho } = vi.hoisted(() => ({
  resultadoVazio: { data: undefined, error: null, isPending: false, refetch: vi.fn() },
  mutateDescartarRascunho: vi.fn((_input: unknown, opts?: { onSuccess?: (item: unknown) => void }) => opts?.onSuccess?.(null)),
}));
vi.mock("./novo-api", () => ({
  useCompromissosFinanceiros: vi.fn().mockReturnValue({ ...resultadoVazio, data: [] }),
  useConfiguracoesFinanceiras: vi.fn().mockReturnValue({ ...resultadoVazio, data: { contas: [], parceiros: [], gruposCategorias: [], centrosCusto: [], produtos: [] } }),
  useRascunhoOperacao: vi.fn().mockReturnValue({ ...resultadoVazio, data: null }),
  useDescartarRascunho: vi.fn().mockReturnValue({ mutate: mutateDescartarRascunho, pendentes: [] }),
  useLiquidarCompromisso: vi.fn().mockReturnValue({ mutate: vi.fn(), pendentes: [] }),
}));

// CompromissosFinanceiros usa useToast() (escrita offline — ver
// ../lib/offline/useSalvarOffline) — precisa do ToastProvider no contexto.
function renderComToast(node: React.ReactElement) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/financeiro/compromissos");
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("CompromissosFinanceiros — criação", () => {
  it("pede confirmação antes de substituir um rascunho", async () => {
    vi.mocked(useRascunhoOperacao).mockReturnValue({ ...resultadoVazio, data: { id: 8, versao: 1, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: {} } } as any);
    const onNav = vi.fn();
    renderComToast(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a pagar" }));
    expect(await screen.findByRole("heading", { name: "Substituir rascunho em andamento?" })).toBeTruthy();
    expect(screen.getByText(/dados preenchidos e documentos anexados/)).toBeTruthy();
    expect(mutateDescartarRascunho).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Descartar e continuar" }));
    await waitFor(() => expect(mutateDescartarRascunho).toHaveBeenCalledOnce());
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
  });

  it("segue diretamente quando não existe rascunho", async () => {
    vi.mocked(useRascunhoOperacao).mockReturnValue({ ...resultadoVazio, data: null } as any);
    const onNav = vi.fn();
    renderComToast(<CompromissosFinanceiros onNav={onNav} />);

    fireEvent.click(await screen.findByRole("button", { name: "Criar a receber" }));
    await waitFor(() => expect(onNav).toHaveBeenCalledWith("lancar"));
    expect(screen.queryByRole("heading", { name: "Substituir rascunho em andamento?" })).toBeNull();
    expect(mutateDescartarRascunho).not.toHaveBeenCalled();
  });
});
