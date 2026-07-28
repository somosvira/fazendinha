import { ZodError, type ZodIssue } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  atualizarMedida: vi.fn(),
  atualizarCombinacao: vi.fn(),
}));

vi.mock("../../services/rebanho/medidas-acasalamento.js", () => ({
  MedidaAcasalamentoError: class MedidaAcasalamentoError extends Error {
    constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
      super(message);
    }
  },
  atualizarMedidaAcasalamento: mocks.atualizarMedida,
  atualizarCombinacaoMedida: mocks.atualizarCombinacao,
}));

import { medidasAcasalamentoRouter } from "./medidas-acasalamento.js";

function erroConfiguracao(message: string): ZodError {
  return new ZodError([{
    code: "custom",
    path: ["itens"],
    message,
  } satisfies ZodIssue]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH de configuração de acasalamento", () => {
  it("retorna 400 para estado final inválido da medida", async () => {
    mocks.atualizarMedida.mockRejectedValue(
      erroConfiguracao("medida de pedigree precisa exigir pedigree"),
    );

    const response = await medidasAcasalamentoRouter.request(
      "/rebanho/acasalamento/medidas/10",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "PEDIGREE" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "medida de pedigree precisa exigir pedigree",
    });
  });

  it("retorna 400 para estado final inválido da combinação", async () => {
    mocks.atualizarCombinacao.mockRejectedValue(
      erroConfiguracao("combinação precisa ter ao menos uma medida"),
    );

    const response = await medidasAcasalamentoRouter.request(
      "/rebanho/acasalamento/combinacoes/20",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: "Combinação revisada" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "combinação precisa ter ao menos uma medida",
    });
  });
});
