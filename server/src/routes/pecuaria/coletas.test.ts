import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exigeArea } from "../../middleware/permissao.js";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { uid } from "../../lib/uid.fixture.js";

const mocks = vi.hoisted(() => ({ leitura: vi.fn(), escrita: vi.fn(), obter: vi.fn(), listar: vi.fn(), preparar: vi.fn(), salvar: vi.fn(), concluir: vi.fn() }));
vi.mock("../../services/propriedade.js", async (original) => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/pecuaria/coletas/coletas.js", () => ({ obterColeta: mocks.obter, listarColetas: mocks.listar, prepararColeta: mocks.preparar, salvarColeta: mocks.salvar, concluirColeta: mocks.concluir }));
import { coletasRouter } from "./coletas.js";

function app(flags: string[] = [], areas = ["pecuaria"], autenticado = true) {
  return new Hono<{ Variables: { usuario: UsuarioContexto } }>()
    .use("*", async (c, next) => { if (autenticado) c.set("usuario", { id: 7, nome: "Operador", email: "operador@example.test", papel: "gestor", status: "ATIVO", dono: false, abas: [], flags, areas }); await next(); })
    .use("*", exigeArea("pecuaria")).route("/", coletasRouter);
}
const payload = { id: uid(1), propriedadeId: 2, tipo: "PESAGEM", data: "2026-10-01", titulo: "Ficha de campo", loteIds: [uid(2)] };
const enviar = (instancia: ReturnType<typeof app>, path: string, method: string, body: unknown) => instancia.request(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.resetAllMocks(); mocks.leitura.mockResolvedValue(2); mocks.escrita.mockResolvedValue(2);
  mocks.obter.mockResolvedValue({ id: uid(1), propriedadeId: 2, status: "PREPARADA" });
  mocks.preparar.mockResolvedValue({ id: uid(1), propriedadeId: 2 });
});

describe("permissões de coletas nas rotas", () => {
  it.each([["/", "POST"], [`/${uid(1)}/rascunho`, "PUT"], [`/${uid(1)}/confirmacao`, "POST"]])("exige lançar em %s", async (path, method) => {
    const resposta = await enviar(app(), path, method, payload);
    expect(resposta.status).toBe(403); expect(mocks.escrita).not.toHaveBeenCalled();
    expect(mocks.preparar).not.toHaveBeenCalled(); expect(mocks.salvar).not.toHaveBeenCalled(); expect(mocks.concluir).not.toHaveBeenCalled();
  });
  it("consulta ficha sem lançar/exportar e preserva escopo de leitura", async () => {
    expect((await app().request(`/${uid(1)}`)).status).toBe(200);
    expect(mocks.obter).toHaveBeenCalledWith(uid(1), 2);
  });
  it("exige exportar para impressão mesmo quando o usuário pode lançar", async () => {
    expect((await app(["lancar"]).request(`/${uid(1)}/impressao`)).status).toBe(403);
    expect(mocks.obter).not.toHaveBeenCalled();
    expect((await app(["exportar"]).request(`/${uid(1)}/impressao`)).status).toBe(200);
    expect(mocks.obter).toHaveBeenCalledWith(uid(1), 2);
  });
  it("exige autenticação e área Pecuária antes de acessar fichas", async () => {
    expect((await app([], ["pecuaria"], false).request(`/${uid(1)}`)).status).toBe(401);
    expect((await app(["lancar", "exportar"], ["financeiro"]).request(`/${uid(1)}`)).status).toBe(403);
    expect(mocks.obter).not.toHaveBeenCalled();
  });
  it("prepara com autor autenticado e sítio resolvido", async () => {
    expect((await enviar(app(["lancar"]), "/", "POST", payload)).status).toBe(201);
    expect(mocks.escrita).toHaveBeenCalledWith(expect.anything(), 2);
    expect(mocks.preparar).toHaveBeenCalledWith(payload, 7);
  });
});
