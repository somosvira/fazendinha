// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { BaixaEstoqueCard } from "./BaixaEstoqueCard";

const categoria = { id: 1, nome: "Sanidade", usoSanitario: true, usoNutricional: false, usoAgricola: false };
const saldo = (o: Record<string, unknown>) => ({ produtoId: 1, nome: "Ivermectina", categoria, unidade: "ML", centrosCusto: [], saldo: 10, custoMedio: 2, valor: 20, minimoEstoque: null, abaixoMinimo: false, ...o });

function mockFetch(saldos: unknown[]) {
  return vi.fn((url: string, init?: RequestInit) => {
    const body = /\/estoque\/saldos/.test(url) ? saldos : /\/estoque\/movimentos/.test(url) && init?.method === "POST" ? { id: 1, operacaoId: 2 } : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  });
}

const props = { animalId: "1", produtoDigitado: "Ivermectina", data: "2026-09-20", tipo: "APLICACAO" as const, onFechar: vi.fn(), onBaixaFeita: vi.fn() };
const botao = () => screen.getByRole("button", { name: /Dar baixa no estoque/ }) as HTMLButtonElement;
const postou = (f: ReturnType<typeof mockFetch>) => f.mock.calls.filter(([u, i]) => /\/estoque\/movimentos/.test(String(u)) && (i as RequestInit | undefined)?.method === "POST");

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("BaixaEstoqueCard", () => {
  it("produto sem saldo no sítio: mostra a mensagem e desabilita a baixa", async () => {
    const f = mockFetch([saldo({ produtoId: 2, nome: "Outro", saldo: 0 }), saldo({ produtoId: 3, nome: "Negativo", saldo: -4 })]);
    vi.stubGlobal("fetch", f);
    render(<BaixaEstoqueCard {...props} />);
    expect(await screen.findByText(/Este produto não tem saldo em estoque nesta fazenda — registre uma compra ou um ajuste em Nova operação/)).toBeTruthy();
    expect(botao().disabled).toBe(true);
    // produtos sem saldo positivo nem são oferecidos
    expect(screen.queryByRole("option", { name: /Outro|Negativo/ })).toBeNull();
    fireEvent.click(botao());
    expect(postou(f)).toHaveLength(0);
  });

  it("com saldo: habilita e registra a baixa como ajuste negativo", async () => {
    const f = mockFetch([saldo({})]);
    vi.stubGlobal("fetch", f);
    render(<BaixaEstoqueCard {...props} />);
    await screen.findByText(/Saldo disponível: 10/);
    expect(botao().disabled).toBe(false);
    fireEvent.click(botao());
    await waitFor(() => expect(postou(f)).toHaveLength(1));
    const corpo = JSON.parse(String((postou(f)[0][1] as RequestInit).body));
    expect(corpo).toMatchObject({ produtoId: 1, tipo: "AJUSTE", quantidade: -1 });
  });

  it("quantidade acima do saldo bloqueia a baixa", async () => {
    const f = mockFetch([saldo({})]);
    vi.stubGlobal("fetch", f);
    render(<BaixaEstoqueCard {...props} />);
    await screen.findByText(/Saldo disponível: 10/);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "11" } });
    expect(screen.getByText(/Quantidade acima do saldo disponível/)).toBeTruthy();
    expect(botao().disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "10" } });
    expect(botao().disabled).toBe(false);
  });
});
