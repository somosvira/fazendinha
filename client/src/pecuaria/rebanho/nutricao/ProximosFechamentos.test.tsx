// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProximosFechamentos } from "./ProximosFechamentos";

const mocks = vi.hoisted(() => ({ visao: vi.fn(), ultimo: vi.fn(), status: vi.fn(), configs: vi.fn(), meses: vi.fn() }));
vi.mock("./api", () => ({ consultarVisaoNutricional: mocks.visao, ultimoFechamentoConfirmado: mocks.ultimo, listarDietas: async () => [] }));
vi.mock("./mensal-api", () => ({ statusMensal: mocks.status, configuracoesMensais: mocks.configs, mesesNutricionais: mocks.meses, reprocessarMensal: vi.fn() }));
vi.mock("../../../financeiro/financeiro-ui", async (original) => ({ ...(await original<object>()), hoje: () => "2026-11-04" }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.status.mockResolvedValue({ habilitada: false, automacao: false }); mocks.configs.mockResolvedValue([]); mocks.meses.mockResolvedValue({ itens: [], total: 0 }); });

const lote = (id: string, nome: string) => ({ id, nome, ativo: true, propriedadeId: 1, propriedade: { id: 1, nome: "Sítio principal" } });
const resumo = (id: string, nome: string, desde: string) => ({ lote: lote(id, nome), vigente: { id: `v-${id}`, desde, ate: null, dieta: { id: "d", nome: "Dieta", versao: 1 } }, programada: null, verValores: true, custos: {} });

describe("Próximos fechamentos", () => {
  it("conta até ontem, mostra os mais atrasados primeiro e ignora lotes sem dieta", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Novilhas", "2026-10-01"), resumo("b", "Lactantes", "2026-10-20"), { ...resumo("c", "Sem dieta", "2026-10-01"), vigente: null }] });
    mocks.ultimo.mockImplementation(async (id: string) => id === "a" ? { fim: "2026-11-03" } : null);
    render(<ProximosFechamentos podeLancar />);
    const linhas = await screen.findAllByRole("row");
    expect(screen.getByText("1 lote tem consumo a fechar por período.")).toBeTruthy();
    // Lactantes nunca fechou: de 20/10 até ontem (03/11) são 15 dias.
    expect(within(linhas[1]).getByText("Lactantes")).toBeTruthy();
    expect(within(linhas[1]).getByText("15 dias por período")).toBeTruthy();
    expect(within(linhas[1]).getByRole("link", { name: "Fechar período" })).toBeTruthy();
    // Novilhas está fechado até ontem: nada a fechar hoje.
    expect(within(linhas[2]).getByText("Em dia")).toBeTruthy();
    expect(within(linhas[2]).queryByRole("link", { name: "Fechar período" })).toBeNull();
    expect(screen.queryByText("Sem dieta")).toBeNull();
  });
  it("lote mensal fecha por período só até a véspera da adoção", async () => {
    mocks.status.mockResolvedValue({ habilitada: true, automacao: true });
    mocks.configs.mockResolvedValue([{ id: "c", propriedadeId: 1, loteId: null, modelo: "AUTOMATICO", diaConferencia: 5, autorizaValidade: false, desde: "2026-11-01" }]);
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Lactantes", "2026-10-01")] });
    mocks.ultimo.mockResolvedValue({ fim: "2026-10-25" });
    render(<ProximosFechamentos podeLancar />);
    const linhas = await screen.findAllByRole("row");
    expect(within(linhas[1]).getByText("6 dias por período")).toBeTruthy();
    expect(within(linhas[1]).getByText("26/10 a 31/10/2026")).toBeTruthy();
    expect(within(linhas[1]).getByText("Diário automático a partir de 01/11").getAttribute("title")).toBe("Todo dia o estoque é descontado sozinho; na conferência mensal, ajuste as diferenças. Conferência no dia 5.");
  });
  it("depois da adoção, conta os dias ainda não processados no tipo de fechamento", async () => {
    mocks.status.mockResolvedValue({ habilitada: true, automacao: false });
    mocks.configs.mockResolvedValue([{ id: "c", propriedadeId: 1, loteId: null, modelo: "MANUAL", diaConferencia: 5, autorizaValidade: false, desde: "2026-10-29" }]);
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Novilhas", "2026-10-01")] });
    mocks.ultimo.mockResolvedValue({ fim: "2026-10-28" });
    // Já processados 29 e 30/10: faltam 31/10 a 03/11.
    mocks.meses.mockResolvedValue({ total: 1, itens: [{ dias: [{ data: "2026-10-29" }, { data: "2026-10-30" }] }] });
    render(<ProximosFechamentos podeLancar />);
    const linhas = await screen.findAllByRole("row");
    expect(within(linhas[1]).getByText("4 dias a processar")).toBeTruthy();
    expect(within(linhas[1]).getByText("31/10 a 03/11/2026")).toBeTruthy();
    expect(within(linhas[1]).getByRole("button", { name: "Processar dias" })).toBeTruthy();
    expect(within(linhas[1]).queryByRole("link", { name: "Fechar período" })).toBeNull();
  });
});
