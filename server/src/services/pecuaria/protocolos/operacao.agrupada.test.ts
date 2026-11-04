import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({tx:{programacaoProtocolo:{findFirst:vi.fn()},tarefaProtocolo:{findMany:vi.fn()},$queryRaw:vi.fn()},custos:vi.fn(),estimativa:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:(fn:(tx:typeof mocks.tx)=>unknown)=>fn(mocks.tx)}}));
vi.mock("../custos/custos.js",()=>({consultarCustosTx:mocks.custos}));
vi.mock("../custos/estimativa-protocolo.js",()=>({estimarProtocoloTx:mocks.estimativa}));
import { listarCustosEtapasOperacao, listarProcedimentosOperacao } from "./operacao.js";
import { consultaOperacaoSchema } from "./operacao.schemas.js";
const id="00000000-0000-4000-8000-000000000001";
const usuario={dono:false,areas:["pecuaria"],flags:[]};
const componente={chave:"mov1",fonteId:"f1",tipoFonte:"APLICACAO",animalId:"a1",data:"2026-11-03",descricao:"Aplicação",estadoFato:"VALIDO",participacaoId:"p1",finalidade:"REPRODUCAO",natureza:"MATERIAL",estado:"CONHECIDO",valor:"123.45",origemId:"mov-financeiro"};
beforeEach(()=>{
 vi.resetAllMocks();
 mocks.tx.programacaoProtocolo.findFirst.mockResolvedValue({id,nome:"Grupo",propriedadeId:1,inicioReferencia:new Date("2026-11-03"),precisaoTemporal:"DIA",status:"ABERTA",protocolo:{id,nome:"IATF",versao:1,tipo:"REPRODUTIVO"}});
 mocks.custos.mockResolvedValue({componentes:[componente]});
 mocks.tx.tarefaProtocolo.findMany.mockResolvedValue([{id:"t1",etapaId:"e1",execucao:{animalId:"a1"},etapa:{nome:"Aplicação",ordem:1,momento:{id:"m1",nome:"D0",ordem:1}},aplicacoes:[{id:"f1"}],tentativas:[],exames:[],manejos:[],vinculos:[]}]);
 mocks.tx.$queryRaw.mockResolvedValue([{id:"t1",situacao:"ATENDIDO"}]);
});
describe("DTO agrupado e autorização de valores",()=>{
 it("mascara todo o resultado e não calcula estimativa financeira sem verValores",async()=>{
  const grupos=await listarCustosEtapasOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({}),usuario);
  expect(grupos.resumo).toMatchObject({situacao:"OCULTO",totalConhecido:null});
  expect(grupos.itens[0]).toMatchObject({participantes:1,atendidos:1,totalConhecido:null,situacao:"OCULTO"});
  const procedimentos=await listarProcedimentosOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({}),usuario);
  expect(procedimentos.itens[0]).toMatchObject({valor:null,situacao:"OCULTO"});
  expect(JSON.stringify([grupos,procedimentos])).not.toContain("123.45");expect(JSON.stringify([grupos,procedimentos])).not.toContain("mov-financeiro");expect(mocks.estimativa).not.toHaveBeenCalled();
  expect(mocks.custos).toHaveBeenCalledWith(mocks.tx,1,expect.objectContaining({programacaoId:id,limite:Number.MAX_SAFE_INTEGER}),true,false);
 });
 it("paginação recorta grupos depois do total e preserva o resumo integral",async()=>{
  mocks.tx.tarefaProtocolo.findMany.mockResolvedValue([]);
  const grupos=await listarCustosEtapasOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({pagina:9,porPagina:1}),{...usuario,dono:true});
  expect(grupos).toMatchObject({total:1,pagina:1,porPagina:1,resumo:{totalConhecido:"123.45"}});
  expect(grupos.itens[0]).toMatchObject({id:"SEM_ETAPA",totalConhecido:"123.45"});
 });
 it("nega acesso sem área pecuária antes de consultar custos",async()=>{
  await expect(listarCustosEtapasOperacao({programacaoId:id},1,consultaOperacaoSchema.parse({}),null)).rejects.toMatchObject({code:"NAO_ENCONTRADO"});
  expect(mocks.custos).not.toHaveBeenCalled();
 });
});
