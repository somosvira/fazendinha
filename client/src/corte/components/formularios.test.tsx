// @vitest-environment jsdom
// Formulários do gado de corte: selects e datas estilizados (RebSelect/CampoData)
// e as explicações simples das opções com jargão.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Lote } from "../types";

const apiMocks = vi.hoisted(() => ({
  criarLote: vi.fn(),
  editarLote: vi.fn(),
  darBaixa: vi.fn(),
  criarPesagem: vi.fn(),
  registrarManejoSanitario: vi.fn(),
  registrarOperacaoComercial: vi.fn(),
  registrarSuplementacao: vi.fn(),
}));

vi.mock("../api", () => ({
  ...apiMocks,
  usePiquetes: () => ({ data: [{ id: "1", codigo: "PQ-01", nome: "Baixada" }, { id: "2", codigo: "PQ-02", nome: "Morro" }] }),
}));

import { LoteForm } from "./LoteForm";
import { ManejoForm } from "./ManejoForm";
import { OperacaoComercialForm } from "./OperacaoComercialForm";
import { PesagemForm } from "./PesagemForm";
import { SuplementacaoForm } from "./SuplementacaoForm";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const DIA_1 = `1 de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
const DIA_1_BR = `01/${pad(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;

const lote: Lote = {
  id: "7", codigo: "REC-A", nome: "Recria A", categoria: "GAROTE", fase: "RECRIA", raca: "Nelore",
  numCabecas: 40, numCabecasEntrada: 40, dataFormacao: "2026-01-10", estado: "ATIVO", resumo: { loteId: "7", pesoMedio: 300 },
};
const props = { onFechar: vi.fn(), onSalvo: vi.fn() };

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Object.values(apiMocks).forEach((m) => m.mockReset().mockResolvedValue({}));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const campo = (nome: string) => screen.getByRole("combobox", { name: nome });
async function abrirOpcao(rotulo: string, opcao: string) {
  fireEvent.click(campo(rotulo));
  return screen.findByRole("option", { name: opcao });
}
async function escolher(rotulo: string, opcao: string) {
  fireEvent.click(await abrirOpcao(rotulo, opcao));
  await act(() => new Promise((r) => setTimeout(r, 0)));
}
async function escolherDia(rotulo: string) {
  fireEvent.click(screen.getByRole("button", { name: rotulo }));
  fireEvent.click(await screen.findByRole("button", { name: DIA_1 }));
  await act(() => new Promise((r) => setTimeout(r, 0)));
}

describe("LoteForm", () => {
  it("explica categoria e fase na lista e envia o que foi escolhido", async () => {
    render(<LoteForm modo="novo" {...props} />);
    expect((await abrirOpcao("Categoria", "Novilhas")).textContent).toContain("Fêmeas de 12 a 24 meses");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await escolher("Categoria", "Novilhas");
    expect(campo("Categoria").textContent).toBe("Novilhas");
    expect((await abrirOpcao("Fase", "Terminação")).textContent).toContain("Engorda final");
    fireEvent.click(screen.getByRole("option", { name: "Terminação" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await escolher("Piquete atual", "PQ-02 · Morro");
    expect(campo("Piquete atual").textContent).toContain("PQ-02 · Morro");
    await escolherDia("Data de formação");
    expect(screen.getByRole("button", { name: "Data de formação" }).textContent).toBe(DIA_1_BR);

    fireEvent.change(screen.getByPlaceholderText("Ex.: TER-03"), { target: { value: "NOV-1" } });
    fireEvent.change(screen.getByPlaceholderText("Ex.: Terminação F1 · lote 3"), { target: { value: "Novilhas 1" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(apiMocks.criarLote).toHaveBeenCalledWith(expect.objectContaining({
      categoria: "NOVILHA", fase: "TERMINACAO", piqueteAtual: "PQ-02", dataFormacao: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`,
    }));
  });

  it("explica a diferença entre vendido e extinto na baixa", async () => {
    render(<LoteForm modo="baixa" lote={lote} {...props} />);
    const extinto = await abrirOpcao("Tipo de baixa", "Extinto (transferência / dissolução do lote)");
    expect(extinto.textContent).toContain("sem venda");
    fireEvent.click(extinto);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baixa" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(apiMocks.darBaixa).toHaveBeenCalledWith("7", { estado: "EXTINTO", motivo: undefined });
  });
});

describe("ManejoForm", () => {
  it("explica vacinas e vermifugação na lista", async () => {
    render(<ManejoForm lote={lote} {...props} />);
    expect((await abrirOpcao("Tipo de manejo", "Vermifugação — esquema 5/8/11")).textContent).toContain("maio, agosto e novembro");
    expect(screen.getByRole("option", { name: "Vacina — Brucelose B19 (fêmeas 3-8 meses)" }).textContent).toContain("Obrigatória");
    fireEvent.click(screen.getByRole("option", { name: "Vermifugação — esquema 5/8/11" }));
    expect(campo("Tipo de manejo").textContent).toBe("Vermifugação — esquema 5/8/11");
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await escolherDia("Próxima dose");
    expect(screen.getByRole("button", { name: "Próxima dose" }).textContent).toBe(DIA_1_BR);
  });
});

describe("OperacaoComercialForm", () => {
  it("explica o efeito de cada tipo no lote", async () => {
    render(<OperacaoComercialForm lote={lote} {...props} />);
    expect((await abrirOpcao("Tipo de operação", "Compra (reposição)")).textContent).toContain("não muda sozinho");
    expect(screen.getByRole("option", { name: "Venda — abate (frigorífico)" }).textContent).toContain("vendido");
    fireEvent.click(screen.getByRole("option", { name: "Descarte (vaca / touro)" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.click(screen.getByRole("button", { name: "Salvar operação" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(apiMocks.registrarOperacaoComercial).toHaveBeenCalledWith(expect.objectContaining({ tipo: "DESCARTE", loteId: "7" }));
  });
});

describe("PesagemForm", () => {
  it("explica os métodos de pesagem e usa o seletor de data", async () => {
    render(<PesagemForm lote={lote} {...props} />);
    expect((await abrirOpcao("Método", "Fita torácica")).textContent).toContain("volta do peito");
    fireEvent.click(screen.getByRole("option", { name: "Fita torácica" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    await escolherDia("Data");
    fireEvent.click(screen.getByRole("button", { name: "Salvar pesagem" }));
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(apiMocks.criarPesagem).toHaveBeenCalledWith("7", expect.objectContaining({
      metodo: "FITA_TORACICA", data: `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`,
    }));
  });
});

describe("SuplementacaoForm", () => {
  it("explica o suplemento e repõe os valores do catálogo", async () => {
    render(<SuplementacaoForm lote={lote} {...props} />);
    expect((await abrirOpcao("Tipo de suplemento", "Proteinado 30% PB · seca")).textContent).toContain("proteína bruta");
    fireEvent.click(screen.getByRole("option", { name: "Proteinado 30% PB · seca" }));
    expect((screen.getByPlaceholderText("Ex.: Proteinado 30% PB") as HTMLInputElement).value).toBe("Proteinado 30% PB");
  });
});
