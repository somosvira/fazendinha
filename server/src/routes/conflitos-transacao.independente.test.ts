import { Hono } from "hono";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ estoque: vi.fn(), financeiro: vi.fn() }));
vi.mock("../services/estoque/estoque.js", async original => ({ ...await original<typeof import("../services/estoque/estoque.js")>(), registrarMovimento: mocks.estoque }));
vi.mock("../services/financeiro/operacoes.js", async original => ({ ...await original<typeof import("../services/financeiro/operacoes.js")>(), criarOperacao: mocks.financeiro }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: vi.fn().mockResolvedValue(7), resolverEscopoEscrita: vi.fn().mockResolvedValue(7) }));
import { estoqueRouter } from "./estoque.js";
import { financeiroRouter } from "./financeiro.js";
function app() { return new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: true, areas: [], flags: [], abas: [], status: "ATIVO" } as never); await next(); }).route("/", estoqueRouter).route("/", financeiroRouter); }
const entradas = [
 { nome: "estoque", url: "/estoque/movimentos", mock: mocks.estoque, input: { produtoId: uid(1), propriedadeId: 7, tipo: "AJUSTE", data: "2026-01-01", quantidade: -1, observacao: "Conferência do saldo físico" } },
 { nome: "financeiro", url: "/financeiro/operacoes", mock: mocks.financeiro, input: { tipo: "COMPRA_ESTOQUE", data: "2026-01-01", descricao: "Compra conferida", propriedadeId: 7, parceiroId: uid(2), itens: [{ descricao: "Produto", produtoId: uid(1), quantidade: 1, unidade: "UN", valorTotal: 10, estocavel: true }], financeiro: { condicao: "SEM_EFEITO_FINANCEIRO" } } },
];
const request = (input: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
const erroSql = (codigo: string) => new Prisma.PrismaClientKnownRequestError("Raw query failed", { code: "P2010", clientVersion: "6.19.3", meta: { driverAdapterError: { cause: { originalCode: codigo, kind: codigo === "40001" ? "TransactionWriteConflict" : "postgres" } } } });
beforeEach(() => { vi.resetAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
describe.each(entradas)("HTTP $nome após esgotar repetição transacional", entrada => {
 it.each([ ["P2034", () => new Prisma.PrismaClientKnownRequestError("conflito", { code: "P2034", clientVersion: "6" })], ["P2010/40001", () => erroSql("40001")], ["adapter direto", () => Object.assign(new Error("TransactionWriteConflict"), { name: "DriverAdapterError", cause: { kind: "TransactionWriteConflict" } })] ] as const)("%s recebe409 de domínio sem detalhes SQL", async (_nome, erro) => {
  entrada.mock.mockRejectedValue(erro()); const r = await app().request(entrada.url, request(entrada.input));
  expect(r.status).toBe(409); expect(await r.json()).toEqual({ code: "CONFLITO", error: "Os dados mudaram. Recarregue e confirme novamente." }); expect(entrada.mock).toHaveBeenCalledTimes(1);
 });
 it("constraint23514 não é convertida em conflito transitório", async () => {
  entrada.mock.mockRejectedValue(erroSql("23514")); const r = await app().request(entrada.url, request(entrada.input));
  expect(r.status).toBe(500); expect(await r.json()).not.toHaveProperty("code", "CONFLITO"); expect(entrada.mock).toHaveBeenCalledTimes(1);
 });
});
