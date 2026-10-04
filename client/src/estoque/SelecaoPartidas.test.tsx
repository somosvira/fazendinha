// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelecaoPartidas, conferirDistribuicaoPartidas, nomeLoteProduto, type DistribuicaoPartida } from "./SelecaoPartidas";
import { listarPartidasNutricionais } from "../pecuaria/rebanho/nutricao/api";
import { previaLoteProduto } from "./api";
vi.mock("../pecuaria/rebanho/nutricao/api", () => ({ listarPartidasNutricionais: vi.fn() }));
vi.mock("./api", () => ({ previaLoteProduto: vi.fn() }));
beforeEach(() => { vi.mocked(previaLoteProduto).mockImplementation(async (_, validade) => ({ existente: validade === "2026-12-31" ? { id: "abc", codigo: "ABC", validade, saldo: "0", origemRastreio: "INFORMADA" } : null })); });
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
    fireEvent.change(screen.getByLabelText("Nome do lote 1"), { target: { value: "NOVO" } });
    fireEvent.click(screen.getByRole("button", { name: "Recebimento com validades diferentes" }));
    expect((screen.getByLabelText("Quantidade do lote 1") as HTMLInputElement).readOnly).toBe(false);
    fireEvent.change(screen.getByLabelText("Quantidade do lote 1"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Quantidade do lote 2"), { target: { value: "6" } });
    expect(screen.getByTestId("escolhas").textContent).toContain('"quantidade":"4"');
    expect(screen.getByTestId("escolhas").textContent).toContain('"quantidade":"6"');
  });
  it("prevê o lote existente pela validade sem pedir código de fabricante", async () => {
    render(<Cenário />);
    fireEvent.change(screen.getByLabelText("Situação da validade 1"), { target: { value: "INFORMADA" } });
    fireEvent.change(screen.getByLabelText("Validade do lote 1"), { target: { value: "2026-12-31" } });
    await screen.findByText(/Esta entrada será somada ao lote ABC/);
    expect(screen.getByTestId("escolhas").textContent).toContain('"validade":"2026-12-31"');
    expect(screen.queryByLabelText("Nome do lote 1")).toBeNull();
    expect(screen.queryByLabelText("Código do lote 1")).toBeNull();
  });
  it("sugere vencimento conhecido sem selecionar silenciosamente", async () => {
    render(<Cenário saida />);
    await screen.findByText(/Vencimento conhecido mais próximo/);
    expect((screen.getByLabelText("Lote 1") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("option", { name: /SEM.*não informada/ })).toBeTruthy();
  });
  it("consulta entradas no consolidado e saídas no sítio do fato", async () => {
    const tela = render(<Cenário />);
    await waitFor(() => expect(listarPartidasNutricionais).toHaveBeenCalledWith("p", null));
    tela.unmount(); render(<Cenário saida />);
    await waitFor(() => expect(listarPartidasNutricionais).toHaveBeenCalledWith("p", 1));
  });
  it("a sugestão considera a data do fato e exclui validade vencida", async () => {
    vi.mocked(listarPartidasNutricionais).mockResolvedValue([{ id: "velho", codigo: "VENCIDO", validade: "2026-09-30", saldo: "50", origemRastreio: "INFORMADA" }, { id: "novo", codigo: "VALIDO", validade: "2026-10-02", saldo: "10", origemRastreio: "INFORMADA" }]);
    render(<Cenário saida />);
    await screen.findByText("VALIDO");
    expect(screen.getByText(/Vencimento conhecido mais próximo/).textContent).not.toContain("VENCIDO");
  });
  it("nomes renomeados prevalecem e confirma ausência de validade fora de um form", () => {
    expect(nomeLoteProduto({ nome: "Recebimento sem validade", codigo: "LEGADO", origemRastreio: "LEGADO_NAO_IDENTIFICADO" })).toBe("Recebimento sem validade");
    expect(() => conferirDistribuicaoPartidas([{ partidaId: "l", quantidade: "10", validade: null }], 10, true)).toThrow(/ciência/);
    expect(() => conferirDistribuicaoPartidas([{ quantidade: "10" }], 10, false)).toThrow(/validade/);
    expect(() => conferirDistribuicaoPartidas([{ quantidade: "10", validade: null }], 10, false)).not.toThrow();
  });
  it("exige escolha explícita da ausência de validade na entrada", async () => {
    render(<Cenário />);
    expect(screen.getByTestId("escolhas").textContent).not.toContain('"validade":null');
    fireEvent.change(screen.getByLabelText("Situação da validade 1"), { target: { value: "NAO_INFORMADA" } });
    expect(screen.getByTestId("escolhas").textContent).toContain('"validade":null');
  });
  it("apagar nome opcional permite confirmar e conserva quantidade e validade", async () => {
    render(<Cenário />);
    fireEvent.change(screen.getByLabelText("Situação da validade 1"), { target: { value: "INFORMADA" } });
    fireEvent.change(screen.getByLabelText("Validade do lote 1"), { target: { value: "2027-01-31" } });
    await screen.findByText("Esta entrada criará um lote para esta validade.");
    fireEvent.change(screen.getByLabelText("Nome do lote 1"), { target: { value: "Recebimento novo" } });
    fireEvent.change(screen.getByLabelText("Nome do lote 1"), { target: { value: "" } });
    const escolhas = JSON.parse(screen.getByTestId("escolhas").textContent!) as DistribuicaoPartida[];
    expect(escolhas).toEqual([{ quantidade: "10", validade: "2027-01-31" }]);
    expect(() => conferirDistribuicaoPartidas(escolhas, 10, false)).not.toThrow();
  });
  it("persiste ciência explícita e a zera quando muda o lote", async () => {
    render(<Cenário saida />);
    await screen.findByRole("option", { name: /SEM.*não informada/ });
    fireEvent.change(screen.getByLabelText("Lote 1"), { target: { value: "sem" } });
    const ciencia = screen.getByRole("checkbox", { name: /Estou ciente/ }) as HTMLInputElement;
    expect(ciencia.required).toBe(true);
    expect(ciencia.checked).toBe(false);
    fireEvent.click(ciencia);
    expect(screen.getByTestId("escolhas").textContent).toContain('"cienciaValidadeDesconhecida":true');
    fireEvent.change(screen.getByLabelText("Lote 1"), { target: { value: "abc" } });
    expect(screen.getByTestId("escolhas").textContent).toContain('"cienciaValidadeDesconhecida":false');
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
