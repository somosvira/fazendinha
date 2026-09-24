// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
