// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AlertasNutricao, fechamentosParaRevisar } from "./AlertasNutricao";
import type { Fechamento } from "./api";

const mocks = vi.hoisted(() => ({ visao: vi.fn(), ultimo: vi.fn(), listar: vi.fn(), status: vi.fn(), configs: vi.fn(), dietas: vi.fn(), saldos: vi.fn() }));
vi.mock("./api", () => ({ consultarVisaoNutricional: mocks.visao, ultimoFechamentoConfirmado: mocks.ultimo, ultimosFechamentos: async () => Object.fromEntries(await Promise.all((await mocks.visao()).lotes.map(async (r: { lote: { id: string } }) => [r.lote.id, (await mocks.ultimo(r.lote.id))?.fim ?? null]))), compartilhada: (_: string, ler: () => Promise<unknown>) => ler(), listarFechamentos: mocks.listar, listarDietas: mocks.dietas, listarPartidasNutricionais: async () => [] }));
vi.mock("../../../estoque/api", () => ({ listarSaldos: mocks.saldos }));
vi.mock("./mensal-api", () => ({ statusMensal: mocks.status, configuracoesMensais: mocks.configs, mesesNutricionais: async () => ({ itens: [], total: 0 }), reprocessarMensal: vi.fn(), processadosMensais: async () => ({}) }));
vi.mock("../../../financeiro/financeiro-ui", async (original) => ({ ...(await original<object>()), hoje: () => "2026-11-04" }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.status.mockResolvedValue({ habilitada: false, automacao: false }); mocks.configs.mockResolvedValue([]); mocks.ultimo.mockResolvedValue({ fim: "2026-11-03" }); mocks.dietas.mockResolvedValue([]); mocks.saldos.mockResolvedValue([]); });

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
  it("avisa ingrediente que acaba em menos de uma semana somando os lotes do sítio", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Lactantes"), { ...resumo("b", "Novilhas"), vigente: { id: "v-b", desde: "2026-10-01", ate: null, dieta: { id: "d", nome: "Dieta", versao: 1 } } }] });
    mocks.listar.mockResolvedValue({ itens: [], total: 0, pagina: 1, limite: 25 });
    mocks.dietas.mockResolvedValue([{ id: "d", nome: "Dieta", versao: 1, publicadaEm: "2026-10-01", itens: [{ produtoId: "silagem", quantidadeCabecaDia: "10", unidade: "KG", produto: { nome: "Silagem" } }] }]);
    // 2 lotes × 6 animais × 10 kg = 120 kg/dia; 500 kg cobrem 4 dias.
    mocks.saldos.mockResolvedValue([{ produtoId: "silagem", nome: "Silagem", saldo: 500, unidade: "KG" }]);
    render(<AlertasNutricao podeLancar />);
    expect(await screen.findByRole("heading", { name: "Estoque acabando ou vencendo" })).toBeTruthy();
    expect(screen.getAllByText("4 dias").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lactantes, Novilhas").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Ver no Estoque" })[0].getAttribute("href")).toBe("/estoque/produtos/silagem");
  });
});
