// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { VisaoGeral } from "./VisaoGeral";
import { obterPainelRebanho } from "../api";
import type { PainelGeral } from "../types";
import { navegarPara } from "../../../router";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import { emDias } from "../../../financeiro/financeiro-ui";

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
    { categoriaId: "cat-vaca", categoria: "Vaca", sexo: "F", qtd: 80 },
    { categoriaId: null, categoria: "Sem categoria", sexo: null, qtd: 5 },
  ],
  porSitio: [
    { propriedadeId: 1, nome: "Sede", qtd: 100 },
    { propriedadeId: null, nome: "Sem sítio", qtd: 2 },
  ],
  receptorasPct: 40,
  femeasAtivas: 100,
  receptorasAtivas: 40,
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
  window.history.replaceState({}, "", "/pecuaria/rebanho");
  vi.clearAllMocks();
  setPropriedadeAtiva(null);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.mocked(obterPainelRebanho).mockResolvedValue(painelMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); setPropriedadeAtiva(null); });

async function montar() {
  render(<VisaoGeral />);
  await screen.findAllByText("Vaca");
}

describe("VisaoGeral do rebanho", () => {
  it("conserva navegação enquanto busca os dados", () => {
    vi.mocked(obterPainelRebanho).mockImplementationOnce(() => new Promise(() => {}));
    render(<VisaoGeral />);
    expect(screen.getByRole("tablist", { name: "Rebanho" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Animais" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Carregando rebanho");
  });
  it("mostra gráficos e participação no total, com quantidade real de receptoras", async () => {
    await montar();
    expect(screen.getByRole("img", { name: /Composição por categoria de 120/ })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Quantidade de baixas por tipo/ })).toBeNull();
    expect(screen.getByText("66,7%")).toBeTruthy();
    expect(screen.getByText("40 de 100 fêmeas ativas")).toBeTruthy();
    expect(screen.getByText("83,3% do efetivo")).toBeTruthy();
  });

  it("distingue categorias homônimas pelo sexo e conserva seu filtro individual", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, porCategoria: [
      { categoriaId: "f", categoria: "Em crescimento", sexo: "F", qtd: 4 },
      { categoriaId: "m", categoria: "Em crescimento", sexo: "M", qtd: 2 },
    ] });
    render(<VisaoGeral podeLancar={false} />);
    const femeas = await screen.findByRole("button", { name: /Em crescimento · fêmeas/ });
    expect(screen.getByRole("button", { name: /Em crescimento · machos/ })).toBeTruthy();
    fireEvent.click(femeas);
    expect(paramsDe(vi.mocked(navegarPara).mock.calls[0][0]).params.get("categoriaId")).toBe("f");
    expect(paramsDe(vi.mocked(navegarPara).mock.calls[0][0]).params.get("sexo")).toBe("F");
    expect(screen.queryByRole("button", { name: "Novo animal" })).toBeNull();
  });

  it("sem animais mostra estados vazios, sem uma rosca artificial", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, ativos: 0, porCategoria: [], porSitio: [], receptorasAtivas: 0, femeasAtivas: 0, receptorasPct: 0 });
    render(<VisaoGeral />);
    await screen.findAllByText("Nenhum animal ativo.");
    expect(screen.queryByRole("img", { name: /Composição por categoria/ })).toBeNull();
    expect(screen.getByText("Sem fêmeas ativas para calcular a proporção de receptoras.")).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
  });
  it("busca o painel com o período padrão de 30 dias", async () => {
    await montar();
    expect(obterPainelRebanho).toHaveBeenCalledWith({ periodoDias: 30 });
  });

  it("apresenta o total na composição e usa as abas para consultas", async () => {
    await montar();
    expect(screen.getAllByText("120")).toHaveLength(1);
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.queryByText("Sítios com animais")).toBeNull();
    expect(screen.queryByText("Baixas em 30 dias")).toBeNull();
    expect(document.querySelector(".pec-indicadores")).toBeNull();
    expect(screen.getByRole("tab", { name: "Lotes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Consultar lotes" })).toBeNull();
    expect(screen.getByText("6 baixas · últimos 30 dias")).toBeTruthy();
  });

  it("reúne baixas por tipo e motivos em detalhes, sem duplicar mortes", async () => {
    await montar();
    const porTipo = screen.getByRole("list", { name: "Baixas por tipo" });
    const porClasse = screen.getByRole("region", { name: "Motivos dos descartes" });
    expect(screen.queryByText("Detalhes dos motivos")).toBeNull();
    expect(within(porTipo).getByRole("button", { name: /Venda/ })).toBeTruthy();
    expect(within(porTipo).getByRole("button", { name: /Morte/ })).toBeTruthy();
    expect(within(porClasse).getByText("Descarte voluntário")).toBeTruthy();
    expect(within(porClasse).getByText("Descarte involuntário")).toBeTruthy();
    expect(within(porClasse).queryByText("Morte")).toBeNull();
    // 3 voluntárias de 4 baixas de descarte classificadas (3 + 1) = 75%
    expect(within(porClasse).getByText(/75% de descarte voluntário/)).toBeTruthy();
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
    const porTipo = screen.getByRole("list", { name: "Baixas por tipo" });
    fireEvent.click(within(porTipo).getByRole("button", { name: /Venda/ }));
    expect(navegarPara).toHaveBeenCalledTimes(1);
    const { pathname, params } = paramsDe(vi.mocked(navegarPara).mock.calls[0][0]);
    expect(pathname).toBe("/pecuaria/rebanho/animais");
    expect(params.get("situacao")).toBe("BAIXADO");
    expect(params.get("tipoBaixa")).toBe("VENDA");
    expect(params.get("baixaDe")).toBeTruthy();
  });

  it("a consulta de todas as baixas acompanha o período escolhido, não o indicador fixo de 30 dias", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValueOnce(painelMock).mockResolvedValueOnce({ ...painelMock, periodoDias: 365, baixasPorTipo: [{ tipo: "VENDA", qtd: 20 }] });
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "12 meses" }));
    await screen.findByText("20 baixas · últimos 365 dias");
    fireEvent.click(screen.getByRole("button", { name: "Ver animais baixados" }));
    const { pathname, params } = paramsDe(vi.mocked(navegarPara).mock.calls[0][0]);
    expect(pathname).toBe("/pecuaria/rebanho/animais");
    expect(params.get("situacao")).toBe("BAIXADO");
    expect(params.get("baixaDe")).toBe(emDias(-365));
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
    expect(within(painel).queryByText("Detalhes dos motivos")).toBeNull();
    expect(within(painel).queryByRole("img")).toBeNull();
    expect(within(painel).queryByRole("button", { name: "Ver animais baixados" })).toBeNull();
  });
  it("sítio selecionado não mostra distribuição por sítio e ocupa toda a composição", async () => {
    setPropriedadeAtiva(1);
    await montar();
    expect(screen.queryByRole("heading", { name: "Por sítio" })).toBeNull();
    expect(document.querySelector(".pec-panorama-principal")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Composição do rebanho" })).toBeTruthy();
  });
  it("Consolidado continua mostrando sítios mesmo quando o agregado só tem um sítio", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, porSitio: [{ propriedadeId: 1, nome: "Sede", qtd: 120 }] });
    await montar();
    expect(screen.getByRole("heading", { name: "Por sítio" })).toBeTruthy();
    expect(document.querySelector(".pec-composicao-grid--sitio")).toBeNull();
  });
  it("receptoras e consulta do efetivo mantêm os filtros reais da lista", async () => {
    await montar();
    fireEvent.click(screen.getByRole("button", { name: "Consultar 40 receptoras de 100 fêmeas ativas" }));
    const params = paramsDe(vi.mocked(navegarPara).mock.calls.at(-1)![0]).params;
    expect(params.get("situacao")).toBe("ATIVO");
    expect(params.get("sexo")).toBe("F");
    expect(params.get("papelReprodutivo")).toBe("RECEPTORA");
    fireEvent.click(screen.getByRole("button", { name: "Ver animais" }));
    expect(paramsDe(vi.mocked(navegarPara).mock.calls.at(-1)![0]).params.get("situacao")).toBe("ATIVO");
  });
  it("quando só há mortes não cria detalhes de motivos repetindo a contagem", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, baixasPorTipo: [{ tipo: "MORTE", qtd: 2 }], baixasPorClasse: [{ classe: "MORTE", qtd: 2 }] });
    await montar();
    expect(screen.getByRole("button", { name: "Morte: 2 baixas" })).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Quantidade de baixas por tipo/ })).toBeNull();
    expect(screen.queryByText("Detalhes dos motivos")).toBeNull();
    expect(screen.queryByText(/mortalidade/i)).toBeNull();
  });
  it("mantém baixas sem motivo explícitas sem incluí-las no percentual de descarte", async () => {
    vi.mocked(obterPainelRebanho).mockResolvedValue({ ...painelMock, baixasPorClasse: [{ classe: "SEM_MOTIVO", qtd: 6 }] });
    await montar();
    expect(screen.getByText("Sem motivo informado")).toBeTruthy();
    expect(screen.queryByText(/% de descarte voluntário/)).toBeNull();
  });
  it("bloqueia consultas das baixas antigas enquanto o período está atualizando", async () => {
    await montar();
    let liberar!: (dados: PainelGeral) => void;
    vi.mocked(obterPainelRebanho).mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "12 meses" }));
    expect(screen.getByRole("button", { name: "Venda: 4 baixas" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Ver animais baixados" })).toHaveProperty("disabled", true);
    liberar({ ...painelMock, periodoDias: 365 });
    await screen.findByText("6 baixas · últimos 365 dias");
    expect(screen.getByRole("button", { name: "Ver animais baixados" })).toHaveProperty("disabled", false);
  });
});


it("restaura o período anual pelo deep-link e conserva no retorno à consulta", async () => {
  window.history.replaceState({}, "", "/pecuaria/rebanho?periodoBaixas=365");
  render(<VisaoGeral />);
  await waitFor(() => expect(obterPainelRebanho).toHaveBeenCalledWith({ periodoDias: 365 }));
  expect(screen.getByRole("button", { name: "12 meses" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "30 dias" }));
  expect(new URLSearchParams(window.location.search).has("periodoBaixas")).toBe(false);
  window.history.replaceState({}, "", "/pecuaria/rebanho?periodoBaixas=365");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await waitFor(() => expect(screen.getByRole("button", { name: "12 meses" }).getAttribute("aria-pressed")).toBe("true"));
});
