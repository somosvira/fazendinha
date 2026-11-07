import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
const mocks = vi.hoisted(() => ({ previa: vi.fn(), gravar: vi.fn() }));
vi.mock("../../services/pecuaria/protocolos/automacao.js", async original => ({
 ...await original<typeof import("../../services/pecuaria/protocolos/automacao.js")>(),
 preverExcecaoAutomacao: mocks.previa, registrarExcecaoAutomacao: mocks.gravar,
}));
import { protocolosOperacaoRouter } from "./protocolos-operacao.js";
function app(lancar=true,area=true,autenticado=true){const usuario:UsuarioContexto={id:7,nome:"Teste",email:"teste@example.com",papel:"LEITOR",abas:[],areas:area?["pecuaria"]:[],flags:lancar?["lancar"]:[],dono:false,status:"ATIVO"};return new Hono<{Variables:{usuario:UsuarioContexto}}>().use("*",async(c,next)=>{if(autenticado)c.set("usuario",usuario);await next();}).route("/",protocolosOperacaoRouter);}

const id = "00000000-0000-4000-8000-000000000001";
const input = { chave: "00000000-0000-4000-8000-000000000002", propriedadeId: 114, motivo: "Animal retirado do protocolo", retirarDoProtocolo: true, reversoes: [] };
const post = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.previa.mockResolvedValue({ fingerprint: "a".repeat(64), fatos: [], impedimentos: [] }); });
it("exige sessão, área e lançamento antes de consultar efeitos", async () => {
 for (const args of [[true,true,false], [true,false,true], [false,true,true]]) expect((await app(...args).request(`/automacoes/${id}/previa-excecao`, post(input))).status).toBe(403);
 expect(mocks.previa).not.toHaveBeenCalled(); expect(mocks.gravar).not.toHaveBeenCalled();
});
it("valida sítio e escolhas e delega só a consulta com autoria da sessão", async () => {
 for (const propriedadeId of [0, -1, "outro-sitio"]) expect((await app().request(`/automacoes/${id}/previa-excecao`, post({ ...input, propriedadeId }))).status).toBe(422);
 expect(mocks.previa).not.toHaveBeenCalled(); expect(mocks.gravar).not.toHaveBeenCalled();
 expect((await app().request(`/automacoes/${id}/previa-excecao`, post(input))).status).toBe(200);
 expect(mocks.previa).toHaveBeenCalledWith(id, input, 7); expect(mocks.gravar).not.toHaveBeenCalled();
});
