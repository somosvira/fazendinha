import { describe,it,expect,vi,beforeEach } from "vitest";
import { Hono } from "hono";
import type { UsuarioContexto } from "../../services/auth/sessao.js";
const mocks=vi.hoisted(()=>({consulta:vi.fn().mockResolvedValue({itens:[],total:0}),regras:vi.fn().mockResolvedValue([]),criar:vi.fn()}));
vi.mock("../../services/propriedade.js",async original=>({...await original<typeof import("../../services/propriedade.js")>(),resolverEscopoLeitura:vi.fn().mockResolvedValue(7)}));
vi.mock("../../services/pecuaria/sanidade/alertas/consulta-alertas.js",async original=>{const real=await original<typeof import("../../services/pecuaria/sanidade/alertas/consulta-alertas.js")>();return{...real,consultarAlertas:mocks.consulta,consultarParticipantes:vi.fn()};});
vi.mock("../../services/pecuaria/sanidade/alertas/regras.js",async original=>{const real=await original<typeof import("../../services/pecuaria/sanidade/alertas/regras.js")>();return{...real,listarRegras:mocks.regras,criarRegra:mocks.criar};});
import { alertasRouter } from "./alertas.js";
const usuario:UsuarioContexto={id:3,nome:"Leitor",email:"leitor@example.invalid",papel:"consulta",abas:[],areas:["pecuaria"],flags:[],status:"ATIVO",dono:false};
function app(u:UsuarioContexto|null){const a=new Hono<{Variables:{usuario:UsuarioContexto}}>();a.use("*",async(c,next)=>{if(u)c.set("usuario",u);await next();});return a.route("/alertas",alertasRouter);}
describe("fachada autorizada de alertas",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("recusa dono sintético mesmo com todas as permissões",async()=>{expect((await app({...usuario,id:0,dono:true}).request("/alertas")).status).toBe(401);expect(mocks.consulta).not.toHaveBeenCalled();});
 it("recusa outra área e sessão ausente antes de consultar",async()=>{expect((await app({...usuario,areas:["financeiro"]}).request("/alertas")).status).toBe(403);expect((await app(null).request("/alertas")).status).toBe(401);expect(mocks.consulta).not.toHaveBeenCalled();});
 it("leitor consulta o recorte sem comando de escrita",async()=>{expect((await app(usuario).request("/alertas?pagina=2&tamanho=10")).status).toBe(200);expect(mocks.consulta).toHaveBeenCalledWith(7,expect.objectContaining({pagina:2,tamanho:10}));expect(mocks.criar).not.toHaveBeenCalled();});
 it("gestão exige lançar e aba cadastro também para operador",async()=>{const r=await app({...usuario,flags:["lancar"]}).request("/alertas/regras",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});expect(r.status).toBe(403);expect(mocks.criar).not.toHaveBeenCalled();});
 it("valida paginação sem tocar o serviço",async()=>{expect((await app(usuario).request("/alertas?tamanho=9999")).status).toBe(422);expect(mocks.consulta).not.toHaveBeenCalled();});
 it("cadastro não troca o sítio selecionado pelo sítio do corpo",async()=>{const body={nome:"Cuidado",produtoId:"bfa5dbef-cc78-4bba-9fd2-9773e53f9042",gatilho:"IDADE",idadeMeses:6,propriedadeIds:[8],vigencia:"2026-10-28"};const r=await app({...usuario,dono:true}).request("/alertas/regras",{method:"POST",headers:{"Content-Type":"application/json","X-Propriedade-Id":"7"},body:JSON.stringify(body)});expect(r.status).toBe(422);expect(mocks.criar).not.toHaveBeenCalled();});

});
