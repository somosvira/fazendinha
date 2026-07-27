import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  obter: vi.fn(),
  criar: vi.fn(),
  recalcular: vi.fn(),
  escolher: vi.fn(),
  resolverLeitura: vi.fn(),
  resolverEscrita: vi.fn(),
}));

vi.mock("../../services/rebanho/planos-acasalamento.js", () => ({
  PlanoAcasalamentoError: class PlanoAcasalamentoError extends Error {
    constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
      super(message);
    }
  },
  listarPlanosAcasalamento: mocks.listar,
  obterPlanoAcasalamento: mocks.obter,
  criarPlanoAcasalamento: mocks.criar,
  recalcularPlanoAcasalamento: mocks.recalcular,
  escolherReprodutorPlano: mocks.escolher,
}));

vi.mock("../../services/propriedade.js", () => ({
  resolverEscopoLeitura: mocks.resolverLeitura,
  resolverEscopoEscrita: mocks.resolverEscrita,
}));

import { planosAcasalamentoRouter } from "./planos-acasalamento.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolverLeitura.mockResolvedValue(3);
  mocks.resolverEscrita.mockResolvedValue(4);
  mocks.listar.mockResolvedValue([]);
  mocks.obter.mockResolvedValue({ id: 100 });
  mocks.criar.mockResolvedValue({ id: 100 });
  mocks.recalcular.mockResolvedValue({ id: 100 });
  mocks.escolher.mockResolvedValue({ linha: { id: 301 }, aviso: null });
});

describe("rotas de planos de acasalamento", () => {
  it("repassa escopo de leitura na listagem e no detalhe", async () => {
    const lista = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos",
    );
    const detalhe = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos/100",
    );

    expect(lista.status).toBe(200);
    expect(detalhe.status).toBe(200);
    expect(mocks.resolverLeitura).toHaveBeenCalledTimes(2);
    expect(mocks.listar).toHaveBeenCalledWith(3);
    expect(mocks.obter).toHaveBeenCalledWith(100, 3);
  });

  it("repassa escopo de escrita e retorna 201 ao criar", async () => {
    const response = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: "Novilhas 2026",
          grupoId: 8,
          combinacaoId: 9,
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(mocks.criar).toHaveBeenCalledWith({
      nome: "Novilhas 2026",
      grupoId: 8,
      combinacaoId: 9,
    }, 4);
  });

  it("repassa escopo de escrita ao recalcular e escolher", async () => {
    const recalculo = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos/100/recalcular",
      { method: "POST" },
    );
    const escolha = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/linhas/301/escolha",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reprodutorId: 20 }),
      },
    );

    expect(recalculo.status).toBe(200);
    expect(escolha.status).toBe(200);
    expect(mocks.recalcular).toHaveBeenCalledWith(100, 4);
    expect(mocks.escolher).toHaveBeenCalledWith(301, {
      reprodutorId: 20,
      confirmadoNaoVerificavel: false,
    }, 4);
  });

  it.each([
    ["GET", "/rebanho/acasalamento/planos/0"],
    ["POST", "/rebanho/acasalamento/planos/abc/recalcular"],
    ["PATCH", "/rebanho/acasalamento/linhas/-1/escolha"],
  ])("valida id positivo em %s %s", async (method, path) => {
    const response = await planosAcasalamentoRouter.request(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ reprodutorId: 10 }) : undefined,
    });

    expect(response.status).toBe(404);
  });

  it("mapeia erros de domínio para 404 e 409", async () => {
    const { PlanoAcasalamentoError } = await import(
      "../../services/rebanho/planos-acasalamento.js"
    );
    mocks.obter.mockRejectedValueOnce(new PlanoAcasalamentoError(
      "NAO_ENCONTRADO",
      "plano não encontrado",
    ));
    mocks.recalcular.mockRejectedValueOnce(new PlanoAcasalamentoError(
      "CONFLITO",
      "plano recalculado simultaneamente; tente novamente",
    ));

    const ausente = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos/999",
    );
    const conflito = await planosAcasalamentoRouter.request(
      "/rebanho/acasalamento/planos/100/recalcular",
      { method: "POST" },
    );

    expect(ausente.status).toBe(404);
    expect(conflito.status).toBe(409);
  });
});
