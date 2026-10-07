import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ listar: vi.fn(), criar: vi.fn(), escrita: vi.fn(), leitura: vi.fn() }));
vi.mock("../../services/propriedade.js", async original => ({ ...await original<typeof import("../../services/propriedade.js")>(), resolverEscopoEscrita: mocks.escrita, resolverEscopoLeitura: mocks.leitura }));
vi.mock("../../services/pecuaria/sanidade/rodadas.js", () => ({ listarRodadas: mocks.listar, criarRodada: mocks.criar }));
import { rodadasRouter } from "./rodadas.js";
const app = (lancar = false, financeiro = false, pecuaria = true) => new Hono().use("*", async (c, next) => {
  c.set("usuario" as never, { id: 7, dono: false, areas: [...(pecuaria ? ["pecuaria"] : []), ...(financeiro ? ["financeiro"] : [])], flags: [...(lancar ? ["lancar"] : []), ...(financeiro ? ["verValores"] : [])], abas: [] } as never); await next();
}).route("/", rodadasRouter);
const payload = { chave: uid(1), propriedadeId: 2, nome: "Rodada de teste", protocoloId: uid(2), inicioReferencia: "2026-10-06", itens: [{ animalId: uid(3) }] };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.escrita.mockResolvedValue(2); mocks.leitura.mockResolvedValue(2); mocks.listar.mockResolvedValue({ itens: [{ id: uid(4), valorServicoAtribuido: "10.00" }], total: 1, pagina: 1, porPagina: 50 }); mocks.criar.mockResolvedValue({ id: uid(4) }); });
describe("rodadas respeitam permissões e fronteiras de consulta", () => {
  it("consulta somente leitura e recusa criação sem lançamento ou acesso à área", async () => {
    expect((await app().request("/rodadas")).status).toBe(200);
    expect((await app().request("/rodadas", post(payload))).status).toBe(403);
    expect((await app(true, false, false).request("/rodadas")).status).toBe(403);
    expect(mocks.criar).not.toHaveBeenCalled();
  });
  it("encaminha busca, datas e paginação ao servidor e oculta valores", async () => {
    const r = await app().request("/rodadas?buscaAnimal=S6&de=2026-10-01&pagina=2");
    expect(mocks.listar).toHaveBeenCalledWith(2, expect.objectContaining({ buscaAnimal: "S6", de: "2026-10-01", pagina: 2 }));
    expect(JSON.stringify(await r.json())).not.toContain("10.00");
    expect(JSON.stringify(await (await app(false, true).request("/rodadas")).json())).toContain("10.00");
  });
  it("valida sítio fora da faixa e mantém confirmação autorizada", async () => {
    expect((await app(true).request("/rodadas", post({ ...payload, propriedadeId: 2147483648 }))).status).toBe(422);
    expect((await app(true).request("/rodadas?propriedadeId=2147483648")).status).toBe(422);
    expect((await app(true).request("/rodadas", post(payload))).status).toBe(200);
    expect(mocks.criar).toHaveBeenCalledWith(payload, 7);
  });
});
