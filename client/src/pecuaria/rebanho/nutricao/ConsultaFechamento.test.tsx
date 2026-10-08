// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsultaFechamento } from "./ConsultaFechamento";
import * as api from "./api";
vi.mock("./api", () => ({ obterFechamento: vi.fn(), estornarConsumo: vi.fn() }));
const fechamento: api.Fechamento = { id: "f", inicio: "2026-10-01", fim: "2026-10-02", animalDias: 2, status: "CONFIRMADO", propriedadeId: 2, propriedade: { id: 2, nome: "Destino" }, lote: { id: "l", nome: "Matrizes" }, verValores: false, custoConhecido: null, coberturaCustoCompleta: false, centroCusto: { nome: "Pecuária" }, vigencia: { dieta: { nome: "Dieta", versao: 1 } }, participacoes: [], itens: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.obterFechamento).mockResolvedValue(fechamento); });
afterEach(cleanup);
describe("detalhe e formulário de estorno", () => {
  it("abre revisão própria sem os cards de consulta e conserva o motivo ao falhar", async () => {
    vi.mocked(api.estornarConsumo).mockRejectedValueOnce(new Error("Período financeiro fechado"));
    render(<ConsultaFechamento id="f" estorno podeLancar onVoltar={vi.fn()} />);
    await screen.findByLabelText("Motivo do estorno");
    expect(screen.queryByText("Consumo e estoque")).toBeNull();
    const botao = screen.getByRole("button", { name: "Confirmar estorno com motivo" });
    expect(botao.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Motivo do estorno"), { target: { value: "Revisão conferida" } });
    fireEvent.click(botao);
    await screen.findByText("Período financeiro fechado");
    expect(screen.getByLabelText("Motivo do estorno")).toHaveProperty("value", "Revisão conferida");
    expect(api.estornarConsumo).toHaveBeenCalledWith("f", { propriedadeId: 2, motivo: "Revisão conferida" });
    vi.mocked(api.estornarConsumo).mockResolvedValue({});
    vi.mocked(api.obterFechamento).mockResolvedValue({ ...fechamento, status: "ESTORNADO", motivoEstorno: "Revisão conferida" });
    fireEvent.click(botao);
    await waitFor(() => expect(screen.queryByLabelText("Motivo do estorno")).toBeNull());
    expect(screen.getByText(/excluído dos custos atuais/)).toBeTruthy();
  });
  it("não abre estorno para usuário de consulta nem mostra custo", async () => {
    render(<ConsultaFechamento id="f" estorno podeLancar={false} onVoltar={vi.fn()} />);
    await screen.findByText("Consumo e estoque");
    expect(screen.queryByLabelText("Motivo do estorno")).toBeNull();
    expect(screen.queryByText("Custo conhecido")).toBeNull();
  });
});
