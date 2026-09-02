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
