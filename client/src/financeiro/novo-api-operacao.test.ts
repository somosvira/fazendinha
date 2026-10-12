// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { obterOperacao } from "./novo-api";
afterEach(() => vi.unstubAllGlobals());
it("recusa resposta vazia que antes derrubava o detalhe da operação", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("[]", { status: 200 })));
  await expect(obterOperacao("op")).rejects.toThrow("Não foi possível carregar os dados da operação. Tente novamente.");
});
it("mantém as relações completas retornadas pela API", async () => {
  const operacao = { id: "op", itens: [], transacoes: [], compromissos: [], documentos: [], movimentosEstoque: [] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(operacao), { status: 200 })));
  await expect(obterOperacao("op")).resolves.toEqual(operacao);
});
