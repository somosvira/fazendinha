// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProximosFechamentos } from "./ProximosFechamentos";

const mocks = vi.hoisted(() => ({ visao: vi.fn(), ultimo: vi.fn() }));
vi.mock("./api", () => ({ consultarVisaoNutricional: mocks.visao, ultimoFechamentoConfirmado: mocks.ultimo }));
vi.mock("../../../financeiro/financeiro-ui", async (original) => ({ ...(await original<object>()), hoje: () => "2026-11-04" }));
afterEach(cleanup);

const lote = (id: string, nome: string) => ({ id, nome, ativo: true, propriedade: { id: 1, nome: "Sítio principal" } });
const resumo = (id: string, nome: string, desde: string) => ({ lote: lote(id, nome), vigente: { id: `v-${id}`, desde, ate: null, dieta: { id: "d", nome: "Dieta", versao: 1 } }, programada: null, verValores: true, custos: {} });

describe("Próximos fechamentos", () => {
  it("mostra até onde cada lote foi fechado e quantos dias faltam, com os mais atrasados primeiro", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [resumo("a", "Novilhas", "2026-10-01"), resumo("b", "Lactantes", "2026-10-20"), { ...resumo("c", "Sem dieta", "2026-10-01"), vigente: null }] });
    mocks.ultimo.mockImplementation(async (id: string) => id === "a" ? { fim: "2026-11-03" } : null);
    render(<ProximosFechamentos podeLancar />);
    const linhas = await screen.findAllByRole("row");
    expect(screen.getByText("2 lotes têm consumo a fechar até hoje.")).toBeTruthy();
    // Lactantes nunca fechou: conta desde o início da dieta (20/10 a 04/11 = 16 dias).
    expect(within(linhas[1]).getByText("Lactantes")).toBeTruthy();
    expect(within(linhas[1]).getByText("16 dias")).toBeTruthy();
    expect(within(linhas[1]).getByText("Nenhum fechamento")).toBeTruthy();
    // Novilhas está fechado até ontem (03/11): falta só hoje.
    expect(within(linhas[2]).getByText("1 dia")).toBeTruthy();
    expect(screen.queryByText("Sem dieta")).toBeNull();
    expect(within(linhas[1]).getByRole("link", { name: "Fechar período" })).toBeTruthy();
    expect(within(linhas[2]).getByRole("link", { name: "Fechar período" })).toBeTruthy();
  });
});
