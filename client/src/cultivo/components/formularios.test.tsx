// @vitest-environment jsdom
// Formulários do milho: selects e datas estilizados e explicações simples.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const apiMocks = vi.hoisted(() => ({
  criarLancamentoCusto: vi.fn(),
  criarProducaoCultivo: vi.fn(),
  criarSilo: vi.fn(),
  criarMovimentoSilo: vi.fn(),
  criarSafraCultivo: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../api")>(),
  ...apiMocks,
  useAreasCultivo: () => ({ data: [{ id: 3, codigo: "A1" }], loading: false, erro: null }),
  useSilos: () => ({ data: [{ id: 9, nome: "Silo bolsa 1" }], loading: false, erro: null, recarregar: vi.fn() }),
}));

import { LancamentoCustoForm } from "./CustosTab";
import { ProducaoForm } from "./ProducaoTab";
import { SiloForm, MovimentoSiloForm } from "./SilosTab";
import { SafraForm } from "./SafrasTab";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const hoje = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const DIA_1 = `1 de ${MESES[hoje.getMonth()]} de ${hoje.getFullYear()}`;
const ISO_1 = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
const props = { onFechar: vi.fn(), onSalvo: vi.fn() };
const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));

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
  await tick();
}
async function escolherDia(rotulo: string) {
  fireEvent.click(screen.getByRole("button", { name: rotulo }));
  fireEvent.click(await screen.findByRole("button", { name: DIA_1 }));
  await tick();
}

describe("LancamentoCustoForm", () => {
  it("explica custeio x investimento e envia as escolhas", async () => {
    render(<LancamentoCustoForm safraCultivoId={1} {...props} />);
    expect((await abrirOpcao("Classe", "Investimento")).textContent).toContain("não entra no custo por hectare");
    expect(screen.getByRole("option", { name: "Custeio" }).textContent).toContain("custo por hectare");
    fireEvent.click(screen.getByRole("option", { name: "Investimento" }));
    await tick();
    expect((await abrirOpcao("Tipo", "Tratos culturais")).textContent).toContain("durante o ciclo");
    fireEvent.click(screen.getByRole("option", { name: "Tratos culturais" }));
    await tick();
    await escolher("Área", "A1");
    await escolherDia("Data");
    fireEvent.change(screen.getByPlaceholderText("Ex.: Adubação de cobertura — ureia"), { target: { value: "Capina" } });
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await tick();
    expect(apiMocks.criarLancamentoCusto).toHaveBeenCalledWith(expect.objectContaining({
      classe: "INVESTIMENTO", tipo: "TRATOS", areaCultivoId: 3, data: ISO_1,
    }));
  });
});

describe("ProducaoForm", () => {
  it("explica tipo e destino e mostra o silo quando o destino é silo", async () => {
    render(<ProducaoForm safraCultivoId={1} {...props} />);
    expect((await abrirOpcao("Tipo", "Silagem (TON)")).textContent).toContain("toneladas");
    fireEvent.click(screen.getByRole("option", { name: "Silagem (TON)" }));
    await tick();
    expect((await abrirOpcao("Destino", "Silo")).textContent).toContain("saldo");
    fireEvent.click(screen.getByRole("option", { name: "Silo" }));
    await tick();
    await escolher("Silo", "Silo bolsa 1");
    expect(campo("Silo").textContent).toBe("Silo bolsa 1");
  });
});

describe("Silos", () => {
  it("explica o tipo do silo", async () => {
    render(<SiloForm {...props} />);
    expect((await abrirOpcao("Tipo", "Grão")).textContent).toContain("sacas");
  });

  it("explica a origem da saída", async () => {
    render(<MovimentoSiloForm siloId={9} {...props} />);
    expect((await abrirOpcao("Origem", "Ajuste")).textContent).toContain("Corrige o saldo");
    fireEvent.click(screen.getByRole("option", { name: "Ajuste" }));
    await tick();
    expect(campo("Origem").textContent).toBe("Ajuste");
  });
});

describe("SafraForm", () => {
  it("usa o seletor de data no início", async () => {
    render(<SafraForm modo="novo" {...props} />);
    await escolherDia("Início");
    expect(screen.getByRole("button", { name: "Início" }).textContent).toBe(`01/${pad(hoje.getMonth() + 1)}/${hoje.getFullYear()}`);
  });
});
