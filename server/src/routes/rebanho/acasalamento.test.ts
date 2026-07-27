import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recomendarParaAnimal: vi.fn(),
  resolverEscopoLeitura: vi.fn(),
}));

vi.mock("../../services/rebanho/acasalamento.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/rebanho/acasalamento.js")>();
  return {
    ...original,
    recomendarParaAnimal: mocks.recomendarParaAnimal,
  };
});

vi.mock("../../services/propriedade.js", () => ({
  resolverEscopoLeitura: mocks.resolverEscopoLeitura,
}));

import { acasalamentoRouter } from "./acasalamento.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolverEscopoLeitura.mockResolvedValue(3);
  mocks.recomendarParaAnimal.mockResolvedValue({
    animalId: 7,
    paiNome: null,
    combinacaoId: 44,
    recomendacoes: [],
  });
});

describe("GET /rebanho/animais/:id/acasalamento", () => {
  it("valida e repassa combinacaoId inteiro positivo", async () => {
    const resposta = await acasalamentoRouter.request(
      "/rebanho/animais/7/acasalamento?combinacaoId=44",
    );

    expect(resposta.status).toBe(200);
    expect(mocks.recomendarParaAnimal).toHaveBeenCalledWith(7, 3, 44);
  });

  it.each(["0", "-1", "abc", "1.5", ""]) (
    "rejeita combinacaoId inválido: %j",
    async (combinacaoId) => {
      const resposta = await acasalamentoRouter.request(
        `/rebanho/animais/7/acasalamento?combinacaoId=${combinacaoId}`,
      );

      expect(resposta.status).toBe(404);
      await expect(resposta.json()).resolves.toEqual({
        error: "combinação não encontrada",
      });
      expect(mocks.recomendarParaAnimal).not.toHaveBeenCalled();
    },
  );

  it("mantém ausência de combinação como default", async () => {
    await acasalamentoRouter.request("/rebanho/animais/7/acasalamento");

    expect(mocks.recomendarParaAnimal).toHaveBeenCalledWith(7, 3, undefined);
  });
});
