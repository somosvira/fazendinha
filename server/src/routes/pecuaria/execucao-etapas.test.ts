import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ previa: vi.fn(), confirmar: vi.fn(), escrita: vi.fn(), leitura: vi.fn(), listar: vi.fn() }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.escrita, resolverEscopoLeitura: mocks.leitura }));
vi.mock("../../services/pecuaria/sanidade/execucao-etapas.js", () => ({ preverExecucaoEtapas: mocks.previa, confirmarExecucaoEtapas: mocks.confirmar }));
vi.mock("../../services/pecuaria/sanidade/aplicacoes.js", async original => ({ ...await original<typeof import("../../services/pecuaria/sanidade/aplicacoes.js")>(), listarAplicacoes: mocks.listar }));
import { sanidadeRouter } from "./sanidade.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";
const app = (lancar: boolean) => new Hono().use("*", async (c, next) => { c.set("usuario" as never, { id: 7, dono: false, areas: ["pecuaria"], flags: lancar ? ["lancar"] : [], abas: [] } as never); await next(); }).route("/", sanidadeRouter);
const payload = { propriedadeId: 2, itens: [{ tipo: "EXAME", animalId: uid(1), tarefaId: uid(2), propriedadeId: 2, tipoExameId: uid(3), data: "2026-10-05" }] };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.escrita.mockResolvedValue(2); mocks.leitura.mockResolvedValue(2); mocks.listar.mockResolvedValue([]); mocks.previa.mockResolvedValue({ fingerprint: "a".repeat(64), itens: [], consumos: [] }); mocks.confirmar.mockResolvedValue({ resultados: [{ id: uid(4), animalId: uid(1) }] }); });
describe("permissões e fronteiras da execução da etapa", () => {
  it("mantém leituras sanitárias para usuário sem permissão para lançar", async () => {
    expect((await app(false).request("/aplicacoes")).status).toBe(200);
    expect(mocks.listar).toHaveBeenCalled();
    expect((await app(false).request("/tarefas/execucao/previa", post(payload))).status).toBe(403);
    expect((await app(false).request("/tarefas/execucao/confirmacao", post({ ...payload, chave: uid(5), fingerprint: "a".repeat(64) }))).status).toBe(403);
    expect(mocks.previa).not.toHaveBeenCalled(); expect(mocks.confirmar).not.toHaveBeenCalled();
  });
  it("resolve escopo antes da prévia e preserva chave/fingerprint na confirmação", async () => {
    expect((await app(true).request("/tarefas/execucao/previa", post(payload))).status).toBe(200);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2); expect(mocks.previa).toHaveBeenCalledWith(payload);
    const confirmar = { ...payload, chave: uid(5), fingerprint: "a".repeat(64) };
    expect((await app(true).request("/tarefas/execucao/confirmacao", post(confirmar))).status).toBe(201);
    expect(mocks.confirmar).toHaveBeenCalledWith(confirmar, 7);
  });
  it("recusa payload de comparação e conserva erro de conflito com caminho acionável", async () => {
    const invalido = await app(true).request("/tarefas/execucao/previa", post({ ...payload, planejado: {} }));
    expect(invalido.status).toBe(422); expect(mocks.previa).not.toHaveBeenCalled();
    mocks.previa.mockRejectedValue(new RebanhoError("CONFLITO", "A tarefa já foi realizada", "itens.0.tarefaId"));
    const conflito = await app(true).request("/tarefas/execucao/previa", post(payload));
    expect(conflito.status).toBe(409); expect(await conflito.json()).toMatchObject({ code: "CONFLITO", campo: "itens.0.tarefaId" });
  });
});
