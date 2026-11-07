// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { UsoProdutoDietas } from "./UsoProdutoDietas";

const mocks = vi.hoisted(() => ({ visao: vi.fn(), dietas: vi.fn() }));
vi.mock("./api", () => ({ consultarVisaoNutricional: mocks.visao, listarDietas: mocks.dietas }));
afterEach(cleanup);

const lote = (id: string, sitio: number, animais: number, dietaId: string | null) => ({ lote: { id, nome: id, propriedadeId: sitio, animaisAtivos: animais, propriedade: { id: sitio, nome: `Sítio ${sitio}` } }, vigente: dietaId ? { id: `v-${id}`, desde: "2026-10-01", ate: null, dieta: { id: dietaId, nome: dietaId, versao: 2 } } : null });

describe("uso do produto nas dietas", () => {
  it("soma o consumo dos lotes do sítio que usam o produto e diz para quantos dias o saldo dá", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [lote("Lactantes", 1, 10, "lactacao"), lote("Secas", 1, 5, null), lote("Outro sítio", 2, 50, "lactacao"), lote("Novilhas", 1, 4, "crescimento")] });
    mocks.dietas.mockResolvedValue([{ id: "lactacao", itens: [{ produtoId: "silagem", quantidadeCabecaDia: "10", unidade: "KG" }] }, { id: "crescimento", itens: [{ produtoId: "racao", quantidadeCabecaDia: "2", unidade: "KG" }] }]);
    render(<UsoProdutoDietas produtoId="silagem" propriedadeId={1} saldo={1000} unidade="kg" />);
    expect(await screen.findAllByText("Lactantes")).toBeTruthy();
    // Só Lactantes no sítio 1 usa a silagem: 10 × 10 = 100 kg/dia; 1.000 kg dão 10 dias.
    expect(screen.getByText("100 kg/dia")).toBeTruthy();
    expect(screen.getByText("10 dias")).toBeTruthy();
    expect(screen.queryByText("Outro sítio")).toBeNull();
    expect(screen.queryByText("Novilhas")).toBeNull();
  });
  it("não aparece quando nenhuma dieta usa o produto", async () => {
    mocks.visao.mockResolvedValue({ verValores: true, lotes: [lote("Lactantes", 1, 10, "lactacao")] });
    mocks.dietas.mockResolvedValue([{ id: "lactacao", itens: [] }]);
    const { container } = render(<UsoProdutoDietas produtoId="silagem" saldo={10} unidade="kg" />);
    await vi.waitFor(() => expect(container.querySelector(".produto-ficha-dietas")).toBeNull());
  });
});
