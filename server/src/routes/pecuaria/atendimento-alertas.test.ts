import {beforeEach,describe,expect,it,vi} from "vitest";
import {Hono} from "hono";
const m=vi.hoisted(()=>({programa:vi.fn(),decidir:vi.fn(),escopo:vi.fn()}));
vi.mock("../../services/pecuaria/sanidade/alertas/decisoes.js",async original=>({...await original<typeof import("../../services/pecuaria/sanidade/alertas/decisoes.js")>(),decidirNecessidade:m.decidir}));
vi.mock("../../db.js",()=>({prisma:{necessidadeProgramacaoSanitaria:{findFirst:m.programa}}}));
vi.mock("../../services/propriedade.js",()=>({resolverEscopoEscrita:m.escopo}));
import {atendimentoAlertasRouter} from "./atendimento-alertas.js";
import type {UsuarioContexto} from "../../services/auth/sessao.js";
const id="a1000000-0000-4000-8000-000000000001";
const corpo={animalId:id,propriedadeId:1,chave:id,revisao:1,motivo:"Conferência do cuidado",acao:"DISPENSAR"};
function app(usuario?:Partial<UsuarioContexto>){return new Hono<{Variables:{usuario:unknown}}>().use('*',async(c,next)=>{if(usuario)c.set('usuario',usuario);await next()}).route('/',atendimentoAlertasRouter)}
beforeEach(()=>{vi.clearAllMocks();m.programa.mockResolvedValue(null);m.escopo.mockResolvedValue(1);m.decidir.mockResolvedValue({id,alertaId:id,revisao:2,situacao:"DISPENSADO",dataAtencao:null,motivo:corpo.motivo,segredo:"não devolver"})});
const request=(a:ReturnType<typeof app>,body:unknown=corpo)=>a.request(`/alertas/${id}/decisoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('decisões de alertas na rota',()=>{
 it('nega sessão ausente e dono sintético',async()=>{expect((await request(app())).status).toBe(403);expect((await request(app({id:-1,dono:true}))).status).toBe(403);expect(m.decidir).not.toHaveBeenCalled()});
 it('nega leitor sem lançar',async()=>{expect((await request(app({id:7,dono:false,areas:['pecuaria'],flags:[]}))).status).toBe(403)});
 it('valida corpo antes da escrita',async()=>{expect((await request(app({id:7,dono:true}),{...corpo,motivo:''})).status).toBe(422);expect(m.decidir).not.toHaveBeenCalled()});
 it('delega escopo e retorna apenas recibo da decisão',async()=>{const res=await request(app({id:7,dono:true}));expect(res.status).toBe(200);expect(await res.json()).toEqual({id,alertaId:id,revisao:2,situacao:'DISPENSADO',dataAtencao:null,motivo:corpo.motivo});expect(m.decidir).toHaveBeenCalledWith({...corpo,alertaId:id},7)});
});
