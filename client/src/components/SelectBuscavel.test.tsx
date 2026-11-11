// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SelectBuscavel, type OpcaoBuscavel } from "./SelectBuscavel";

const fabricantes: OpcaoBuscavel[] = [{ id: "f1", nome: "Bayer S.A." }, { id: "f2", nome: "Ourofino Saúde Animal" }, { id: "f3", nome: "Fabricante antigo", ativo: false }];
const buscar = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  buscar.mockImplementation(async ({ busca, selecionadoId }: { busca: string; selecionadoId?: string }) => {
    if (selecionadoId) { const i = fabricantes.filter(f => f.id === selecionadoId); return { itens: i, total: i.length }; }
    const t = busca.toLowerCase(); const itens = fabricantes.filter(f => f.ativo !== false && f.nome.toLowerCase().includes(t));
    return { itens, total: itens.length };
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const abrir = (rotulo = "Fabricante") => fireEvent.click(screen.getByRole("combobox", { name: rotulo }));

it("abre com a lista, filtra pelo que é digitado e devolve a opção escolhida", async () => {
  const onChange = vi.fn();
  render(<SelectBuscavel rotulo="Fabricante" valor="" onChange={onChange} buscar={buscar} />);
  abrir();
  expect(await screen.findByText("Ourofino Saúde Animal")).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Buscar fabricante"), { target: { value: "bayer" } });
  await waitFor(() => expect(buscar).toHaveBeenLastCalledWith({ busca: "bayer" }));
  await waitFor(() => expect(screen.queryByText("Ourofino Saúde Animal")).toBeNull());
  fireEvent.click(screen.getByText("Bayer S.A."));
  expect(onChange).toHaveBeenCalledWith("f1", expect.objectContaining({ nome: "Bayer S.A." }));
});

it("mostra o nome da referência escolhida, inclusive inativa, consultando por ID", async () => {
  render(<SelectBuscavel rotulo="Fabricante" valor="f3" onChange={vi.fn()} buscar={buscar} />);
  expect(await screen.findByText("Fabricante antigo (inativo)")).toBeTruthy();
  expect(buscar).toHaveBeenCalledWith({ busca: "", selecionadoId: "f3" });
});

it("limpa a seleção com onChange vazio", async () => {
  const onChange = vi.fn();
  render(<SelectBuscavel rotulo="Fabricante" valor="f1" onChange={onChange} buscar={buscar} />);
  await screen.findByText("Bayer S.A.");
  fireEvent.click(screen.getByRole("button", { name: "Limpar Fabricante" }));
  expect(onChange).toHaveBeenCalledWith("");
});

it("sem resultado, avisa o termo buscado", async () => {
  render(<SelectBuscavel rotulo="Fabricante" valor="" onChange={vi.fn()} buscar={buscar} />);
  abrir();
  await screen.findByText("Bayer S.A.");
  fireEvent.change(screen.getByPlaceholderText("Buscar fabricante"), { target: { value: "xyzxyz" } });
  expect(await screen.findByText("Nenhum resultado para “xyzxyz”.")).toBeTruthy();
});

it("erro de consulta oferece Tentar novamente", async () => {
  buscar.mockRejectedValueOnce(new Error("Falha de rede"));
  render(<SelectBuscavel rotulo="Fabricante" valor="" onChange={vi.fn()} buscar={buscar} />);
  abrir();
  expect(await screen.findByText("Falha de rede")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByText("Bayer S.A.")).toBeTruthy();
});

it("avisa quando há mais resultados do que os exibidos", async () => {
  buscar.mockResolvedValueOnce({ itens: fabricantes.slice(0, 2), total: 72 });
  render(<SelectBuscavel rotulo="Fabricante" valor="" onChange={vi.fn()} buscar={buscar} />);
  abrir();
  expect(await screen.findByText("Mostrando 2 de 72. Digite para refinar.")).toBeTruthy();
});

it("somente leitura mostra o nome sem controles", async () => {
  render(<SelectBuscavel rotulo="Fabricante" valor="f1" onChange={vi.fn()} buscar={buscar} somenteLeitura />);
  expect(await screen.findByText("Referência planejada")).toBeTruthy();
  expect(screen.queryByRole("combobox")).toBeNull();
});

it("exibe o detalhe da opção selecionada e o erro do campo", async () => {
  render(<SelectBuscavel rotulo="Fabricante" valor="f1" onChange={vi.fn()} buscar={buscar} detalhe={o => <p>Detalhe de {o.nome}</p>} erroCampo="Campo inválido" />);
  expect(await screen.findByText("Detalhe de Bayer S.A.")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toBe("Campo inválido");
});
