// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { VisaoGeral } from "./VisaoGeral";
import { obterPainelRebanho } from "../api";
import type { PainelGeral } from "../types";
import { navegarPara } from "../../../router";

vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  obterPainelRebanho: vi.fn(),
}));
vi.mock("../../../router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../router")>()),
  navegarPara: vi.fn(),
}));

const painelMock: PainelGeral = {
  ativos: 120,
  porCategoria: [
    { categoriaId: "cat-vaca", categoria: "Vaca", qtd: 80 },
    { categoriaId: null, categoria: "Sem categoria", qtd: 5 },
  ],
  porSitio: [
    { propriedadeId: 1, nome: "Sede", qtd: 100 },
    { propriedadeId: null, nome: "Sem sítio", qtd: 2 },
  ],
  receptorasPct: 40,
  baixas30d: 6,
  ultimosEventos: [{ tipo: "CADASTRO", animalId: "a1", brinco: "0001", data: "2026-03-01" }],
  baixasPorTipo: [{ tipo: "VENDA", qtd: 4 }, { tipo: "MORTE", qtd: 2 }],
  baixasPorClasse: [
    { classe: "DESCARTE_VOLUNTARIO", qtd: 3 },
    { classe: "DESCARTE_INVOLUNTARIO", qtd: 1 },
    { classe: "MORTE", qtd: 2 },
  ],
  periodoDias: 30,
};

/** extrai path + query params de uma URL relativa, do jeito que `navegarPara` recebe */
function paramsDe(href: string) {
  const url = new URL(href, "http://localhost");
  return { pathname: url.pathname, params: url.searchParams };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obterPainelRebanho).mockResolvedValue(painelMock);
});
afterEach(cleanup);

async function montar() {
  render(<VisaoGeral />);
  await screen.findAllByText("Vaca");
}

describe("VisaoGeral do rebanho", () => {
  it("busca o painel com o período padrão de 30 dias", async () => {
    await montar();
    expect(obterPainelRebanho).toHaveBeenCalledWith({ periodoDias: 30 });
  });

  it("mostra as métricas principais", async () => {
    await montar();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("6")).toBeTruthy();
  });

  it("painel \"Baixas no período\" mostra por tipo, por classe e a proporção de descarte voluntário", async () => {
    await montar();
    const porTipo = screen.getByText("Por tipo").closest("div")!;
    const porClasse = screen.getByText("Por classe").closest("div")!;
    expect(within(porTipo).getByText("Venda")).toBeTruthy();
    expect(within(porTipo).getByText("Morte")).toBeTruthy();
    expect(within(porClasse).getByText("Descarte voluntário")).toBeTruthy();
    expect(within(porClasse).getByText("Descarte involuntário")).toBeTruthy();
    expect(within(porClasse).getByText("Morte")).toBeTruthy();
    // 3 voluntárias de 4 baixas de descarte classificadas (3 + 1) = 75%
    expect(within(porClasse).getByText(/75% das baixas por descarte classificado foram voluntárias/)).toBeTruthy();
  });

  it("alternar para 12 meses refaz a busca do painel com o novo período", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "12 meses" }));
    await waitFor(() => expect(obterPainelRebanho).toHaveBeenCalledWith({ periodoDias: 365 }));
  });

  it("30 dias começa marcado e alternar troca o botão pressionado", async () => {
    await montar();
    expect(screen.getByRole("button", { name: "30 dias" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "12 meses" }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "12 meses" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "12 meses" }).getAttribute("aria-pressed")).toBe("true"));
  });

  it("clicar num tipo de baixa abre Animais já filtrado por tipo e período", async () => {
    await montar();
    const porTipo = screen.getByText("Por tipo").closest("div")!;
    fireEvent.click(within(porTipo).getByRole("button", { name: /Venda/ }));
    expect(navegarPara).toHaveBeenCalledTimes(1);
    const { pathname, params } = paramsDe(vi.mocked(navegarPara).mock.calls[0][0]);
    expect(pathname).toBe("/pecuaria/rebanho/animais");
    expect(params.get("situacao")).toBe("BAIXADO");
    expect(params.get("tipoBaixa")).toBe("VENDA");
    expect(params.get("baixaDe")).toBeTruthy();
  });

  it("clicar no cartão \"Baixas em 30 dias\" abre Animais filtrado por baixados nos últimos 30 dias", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Baixas em 30 dias/ }));
    const { pathname, params } = paramsDe(vi.mocked(navegarPara).mock.calls[0][0]);
    expect(pathname).toBe("/pecuaria/rebanho/animais");
    expect(params.get("situacao")).toBe("BAIXADO");
    expect(params.get("baixaDe")).toBeTruthy();
    expect(params.get("tipoBaixa")).toBeNull();
  });

  it("clicar numa categoria abre Animais filtrado por categoriaId; \"Sem categoria\" usa semCategoria", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /^Vaca/ }));
    expect(paramsDe(vi.mocked(navegarPara).mock.calls[0][0]).params.get("categoriaId")).toBe("cat-vaca");

    fireEvent.click(screen.getByRole("button", { name: /Sem categoria/ }));
    const ultima = vi.mocked(navegarPara).mock.calls.at(-1)![0];
    expect(paramsDe(ultima).params.get("semCategoria")).toBe("true");
  });

  it("clicar num sítio abre Animais filtrado por propriedadeId", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Sede/ }));
    const { params } = paramsDe(vi.mocked(navegarPara).mock.calls[0][0]);
    expect(params.get("propriedadeId")).toBe("1");
  });

  it("sem baixas no período mostra o estado vazio", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, baixasPorTipo: [], baixasPorClasse: [] });
    await montar();
    const painel = screen.getByRole("heading", { name: "Baixas no período" }).closest("section")!;
    expect(within(painel).getByText("Nenhuma baixa no período.")).toBeTruthy();
    expect(within(painel).getByText("Nenhuma baixa classificada no período.")).toBeTruthy();
  });
});
