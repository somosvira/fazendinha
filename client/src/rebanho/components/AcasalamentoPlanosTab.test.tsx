// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AcasalamentoPlanosTab, atualizarLinhaPlano } from "./AcasalamentoPlanosTab";
import type {
  LinhaPlanoAcasalamentoDTO,
  PlanoAcasalamentoDTO,
  VersaoPlanoAcasalamentoDTO,
} from "../api";

function resposta(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

const ranking = [
  { reprodutorId: 10, nome: "Touro Seguro", merito: 0.86, parentesco: 0.03125, status: "ok" as const, score: 0.86, motivos: ["mérito leiteiro superior"], indicadoresPontuados: 2 },
  { reprodutorId: 20, nome: "Touro Incerto", merito: 0.72, parentesco: 0, status: "nao_verificavel" as const, score: 0.72, motivos: ["pedigree insuficiente para verificar consanguinidade"], indicadoresPontuados: 2 },
  { reprodutorId: 30, nome: "Touro Consanguíneo", merito: 0.95, parentesco: 0.25, status: "consanguineo" as const, score: 0, motivos: ["parentesco acima do limite"], indicadoresPontuados: 2 },
  { reprodutorId: 40, nome: "Touro Restrito", merito: 0.91, parentesco: 0, status: "restrito" as const, score: 0, motivos: ["indicador abaixo do mínimo"], indicadoresPontuados: 2 },
];

function linha(escolhido: number | null = null): LinhaPlanoAcasalamentoDTO {
  return {
    id: 301,
    femeaId: 145,
    femeaNumero: "145",
    femeaNome: "Jurema",
    ranking,
    reprodutorEscolhidoId: escolhido,
    reprodutorEscolhidoNome: escolhido === 10 ? "Touro Seguro" : escolhido === 20 ? "Touro Incerto" : null,
    confirmadoNaoVerificavel: escolhido === 20,
  };
}

function versao(numero: number, escolhido: number | null = null): VersaoPlanoAcasalamentoDTO {
  return {
    id: 200 + numero,
    versao: numero,
    configSnapshot: {
      termos: [{ indicadorId: 7, peso: 1, direcao: "maior_melhor", minimo: null, maximo: null, obrigatoria: false }],
      consanguinidadeMax: 0.125,
      exigePedigree: false,
    },
    createdAt: `2026-07-${20 + numero}T12:00:00.000Z`,
    linhas: [linha(escolhido)],
  };
}

function plano(versoes = [versao(1), versao(2)]): PlanoAcasalamentoDTO {
  return {
    id: 12,
    nome: "Primíparas julho",
    grupoId: 2,
    grupoNome: "Primíparas",
    combinacaoId: 3,
    combinacaoNome: "Leite seguro",
    ultimaVersao: versoes.at(-1)?.versao ?? null,
    totalFemeas: 1,
    totalEscolhas: versoes.at(-1)?.linhas.filter((item) => item.reprodutorEscolhidoId != null).length ?? 0,
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-22T12:00:00.000Z",
    versoes,
  };
}

function resumoPlano() {
  const { versoes: _versoes, ...resumo } = plano();
  return resumo;
}

function apiPlanos(opcoes: {
  planos?: ReturnType<typeof resumoPlano>[];
  detalhe?: PlanoAcasalamentoDTO;
  criar?: PlanoAcasalamentoDTO;
  recalcular?: PlanoAcasalamentoDTO;
  escolherAviso?: string | null;
} = {}) {
  const planos = opcoes.planos ?? [resumoPlano()];
  const detalhe = opcoes.detalhe ?? plano();
  const criar = opcoes.criar ?? detalhe;
  const recalcular = opcoes.recalcular ?? plano([versao(1), versao(2), versao(3)]);
  const escolherAviso = opcoes.escolherAviso ?? null;
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/rebanho/grupos")) return resposta([{ id: 2, nome: "Primíparas" }]);
    if (url.endsWith("/rebanho/acasalamento/combinacoes")) return resposta([{ id: 3, nome: "Leite seguro", ativo: true, itens: [] }]);
    if (url.endsWith("/rebanho/acasalamento/planos") && init?.method === "POST") return resposta(criar, 201);
    if (url.endsWith("/rebanho/acasalamento/planos")) return resposta(planos);
    if (url.endsWith("/rebanho/acasalamento/planos/12/recalcular")) return resposta(recalcular, 201);
    if (url.endsWith("/rebanho/acasalamento/planos/12")) return resposta(detalhe);
    if (url.endsWith("/rebanho/acasalamento/linhas/301/escolha")) {
      const body = JSON.parse(String(init?.body));
      return resposta({ linha: linha(body.reprodutorId), aviso: escolherAviso });
    }
    return resposta({ error: `Rota inesperada: ${url}` }, 404);
  });
}

