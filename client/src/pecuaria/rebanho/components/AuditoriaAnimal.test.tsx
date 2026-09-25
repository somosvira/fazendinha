// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuditoriaAnimal } from "./AuditoriaAnimal";
import { buscarAuditoriaAnimal } from "../api";
import type { EntradaAuditoria } from "../types";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  buscarAuditoriaAnimal: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const entrada = (indice: number): EntradaAuditoria => ({
  em: `2026-09-2${indice}T14:32:00.000Z`,
  acao: "EDITAR",
  entidade: "Animal",
  usuarioNome: "Ana",
  resumo: `Alteração ${indice}`,
  entidadeId: "animal-1",
  alteracoes: [{ campo: "pesoKg", rotulo: "Peso", antes: "300", depois: "310" }],
});

describe("AuditoriaAnimal", () => {
  it("mostra data e hora de cada entrada", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [entrada(1)], total: 1 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    // não fixa o fuso horário do ambiente de teste: só confere que data e hora aparecem juntas
    expect(screen.getByText(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/)).toBeTruthy();
  });

  it("expande e mostra as alterações (campo: antes → depois) ao clicar em 'Ver alterações'", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [entrada(1)], total: 1 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    const botao = screen.getByRole("button", { name: "Ver alterações" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(botao);
    expect(screen.getByRole("button", { name: "Ocultar alterações" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Peso:")).toBeTruthy();
    expect(screen.getByText(/300 → 310/)).toBeTruthy();
  });

  it("null nas alterações vira travessão", async () => {
    const entradaSemAntes: EntradaAuditoria = { ...entrada(1), alteracoes: [{ campo: "observacao", rotulo: "Observação", antes: null, depois: "Nova nota" }] };
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [entradaSemAntes], total: 1 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    fireEvent.click(screen.getByRole("button", { name: "Ver alterações" }));
    expect(screen.getByText(/— → Nova nota/)).toBeTruthy();
  });

  it("sem alterações, não mostra o botão 'Ver alterações'", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [{ ...entrada(1), alteracoes: [] }], total: 1 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    expect(screen.queryByRole("button", { name: "Ver alterações" })).toBeNull();
  });

  it("'Carregar mais' busca a próxima página e acumula os itens", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValueOnce({ itens: [entrada(1)], total: 25 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    expect(screen.queryByText("Alteração 2")).toBeNull();

    vi.mocked(buscarAuditoriaAnimal).mockResolvedValueOnce({ itens: [entrada(2)], total: 25 });
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await screen.findByText("Alteração 2");
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", { page: 2, pageSize: 20 });
    // itens 1 e 2 continuam ambos na tela
    expect(screen.getByText("Alteração 1")).toBeTruthy();
  });

  it("sem mais páginas, não mostra 'Carregar mais'", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [entrada(1)], total: 1 });
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Alteração 1");
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("sem nenhum registro, mostra o estado vazio", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [], total: 0 });
    render(<AuditoriaAnimal id="animal-1" />);
    await waitFor(() => expect(screen.getByText("Nenhum registro de auditoria.")).toBeTruthy());
  });

  it("mudar recarregarToken busca de novo a partir da página 1", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ itens: [entrada(1)], total: 1 });
    const { rerender } = render(<AuditoriaAnimal id="animal-1" recarregarToken={0} />);
    await screen.findByText("Alteração 1");
    vi.mocked(buscarAuditoriaAnimal).mockClear();
    rerender(<AuditoriaAnimal id="animal-1" recarregarToken={1} />);
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenCalledWith("animal-1", { page: 1, pageSize: 20 }));
  });
});
