// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProtocolosCadastro } from "./ProtocolosCadastro";
import { listarTiposAplicacao, reqSanidade } from "./api";
import { listarProdutos } from "../../../estoque/api";
vi.mock("./api", () => ({ listarTiposAplicacao: vi.fn(), reqSanidade: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn() }));
const protocolo = { id: "p1", nome: "Controle CCS", descricao: null, ativo: true, versao: 1, publicadoEm: null, etapas: [{ diaRelativo: 0, tipo: "EXAME", tipoExameId: "e1", produtoId: null, tipoAplicacaoId: null, tipoAplicacaoNomeSnapshot: null, dose: null, unidade: null }] };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listarProdutos).mockResolvedValue([]);
  vi.mocked(listarTiposAplicacao).mockResolvedValue([]);
  vi.mocked(reqSanidade).mockImplementation(async (path) => {
    if (path === "/protocolos?incluirInativos=true") return [protocolo] as never;
    if (path.endsWith("/publicacao")) return { id: "p1", nome: protocolo.nome, ativo: true, versao: 1, publicadoEm: "2026-10-06" } as never;
    if (path.endsWith("/inativacao")) return { ...protocolo, ativo: false } as never;
    if (path === "/protocolos") return { ...protocolo, id: "p2", versao: 2 } as never;
    return [{ id: "e1", nome: "CCS", ativo: true, tipoResultado: "NUMERO", unidade: null, opcoes: null }] as never;
  });
});
afterEach(cleanup);
describe("Protocolos sanitários", () => {
  it("publica localmente preservando etapas quando a resposta é parcial", async () => {
    render(<ProtocolosCadastro podeLancar />);
    await screen.findAllByText("Controle CCS");
    fireEvent.click(screen.getAllByRole("button", { name: "Publicar Controle CCS v1" })[0]);
    await screen.findByText("Versão publicada.");
    expect(screen.getAllByText("Publicado")).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver etapas de Controle CCS v1" })[0]);
    expect(screen.getByText("Etapa 1 · Dia 0")).toBeTruthy();
    expect(screen.getByText("Exame · CCS")).toBeTruthy();
    expect(reqSanidade).toHaveBeenCalledTimes(3);
  });
  it("mantém lista e detalhes consultáveis se o catálogo falha", async () => {
    vi.mocked(listarProdutos).mockRejectedValueOnce(new Error("Catálogo indisponível"));
    render(<ProtocolosCadastro podeLancar />);
    await screen.findAllByText("Controle CCS");
    await screen.findByText("Catálogo indisponível");
    expect((screen.getByRole("button", { name: "Novo protocolo" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Ver etapas de Controle CCS v1" })[0]);
    expect(screen.getByText("Etapa 1 · Dia 0")).toBeTruthy();
  });
  it("mostra detalhes em somente leitura sem ações de escrita", async () => {
    render(<ProtocolosCadastro podeLancar={false} />);
    await screen.findAllByText("Controle CCS");
    expect(screen.queryByRole("button", { name: /Publicar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Novo protocolo" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver etapas/ })[0]);
    expect(screen.getByText("Etapa 1 · Dia 0")).toBeTruthy();
  });
  it("inativa e não oferece reativação inexistente no contrato", async () => {
    render(<ProtocolosCadastro podeLancar />);
    await screen.findAllByText("Controle CCS");
    fireEvent.click(screen.getAllByRole("button", { name: "Inativar Controle CCS v1" })[0]);
    await screen.findByText("Versão inativada.");
    expect(screen.queryByRole("button", { name: /Reativar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Inativar/ })).toBeNull();
  });
  it("uma versão publicada abre novo rascunho usando POST", async () => {
    vi.mocked(reqSanidade).mockImplementation(async (path, init) => {
      if (path === "/protocolos?incluirInativos=true") return [{ ...protocolo, publicadoEm: "2026-10-06" }] as never;
      if (init) return { ...protocolo, id: "p2", versao: 2 } as never;
      return [{ id: "e1", nome: "CCS", ativo: true, tipoResultado: "NUMERO", unidade: null, opcoes: null }] as never;
    });
    render(<ProtocolosCadastro podeLancar />);
    await waitFor(() => expect((screen.getAllByRole("button", { name: "Nova versão de Controle CCS v1" })[0] as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getAllByRole("button", { name: "Nova versão de Controle CCS v1" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/protocolos", expect.objectContaining({ method: "POST" })));
  });
});