async function abrirPlano(onAbrirFicha?: (animalId: string) => void, fetchMock = apiPlanos()) {
  vi.stubGlobal("fetch", fetchMock);
  render(createElement(AcasalamentoPlanosTab, { onAbrirFicha }));
  fireEvent.click(await screen.findByRole("button", { name: "Abrir plano Primíparas julho" }));
  await screen.findByText("Touro Seguro");
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AcasalamentoPlanosTab", () => {
  it("carrega planos, grupos e combinações em paralelo e mostra o estado vazio", async () => {
    const fetchMock = apiPlanos({ planos: [] });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(AcasalamentoPlanosTab));

    expect(screen.getByRole("status").textContent).toContain("Carregando");
    expect(await screen.findByText("Nenhum plano de acasalamento criado")).toBeTruthy();
    expect(screen.getByText("Crie o primeiro plano para calcular candidatos por lote.")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Primíparas" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Leite seguro" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("anuncia falha de carregamento sem esconder o contexto da aba", async () => {
    vi.stubGlobal("fetch", vi.fn(() => resposta({ error: "Falha ao carregar planos" }, 500)));
    render(createElement(AcasalamentoPlanosTab));

    expect((await screen.findByRole("alert")).textContent).toContain("Falha ao carregar planos");
    expect(screen.getByRole("form", { name: "Cadastro de plano de acasalamento" })).toBeTruthy();
  });

  it("valida os três campos obrigatórios antes de criar", async () => {
    const fetchMock = apiPlanos({ planos: [] });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(AcasalamentoPlanosTab));
    await screen.findByText("Nenhum plano de acasalamento criado");

    fireEvent.change(screen.getByLabelText("Grupo do plano"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Combinação de medidas"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar plano de acasalamento" }));

    expect(screen.getByRole("alert").textContent).toContain("Informe nome, grupo e combinação");
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/planos") && (init as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("envia o payload exato ao criar e abre o plano retornado", async () => {
    const fetchMock = apiPlanos({ planos: [] });
    vi.stubGlobal("fetch", fetchMock);
    render(createElement(AcasalamentoPlanosTab));
    await screen.findByText("Nenhum plano de acasalamento criado");

    fireEvent.change(screen.getByLabelText("Nome do plano"), { target: { value: "Primíparas julho" } });
    fireEvent.change(screen.getByLabelText("Grupo do plano"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Combinação de medidas"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar plano de acasalamento" }));

    await screen.findByText("Touro Seguro");
    expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/planos", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ nome: "Primíparas julho", grupoId: 2, combinacaoId: 3 }),
    }));
    expect(screen.getByRole("heading", { level: 2, name: "Primíparas julho" })).toBeTruthy();
  });

  it("abre a versão mais recente e mostra ranking, status, parentesco, motivo e ficha da fêmea", async () => {
    const onAbrirFicha = vi.fn();
    await abrirPlano(onAbrirFicha);

    expect(screen.getByText(/criado em 20\/07\/2026 · atualizado em 22\/07\/2026/)).toBeTruthy();
    expect((screen.getByLabelText("Versão do plano") as HTMLSelectElement).value).toBe("2");
    expect(screen.getByRole("option", { name: /Versão 1/ })).toBeTruthy();
    expect(screen.getByText("86%")).toBeTruthy();
    expect(screen.getByText("3,1% parentesco")).toBeTruthy();
    expect(screen.getByText("apto")).toBeTruthy();
    expect(screen.getByText("pedigree não verificável")).toBeTruthy();
    expect(screen.getByText("consanguíneo")).toBeTruthy();
    expect(screen.getByText("restrito")).toBeTruthy();
    expect(screen.getByText("mérito leiteiro superior")).toBeTruthy();

    const abrirFicha = screen.getByRole("button", { name: "Abrir ficha da fêmea 145 Jurema" });
    expect(abrirFicha.className).toContain("min-w-6");
    fireEvent.click(abrirFicha);
    expect(onAbrirFicha).toHaveBeenCalledWith("145");
  });

  it("não permite selecionar candidato consanguíneo ou restrito", async () => {
    await abrirPlano();

    const seletor = screen.getByLabelText("Reprodutor para 145 Jurema");
    expect((within(seletor).getByRole("option", { name: /Touro Consanguíneo/ }) as HTMLOptionElement).disabled).toBe(true);
    expect((within(seletor).getByRole("option", { name: /Touro Restrito/ }) as HTMLOptionElement).disabled).toBe(true);
  });

  it("restaura no seletor a escolha persistida ao trocar de versão", async () => {
    await abrirPlano(undefined, apiPlanos({ detalhe: plano([versao(1, 10), versao(2, 20)]) }));

    expect((screen.getByLabelText("Reprodutor para 145 Jurema") as HTMLSelectElement).value).toBe("20");
    fireEvent.change(screen.getByLabelText("Versão do plano"), { target: { value: "1" } });

    expect((screen.getByLabelText("Reprodutor para 145 Jurema") as HTMLSelectElement).value).toBe("10");
  });

  it("mantém a contagem de escolhas ao trocar o reprodutor de uma linha já escolhida", () => {
    const existente = plano([versao(1, 10)]);
    existente.totalEscolhas = 1;

    const atualizado = atualizarLinhaPlano(existente, 1, linha(20));

    expect(atualizado.totalEscolhas).toBe(1);
  });

  it("cancela a escolha de pedigree não verificável por botão ou Escape e devolve foco ao gatilho", async () => {
    const fetchMock = await abrirPlano();
    const seletor = screen.getByLabelText("Reprodutor para 145 Jurema");
    fireEvent.change(seletor, { target: { value: "20" } });
    const gatilho = screen.getByRole("button", { name: "Escolher Touro Incerto para 145 Jurema" });
    gatilho.focus();
    fireEvent.click(gatilho);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/pedigree não foi suficiente para verificar a consanguinidade/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar escolha" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(gatilho);
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(gatilho));
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/linhas/301/escolha"))).toBe(false);
  });

  it("confirma pedigree não verificável e envia a flag true", async () => {
    const fetchMock = await abrirPlano();
    fireEvent.change(screen.getByLabelText("Reprodutor para 145 Jurema"), { target: { value: "20" } });
    const gatilho = screen.getByRole("button", { name: "Escolher Touro Incerto para 145 Jurema" });
    fireEvent.click(gatilho);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar Touro Incerto para 145 Jurema" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/linhas/301/escolha", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ reprodutorId: 20, confirmadoNaoVerificavel: true }),
    })));
    expect(await screen.findByText("Escolhido: Touro Incerto")).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(gatilho));
  });

  it("escolhe candidato apto com flag false e anuncia aviso de estoque sem tratá-lo como erro", async () => {
    const fetchMock = apiPlanos({ escolherAviso: "Escolha salva, mas o estoque de sêmen está sem doses." });
    await abrirPlano(undefined, fetchMock);
    fireEvent.change(screen.getByLabelText("Reprodutor para 145 Jurema"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Escolher Touro Seguro para 145 Jurema" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/linhas/301/escolha", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ reprodutorId: 10, confirmadoNaoVerificavel: false }),
    })));
    expect((await screen.findByRole("status")).textContent).toContain("estoque de sêmen está sem doses");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Escolhido: Touro Seguro")).toBeTruthy();
  });

  it("recalcula o plano e seleciona a nova versão retornada", async () => {
    const fetchMock = await abrirPlano();
    fireEvent.click(screen.getByRole("button", { name: "Recalcular plano Primíparas julho" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/rebanho/acasalamento/planos/12/recalcular", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect((screen.getByLabelText("Versão do plano") as HTMLSelectElement).value).toBe("3"));
    expect(screen.getByRole("option", { name: /Versão 3/ })).toBeTruthy();
  });
});
