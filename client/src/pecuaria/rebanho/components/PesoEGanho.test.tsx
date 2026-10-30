// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
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
  const excluir = vi.fn();
  const periodo = vi.fn();
  render(<PesoEGanho animal={animal} periodo="entrada" onPeriodoChange={periodo} podeLancar={podeLancar} onEditarPesagem={editar} onExcluirPesagem={excluir} manejo={<div>Manejo disponível</div>} />);
  return { editar, excluir, periodo };
}
describe("PesoEGanho", () => {
  it("mostra ausência de dados e faixa integrada sem inventar GMD", () => {
    montar();
    expect(screen.getByRole("status").textContent).toContain("Ainda não há pesagens");
    expect(screen.getByText("Pesagens insuficientes")).toBeTruthy();
    expect(screen.getByText("Últimas pesagens")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Manejos registrados/ })).toBeNull();
    expect(screen.getByText("Manejo disponível")).toBeTruthy();
    expect(screen.queryByText("Último peso")).toBeNull();
  });
  it("preserva ações e seletor com uma pesagem e controles de expansão completos", async () => {
    const { editar, periodo } = montar({ ...base, historicoPesagens: [pesagem] });
    expect(screen.getByRole("status").textContent).toContain("Uma pesagem ainda não forma uma curva");
    await alterarControle(screen.getByLabelText("Período do GMD"), { target: { value: "90" } });
    expect(periodo).toHaveBeenCalledWith(90);
    fireEvent.click(screen.getByRole("button", { name: "Editar pesagem de 01/10/2026" }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", animalId: base.id }));
    expect(screen.getByText("Últimas pesagens")).toBeTruthy();
  });
  it("oculta ações sem permissão e mantém histórico de várias pesagens", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }] }, false);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Últimas pesagens" }).textContent).toContain("470 kg");
    expect(screen.queryByRole("button", { name: /Editar pesagem/ })).toBeNull();
  });
  it("mostra um só indicador quando período, recente e entrada usam as mesmas duas pesagens", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }], peso: { ...base.peso, gmdRecente: 0.5, gmdDesdeEntrada: 0.5, gmdPeriodo: { dias: 30, valor: 0.5, pesagens: 2 } } });
    expect(screen.getAllByText("+0,500 kg/dia")).toHaveLength(1);
    expect(screen.getByText("GMD recente")).toBeTruthy();
    expect(screen.getByText("GMD desde a entrada")).toBeTruthy();
    expect(screen.getByText("Como foi calculado").closest("details")?.open).toBe(false);
    expect(screen.getByText("Ganho médio diário (GMD)")).toBeTruthy();
    expect(screen.getByText(/2 pesagens · 01\/09\/2026 a 01\/10\/2026/)).toBeTruthy();
  });
  it("não agrupa resultados numericamente iguais quando as bases de cálculo são diferentes", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }, { ...pesagem, id: "p-1", data: "2026-08-01", pesoKg: 450 }], peso: { ...base.peso, gmdRecente: 0.5, gmdDesdeEntrada: 0.5, gmdPeriodo: { dias: 30, valor: 0.5, pesagens: 2 } } });
    expect(screen.getAllByText("+0,500 kg/dia")).toHaveLength(3);
    expect(screen.queryByText("Mesmas duas pesagens do período.")).toBeNull();
  });

  it("mantém ganho entre páginas e as ações do cartão correto", () => {
    const registros = Array.from({ length: 7 }, (_, indice) => ({ ...pesagem, id: `p${indice}`, data: `2026-10-${String(7-indice).padStart(2, "0")}`, pesoKg: 500-indice }));
    const { editar, excluir } = montar({ ...base, historicoPesagens: registros });
    const quinto = screen.getByRole("article", { name: "Pesagem de 03/10/2026" });
    expect(quinto.textContent).toContain("+1,000 kg/dia");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.queryByRole("article", { name: "Pesagem de 07/10/2026" })).toBeNull();
    expect(screen.getByRole("article", { name: "Pesagem de 02/10/2026" }).textContent).toContain("+1,000 kg/dia");
    fireEvent.click(screen.getByRole("button", { name: "Editar pesagem de 02/10/2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir pesagem de 02/10/2026" }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ id: "p5", pesoKg: 495 }));
    expect(excluir).toHaveBeenCalledWith(expect.objectContaining({ id: "p5", pesoKg: 495 }));
  });

  it("omite o aviso genérico da seed sem remover observações úteis ou mudar a edição", () => {
    const aviso = "Cenário sintético de desenvolvimento. Animais, doses, resultados e intervalos fictícios; não são recomendação clínica.";
    const observacao = `${aviso} Conferido na balança.`;
    const { editar } = montar({ ...base, historicoPesagens: [{ ...pesagem, observacao }, { ...pesagem, id: "p0", data: "2026-09-01", observacao: aviso }] });
    expect(screen.queryByText(/Cenário sintético/)).toBeNull();
    expect(screen.getByText("Conferido na balança.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Editar pesagem de 01/10/2026" }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ observacao }));
  });

});
