// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { DetalhesFechamento } from "./DetalhesFechamento";
import type { Fechamento } from "./api";
afterEach(cleanup);
function fechamentoResumo(verValores: boolean): Fechamento {
  return { id: "f", inicio: "2026-10-01", fim: "2026-10-02", animalDias: 2, status: "ESTORNADO", motivoEstorno: "Conferência corrigida", propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, lote: { id: "l", nome: "Matrizes" }, verValores, custoConhecido: "100", coberturaCustoCompleta: false, centroCusto: { nome: "Pecuária" }, vigencia: { dieta: { nome: "Dieta", versao: 1 } }, participacoes: [], itens: [] };
}
describe("lotes no histórico nutricional", () => {
  it("mostra nome do lote atual, mantendo o código apenas como compatibilidade", () => {
    const f: Fechamento = { id: "f", inicio: "2026-10-01", fim: "2026-10-02", animalDias: 2, status: "CONFIRMADO", propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, lote: { id: "rebanho", nome: "Vacas" }, verValores: false, custoConhecido: null, coberturaCustoCompleta: false, centroCusto: { nome: "Pecuária" }, vigencia: { dieta: { nome: "Dieta", versao: 1 } }, participacoes: [], itens: [{ produtoId: "p", quantidadePrevista: "10", quantidadeConfirmada: "10", unidade: "KG", situacaoCusto: "DESCONHECIDO", produto: { nome: "Ração" }, movimentoEstoque: { quantidade: "10", valorTotal: null, custoUnitario: null, alocacaoPartidaEstoques: [{ quantidade: "10", partida: { codigo: "LOTE-00000000-0000-7000-8000-000000000001", nome: "Vence dezembro", validade: "2026-12-31" } }] } }] };
    render(<DetalhesFechamento fechamento={f} />);
    expect(screen.getAllByText(/lote Vence dezembro: 10 KG/)).toHaveLength(2);
    expect(screen.queryByText(/LOTE-00000000/)).toBeNull();
    expect(screen.queryByText(/Custo conhecido/)).toBeNull();
  });
  it("concentra base histórica e custos no resumo sem outra fileira de cards", () => {
    render(<DetalhesFechamento fechamento={fechamentoResumo(true)} />);
    const resumo = screen.getByRole("heading", { name: "Resumo do fechamento" }).closest("section")!;
    expect(within(resumo).getByText(/2 animal-dias/)).toBeTruthy();
    expect(within(resumo).getByText(/100,00/)).toBeTruthy();
    expect(within(resumo).getByText(/50,00/)).toBeTruthy();
    expect(within(resumo).getByText(/Cobertura incompleta/)).toBeTruthy();
    expect(within(resumo).getByText(/excluído dos custos atuais/)).toBeTruthy();
    expect(document.querySelector(".nutricao-metricas")).toBeNull();
  });
  it("oculta custos do resumo sem permissão, mesmo com valores conhecidos no payload", () => {
    render(<DetalhesFechamento fechamento={fechamentoResumo(false)} />);
    expect(screen.queryByText(/100,00/)).toBeNull();
    expect(screen.queryByText(/50,00/)).toBeNull();
    expect(screen.queryByText("Custo por animal-dia")).toBeNull();
    expect(screen.getByText(/2 animal-dias/)).toBeTruthy();
    expect(screen.getByText(/Conferência corrigida/)).toBeTruthy();
  });
});
