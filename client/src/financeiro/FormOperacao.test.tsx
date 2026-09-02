// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormOperacao } from "./FormOperacao";
import type { ConfiguracoesFinanceiras } from "./novo-api";

afterEach(cleanup);

const config: ConfiguracoesFinanceiras = {
  contas: [{ id: 1, nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true }],
  parceiros: [
    { id: 1, nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
    { id: 2, nome: "Cliente Regional", documento: null, tipo: "CLIENTE", telefone: null, email: null, ativo: true },
  ],
  gruposCategorias: [],
  centrosCusto: [],
  produtos: [{ id: 1, nome: "Ração", unidade: "kg", estocavel: true, custoUnitario: "5" }],
};

function montar() {
  render(<FormOperacao config={config} onSalvo={vi.fn()} onCancelar={vi.fn()} />);
}

describe("FormOperacao", () => {
  it("abre como modal e remove campos físicos quando o tipo é serviço", () => {
    montar();
    expect(screen.getByRole("dialog", { name: "Nova operação" })).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de operação" }), { target: { value: "SERVICO" } });
    expect(screen.queryByRole("combobox", { name: "Produto do item 1" })).toBeNull();
    expect(screen.getByRole("spinbutton", { name: "Valor total da operação" })).toBeTruthy();
  });

  it("permite alternar entre valor unitário e valor total do item", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Base do valor do item 1" }), { target: { value: "TOTAL" } });
    expect(screen.getByRole("spinbutton", { name: "Valor total do item 1" })).toBeTruthy();
    expect(screen.queryByRole("spinbutton", { name: "Valor unitário do item 1" })).toBeNull();
  });

  it("deriva a unidade do produto sem permitir edição", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Produto do item 1" }), { target: { value: "1" } });
    expect(screen.getByLabelText("Unidade do item 1").textContent).toBe("kg");
    expect(screen.queryByRole("textbox", { name: "Unidade do item 1" })).toBeNull();
  });

  it("não expõe o saldo no seletor de conta", () => {
    montar();
    expect(screen.getByRole("option", { name: "Banco principal" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Banco principal.*R\$/ })).toBeNull();
  });

  it("formata o valor informado com duas casas decimais", () => {
    montar();
    const campo = screen.getByRole("spinbutton", { name: "Valor unitário do item 1" });
    fireEvent.change(campo, { target: { value: "12.5" } });
    fireEvent.blur(campo);
    expect((campo as HTMLInputElement).value).toBe("12.50");
  });

  it("remove a introdução e posiciona o aviso antes da confirmação", () => {
    montar();
    expect(screen.queryByText(/Registre o fato de negócio uma vez/)).toBeNull();
    const aviso = screen.getByText("A confirmação cria somente os efeitos descritos acima.");
    const botao = screen.getByRole("button", { name: "Confirmar operação" });
    expect(aviso.compareDocumentPosition(botao) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("explica e configura os compromissos derivados da condição a prazo", () => {
    montar();
    fireEvent.change(screen.getByRole("combobox", { name: "Condição financeira" }), { target: { value: "A_PRAZO" } });
    expect(screen.getByText("Cada parcela será criada como um compromisso vinculado a esta operação.")).toBeTruthy();
    expect(screen.getByRole("spinbutton", { name: "Valor da parcela 1" })).toBeTruthy();
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
  });

  it("oferece documentos tipificados no próprio cadastro", () => {
    montar();
    expect(screen.getByLabelText("Anexar documentos")).toBeTruthy();
    expect(screen.getByText("PDF, XML, JPG, PNG ou WEBP, com até 10 MB por arquivo.")).toBeTruthy();
  });
});
