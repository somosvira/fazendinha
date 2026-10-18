import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({obter:vi.fn(),escopo:vi.fn()}));
vi.mock("../services/gerencial/resumo.js",async original=>({...await original<typeof import("../services/gerencial/resumo.js")>(),obterResumoGerencial:mocks.obter}));
vi.mock("../services/propriedade.js",async original=>({...await original<typeof import("../services/propriedade.js")>(),resolverEscopoLeitura:mocks.escopo}));
import { gerencialRouter } from "./gerencial.js";
import { permissoesGerencial, sinalizarLacunasNutricao } from "../services/gerencial/resumo.js";
import type { UsuarioContexto } from "../services/auth/sessao.js";
const perfil=(areas=["pecuaria","financeiro"],flags=["verValores","verSalarios","verInvestimento"]):UsuarioContexto=>({id:1,nome:"Ana",email:"",papel:"consulta",abas:["dashboard"],areas,flags,status:"ATIVO",dono:false});
const app=(u:UsuarioContexto|null)=>new Hono().use("*",async(c,next)=>{if(u)c.set("usuario" as never,u as never);await next();}).route("/",gerencialRouter);
const url="/gerencial/resumo?inicio=2026-10-01&fim=2026-10-17";
beforeEach(()=>{vi.clearAllMocks();mocks.escopo.mockResolvedValue(3);mocks.obter.mockResolvedValue({versao:"GERENCIAL_V1"});});
describe("painel gerencial: autorização e validação HTTP",()=>{
  it.each([{u:null,status:401},{u:perfil([],[]),status:403}])("recusa acesso direto sem sessão/área ($status)",async({u,status})=>{expect((await app(u).request(url)).status).toBe(status);expect(mocks.obter).not.toHaveBeenCalled();});
  it("limita intervalo antes de consultar dados",async()=>{expect((await app(perfil()).request("/gerencial/resumo?inicio=2025-01-01&fim=2026-10-17")).status).toBe(422);expect(mocks.obter).not.toHaveBeenCalled();});
  it("participação sem recorte impede cobertura completa no DTO e em suas finalidades",()=>{
    const completo={cobertura:"COMPLETO",situacao:"COMPLETO",totalConhecido:"12.00",componentesPendentes:0};
    expect(sinalizarLacunasNutricao(completo,1)).toMatchObject({cobertura:"PARCIAL",situacao:"PARCIAL",totalConhecido:"12.00",lacunasNutricao:1});
    expect(sinalizarLacunasNutricao({...completo,totalConhecido:null},1).cobertura).toBe("DESCONHECIDO");
    expect(sinalizarLacunasNutricao(completo,0).cobertura).toBe("COMPLETO");
  });
  it("transmite o sítio resolvido pelo contrato existente",async()=>{expect((await app(perfil()).request(url)).status).toBe(200);expect(mocks.obter).toHaveBeenCalledWith(expect.objectContaining({id:1}),3,new Date("2026-10-01"),new Date("2026-10-17"));});
  it("separa permissões dos blocos e não concede financeiro por ser pecuarista",()=>{
    expect(permissoesGerencial(perfil(["pecuaria"],[]))).toEqual({acesso:true,caixa:false,estoque:false,nutricao:false,custos:false,clinico:true});
    expect(permissoesGerencial(perfil(["financeiro"]))).toEqual({acesso:true,caixa:true,estoque:true,nutricao:false,custos:false,clinico:false});
    expect(permissoesGerencial(perfil(undefined,["verValores"])).caixa).toBe(false);
    expect(permissoesGerencial(perfil(undefined,[])).nutricao).toBe(false);
  });
});
