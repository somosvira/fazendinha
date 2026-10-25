// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
const fetchMock = vi.fn();
beforeEach(() => {
  sessionStorage.clear();
  setPropriedadeAtiva(2);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("reenvia a mesma chave e o mesmo payload após resposta perdida", async () => {
  fetchMock.mockRejectedValueOnce(new Error("Conexão perdida"));
  await expect(
    registrarLeite("/estoque/vendas", 2, { produtoId: "p", valorTotal: 25 }),
  ).rejects.toThrow("Conexão perdida");
  const primeira = JSON.parse(fetchMock.mock.calls[0][1].body);
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ id: "venda" }), { status: 201 }),
  );
  await registrarLeite("/estoque/vendas", 2, {
    produtoId: "p",
    valorTotal: 25,
  });
  expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(primeira);
  expect(sessionStorage.length).toBe(0);
});
it("trocar dados ou sítio não reutiliza a tentativa anterior", async () => {
  fetchMock.mockRejectedValue(new Error("Falha"));
  await registrarLeite("/estoque/vendas", 2, { valorTotal: 25 }).catch(
    () => {},
  );
  await registrarLeite("/estoque/vendas", 2, { valorTotal: 30 }).catch(
    () => {},
  );
  await registrarLeite("/estoque/vendas", 3, { valorTotal: 30 }).catch(
    () => {},
  );
  expect(
    new Set(fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).chave)).size,
  ).toBe(3);
  expect(fetchMock.mock.calls[2][1].headers["X-Propriedade-Id"]).toBe("3");
});
it("propaga rejeição de domínio sem mascará-la como sucesso", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ error: "Saldo insuficiente" }), {
      status: 409,
    }),
  );
  await expect(
    registrarLeite("/estoque/vendas", 2, { quantidadeLitros: 100 }),
  ).rejects.toThrow("Saldo insuficiente");
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ quantidadeLitros: "10" })),
  );
  expect(await consultarLeite("/estoque?produtoId=p", 2)).toEqual({
    quantidadeLitros: "10",
  });
});
it("preserva o reenvio sem armazenamento do navegador e renova depois do sucesso", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage bloqueado"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage bloqueado"); });
  vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Storage bloqueado"); });
  fetchMock.mockRejectedValueOnce(new Error("Resposta perdida")).mockResolvedValue(new Response(JSON.stringify({ id: "nova" })));
  await expect(registrarLeite("/estoque/teste-storage", 2, { litros: 15 })).rejects.toThrow("Resposta perdida");
  await registrarLeite("/estoque/teste-storage", 2, { litros: 15 });
  const chave = JSON.parse(fetchMock.mock.calls[0][1].body).chave;
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).chave).toBe(chave);
  // Outra resposta independente permite verificar uma nova operação com o mesmo payload.
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "outra" })));
  await registrarLeite("/estoque/teste-storage", 2, { litros: 15 });
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).chave).not.toBe(chave);
});
