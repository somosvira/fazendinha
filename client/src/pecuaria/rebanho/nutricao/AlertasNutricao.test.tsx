// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AlertasNutricao, fechamentosParaRevisar } from "./AlertasNutricao";
import type { Fechamento } from "./api";

const mocks = vi.hoisted(() => ({ visao: vi.fn(), ultimo: vi.fn(), listar: vi.fn(), status: vi.fn(), configs: vi.fn() }));
vi.mock("./api", () => ({ consultarVisaoNutricional: mocks.visao, ultimoFechamentoConfirmado: mocks.ultimo, listarFechamentos: mocks.listar }));
vi.mock("./mensal-api", () => ({ statusMensal: mocks.status, configuracoesMensais: mocks.configs }));
vi.mock("../../../financeiro/financeiro-ui", async (original) => ({ ...(await original<object>()), hoje: () => "2026-11-04" }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.status.mockResolvedValue({ habilitada: false, automacao: false }); mocks.configs.mockResolvedValue([]); mocks.ultimo.mockResolvedValue({ fim: "2026-11-03" }); });

const lote = (id: string, nome: string) => ({ id, nome, ativo: true, propriedadeId: 1, animaisAtivos: 6, propriedade: { id: 1, nome: "Sítio principal" } });
const resumo = (id: string, nome: string, vigente = true) => ({ lote: lote(id, nome), vigente: vigente ? { id: `v-${id}`, desde: "2026-10-01", ate: null, dieta: { id: "d", nome: "Dieta", versao: 1 } } : null, programada: null, verValores: true, custos: {} });
const fechamento = (itens: Array<[string, string, string]>, custo: string | null = "100") => ({
  id: "f1", inicio: "2026-10-26", fim: "2026-10-26", status: "CONFIRMADO", lote: { id: "c", nome: "Crias" }, propriedade: { id: 1, nome: "Sítio principal" }, propriedadeId: 1, verValores: true, custoConhecido: custo, coberturaCustoCompleta: custo != null,
  itens: itens.map(([nome, previsto, conferido]) => ({ produtoId: nome, produto: { nome }, unidade: "L", quantidadePrevista: previsto, quantidadeConfirmada: conferido })),
}) as unknown as Fechamento;

describe("Alertas da nutrição", () => {
  it("marca para revisão divergências acima de 20% e custo não apurado", () => {
    expect(fechamentosParaRevisar([fechamento([["Leite", "32", "60"]])])[0].motivos).toEqual(["Leite: conferido 60 L para 32 previstos (+88%)"]);
    expect(fechamentosParaRevisar([fechamento([["Leite", "32", "35"]])])).toHaveLength(0);
    expect(fechamentosParaRevisar([fechamento([["Leite", "32", "32"]], null)])[0].motivos).toEqual(["Custo não apurado"]);
  });
  it("reúne consumo a fechar, lotes sem dieta e fechamentos para revisar", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Lactantes"), resumo("s", "Secas", false)] });
    mocks.ultimo.mockResolvedValue({ fim: "2026-10-25" });
    mocks.listar.mockResolvedValue({ itens: [fechamento([["Leite", "32", "60"]])], total: 1, pagina: 1, limite: 25 });
    render(<AlertasNutricao podeLancar />);
    expect(await screen.findByRole("heading", { name: "Consumo a fechar" })).toBeTruthy();
    expect(screen.getAllByText("9 dias").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Lotes sem dieta vigente" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Atribuir dieta" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Fechamentos para revisar" })).toBeTruthy();
    expect(screen.getAllByText(/\+88%/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/processamento automático/)).toBeNull();
  });
  it("diz quando nada precisa de atenção", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Lactantes")] });
    mocks.listar.mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 25 });
    render(<AlertasNutricao podeLancar />);
    expect(await screen.findByText("Nada precisa de atenção na nutrição agora.")).toBeTruthy();
  });
});
