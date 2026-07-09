// @vitest-environment jsdom
/* Fluxos principais do Lançar (saída e entrada) pós-migração Tailwind/shadcn:
 * o comportamento (estado, validação, payload do POST) tem que ser idêntico
 * ao da versão CSS legado. API real mockada — nada de rede aqui. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Lancar } from "./Lancar";

const { criarLancamentoMock } = vi.hoisted(() => ({
  criarLancamentoMock: vi.fn(),
}));

const CADASTROS = {
  centrosCusto: [
    { id: 1, nome: "Atividade Leiteira", ehInvestimento: false },
    { id: 2, nome: "Plantio Café", ehInvestimento: false },
    { id: 3, nome: "Atividade Leiteira - Investimento", ehInvestimento: true },
  ],
  contas: [{ id: 10, nome: "Banco do Brasil ag. 1234", banco: "BB" }],
  grupos: [{ id: 100, nome: "Insumos", categorias: [{ id: 1000, nome: "Ração" }] }],
  fornecedores: [{ id: 50, nome: "Cooperativa Boa Vista", documento: null }],
};

vi.mock("../financeiro/api", () => ({
  useCadastros: () => ({ data: CADASTROS, loading: false, erro: null, recarregar: vi.fn() }),
  criarLancamento: criarLancamentoMock,
  uploadPendenteNF: vi.fn(),
  cancelarPendenteNF: vi.fn(),
}));

vi.mock("./Shell", () => ({ ReportHeader: () => null }));

vi.mock("./Toast", () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../data/rionovo", () => ({ default: { UPDATED_AT: "01/07/2026" } }));

// jsdom 29 + vitest 2 não expõem localStorage no global do test env —
// stub simples em memória (o componente usa a API padrão via try/catch).
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

beforeEach(() => {
  store.clear();
  criarLancamentoMock.mockReset();
});
afterEach(cleanup);

function preencherSaida() {
  fireEvent.change(screen.getByPlaceholderText("Digite o nome do fornecedor…"), {
    target: { value: "Agropecuária Silva" },
  });
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "1.234,56" } });
  fireEvent.click(screen.getByRole("button", { name: /Leite/ })); // atividade
  fireEvent.click(screen.getByRole("button", { name: "Insumos" })); // grupo
  fireEvent.click(screen.getByRole("button", { name: "Ração" })); // categoria
}

describe("Lancar — fluxo de saída (gasto)", () => {
  it("registra um gasto com o payload DEBITO correto e mostra a tela de sucesso", async () => {
    criarLancamentoMock.mockResolvedValue({ ok: true, lancamentoId: 77 });
    render(<Lancar onNav={vi.fn()} />);

    const registrar = screen.getByRole("button", { name: "Registrar gasto →" });
    expect((registrar as HTMLButtonElement).disabled).toBe(true);

    preencherSaida();
    expect((registrar as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(registrar);
    expect(await screen.findByText(/Gasto registrado · #77/)).toBeTruthy();

    expect(criarLancamentoMock).toHaveBeenCalledTimes(1);
    const payload = criarLancamentoMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      natureza: "DEBITO",
      valorBR: "1.234,56",
      categoriaId: 1000,
      centroCustoId: 1, // Atividade Leiteira (custeio)
      contaBancariaId: 10,
      fornecedorId: null,
      fornecedorNome: "Agropecuária Silva",
      pago: true,
    });
  });

  it("toggle 'É investimento' troca o centro de custo para a variante Investimento", async () => {
    criarLancamentoMock.mockResolvedValue({ ok: true, lancamentoId: 78 });
    render(<Lancar onNav={vi.fn()} />);

    preencherSaida();
    const info = screen.getByText("É investimento, não custeio");
    const row = info.parentElement!.parentElement!;
    fireEvent.click(row.querySelector('[role="button"]')!);

    fireEvent.click(screen.getByRole("button", { name: "Registrar gasto →" }));
    expect(await screen.findByText(/Gasto registrado · #78/)).toBeTruthy();
    expect(criarLancamentoMock.mock.calls[0][0].centroCustoId).toBe(3);
  });
});

describe("Lancar — fluxo de entrada (receita)", () => {
  it("registra uma entrada CREDITO com quantidade na descrição", async () => {
    criarLancamentoMock.mockResolvedValue({ ok: true, lancamentoId: 99 });
    render(<Lancar onNav={vi.fn()} />);

    fireEvent.click(screen.getByText("Entrada").closest("button")!);

    fireEvent.change(screen.getByPlaceholderText("Quem comprou / pagou…"), {
      target: { value: "Embaré" },
    });
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "88.830,00" } });
    fireEvent.change(screen.getByPlaceholderText("ex.: 25380"), { target: { value: "25380" } });
    fireEvent.click(screen.getByRole("button", { name: "Insumos" }));
    fireEvent.click(screen.getByRole("button", { name: "Ração" }));

    fireEvent.click(screen.getByRole("button", { name: "Registrar entrada →" }));
    expect(await screen.findByText("Entrada registrada")).toBeTruthy();

    const payload = criarLancamentoMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      natureza: "CREDITO",
      valorBR: "88.830,00",
      categoriaId: 1000,
      centroCustoId: 1, // default do tipo "leite"
      pago: true,
      descricao: "25380 litros",
    });
  });
});
