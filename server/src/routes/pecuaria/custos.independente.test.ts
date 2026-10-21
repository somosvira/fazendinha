import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { uid } from "../../lib/uid.fixture.js";
import { exigeArea } from "../../middleware/permissao.js";

const mocks=vi.hoisted(()=>({consultar:vi.fn(),candidatos:vi.fn(),classificar:vi.fn(),vincular:vi.fn(),encerrar:vi.fn(),leitura:vi.fn(),escrita:vi.fn()}));
vi.mock("../../services/pecuaria/custos/custos.js",()=>({consultarCustos:mocks.consultar,candidatosPreparo:mocks.candidatos,classificarCusto:mocks.classificar,vincularPreparo:mocks.vincular,encerrarVinculoPreparo:mocks.encerrar}));
vi.mock("../../services/propriedade.js",async original=>({...await original<typeof import("../../services/propriedade.js")>(),resolverEscopoLeitura:mocks.leitura,resolverEscopoEscrita:mocks.escrita}));
import { rebanhoRouter } from "./rebanho.js";
import { RebanhoError } from "../../services/pecuaria/rebanho/regras.js";

const perfil=(areas=["pecuaria","financeiro"],flags=["lancar","verValores"])=>({id:7,dono:false,areas,flags,abas:[],status:"ATIVO"});
function app(usuario:ReturnType<typeof perfil>|null=perfil()){
 return new Hono().use("*",async(c,next)=>{if(usuario)c.set("usuario" as never,usuario as never);await next();})
  .use("*",exigeArea("pecuaria")).route("/",rebanhoRouter);
}
const body=(method:string,input:unknown)=>({method,headers:{"content-type":"application/json"},body:JSON.stringify(input)});
const classificacao=()=>({chave:uid(1),propriedadeId:1,tipo:"APLICACAO",fonteId:uid(2),versao:0,motivo:"Finalidade conferida pelo responsável",finalidade:"REPRODUCAO",materialNaoAplicavel:false,servicoNaoAplicavel:true,coberturaServico:"PROCEDIMENTO",materialDocumentado:null});
const preparo=()=>({chave:uid(3),propriedadeId:1,tentativaId:uid(4),tipo:"APLICACAO",fonteId:uid(2),modo:"INTEGRAL",motivo:"Preparatório conferido para esta tentativa"});
beforeEach(()=>{
 vi.clearAllMocks();mocks.leitura.mockResolvedValue(1);mocks.escrita.mockResolvedValue(1);
 mocks.consultar.mockResolvedValue({situacao:"COMPLETO",cobertura:"COMPLETO",totalConhecido:"100.00",fontes:[{documentoMaterial:null,classificacao:{valorMaterialDocumentado:null}}]});
 mocks.candidatos.mockResolvedValue({itens:[]});mocks.classificar.mockResolvedValue({id:uid(5),versao:1});mocks.vincular.mockResolvedValue({id:uid(6)});mocks.encerrar.mockResolvedValue({id:uid(6)});
});

