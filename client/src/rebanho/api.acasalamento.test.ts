// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import {
  atualizarMedidaAcasalamento,
  criarCombinacaoMedida,
  criarMedidaAcasalamento,
  criarPlanoAcasalamento,
  escolherReprodutorPlano,
  listarCombinacoesMedida,
  listarMedidasAcasalamento,
  recalcularPlanoAcasalamento,
  useAcasalamento,
} from "./api";
import {
  coeficienteParaPercentual,
  percentualParaCoeficiente,
} from "./components/MedidasAcasalamentoSection";
import { CadastrosView } from "./components/CadastrosView";

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

function apiVazia(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  if (url.endsWith("/rebanho/produtos")) return resposta([]);
  if (url.endsWith("/rebanho/genetica/indicadores")) {
    return resposta([
      { id: 7, sigla: "PTA_L", nome: "PTA leite", unidade: "kg", direcao: "maior_melhor", colunaLegada: "ptaLeite", ranking: true, ativo: true },
      { id: 8, sigla: "CCS", nome: "CCS", unidade: "mil/mL", direcao: "menor_melhor", colunaLegada: null, ranking: true, ativo: false },
    ]);
  }
  if (url.endsWith("/rebanho/acasalamento/medidas") && init?.method === "POST") {
    return resposta({ id: 99, ...JSON.parse(String(init.body)), itens: [] }, 201);
  }
  if (url.endsWith("/rebanho/acasalamento/combinacoes") && init?.method === "POST") {
    return resposta({ id: 77, ...JSON.parse(String(init.body)), itens: [] }, 201);
  }
  if (url.endsWith("/rebanho/acasalamento/medidas") || url.endsWith("/rebanho/acasalamento/medidas?inativas=1")) return resposta([]);
  if (url.endsWith("/rebanho/acasalamento/combinacoes") || url.endsWith("/rebanho/acasalamento/combinacoes?inativas=1")) return resposta([]);
  return resposta([]);
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});

/* Abre o seletor, escolhe a opção e espera o Radix devolver o foco ao gatilho. */
async function escolher(rotulo: string, opcao: string, dentro: Pick<typeof screen, "getByRole"> = screen) {
  fireEvent.click(dentro.getByRole("combobox", { name: rotulo }));
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("API de acasalamento dirigido", () => {
  it("converte percentual de exibição e coeficiente persistido sem perder a escala", () => {
    expect(percentualParaCoeficiente(12.5)).toBe(0.125);
    expect(coeficienteParaPercentual(0.125)).toBe(12.5);
    expect(percentualParaCoeficiente(null)).toBeNull();
    expect(coeficienteParaPercentual(null)).toBeNull();
  });

  it("confirma a query de inativas nas medidas e combinações", async () => {
    const fetchMock = vi.fn(() => resposta([]));
    vi.stubGlobal("fetch", fetchMock);

    await listarMedidasAcasalamento(true);
    await listarCombinacoesMedida(true);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/acasalamento/medidas?inativas=1", expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/acasalamento/combinacoes?inativas=1", expect.any(Object));
  });

  it("cria e atualiza medida com paths, métodos e bodies exatos", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 4 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      nome: "Mérito leiteiro",
      tipo: "MERITO" as const,
      consanguinidadeMax: null,
      exigePedigree: false,
      ativo: true,
      itens: [{ indicadorId: 7, peso: 2, minimo: 400, maximo: null }],
    };

    await criarMedidaAcasalamento(input);
    await atualizarMedidaAcasalamento(4, { nome: "Mérito leiteiro revisado", ativo: false });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/acasalamento/medidas", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/acasalamento/medidas/4", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ nome: "Mérito leiteiro revisado", ativo: false }),
    }));
  });

  it("cria combinação com o body exato", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      nome: "Leite seguro",
      ativo: true,
      itens: [{ medidaId: 4, peso: 1.5, obrigatoria: true, ordem: 2 }],
    };

    await criarCombinacaoMedida(input);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/combinacoes", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }));
  });

  it("cria e recalcula plano nos endpoints exatos", async () => {
    const fetchMock = vi.fn(() => resposta({ id: 12 }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { nome: "Primíparas julho", grupoId: 2, combinacaoId: 3 };

    await criarPlanoAcasalamento(input);
    await recalcularPlanoAcasalamento(12);

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/rebanho/acasalamento/planos", expect.objectContaining({
      method: "POST",
      body: JSON.stringify(input),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/rebanho/acasalamento/planos/12/recalcular", expect.objectContaining({ method: "POST" }));
  });

  it("escolhe reprodutor com confirmação explícita no endpoint da linha", async () => {
    const fetchMock = vi.fn(() => resposta({ linha: { id: 21 }, aviso: null }));
    vi.stubGlobal("fetch", fetchMock);
    const input = { reprodutorId: 9, confirmadoNaoVerificavel: true };

    await escolherReprodutorPlano(21, input);

    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/linhas/21/escolha", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify(input),
    }));
  });

  it("expõe no hook o erro ao carregar recomendação individual", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta({ error: "Falha ao calcular acasalamento" }, 500)));

    const { result } = renderHook(() => useAcasalamento("145"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.erro).toBe("Falha ao calcular acasalamento");
    expect(typeof result.current.recarregar).toBe("function");
  });
});

