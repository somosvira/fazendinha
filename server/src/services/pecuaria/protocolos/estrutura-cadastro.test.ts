import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db=vi.hoisted(()=>({protocolo:{findUnique:vi.fn()},momentoProtocolo:{count:vi.fn(),findMany:vi.fn(),findFirst:vi.fn()},etapaProtocolo:{count:vi.fn(),findMany:vi.fn()}}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:vi.fn(async(callback:(tx:typeof db)=>unknown)=>callback(db))}}));
import { apresentarProcedimentoCadastro, listarEstruturaCadastro, listarProcedimentosEtapaCadastro } from "./estrutura-cadastro.js";
const revisao=new Date("2026-10-23T12:00:00Z");
const acao={id:"a",nome:"Aplicação inicial",tipo:"APLICACAO",diaRelativo:0,unidadeIntervalo:"DIAS",configuracao:{},dose:new Prisma.Decimal(2),unidade:"ML",via:null,tipoAplicacaoNomeSnapshot:null,produto:{nome:"Nome atual"},tipoExame:null,material:null} satisfies Parameters<typeof apresentarProcedimentoCadastro>[0];
beforeEach(()=>{vi.clearAllMocks();db.protocolo.findUnique.mockResolvedValue({atualizadoEm:revisao});db.momentoProtocolo.count.mockResolvedValue(11);db.momentoProtocolo.findMany.mockResolvedValue([]);db.momentoProtocolo.findFirst.mockResolvedValue({id:"m"});db.etapaProtocolo.count.mockResolvedValue(2);db.etapaProtocolo.findMany.mockResolvedValue([acao]);});
it("pagina etapas sem agrupar os avulsos por data e mantém cada lista de procedimentos limitada",async()=>{
  db.momentoProtocolo.findMany.mockResolvedValue([{id:"m11",nome:"Revisão",modoAtendimento:"MANUAL",instrucoesGerais:null,_count:{etapas:15},etapas:[acao]}]);
  const p=await listarEstruturaCadastro("p",{pagina:2,revisao:revisao.toISOString()});
  expect(p).toMatchObject({total:13,pagina:2,porPagina:10,itens:[{id:"m11",agrupada:true,procedimentos:{total:15,porPagina:10}},{id:"a",agrupada:false,modoAtendimento:null}]});
  expect(db.momentoProtocolo.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:10,take:1,select:expect.objectContaining({etapas:expect.objectContaining({take:10})})}));
  expect(db.etapaProtocolo.findMany).toHaveBeenCalledWith(expect.objectContaining({skip:0,take:9,where:{protocoloId:"p",momentoId:null}}));
});
it("rejeita revisão divergente antes de ler estrutura e exige teto10",async()=>{
  await expect(listarEstruturaCadastro("p",{revisao:"2026-10-22T12:00:00.000Z"})).rejects.toThrow("Esta versão mudou");
  expect(db.momentoProtocolo.count).not.toHaveBeenCalled();
  await expect(listarEstruturaCadastro("p",{porPagina:11})).rejects.toThrow();
});
it("valida que a etapa pertence à versão e pagina seus procedimentos no banco",async()=>{
  db.etapaProtocolo.count.mockResolvedValue(21);
  expect(await listarProcedimentosEtapaCadastro("p","m",{pagina:2})).toMatchObject({pagina:2,total:21,porPagina:10});
  expect(db.etapaProtocolo.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{protocoloId:"p",momentoId:"m"},skip:10,take:10}));
  db.momentoProtocolo.findFirst.mockResolvedValue(null);db.etapaProtocolo.findMany.mockClear();
  await expect(listarProcedimentosEtapaCadastro("p","outra",{})).rejects.toThrow("Etapa não encontrada");
  expect(db.etapaProtocolo.findMany).not.toHaveBeenCalled();
});
it("prioriza referências congeladas e não inventa via, modo ou material para IA/TE",()=>{
  expect(apresentarProcedimentoCadastro({...acao,configuracao:{referencias:{produto:{nome:"Nome na versão",orientacaoUso:"Conferir embalagem"}}}})).toMatchObject({referencia:"Nome na versão",quantidade:"2",via:null,orientacaoUso:"Conferir embalagem"});
  expect(apresentarProcedimentoCadastro({...acao,tipo:"TENTATIVA",configuracao:{tentativaTipo:"TE"},produto:null,dose:null,unidade:null})).toMatchObject({procedimento:"Transferência de embrião",referencia:null,definirMaterialNoAtendimento:true,quantidade:null});
  expect(apresentarProcedimentoCadastro({...acao,tipo:"TENTATIVA",configuracao:{planoTentativa:{tipo:"IA",materialId:"mat",quantidade:1},referencias:{material:{produtoNome:"Sêmen histórico",unidade:"DOSE"}}},material:{produto:{nome:"Nome atual",unidade:"UN"}}})).toMatchObject({procedimento:"Inseminação artificial",referencia:"Sêmen histórico",definirMaterialNoAtendimento:false,quantidade:"1",unidadeQuantidade:"DOSE"});
});
