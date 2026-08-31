// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  ajustarDoses,
  criarIndicador,
  criarLoteSemen,
  rankingReprodutores,
  salvarFichaGenetica,
} from "./api";
import { CadastrosView } from "./components/CadastrosView";
import { ReprodutoresSection } from "./components/ReprodutoresSection";

// CadastrosView também monta a sub-aba Produtos (useProdutos, useQuery) —
// incidental pra este arquivo (só testa genética/sêmen), mockada pra não
// precisar de QueryClientProvider.
vi.mock("./api", async (importOriginal) => ({
  ...await importOriginal<typeof import("./api")>(),
  useProdutos: () => ({ data: [] }),
}));

function resposta(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API de genética e sêmen", () => {
  it("cria indicador com o payload exato do catálogo", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 7 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      sigla: "PTA_L",
      nome: "PTA leite",
      unidade: "kg",
      direcao: "maior_melhor" as const,
      colunaLegada: "ptaLeite" as const,
      ranking: true,
      ativo: true,
    };

    await criarIndicador(input);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/genetica/indicadores", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }));
  });

  it("substitui a ficha genética completa do reprodutor", async () => {
    const fetchMock = vi.fn(() => resposta({ valoresIndicador: [], valoresMarcador: [], valoresCaseina: [], pedigree: null }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      valoresIndicador: [{ indicadorId: 7, valor: 842.5 }],
      valoresMarcador: [{ marcadorId: 3, resultado: "A2A2" }],
      valoresCaseina: [{ caseinaId: 5, genotipo: "BB" }],
      pedigree: {
        paiNome: "Alta Maverick", paiCodigo: "MAV-01",
        maeNome: "Rio Novo 942", maeCodigo: "0942",
        avoMaternoNome: "Supersire", avoMaternoCodigo: "SS-10",
        avoPaternoNome: "Chief", avoPaternoCodigo: "CH-08",
      },
    };

    await salvarFichaGenetica(12, input);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/reprodutores/12/genetica", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify(input),
    }));
  });

  it("cria lote de sêmen com números JSON e campos nulos explícitos", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 31 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { tipoSemenId: 2, lote: "SX-2407", localizacao: null, dosesDisponiveis: 18 };

    await criarLoteSemen(12, input);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/reprodutores/12/semen", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }));
  });

  it("ajusta doses pelo id do estoque", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 31, dosesDisponiveis: 17 }));
    vi.stubGlobal("fetch", fetchMock);

    await ajustarDoses(31, -1);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/semen/31/doses", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ delta: -1 }),
    }));
  });

  it("consulta ranking padrão e por indicador", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => resposta({ ordem: [12, 9], indicadorId: null }))
      .mockImplementationOnce(() => resposta({ ordem: [9, 12], indicadorId: 7 }));
    vi.stubGlobal("fetch", fetchMock);

    await rankingReprodutores();
    await rankingReprodutores(7);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/reprodutores/ranking", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/reprodutores/ranking?indicadorId=7", expect.any(Object));
  });
});

