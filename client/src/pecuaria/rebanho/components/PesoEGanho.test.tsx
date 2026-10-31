// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PesoEGanho } from "./PesoEGanho";
import type { AnimalFicha } from "../types";
vi.mock("../../../financeiro/financeiro-ui", async (importOriginal) => ({ ...await importOriginal<typeof import("../../../financeiro/financeiro-ui")>(), hoje: () => "2026-10-30" }));
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
    expect(screen.getByRole("status").textContent).toContain("Pesagens insuficientes para a curva e o GMD do período");
    expect(screen.getByText("Últimas pesagens")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Manejos registrados/ })).toBeNull();
    expect(screen.queryByText("Manejo disponível")).toBeNull();
    expect(screen.queryByText("Último peso")).toBeNull();
  });
  it("preserva ações e seletor com uma pesagem e controles de expansão completos", async () => {
    const { editar, periodo } = montar({ ...base, historicoPesagens: [pesagem] });
    expect(screen.getByRole("status").textContent).toContain("Pesagens insuficientes para a curva e o GMD do período");
    await alterarControle(screen.getByLabelText("Período do GMD"), { target: { value: "90" } });
    expect(periodo).toHaveBeenCalledWith(90);
    fireEvent.click(screen.getByRole("button", { name: "Editar pesagem de 01/10/2026" }));
    expect(editar).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", animalId: base.id }));
    expect(screen.getByText("Últimas pesagens")).toBeTruthy();
  });
  it("oculta ações sem permissão e mantém histórico de várias pesagens", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }] }, false);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("table").textContent).toContain("470 kg");
    expect(screen.queryByRole("button", { name: /Editar pesagem/ })).toBeNull();
  });
  it("mostra um só indicador quando período, recente e entrada usam as mesmas duas pesagens", () => {
    montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }], peso: { ...base.peso, gmdRecente: 0.5, gmdDesdeEntrada: 0.5, gmdPeriodo: { dias: 30, valor: 0.5, pesagens: 2 } } });
    expect(screen.getAllByText("+0,500 kg/dia")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Como foi calculado o GMD" })).toBeTruthy();
    expect(document.querySelector("details")).toBeNull();
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
    const quinto = screen.getByRole("row", { name: "Pesagem de 03/10/2026" });
    expect(quinto.textContent).toContain("+1,000 kg/dia");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.queryByRole("row", { name: "Pesagem de 07/10/2026" })).toBeNull();
    expect(screen.getByRole("row", { name: "Pesagem de 02/10/2026" }).textContent).toContain("+1,000 kg/dia");
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

