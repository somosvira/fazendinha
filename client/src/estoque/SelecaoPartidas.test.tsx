// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelecaoPartidas, type DistribuicaoPartida } from "./SelecaoPartidas";
import { listarPartidasNutricionais } from "../pecuaria/rebanho/nutricao/api";
vi.mock("../pecuaria/rebanho/nutricao/api", () => ({ listarPartidasNutricionais: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listarPartidasNutricionais).mockResolvedValue([{ id: "abc", codigo: "ABC", validade: "2026-12-31", saldo: "50", origemRastreio: "INFORMADA" }, { id: "sem", codigo: "SEM", validade: null, saldo: "5", origemRastreio: "INFORMADA" }]); });
afterEach(cleanup);
function Cenário({ saida = false, quantidade = "10" }: { saida?: boolean; quantidade?: string }) {
  const [valor, setValor] = useState<DistribuicaoPartida[]>([]);
  return <><SelecaoPartidas produtoId="p" propriedadeId={1} dataFato="2026-10-02" quantidade={quantidade} unidade="ML" saida={saida} valor={valor} onChange={setValor} /><output data-testid="escolhas">{JSON.stringify(valor)}</output></>;
}
describe("lotes do produto", () => {
  it("inicia um lote com a quantidade do item; divisão é explícita", async () => {
    render(<Cenário />);
    await waitFor(() => expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).value).toBe("10"));
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText("Código do lote 1"), { target: { value: "NOVO" } });
    fireEvent.click(screen.getByRole("button", { name: "Dividir entre lotes" }));
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).readOnly).toBe(false);
    fireEvent.change(screen.getByLabelText("Quantidade do lote 1"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Quantidade do lote 2"), { target: { value: "6" } });
    expect(screen.getByTestId("escolhas").textContent).toContain('"quantidade":"4"');
    expect(screen.getByTestId("escolhas").textContent).toContain('"quantidade":"6"');
  });
  it("reutiliza lote existente na entrada com código e validade preservados", async () => {
    render(<Cenário />);
    await screen.findByRole("option", { name: /ABC · saldo/ });
    fireEvent.change(screen.getByLabelText("Lote 1"), { target: { value: "abc" } });
    expect(screen.getByTestId("escolhas").textContent).toContain('"partidaId":"abc"');
    expect(screen.getByTestId("escolhas").textContent).toContain('"validade":"2026-12-31"');
    expect(screen.queryByLabelText("Código do lote 1")).toBeNull();
  });
  it("sugere vencimento conhecido sem selecionar silenciosamente", async () => {
    render(<Cenário saida />);
    await screen.findByText(/Vencimento conhecido mais próximo/);
    expect((screen.getByLabelText("Lote 1") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("option", { name: /SEM.*não informada/ })).toBeTruthy();
  });
});