describe("custos de Pecuária — autorização e contratos HTTP independentes",()=>{
 it("leitor de Pecuária consulta custo registrado sem Financeiro e GET não executa gravação",async()=>{
  const resposta=await app(perfil(["pecuaria"],[])).request(`/custos?animalId=${uid(7)}&verValores=true`);
  expect(resposta.status).toBe(200);expect(await resposta.json()).toMatchObject({situacao:"COMPLETO",totalConhecido:"100.00",fontes:[{documentoMaterial:null}]});
  expect(mocks.consultar).toHaveBeenCalledWith(1,expect.objectContaining({animalId:uid(7)}),true,false);
  for(const gravar of [mocks.classificar,mocks.vincular,mocks.encerrar])expect(gravar).not.toHaveBeenCalled();
 });
 it("leitura de custo direto conserva acesso do perfil financeiro",async()=>{
  const resposta=await app().request(`/custos?animalId=${uid(7)}`);
  expect(resposta.status).toBe(200);expect(mocks.consultar).toHaveBeenCalledWith(1,expect.anything(),true,true);
 });
 it("leitor consulta preparatórios sem abrir edição ou conceder acesso financeiro",async()=>{
  const resposta=await app(perfil(["pecuaria"],[])).request(`/custos/tentativas/${uid(4)}/preparatorios`);
  expect(resposta.status).toBe(200);
  expect(mocks.candidatos).toHaveBeenCalledWith(uid(4),1,true,1,10);
 });
 it("fato de outro sítio segue indisponível ao leitor sem permissão financeira",async()=>{
  mocks.consultar.mockRejectedValue(new RebanhoError("NAO_ENCONTRADO","Tentativa não encontrada neste sítio"));
  const resposta=await app(perfil(["pecuaria"],[])).request(`/custos?tentativaId=${uid(4)}`);
  expect(resposta.status).toBe(404);
  expect(mocks.consultar).toHaveBeenCalledWith(1,expect.objectContaining({tentativaId:uid(4)}),true,false);
 });
 it.each([{nome:"não autenticado",usuario:null,status:401},{nome:"sem Pecuária",usuario:perfil(["financeiro"]),status:403}])("$nome não consulta o domínio",async({usuario,status})=>{
  expect((await app(usuario).request(`/custos?animalId=${uid(7)}`)).status).toBe(status);expect(mocks.consultar).not.toHaveBeenCalled();
 });
 it.each([
  {nome:"sem Financeiro",usuario:perfil(["pecuaria"],["lancar","verValores"])},
  {nome:"sem verValores",usuario:perfil(["pecuaria","financeiro"],["lancar"])},
  {nome:"sem lançar",usuario:perfil(["pecuaria","financeiro"],["verValores"])},
 ])("$nome não classifica, vincula ou encerra preparatórios",async({usuario})=>{
  const a=app(usuario);
  for(const [url,request] of [["/custos/classificacao",body("PUT",classificacao())],["/custos/preparatorios",body("POST",preparo())],[`/custos/preparatorios/${uid(6)}/encerramento`,body("POST",{chave:uid(8),propriedadeId:1,motivo:"Vínculo revisado pelo responsável"})]] as const)
   expect((await a.request(url,request)).status).toBe(403);
  for(const gravar of [mocks.classificar,mocks.vincular,mocks.encerrar])expect(gravar).not.toHaveBeenCalled();
 });
 it("classificação usa autoria da sessão e sítio resolvido no servidor",async()=>{
  mocks.escrita.mockResolvedValue(6);
  const resposta=await app().request("/custos/classificacao",body("PUT",classificacao()));
  expect(resposta.status).toBe(200);expect(mocks.classificar).toHaveBeenCalledWith({...classificacao(),propriedadeId:6},7);
 });
 it("vínculo autorizado preserva chave, origem e destino da atribuição",async()=>{
  const resposta=await app().request("/custos/preparatorios",body("POST",preparo()));
  expect(resposta.status).toBe(201);expect(mocks.vincular).toHaveBeenCalledWith(preparo(),7);
 });
 it.each(["",`animalId=${uid(7)}&tentativaId=${uid(4)}`,"animalId=invalido",`animalId=${uid(7)}&inicio=2026-02-31`])("consulta inválida%s é recusada sem serviço",async query=>{
  const resposta=await app().request(`/custos?${query}`);expect(resposta.status).toBeGreaterThanOrEqual(400);expect(resposta.status).toBeLessThan(500);expect(mocks.consultar).not.toHaveBeenCalled();
 });
 it("origem ou vínculo com UUID inválido recebe4xx antes do serviço",async()=>{
  expect((await app().request("/custos/tentativas/invalido/preparatorios")).status).toBe(422);
  expect((await app().request("/custos/preparatorios/invalido/encerramento",body("POST",{chave:uid(8),propriedadeId:1,motivo:"Vínculo revisado pelo responsável"}))).status).toBe(422);
  expect(mocks.candidatos).not.toHaveBeenCalled();expect(mocks.encerrar).not.toHaveBeenCalled();
 });
 it("JSON malformado não vira500 nem chama classificação",async()=>{
  const resposta=await app().request("/custos/classificacao",{method:"PUT",headers:{"content-type":"application/json"},body:"{"});
  expect(resposta.status).toBeGreaterThanOrEqual(400);expect(resposta.status).toBeLessThan(500);expect(mocks.classificar).not.toHaveBeenCalled();
 });
 it("sítio ausente no consolidado precisa ser escolhido e conflito do serviço permanece409",async()=>{
  mocks.leitura.mockResolvedValue(null);
  expect((await app().request(`/custos?animalId=${uid(7)}`)).status).toBe(422);
  expect(mocks.consultar).not.toHaveBeenCalled();
  mocks.classificar.mockRejectedValue(new RebanhoError("CONFLITO","A origem já foi atribuída"));
  const resposta=await app().request("/custos/classificacao",body("PUT",classificacao()));
  expect(resposta.status).toBe(409);expect(await resposta.json()).toMatchObject({code:"CONFLITO",error:"A origem já foi atribuída"});
 });
});
