// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HistoricoBaixas } from "./HistoricoBaixas";
import type { AnimalFicha } from "../types";

afterEach(cleanup);

type Baixa = AnimalFicha["historicoBaixas"][number];

const baixaValendo: Baixa = {
  id: "b1", data: "2026-09-12", tipo: "VENDA", motivo: { nome: "Baixa produção", classe: "DESCARTE_VOLUNTARIO" },
  observacao: "Vendida no leilão", estornadaEm: null, estornoMotivo: null, criadoPor: "Ana",
};
const baixaEstornada: Baixa = {
  id: "b0", data: "2026-01-05", tipo: "MORTE", motivo: { nome: "Doença", classe: "MORTE" },
  observacao: null, estornadaEm: "2026-01-10", estornoMotivo: "Cadastro duplicado", criadoPor: "João",
};

describe("HistoricoBaixas", () => {
  it("não renderiza nada quando não há baixas", () => {
    const { container } = render(<HistoricoBaixas historicoBaixas={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra a baixa em vigor com o selo Valendo", () => {
    render(<HistoricoBaixas historicoBaixas={[baixaValendo]} />);
    expect(screen.getByText("Venda")).toBeTruthy();
    expect(screen.getByText("12/09/2026")).toBeTruthy();
    expect(screen.getByText("Baixa produção (descarte voluntário)")).toBeTruthy();
    expect(screen.getByText("Vendida no leilão")).toBeTruthy();
    expect(screen.getByText("Valendo")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
  });

  it("mostra quando e por que uma baixa foi estornada, sem o selo Valendo para ela", () => {
    render(<HistoricoBaixas historicoBaixas={[baixaValendo, baixaEstornada]} />);
    expect(screen.getByText(/Estornada em 10\/01\/2026 — Cadastro duplicado/)).toBeTruthy();
    expect(screen.getAllByText("Valendo")).toHaveLength(1);
  });
});

it("mostra evidência e autoria, oferecendo revisão só para origem comprovada ainda não classificada", () => {
  const origem = { bancoOrigem: "IDEAGRI", chaveOrigem: "BAIXA:1", evidencia: "Extrato da saída", motivo: "Saída sem classificação", usuarioId: 7, registradaEm: "2026-10-29T12:00:00Z", revisao: null };
  const revisar = vi.fn();
  render(<HistoricoBaixas historicoBaixas={[
    { ...baixaValendo, tipo: "NAO_DETERMINADO", regularizacaoHistorica: origem },
    { ...baixaEstornada, id: "b2", tipo: "NAO_DETERMINADO", regularizacaoHistorica: origem },
    { ...baixaValendo, id: "b3", tipo: "NAO_DETERMINADO" },
  ]} onRevisar={revisar} />);
  expect(screen.getAllByText("Extrato da saída")).toHaveLength(2);
  const acoes = screen.getAllByRole("button", { name: "Revisar classificação" });
  expect(acoes).toHaveLength(1);
  fireEvent.click(acoes[0]);
  expect(revisar).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
});
it("leitura da proveniência permanece disponível sem ação de escrita e conserva a revisão", () => {
  render(<HistoricoBaixas historicoBaixas={[{ ...baixaValendo, regularizacaoHistorica: { bancoOrigem: "IDEAGRI", chaveOrigem: "1", evidencia: "Extrato original", motivo: "Saída antiga", usuarioId: 7, registradaEm: "2026-10-29T12:00:00Z", revisao: { usuarioId: 8, registradaEm: "2026-10-29T13:00:00Z", dados: { chave: "chave", tipo: "VENDA", evidencia: "Nota de venda", motivo: "Documento localizado" } } } }]} />);
  expect(screen.getByText("Extrato original")).toBeTruthy();
  expect(screen.getByText("Nota de venda")).toBeTruthy();
  expect(screen.getByText(/Usuário 8/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Revisar classificação" })).toBeNull();
});
