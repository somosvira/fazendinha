// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OperacoesFinanceiras } from "./OperacoesFinanceiras";
import { descartarRascunhoOperacao, obterRascunhoOperacao } from "./novo-api";
import { limparRascunhoAtivo, prepararPublicacaoRascunho } from "./rascunhoAtivo";
import { abrirRotaNovaOperacao } from "../router";
import { escolher, escolherData, prepararPopups } from "./campos.test-utils";
import { listarOperacoes } from "./novo-api";

vi.mock("./novo-api", () => ({
  listarOperacoes: vi.fn().mockResolvedValue([]),
  obterConfiguracoesFinanceiras: vi.fn().mockResolvedValue({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] }),
  obterRascunhoOperacao: vi.fn(),
  descartarRascunhoOperacao: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./FormOperacao", () => ({
  FormOperacao: ({ rascunho, operacaoBase }: { rascunho: { versao: number } | null; operacaoBase: unknown }) => (
    <div data-versao={rascunho?.versao}>{operacaoBase ? "Formulário de correção" : rascunho ? "Formulário com rascunho" : "Formulário novo"}</div>
  ),
}));

vi.mock("./OperacaoFinanceiraDetalhe", () => ({
  OperacaoFinanceiraDetalhe: ({ onCorrigir }: { onCorrigir: (operacao: unknown) => void }) => (
    <button type="button" onClick={() => onCorrigir({ id: 12, transacoes: [], compromissos: [], itens: [] })}>Corrigir</button>
  ),
}));

const rascunho = { id: 8, versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados: { formulario: { descricao: "Compra mensal" } } };

afterEach(() => { vi.unstubAllGlobals(); });

beforeEach(() => {
  prepararPopups();
  cleanup(); vi.clearAllMocks(); limparRascunhoAtivo();
  window.history.replaceState(null, "", "/financeiro/operacoes");
  // A API real publica o rascunho na store compartilhada; os dublês fazem o mesmo.
  vi.mocked(obterRascunhoOperacao).mockImplementation(async () => prepararPublicacaoRascunho("leitura")(rascunho));
  vi.mocked(descartarRascunhoOperacao).mockImplementation(async () => { prepararPublicacaoRascunho("escrita")(null); });
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

  it("o atalho da sidebar abre o rascunho mais recente com a lista já montada", async () => {
    render(<OperacoesFinanceiras />);
    await screen.findByRole("button", { name: "Continuar operação" });
    // Um autosave posterior à carga da lista (ex.: o formulário aberto antes do "voltar").
    act(() => { prepararPublicacaoRascunho("escrita")({ ...rascunho, versao: 5 }); });

    act(() => { abrirRotaNovaOperacao(); });

    const formulario = await screen.findByText("Formulário com rascunho");
    expect(formulario.getAttribute("data-versao")).toBe("5");
    expect(window.location.pathname).toBe("/financeiro/operacoes/nova");
  });

  // Regressão: os efeitos dos filhos rodam antes dos do App. Ao recarregar em
  // /financeiro/operacoes/nova, a leitura da tela sai antes do limpar do App e
  // não pode ser perdida, senão o formulário monta vazio sobre o rascunho salvo.
  it("abre o formulário com o rascunho mesmo se a store for limpa com a leitura a caminho", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes/nova");
    vi.mocked(obterRascunhoOperacao).mockImplementation(async () => {
      const publicar = prepararPublicacaoRascunho("leitura");
      await Promise.resolve();
      return publicar(rascunho);
    });
    render(<OperacoesFinanceiras />);
    limparRascunhoAtivo();
    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
  });

  it("o atalho da sidebar troca uma correção em curso pelo rascunho", async () => {
    window.history.replaceState(null, "", "/financeiro/operacoes/12");
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("button", { name: "Corrigir" }));
    expect(await screen.findByText("Formulário de correção")).toBeTruthy();

    act(() => { abrirRotaNovaOperacao(); });

    expect(await screen.findByText("Formulário com rascunho")).toBeTruthy();
  });
});

describe("OperacoesFinanceiras — filtros", () => {
  it("explica em linguagem simples os filtros de efeito, status e tipo", async () => {
    render(<OperacoesFinanceiras />);
    fireEvent.click(await screen.findByRole("combobox", { name: "Filtrar por efeito" }));
    expect((await screen.findByRole("option", { name: "A pagar" })).textContent).toContain("parcelas a pagar");
    expect(screen.getByRole("option", { name: "Sem efeitos" }).textContent).toContain("Não mexeram em estoque, contas nem parcelas");
    fireEvent.click(screen.getByRole("option", { name: "Estoque" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por status" }));
    expect((await screen.findByRole("option", { name: "Canceladas" })).textContent).toContain("desfeitos");
    fireEvent.click(screen.getByRole("option", { name: "Confirmadas" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.click(screen.getByRole("combobox", { name: "Filtrar por tipo" }));
    expect((await screen.findByRole("option", { name: "Transferência" })).textContent).toContain("entre contas da própria fazenda");
    expect(screen.getByRole("option", { name: "Venda" }).textContent).toContain("Você vende para um cliente");
  });

  it("consulta o intervalo escolhido no calendário do período", async () => {
    render(<OperacoesFinanceiras />);
    await screen.findByRole("combobox", { name: "Filtrar por tipo" });
    fireEvent.click(screen.getByRole("button", { name: /^Período:/ }));
    await escolherData("Início do intervalo", "2 de agosto de 2026");
    await escolherData("Fim do intervalo", "20 de agosto de 2026");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
    await waitFor(() => expect(listarOperacoes).toHaveBeenLastCalledWith({ inicio: "2026-08-02", fim: "2026-08-20" }));
    await escolher("Filtrar por tipo", "Venda");
    expect(screen.getByRole("combobox", { name: "Filtrar por tipo" }).textContent).toBe("Venda");
  });
});
