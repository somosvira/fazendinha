import { beforeEach, describe, it, expect, vi } from "vitest";
import { Hono } from "hono";
const { buscar, escopo } = vi.hoisted(() => ({ buscar: vi.fn(), escopo: vi.fn() }));
vi.mock("../services/busca.js", async importOriginal => ({ ...await importOriginal<typeof import("../services/busca.js")>(), buscarEntidades: buscar }));
vi.mock("../services/propriedade.js", async importOriginal => ({ ...await importOriginal<typeof import("../services/propriedade.js")>(), resolverEscopoLeitura: escopo }));
import { buscaRouter } from "./busca.js";
const usuario = { id: 1, nome: "Usuário", dono: false, areas: ["pecuaria"], abas: [], flags: [] };
function app(autenticado = true) { const a = new Hono<{ Variables: { usuario: typeof usuario } }>(); a.use("*", async(c, next) => { if (autenticado) c.set("usuario", usuario); return next(); }); return a.route("/api", buscaRouter); }
beforeEach(() => { vi.clearAllMocks(); buscar.mockResolvedValue([]); escopo.mockResolvedValue(7); });
describe("GET /api/busca", () => {
  it("exige sessão antes de resolver sítio ou consultar registros", async () => {
    const r = await app(false).request("/api/busca?q=184"); expect(r.status).toBe(401); expect(buscar).not.toHaveBeenCalled(); expect(escopo).not.toHaveBeenCalled();
  });
  it("valida comprimento e não consulta para termo curto", async () => {
    expect((await app().request(`/api/busca?q=${'a'.repeat(61)}`)).status).toBe(400);
    expect(await (await app().request("/api/busca?q=a")).json()).toEqual([]); expect(buscar).not.toHaveBeenCalled();
  });
  it("entrega usuário e escopo resolvido ao serviço", async () => {
    const r = await app().request("/api/busca?q=184", { headers: { "X-Propriedade-Id": "7" } });
    expect(r.status).toBe(200); expect(buscar).toHaveBeenCalledWith("184", usuario, 7);
  });
});
