import { afterEach, expect, it, vi } from "vitest";
import { reqProtocolo } from "./api";
vi.mock("../../../propriedadeScope", () => ({ comPropriedade: () => ({}) }));
afterEach(() => vi.unstubAllGlobals());
it("consulta as opções do builder na rota real de cadastros, preservando o caminho operacional", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ itens: [] }) });
  vi.stubGlobal("fetch", fetchMock);
  await reqProtocolo("/cadastros/opcoes?opcao=PRODUTO&origem=SANITARIO&porPagina=10");
  expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/protocolos/cadastros/opcoes?opcao=PRODUTO&origem=SANITARIO&porPagina=10");
  await reqProtocolo("/tarefas/t1");
  expect(fetchMock.mock.calls[1][0]).toBe("/api/pecuaria/rebanho/protocolos/operacao/tarefas/t1");
});
