// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PesoEGanho } from "./PesoEGanho";
import type { AnimalFicha } from "../types";
const catVaca = { id: "cat-vaca", nome: "Vaca" };
const base: AnimalFicha = {
  id: "animal-1", brinco: "1234", nome: "Mimosa", sexo: "F", categoria: catVaca, categoriaOrigem: "AUTOMATICA", categoriaCalculada: catVaca, idadeMeses: 40, idadeNaBaixa: false,
  dataNascimento: "2022-01-01", dataEntrada: "2022-01-01", origem: "NASCIDO", propriedade: { id: 1, nome: "Sede" },
  lote: null, aptidao: "LEITE", papelReprodutivo: "RECEPTORA", composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO",
  gmdRecente: null, noLocalDesde: null,
  brincoEletronico: null, sisbov: null, nascimentoEstimado: false, partosAntesDaEntrada: 1, observacao: null,
  composicao: [], historicoLocalizacoes: [{ id: "loc-1", propriedade: { id: 1, nome: "Sede" }, lote: null, desde: "2022-01-01", ate: null, motivo: null, movimentacaoId: null }],
  historicoDestinos: [{ id: "dest-1", aptidao: "LEITE", papelReprodutivo: "RECEPTORA", desde: "2022-01-01", ate: null }],
  historicoPesagens: [], historicoCategoriasManuais: [],
  baixa: null,
  peso: { ultimo: null, gmdRecente: null, gmdDesdeEntrada: null, gmdPeriodo: { dias: null, valor: null, pesagens: 0 } },
  historicoBaixas: [],
  filiacao: { mae: null, pai: null },
  filhosCount: 0,
};
afterEach(cleanup);
const pesagem = { id: "p1", data: "2026-10-01", pesoKg: 489, tipo: "ROTINA" as const, origem: "MANUAL" as const, observacao: null };
function montar(animal = base, podeLancar = true) {
  const editar = vi.fn();
  const periodo = vi.fn();
  render(<PesoEGanho animal={animal} periodo="entrada" onPeriodoChange={periodo} podeLancar={podeLancar} onEditarPesagem={editar} onExcluirPesagem={vi.fn()} manejo={<div>Manejo disponível</div>} />);
  return { editar, periodo };
}
describe("PesoEGanho", () => {
  it("mostra ausência de dados e faixa integrada sem inventar GMD", () => {
    montar();
    expect(screen.getByRole("status").textContent).toContain("Ainda não há pesagens");
    expect(screen.getByText("Pesagens insuficientes", { selector: "small" })).toBeTruthy();
    expect(screen.getByText("0 registros").closest("dl")?.className).toBe("ficha-peso-faixa");
    expect(screen.getByText("Manejo disponível").parentElement?.className).toBe("ficha-peso-manejo");
    expect(screen.getByRole("button", { name: "Pesagens · 0 registros" }).getAttribute("aria-expanded")).toBe("false");
  });
  it("preserva ações e seletor com uma pesagem e controles de expansão completos", () => {
    const { editar, periodo } = montar({ ...base, historicoPesagens: [pesagem] });
    expect(screen.getByRole("status").textContent).toContain("Uma pesagem ainda não forma uma curva");
    fireEvent.change(screen.getByLabelText("Período do GMD"), { target: { value: "90" } });
    expect(periodo).toHaveBeenCalledWith(90);
    fireEvent.click(screen.getByRole("button", { name: "Pesagens · 1 registro" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar pesagem de 01/10/2026" }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", animalId: base.id }));
    expect(screen.getByRole("button", { name: "Pesagens · 1 registro" }).getAttribute("aria-expanded")).toBe("true");
  });
  it("oculta ações sem permissão e mantém histórico de várias pesagens", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }] }, false);
    fireEvent.click(screen.getByRole("button", { name: "Pesagens · 2 registros" }));
    expect(screen.getByRole("table").textContent).toContain("470 kg");
    expect(screen.queryByRole("button", { name: /Editar pesagem/ })).toBeNull();
  });
});
