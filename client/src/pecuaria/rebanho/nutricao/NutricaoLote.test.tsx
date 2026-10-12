// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NutricaoLote } from "./NutricaoLote";
import * as api from "./api";
vi.mock("./api", () => ({ consultarResumoNutricional: vi.fn(), listarVigencias: vi.fn() }));
vi.mock("./FechamentosNutricao", () => ({ FechamentosNutricao: () => <p>Histórico de fechamentos</p> }));
const vigente: api.Vigencia = { id: "atual", desde: "2026-09-01", ate: "2026-11-01", dieta: { id: "d1", nome: "Dieta atual", versao: 1 } };
const programada: api.Vigencia = { id: "futura", desde: "2026-11-01", ate: null, dieta: { id: "d2", nome: "Dieta futura", versao: 2 } };
const resumo: api.ResumoNutricional = { lote: { id: "lote", nome: "Matrizes", propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, ativo: true, animaisAtivos: 5, observacao: null }, vigente, programada, verValores: true, custos: { custoConhecido: "379.50", custoPorAnimalDia: "6.90", animalDias: 55, fechamentos: 1, coberturaCustoCompleta: true } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.consultarResumoNutricional).mockResolvedValue(resumo);
  vi.mocked(api.listarVigencias).mockResolvedValue({ itens: [programada, vigente], total: 121, pagina: 1, limite: 25, vigente, programada });
});
afterEach(cleanup);
describe("nutrição do lote", () => {
  it("mostra custos completos e base histórica, com ligação direta à ficha do lote", async () => {
    render(<NutricaoLote loteId="lote" podeLancar vista="lotes" />);
    await screen.findByText("Custo total da nutrição");
    expect(screen.getByText(/379,50/)).toBeTruthy();
    expect(screen.getByText(/6,90/)).toBeTruthy();
    expect(screen.getByText(/55 animal-dias/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ver lote e animais/ }).getAttribute("href")).toBe("/pecuaria/rebanho/lotes/lote");
    expect(screen.queryByLabelText("Versão publicada")).toBeNull();
    expect(screen.getByRole("link", { name: "Trocar dieta" }).getAttribute("href")).toContain("acao=atribuir");
  });
  it("separa vigente/futura e pagina o histórico sem permissão de escrita", async () => {
    render(<NutricaoLote loteId="lote" podeLancar={false} vista="lotes" />);
    await screen.findByText(/Programada: Dieta futura/);
    expect(screen.getByText("Em uso")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Trocar dieta" })).toBeNull();
    fireEvent.click(screen.getByText("Mais dietas"));
    await waitFor(() => expect(api.listarVigencias).toHaveBeenLastCalledWith("lote", 2));
    await screen.findByText(/Página 2 · 121 dietas/);
    expect(screen.getByText(/379,50/)).toBeTruthy();
  });
  it("oculta os valores sem permissão financeira mesmo diante de um payload com valores", async () => {
    vi.mocked(api.consultarResumoNutricional).mockResolvedValue({ ...resumo, verValores: false });
    render(<NutricaoLote loteId="lote" podeLancar={false} vista="lotes" />);
    await screen.findByText("Em uso");
    expect(screen.queryByText("Custo total da nutrição")).toBeNull();
    expect(screen.queryByText(/379,50/)).toBeNull();
    expect(screen.queryByText(/6,90/)).toBeNull();
  });
  it("marca custos parciais e recupera uma consulta que falhou", async () => {
    vi.mocked(api.consultarResumoNutricional).mockRejectedValueOnce(new Error("Consulta indisponível")).mockResolvedValueOnce({ ...resumo, custos: { ...resumo.custos, coberturaCustoCompleta: false } });
    render(<NutricaoLote loteId="lote" podeLancar={false} />);
    await screen.findByText("Consulta indisponível");
    fireEvent.click(screen.getByText("Tentar novamente"));
    await screen.findByText(/Valor parcial/);
    expect(screen.queryByText("Consulta indisponível")).toBeNull();
  });
  it("ausência de custo não se apresenta como gasto zero", async () => {
    vi.mocked(api.consultarResumoNutricional).mockResolvedValue({ ...resumo, custos: { custoConhecido: null, custoPorAnimalDia: null, animalDias: 0, fechamentos: 0, coberturaCustoCompleta: false } });
    render(<NutricaoLote loteId="lote" podeLancar={false} />);
    await screen.findByText("Em uso");
    expect(screen.getAllByText("Não apurado")).toHaveLength(2);
    expect(screen.queryByText(/R\$.*0,00/)).toBeNull();
  });
});
