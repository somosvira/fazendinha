import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstoqueError } from "../services/estoque/estoque.js";
import { FinanceiroError } from "../services/financeiro/regras.js";
import { uid } from "../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ criar: vi.fn() }));
vi.mock("../services/financeiro/operacoes.js", () => ({ criarOperacao: mocks.criar }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: vi.fn().mockResolvedValue(1), resolverEscopoEscrita: vi.fn().mockResolvedValue(1) }));
import { financeiroRouter } from "./financeiro.js";
function appOperador() {
  return new Hono().use("*", async (c, next) => {
    c.set("usuario" as never, { id: 7, dono: false, areas: ["financeiro"], flags: ["lancar"], abas: [], status: "ATIVO" } as never);
    await next();
  }).route("/", financeiroRouter);
}
beforeEach(() => { vi.clearAllMocks(); });
describe("erros de lotes em operações financeiras", () => {
  it("preserva o caminho do item para destacar sua distribuição", async () => {
    mocks.criar.mockRejectedValue(new FinanceiroError("VALIDACAO", "A soma dos lotes deve conferir com a quantidade.", "itens.1.partidas"));
    const app = appOperador();
    const resposta = await app.request("/financeiro/operacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      tipo: "COMPRA_ESTOQUE", data: "2026-09-10", descricao: "Compra de vacina", propriedadeId: 1, parceiroId: uid(2),
      itens: [{ descricao: "Vacina", produtoId: uid(1), quantidade: 50, unidade: "mL", valorTotal: 100, estocavel: true }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    }) });
    expect(resposta.status).toBe(422);
    expect(await resposta.json()).toMatchObject({ code: "VALIDACAO", campo: "itens.1.partidas" });
  });
  it.each([
    ["VALIDACAO", "Saldo insuficiente no lote VAC-01", 422],
    ["CONFLITO", "A validade informada diverge do lote cadastrado", 409],
  ] as const)("preserva mensagem de %s sem convertê-la em erro inesperado", async (codigo, mensagem, status) => {
    mocks.criar.mockRejectedValue(new EstoqueError(codigo, mensagem));
    const app = appOperador();
    const res = await app.request("/financeiro/operacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
      tipo: "COMPRA_ESTOQUE", data: "2026-09-10", descricao: "Compra de vacina", propriedadeId: 1, parceiroId: uid(2),
      itens: [{ descricao: "Vacina", produtoId: uid(1), quantidade: 50, unidade: "mL", valorTotal: 100, estocavel: true }],
      financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" },
    }) });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: mensagem, code: codigo });
    expect(mocks.criar).toHaveBeenCalledTimes(1);
  });
});
