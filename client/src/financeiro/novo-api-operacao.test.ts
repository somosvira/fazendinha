// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { obterOperacao, linkProcedimentoServico, type ProcedimentoServico } from "./novo-api";
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
it.each([[401, "sessão expirou"], [403, "permissão"], [404, "não foi encontrado"], [409, "dados mudaram"], [429, "Muitas tentativas"], [500, "Tente novamente"]])("orienta recuperação para HTTP %s sem mensagem de domínio", async (status, texto) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: Number(status) })));
  await expect(obterOperacao("op")).rejects.toThrow(String(texto));
});

it("abre tentativa de reprodução no sítio do fato a partir do Serviço", () => {
  const item = { id: "tentativa-1", tipo: "TENTATIVA", animalId: "matriz-1", propriedade: { id: 4, nome: "Origem" } } as ProcedimentoServico;
  const url = new URL(linkProcedimentoServico(item, "/financeiro/operacoes/1"), "http://teste");
  expect(url.pathname).toBe("/pecuaria/reproducao");
  expect(Object.fromEntries(url.searchParams)).toEqual({ animalId: "matriz-1", tentativaId: "tentativa-1", propriedadeId: "4", returnTo: "/financeiro/operacoes/1" });
});
