import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
const previa = vi.hoisted(()=>vi.fn());
vi.mock("../../services/pecuaria/protocolos/previa-programacao.js",async original=>({...await original<typeof import("../../services/pecuaria/protocolos/previa-programacao.js")>(),preverProgramacaoColetiva:previa}));
import { protocolosOperacaoRouter } from "./protocolos-operacao.js";
function app(lancar=true,area=true,autenticado=true){const usuario:UsuarioContexto={id:7,nome:"Teste",email:"teste@example.com",papel:"LEITOR",abas:[],areas:area?["pecuaria"]:[],flags:lancar?["lancar"]:[],dono:false,status:"ATIVO"};return new Hono<{Variables:{usuario:UsuarioContexto}}>().use("*",async(c,next)=>{if(autenticado)c.set("usuario",usuario);await next();}).route("/",protocolosOperacaoRouter);}
const input={propriedadeId:114,protocoloId:"00000000-0000-4000-8000-000000000001",animaisIds:["00000000-0000-4000-8000-000000000002"],inicioReferencia:"2026-11-05"};
const post=(body:unknown)=>({method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();previa.mockResolvedValue({itens:[],participantes:[],total:0,pagina:1,porPagina:10,avisos:[]});});
it("exige sessão, área e lançamento antes da prévia",async()=>{for(const args of [[true,true,false],[true,false,true],[false,true,true]])expect((await app(...args).request("/programacoes/previa",post(input))).status).toBe(403);expect(previa).not.toHaveBeenCalled();});
it("valida sítio e lote antes de delegar uma consulta sem gravação",async()=>{expect((await app().request("/programacoes/previa",post(input))).status).toBe(200);expect(previa).toHaveBeenCalledWith({...input,pagina:1,porPagina:10});expect((await app().request("/programacoes/previa",post({...input,propriedadeId:undefined}))).status).toBe(422);expect((await app().request("/programacoes/previa",post({...input,animaisIds:[input.animaisIds[0],input.animaisIds[0]]}))).status).toBe(422);expect(previa).toHaveBeenCalledTimes(1);});
