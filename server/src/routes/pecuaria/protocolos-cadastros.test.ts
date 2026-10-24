import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
import { uid } from "../../lib/uid.fixture.js";
const mocks = vi.hoisted(() => ({ lista: vi.fn(), meta: vi.fn(), acoes: vi.fn() }));
vi.mock("../../services/pecuaria/protocolos/cadastros.js", () => ({ listarCadastrosProtocolos: mocks.lista, obterCadastroProtocolo: mocks.meta, listarAcoesCadastroProtocolo: mocks.acoes }));
import { protocolosCadastrosRouter } from "./protocolos-cadastros.js";
const estrutura = vi.hoisted(()=>({lista:vi.fn(),procedimentos:vi.fn()}));
vi.mock("../../services/pecuaria/protocolos/estrutura-cadastro.js",()=>({listarEstruturaCadastro:estrutura.lista,listarProcedimentosEtapaCadastro:estrutura.procedimentos}));
function app(sessao = true, area = true) {
  const usuario: UsuarioContexto = { id: 7, nome: "Leitor", email: "teste@example.com", papel: "LEITOR", abas: [], areas: area ? ["pecuaria"] : [], flags: [], dono: false, status: "ATIVO" };
  return new Hono<{ Variables: { usuario: UsuarioContexto } }>().use("*", async (c, next) => { if (sessao) c.set("usuario", usuario); await next(); }).route("/", protocolosCadastrosRouter);
}
beforeEach(() => { vi.clearAllMocks(); mocks.lista.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }); mocks.meta.mockResolvedValue({ id: uid(805) }); mocks.acoes.mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }); });
it("exige sessão/área e permite leitura do catálogo sem lançar", async () => {
  expect((await app(false).request("/?tipo=SANITARIO")).status).toBe(403);
  expect((await app(true, false).request("/?tipo=SANITARIO")).status).toBe(403);
  expect((await app().request("/?tipo=SANITARIO")).status).toBe(200);
  expect(mocks.lista).toHaveBeenCalledTimes(1);
});
it("valida busca/situação/teto nos endpoints novos sem aceitar escritas", async () => {
  expect((await app().request("/?tipo=REPRODUTIVO&busca=IATF&situacao=RASCUNHO&pagina=2")).status).toBe(200);
  expect(mocks.lista).toHaveBeenCalledWith(expect.objectContaining({ busca: "IATF", situacao: "RASCUNHO", pagina: 2, porPagina: 10 }));
  expect((await app().request("/?tipo=REPRODUTIVO&porPagina=11")).status).toBe(422);
  expect((await app().request(`/${uid(805)}`)).status).toBe(200);
  expect((await app().request(`/${uid(805)}/acoes?pagina=2`)).status).toBe(200);
  expect((await app().request(`/${uid(805)}/acoes?porPagina=11`)).status).toBe(422);
  expect((await app().request(`/${uid(805)}`, { method: "POST" })).status).toBe(404);
});
it("protege detalhes pela área e valida versão, etapa, revisão e limite de página",async()=>{
  estrutura.lista.mockResolvedValue({itens:[],total:0,pagina:1,porPagina:10});estrutura.procedimentos.mockResolvedValue({itens:[],total:0,pagina:1,porPagina:10});
  expect((await app(false).request(`/${uid(805)}/estrutura`)).status).toBe(403);
  expect((await app(true,false).request(`/${uid(805)}/estrutura/${uid(806)}/procedimentos`)).status).toBe(403);
  expect((await app().request(`/${uid(805)}/estrutura?pagina=2`)).status).toBe(200);
  expect(estrutura.lista).toHaveBeenCalledWith(uid(805),expect.objectContaining({pagina:2,porPagina:10}));
  expect((await app().request(`/${uid(805)}/estrutura?porPagina=11`)).status).toBe(422);
  expect((await app().request(`/${uid(805)}/estrutura/${uid(806)}/procedimentos?pagina=2`)).status).toBe(200);
  expect((await app().request(`/${uid(805)}/estrutura/invalida/procedimentos`)).status).toBe(422);
});