describe("cadastro de medidas e combinações", () => {
  it("abre a seção compartilhada e apresenta os dois cadastros", async () => {
    vi.stubGlobal("fetch", vi.fn(apiVazia));
    render(createElement(CadastrosView));

    const acasalamento = screen.getByRole("button", { name: "Medidas de acasalamento" });
    fireEvent.click(acasalamento);

    expect(acasalamento.getAttribute("aria-pressed")).toBe("true");
    expect(acasalamento.getAttribute("style")).toContain("var(--cafe)");
    expect(await screen.findByRole("heading", { name: "Medidas e combinações de acasalamento" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Medidas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Combinações" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Cadastrar primeira medida" })).toBeTruthy();
  });

  it("volta ao estado vazio ao cancelar o editor depois de erro de validação", async () => {
    vi.stubGlobal("fetch", vi.fn(apiVazia));
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira medida" }));

    fireEvent.submit(screen.getByRole("form", { name: "Cadastro de medida" }));
    expect(screen.getByRole("alert").textContent).toContain("Informe o nome da medida");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Cadastrar primeira medida" })).toBeTruthy();
  });

  it("explica em linguagem simples cada tipo de medida", async () => {
    vi.stubGlobal("fetch", vi.fn(apiVazia));
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira medida" }));

    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de medida" }));
    expect((await screen.findByRole("option", { name: "Restrição por indicador" })).textContent).toContain("Descarta touros fora do mínimo ou máximo dos indicadores.");
    expect(screen.getByRole("option", { name: "Consanguinidade" }).textContent).toContain("Descarta touros com parentesco acima do limite com a vaca.");
    expect(screen.getByRole("option", { name: "Pedigree" }).textContent).toContain("Exige genealogia suficiente para conferir o parentesco.");
  });

  it("converte 12,5% em 0,125 ao criar medida de consanguinidade", async () => {
    const fetchMock = vi.fn(apiVazia);
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira medida" }));

    fireEvent.change(screen.getByLabelText("Nome da medida"), { target: { value: "Consanguinidade controlada" } });
    await escolher("Tipo de medida", "Consanguinidade");
    fireEvent.change(screen.getByLabelText("Limite de consanguinidade (%)"), { target: { value: "12.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar medida" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/medidas", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        nome: "Consanguinidade controlada",
        tipo: "CONSANGUINIDADE",
        consanguinidadeMax: 0.125,
        exigePedigree: false,
        ativo: true,
        itens: [],
      }),
    })));
  });

  it("envia indicador, peso e limites na medida de mérito", async () => {
    const fetchMock = vi.fn(apiVazia);
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira medida" }));

    fireEvent.change(screen.getByLabelText("Nome da medida"), { target: { value: "Mérito leiteiro" } });
    await escolher("Tipo de medida", "Mérito genético");
    await escolher("Indicador 1", "PTA_L · PTA leite");
    fireEvent.change(screen.getByLabelText("Peso 1"), { target: { value: "2.5" } });
    fireEvent.change(screen.getByLabelText("Mínimo 1"), { target: { value: "400" } });
    fireEvent.change(screen.getByLabelText("Máximo 1"), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar medida" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/medidas", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        nome: "Mérito leiteiro",
        tipo: "MERITO",
        consanguinidadeMax: null,
        exigePedigree: false,
        ativo: true,
        itens: [{ indicadorId: 7, peso: 2.5, minimo: 400, maximo: 900 }],
      }),
    })));
  });

  it("bloqueia indicador duplicado com erro textual anunciado", async () => {
    const fetchMock = vi.fn(apiVazia);
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira medida" }));

    fireEvent.change(screen.getByLabelText("Nome da medida"), { target: { value: "Mérito duplicado" } });
    await escolher("Tipo de medida", "Mérito genético");
    await escolher("Indicador 1", "PTA_L · PTA leite");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar indicador" }));
    await escolher("Indicador 2", "PTA_L · PTA leite");
    fireEvent.click(screen.getByRole("button", { name: "Salvar medida" }));

    expect(screen.getByRole("alert").textContent).toContain("O indicador não pode se repetir");
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/acasalamento/medidas") && (init as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("envia peso, obrigatoriedade e ordem ao criar combinação", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/rebanho/produtos")) return resposta([]);
      if (url.endsWith("/rebanho/genetica/indicadores")) return resposta([]);
      if (url.endsWith("/rebanho/acasalamento/medidas") || url.endsWith("/rebanho/acasalamento/medidas?inativas=1")) {
        return resposta([{ id: 4, nome: "Mérito leiteiro", tipo: "MERITO", consanguinidadeMax: null, exigePedigree: false, ativo: true, itens: [] }]);
      }
      if (url.endsWith("/rebanho/acasalamento/combinacoes") && init?.method === "POST") return resposta({ id: 8 }, 201);
      if (url.endsWith("/rebanho/acasalamento/combinacoes")) return resposta([]);
      return resposta([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(CadastrosView));
    fireEvent.click(screen.getByRole("button", { name: "Medidas de acasalamento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Combinações" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cadastrar primeira combinação" }));

    const formulario = screen.getByRole("form", { name: "Cadastro de combinação" });
    fireEvent.change(within(formulario).getByLabelText("Nome da combinação"), { target: { value: "Leite seguro" } });
    await escolher("Medida 1", "Mérito leiteiro", within(formulario));
    fireEvent.change(within(formulario).getByLabelText("Peso da medida 1"), { target: { value: "1.5" } });
    fireEvent.click(within(formulario).getByLabelText("Obrigatória 1"));
    fireEvent.change(within(formulario).getByLabelText("Ordem 1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar combinação" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/combinacoes", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        nome: "Leite seguro",
        ativo: true,
        itens: [{ medidaId: 4, peso: 1.5, obrigatoria: true, ordem: 2 }],
      }),
    })));
  });
});