describe("UI de genética e sêmen", () => {
  it("oferece a sub-aba de indicadores e mantém a seleção visível", () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta([])));

    render(createElement(CadastrosView));
    const indicadores = screen.getByRole("button", { name: "Indicadores" });

    fireEvent.click(indicadores);

    expect(indicadores.getAttribute("aria-pressed")).toBe("true");
    expect(indicadores.getAttribute("style")).toContain("var(--cafe)");
  });

  it("expande uma ficha técnica acessível com ranking, genética e estoque", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rebanho/reprodutores?inativos=1")) {
        return resposta({
          reprodutores: [{
            id: 12, nome: "Alta Maverick", codigo: "MAV-01", racaId: 1, racaNome: "Holandês",
            centralSemenId: 1, centralNome: "Alta", ptaLeite: 842.5, ptaGordura: 31.2,
            ptaProteina: 25.4, tpi: 2740, ativo: true,
          }],
          resumo: { total: 1, mediaPtaLeite: 842.5, mediaPtaGordura: 31.2, mediaPtaProteina: 25.4, mediaTpi: 2740, melhorLeiteId: 12, melhorTpiId: 12 },
        });
      }
      if (url.endsWith("/rebanho/genetica/indicadores")) return resposta([{ id: 7, sigla: "PTA_L", nome: "PTA leite", unidade: "kg", direcao: "maior_melhor", colunaLegada: "ptaLeite", ranking: true, ativo: true }]);
      if (url.endsWith("/rebanho/reprodutores/ranking")) return resposta({ ordem: [12], indicadorId: null });
      if (url.endsWith("/rebanho/centrais-semen")) return resposta([]);
      if (url.endsWith("/rebanho/racas")) return resposta([]);
      if (url.endsWith("/rebanho/genetica/marcadores")) return resposta([]);
      if (url.endsWith("/rebanho/genetica/caseinas")) return resposta([]);
      if (url.endsWith("/rebanho/semen/tipos")) return resposta([]);
      if (url.endsWith("/rebanho/reprodutores/12/genetica")) return resposta({ valoresIndicador: [{ indicadorId: 7, valor: 842.5 }], valoresMarcador: [], valoresCaseina: [], pedigree: null });
      if (url.endsWith("/rebanho/reprodutores/12/semen")) return resposta([]);
      return resposta([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ReprodutoresSection));
    const trigger = await screen.findByRole("button", { name: /Abrir ficha genética de Alta Maverick/ });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe("ficha-reprodutor-12");

    fireEvent.click(trigger);

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(await screen.findByRole("region", { name: "Ficha genética de Alta Maverick" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Ordenar reprodutores por" })).toBeTruthy();
    expect(screen.getByText("Pedigree")).toBeTruthy();
    expect(screen.getByText("Indicadores genéticos")).toBeTruthy();
    expect(screen.getByText("Marcadores e caseínas")).toBeTruthy();
    expect(screen.getByText("Estoque de sêmen")).toBeTruthy();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/reprodutores/12/genetica", expect.any(Object)));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("mantém a ordenação do último indicador quando respostas chegam fora de ordem", async () => {
    let resolverPrimeiro!: (value: Response) => void;
    let resolverSegundo!: (value: Response) => void;
    const primeiraResposta = new Promise<Response>((resolve) => { resolverPrimeiro = resolve; });
    const segundaResposta = new Promise<Response>((resolve) => { resolverSegundo = resolve; });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rebanho/reprodutores?inativos=1")) {
        return resposta({
          reprodutores: [
            { id: 12, nome: "Alta Maverick", codigo: null, racaId: null, racaNome: null, centralSemenId: null, centralNome: null, ptaLeite: 842, ptaGordura: null, ptaProteina: null, tpi: 2740, ativo: true },
            { id: 9, nome: "Semex Chief", codigo: null, racaId: null, racaNome: null, centralSemenId: null, centralNome: null, ptaLeite: 700, ptaGordura: null, ptaProteina: null, tpi: 2900, ativo: true },
          ],
          resumo: { total: 2, mediaPtaLeite: 771, mediaPtaGordura: null, mediaPtaProteina: null, mediaTpi: 2820, melhorLeiteId: 12, melhorTpiId: 9 },
        });
      }
      if (url.endsWith("/rebanho/genetica/indicadores")) return resposta([
        { id: 7, sigla: "PTA_L", nome: "PTA leite", unidade: "kg", direcao: "maior_melhor", colunaLegada: "ptaLeite", ranking: true, ativo: true },
        { id: 8, sigla: "TPI_X", nome: "TPI novo", unidade: "pontos", direcao: "maior_melhor", colunaLegada: null, ranking: true, ativo: true },
      ]);
      if (url.endsWith("/rebanho/reprodutores/ranking")) return resposta({ ordem: [12, 9], indicadorId: null });
      if (url.endsWith("?indicadorId=7")) return primeiraResposta;
      if (url.endsWith("?indicadorId=8")) return segundaResposta;
      return resposta([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(createElement(ReprodutoresSection));
    const seletor = await screen.findByRole("combobox", { name: "Ordenar reprodutores por" });
    fireEvent.change(seletor, { target: { value: "7" } });
    fireEvent.change(seletor, { target: { value: "8" } });

    await act(async () => { resolverSegundo(await resposta({ ordem: [9, 12], indicadorId: 8 })); });
    await act(async () => { resolverPrimeiro(await resposta({ ordem: [12, 9], indicadorId: 7 })); });

    const nomes = Array.from(container.querySelectorAll("article")).map((article) => article.textContent ?? "");
    expect(nomes[0]).toContain("Semex Chief");
    expect(seletor).toHaveProperty("value", "8");
  });

  it("anuncia erro de dose dentro do bloco de estoque", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/rebanho/reprodutores?inativos=1")) return resposta({
        reprodutores: [{ id: 12, nome: "Alta Maverick", codigo: null, racaId: null, racaNome: null, centralSemenId: null, centralNome: null, ptaLeite: null, ptaGordura: null, ptaProteina: null, tpi: null, ativo: true }],
        resumo: { total: 1, mediaPtaLeite: null, mediaPtaGordura: null, mediaPtaProteina: null, mediaTpi: null, melhorLeiteId: null, melhorTpiId: null },
      });
      if (url.endsWith("/rebanho/reprodutores/ranking")) return resposta({ ordem: [12], indicadorId: null });
      if (url.endsWith("/rebanho/reprodutores/12/genetica")) return resposta({ valoresIndicador: [], valoresMarcador: [], valoresCaseina: [], pedigree: null });
      if (url.endsWith("/rebanho/reprodutores/12/semen")) return resposta([]);
      return resposta([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(createElement(ReprodutoresSection));
    fireEvent.click(await screen.findByRole("button", { name: /Abrir ficha genética de Alta Maverick/ }));
    const estoque = await screen.findByRole("region", { name: "Estoque de sêmen" });
    const doses = within(estoque).getByRole("spinbutton", { name: "Doses" });
    fireEvent.change(doses, { target: { value: "1.5" } });
    const registrar = within(estoque).getByRole("button", { name: "Registrar entrada" });
    fireEvent.submit(registrar.closest("form")!);

    expect(within(estoque).getByText(/Informe uma quantidade inteira de doses/)).toBeTruthy();
  });
});