it("mantém pesos históricos visíveis, identifica precisão/contexto e não calcula ganho com estimativa ou fato externo", () => {
  montar({ ...base, historicoPesagens: [
    { ...pesagem, precisao: "MEDIDO", contextoHistorico: "INTERNO" },
    { ...pesagem, id: "estimado", data: "2026-09-01", pesoKg: 470, precisao: "ESTIMADO", contextoHistorico: "INTERNO" },
    { ...pesagem, id: "informado", data: "2026-08-01", pesoKg: 450, precisao: "INFORMADO", contextoHistorico: "EXTERNO", referenciaHistorica: "IDEAGRI:1" },
    { ...pesagem, id: "medido", data: "2026-07-01", pesoKg: 440, precisao: "MEDIDO", contextoHistorico: "INTERNO" },
  ] });
  const estimado = screen.getByRole("row", { name: "Pesagem de 01/09/2026" });
  expect(estimado.textContent).toContain("470 kg");
  expect(estimado.textContent).toContain("Estimado");
  const informado = screen.getByRole("row", { name: "Pesagem de 01/08/2026" });
  expect(informado.textContent).toContain("Informado");
  expect(informado.textContent).toContain("Externo");
  expect(screen.getByRole("row", { name: "Pesagem de 01/10/2026" }).textContent).not.toContain("kg/dia");
  expect(estimado.textContent).not.toContain("kg/dia");
  expect(informado.textContent).not.toContain("kg/dia");
  expect(screen.queryByRole("button", { name: "Editar pesagem de 01/08/2026" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Excluir pesagem de 01/08/2026" })).toBeNull();
  expect(informado.textContent).toContain("Reconciliação auditada");
  expect(screen.getByRole("button", { name: "Editar pesagem de 01/10/2026" })).toBeTruthy();
});
it("não transforma precisão ausente em medida e preserva a comparação compatível do legado", () => {
  montar({ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }] });
  const atual = screen.getByRole("row", { name: "Pesagem de 01/10/2026" });
  expect(atual.textContent).not.toContain("Precisão não informada");
  expect(atual.textContent).not.toContain("Contexto não informado");
  fireEvent.click(screen.getByRole("button", { name: "Detalhes da pesagem de 01/10/2026" }));
  const detalhe = screen.getByRole("dialog", { name: "Detalhes da pesagem" });
  expect(within(detalhe).getByText("Precisão não informada")).toBeTruthy();
  expect(within(detalhe).getByText("Contexto não informado")).toBeTruthy();
  expect(atual.textContent).toContain("+0,633 kg/dia");
});

it("mantém gráfico desenhável sem presumir GMD com estimativas ou datas iguais", () => {
  montar({ ...base, historicoPesagens: [
    { ...pesagem, precisao: "ESTIMADO", contextoHistorico: "INTERNO" },
    { ...pesagem, id: "p0", precisao: "ESTIMADO", contextoHistorico: "INTERNO", pesoKg: 470 },
  ] });
  expect(screen.getByRole("img", { name: "Evolução do peso do animal ao longo do tempo" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Pesagens insuficientes para o GMD do período");
  expect(screen.queryByText("Pesagens insuficientes para a curva e o GMD do período")).toBeNull();
  expect(screen.getAllByRole("row", { name: "Pesagem de 01/10/2026" })[0].textContent).not.toContain("kg/dia");
});

it("preserva GMD recente e desde a entrada quando falta base no período recortado", () => {
  render(<PesoEGanho animal={{ ...base, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", pesoKg: 470 }], peso: { ...base.peso, gmdRecente: 0.633, gmdDesdeEntrada: 0.5 } }} periodo={30} onPeriodoChange={vi.fn()} podeLancar={false} onEditarPesagem={vi.fn()} onExcluirPesagem={vi.fn()} />);
  expect(screen.getAllByText("+0,633 kg/dia").length).toBeGreaterThan(0);
  expect(screen.getByText("+0,500 kg/dia")).toBeTruthy();
  expect(screen.getByText("GMD recente")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Pesagens insuficientes para a curva e o GMD do período");
});

it("mostra GMD disponível e aviso próprio da curva quando o histórico local é insuficiente", () => {
  montar({ ...base, historicoPesagens: [pesagem], peso: { ...base.peso, gmdPeriodo: { valor: 0.5, dias: 30, pesagens: 2 } } });
  expect(screen.getByText("+0,500 kg/dia")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Uma pesagem ainda não forma uma curva");
  expect(screen.queryByText("Pesagens insuficientes para a curva e o GMD do período")).toBeNull();
});

it("recorta a curva na data da baixa e conserva observação e referência no modal", () => {
  const { container } = render(<PesoEGanho animal={{ ...base, baixa: { id: "baixa-1", data: "2026-09-15", tipo: "VENDA", motivo: null, observacao: null, estornadaEm: null, estornoMotivo: null }, historicoPesagens: [pesagem, { ...pesagem, id: "p0", data: "2026-09-01", referenciaHistorica: "IDEAGRI:123", observacao: "Peso externo conferido." }] }} periodo="entrada" onPeriodoChange={vi.fn()} podeLancar={true} onEditarPesagem={vi.fn()} onExcluirPesagem={vi.fn()} />);
  expect(screen.getByRole("status").textContent).toContain("Pesagens insuficientes para a curva e o GMD do período");
  fireEvent.click(screen.getByRole("button", { name: "Detalhes da pesagem de 01/09/2026" }));
  const modal = screen.getByRole("dialog", { name: "Detalhes da pesagem" });
  expect(within(modal).getByText("Peso externo conferido.")).toBeTruthy();
  expect(within(modal).getByText("IDEAGRI:123")).toBeTruthy();
  expect(container.querySelector("details")).toBeNull();
});
