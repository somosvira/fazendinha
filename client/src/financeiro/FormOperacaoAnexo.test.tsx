// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { render } from "./lib/testQueryClient";
import { FormOperacao } from "./FormOperacao";
import type { ConfiguracoesFinanceiras, DocumentoFinanceiro } from "./novo-api";

const { anexarDocumentoRascunho, salvarRascunhoOperacao } = vi.hoisted(() => ({
  anexarDocumentoRascunho: vi.fn(),
  salvarRascunhoOperacao: vi.fn(),
}));

vi.mock("./novo-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./novo-api")>()),
  anexarDocumentoRascunho,
  salvarRascunhoOperacao,
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const config: ConfiguracoesFinanceiras = { contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] };
const documento = { id: 7, nome: "nota.pdf", tipo: "NOTA_FISCAL", numero: null } as unknown as DocumentoFinanceiro;

function anexar(arquivo: File) {
  fireEvent.change(screen.getByLabelText("Anexar documentos"), { target: { files: [arquivo] } });
}

describe("FormOperacao — anexo de documento", () => {
  it("mostra o documento em andamento enquanto o upload não termina e troca pelo salvo ao concluir", async () => {
    salvarRascunhoOperacao.mockResolvedValue({ id: 1, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-21T12:00:00Z" });
    let concluir!: (doc: DocumentoFinanceiro) => void;
    anexarDocumentoRascunho.mockReturnValue(new Promise<DocumentoFinanceiro>((resolve) => { concluir = resolve; }));
    render(<FormOperacao config={config} onSalvo={vi.fn()} />);

    anexar(new File(["conteudo"], "nota.pdf", { type: "application/pdf" }));

    const pendente = await screen.findByRole("status", { name: "Anexando documento nota.pdf" });
    expect(pendente.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByLabelText("Anexar documentos") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Anexando documento…" }) as HTMLButtonElement).disabled).toBe(true);

    concluir(documento);

    await waitFor(() => expect(screen.queryByRole("status", { name: "Anexando documento nota.pdf" })).toBeNull());
    expect(screen.getByText("Salvo no rascunho")).toBeTruthy();
    expect((screen.getByLabelText("Anexar documentos") as HTMLInputElement).disabled).toBe(false);
  });

  it("remove o estado de carregamento e exibe o erro quando o upload falha", async () => {
    salvarRascunhoOperacao.mockResolvedValue({ id: 1, dados: {}, versao: 1, documentos: [], updatedAt: "2026-09-21T12:00:00Z" });
    anexarDocumentoRascunho.mockRejectedValue(new Error("Falha no armazenamento"));
    render(<FormOperacao config={config} onSalvo={vi.fn()} />);

    anexar(new File(["conteudo"], "nota.pdf", { type: "application/pdf" }));

    await waitFor(() => expect(screen.queryByRole("status", { name: "Anexando documento nota.pdf" })).toBeNull());
    expect(await screen.findByText("Falha no armazenamento")).toBeTruthy();
    expect(screen.getByText("Nenhum documento anexado.")).toBeTruthy();
  });
});
