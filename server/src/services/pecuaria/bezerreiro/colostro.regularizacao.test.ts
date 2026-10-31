import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const f=vi.hoisted(()=>({transacao:vi.fn()}));
vi.mock('../../../db.js',()=>({prisma:{}}));
vi.mock('../transacao.js',()=>({transacaoPecuaria:f.transacao}));
import { consultarDestinacaoColostro, consultarPreparoColostro, listarHistoricoColostro } from './colostro.js';
const data=new Date('2026-10-20T00:00:00Z'),D=(v:string)=>new Prisma.Decimal(v);
function banco(){return{
 destinacaoColostro:{findFirst:vi.fn(),findMany:vi.fn().mockResolvedValue([]),count:vi.fn(async()=>0)},
 preparoColostro:{findFirst:vi.fn(),findMany:vi.fn().mockResolvedValue([]),count:vi.fn(async()=>0)},
 unidadeBancoColostro:{findMany:vi.fn().mockResolvedValue([])},
 alocacaoFornecimentoColostro:{findMany:vi.fn().mockResolvedValue([])},origemPreparoColostro:{findMany:vi.fn().mockResolvedValue([])},
};}
let tx:ReturnType<typeof banco>;
beforeEach(()=>{vi.clearAllMocks();tx=banco();f.transacao.mockImplementation((run:(v:unknown)=>unknown)=>run(tx));});
describe('consultas de regularização de colostro',()=>{
 it('histórico pagina no sítio e período sem excluir registros estornados',async()=>{
  await listarHistoricoColostro(7,{pagina:2,tamanho:30,incluirEstornados:false,inicio:'2026-10-01',fim:'2026-10-28'},'destinacoes');
  expect(tx.destinacaoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{propriedadeId:7,data:{gte:new Date('2026-10-01'),lte:new Date('2026-10-28')}},skip:30,take:30}));
  expect(tx.destinacaoColostro.count).toHaveBeenCalledWith(expect.objectContaining({where:expect.not.objectContaining({status:expect.anything()})}));
 });
 it('destinação distingue fornecimento apenas vinculado e identifica o consumidor da unidade que bloqueia o estorno',async()=>{
  tx.destinacaoColostro.findFirst.mockResolvedValue({id:'destino',origemId:'origem',data,ocorridoEm:null,versao:2,status:'CONFIRMADO',snapshot:{fornecimentosCriados:['novo']},alocacoes:[{id:'vinculo',fornecimentoId:'preexistente',fornecimento:{criaId:'cria'},quantidadeLitros:D('4'),ativo:true}],unidades:[{id:'unidade',codigo:'BC001',status:'RETIRADA',volumeLitros:D('2')}]});
  tx.alocacaoFornecimentoColostro.findMany.mockResolvedValue([{destinacaoId:'consumidor',fornecimentoId:'novo',unidade:{codigo:'BC001'}}]);
  const d=await consultarDestinacaoColostro('destino',7);
  expect(d.fornecimentos[0].criadoPelaDestinacao).toBe(false);expect(d.dependencias).toEqual([{tipo:'destinacoes',id:'consumidor',unidadeCodigo:'BC001'}]);
  expect(tx.alocacaoFornecimentoColostro.findMany).toHaveBeenCalledWith(expect.objectContaining({where:{ativo:true,origem:{propriedadeId:7},unidadeId:{in:['unidade']}}}));
 });
 it('enriquecimento identifica congelamento e consumo ativos da origem resultante',async()=>{
  tx.preparoColostro.findFirst.mockResolvedValue({id:'preparo',data,ocorridoEm:null,versao:1,status:'CONFIRMADO',volumeFinalLitros:D('2.2'),origemResultado:{id:'enriquecida'},origens:[],insumos:[],criadoEm:data});
  tx.unidadeBancoColostro.findMany.mockResolvedValue([{destinacaoId:'congelamento',codigo:'BC002'}]);
  tx.origemPreparoColostro.findMany.mockResolvedValue([{preparoId:'consumidor',unidade:null}]);
  const d=await consultarPreparoColostro('preparo',7);
  expect(d.dependencias).toEqual([{tipo:'enriquecimentos',id:'consumidor',unidadeCodigo:null},{tipo:'destinacoes',id:'congelamento',unidadeCodigo:'BC002'}]);
  expect(tx.unidadeBancoColostro.findMany).toHaveBeenCalledWith({where:{origemId:'enriquecida',propriedadeId:7,status:{not:'ESTORNADA'}}});
 });
});
