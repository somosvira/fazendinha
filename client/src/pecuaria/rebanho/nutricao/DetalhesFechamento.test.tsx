// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DetalhesFechamento } from "./DetalhesFechamento";
import type { Fechamento } from "./api";
afterEach(cleanup);
describe("lotes no histórico nutricional", () => {
  it("mostra nome do lote atual, mantendo o código apenas como compatibilidade", () => {
    const f: Fechamento = { id: "f", inicio: "2026-10-01", fim: "2026-10-02", animalDias: 2, status: "CONFIRMADO", propriedadeId: 1, lote: { id: "rebanho", nome: "Vacas" }, verValores: false, custoConhecido: null, coberturaCustoCompleta: false, centroCusto: { nome: "Pecuária" }, vigencia: { dieta: { nome: "Dieta", versao: 1 } }, participacoes: [], itens: [{ produtoId: "p", quantidadePrevista: "10", quantidadeConfirmada: "10", unidade: "KG", situacaoCusto: "DESCONHECIDO", produto: { nome: "Ração" }, movimentoEstoque: { quantidade: "10", valorTotal: null, custoUnitario: null, alocacaoPartidaEstoques: [{ quantidade: "10", partida: { codigo: "LOTE-00000000-0000-7000-8000-000000000001", nome: "Vence dezembro", validade: "2026-12-31" } }] } }] };
    render(<DetalhesFechamento fechamento={f} />);
    expect(screen.getByText(/lote Vence dezembro: 10 KG/)).toBeTruthy();
    expect(screen.queryByText(/LOTE-00000000/)).toBeNull();
    expect(screen.queryByText(/Custo conhecido:/)).toBeNull();
  });
});
