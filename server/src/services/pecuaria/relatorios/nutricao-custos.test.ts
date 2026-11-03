import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Prisma} from '@prisma/client';
const m=vi.hoisted(()=>({dietas:vi.fn(),vigencias:vi.fn(),contar:vi.fn(),fechamentos:vi.fn(),custos:vi.fn()}));
vi.mock('../../../db.js',()=>({prisma:{$transaction:(fn:(tx:unknown)=>unknown)=>fn({vigenciaDietaLote:{findMany:m.vigencias,count:m.contar}})}}));
vi.mock('../nutricao/dietas.js',()=>({listarDietas:m.dietas}));
vi.mock('../nutricao/consumo.js',()=>({listarFechamentos:m.fechamentos}));
vi.mock('../custos/custos.js',()=>({consultarCustosTx:m.custos}));
import {consultarRelatoriosNutricaoCustos} from './nutricao-custos.js';
import type {ConsultaRelatorio} from './tipos.js';
const base:ConsultaRelatorio={fonte:'dietas',propriedadeId:7,inicio:'2026-10-01',fim:'2026-10-31',pagina:1,porPagina:25,podeVerValores:true,podeConsultarCustos:true};
beforeEach(()=>vi.clearAllMocks());
describe('fontes de nutrição e custos',()=>{
 it('delega outras fontes sem consultar dados',async()=>expect(await consultarRelatoriosNutricaoCustos({...base,fonte:'partos'})).toBeNull());
 it('mantém ingrediente, versão, unidade e matéria seca desconhecida separados',async()=>{
  m.dietas.mockResolvedValue([{id:'d',nome:'Bezerros',versao:2,ativo:true,publicadaEm:null,observacao:null,itens:[{id:'i',produtoId:'p',produto:{nome:'Leite'},unidade:'L',quantidadeCabecaDia:new Prisma.Decimal(4),materiaSecaPercentualSnapshot:null},{id:'j',produtoId:'q',produto:{nome:'Ração'},unidade:'KG',quantidadeCabecaDia:new Prisma.Decimal('0.5'),materiaSecaPercentualSnapshot:new Prisma.Decimal(90)}]}]);
  const r=await consultarRelatoriosNutricaoCustos(base);expect(r?.total).toBe(2);expect(r?.linhas[0]).toMatchObject({unidade:'L',quantidade:4,materiaSeca:null,versao:2});expect(r?.linhas[1]).toMatchObject({unidade:'KG',quantidade:0.5});
  const pagina=await consultarRelatoriosNutricaoCustos({...base,pagina:2,porPagina:1});expect(pagina?.total).toBe(2);expect(pagina?.linhas).toHaveLength(1);expect(pagina?.linhas[0].ingrediente).toBe('Ração');
 });
 it('filtra vigências pelo sítio e sobreposição semiaberta antes da paginação',async()=>{
  m.vigencias.mockResolvedValue([]);m.contar.mockResolvedValue(31);const r=await consultarRelatoriosNutricaoCustos({...base,fonte:'vigencias',pagina:2,loteId:'l'});
  expect(m.vigencias).toHaveBeenCalledWith(expect.objectContaining({where:{lote:{propriedadeId:7},loteId:'l',desde:{lte:new Date('2026-10-31T00:00:00Z')},OR:[{ate:null},{ate:{gt:new Date('2026-10-01T00:00:00Z')}}]},skip:25,take:25}));expect(r?.total).toBe(31);
 });
 it('mascara valores de fechamento no servidor e conserva estornos e custo zero',async()=>{
  m.fechamentos.mockResolvedValue({total:2,itens:[{id:'f',loteId:'l',lote:{nome:'Lote'},vigencia:{dieta:{nome:'Dieta',versao:1}},inicio:new Date('2026-10-01Z'),fim:new Date('2026-10-02Z'),status:'ESTORNADO',animalDias:2,participacoes:[{}],custoConhecido:'0.00',coberturaCustoCompleta:true,confirmadoEm:new Date('2026-10-03Z'),estornadoEm:null,motivoEstorno:null}]});
  expect((await consultarRelatoriosNutricaoCustos({...base,fonte:'consumos'}))?.linhas[0]).toMatchObject({custoConhecido:'0.00',situacao:'ESTORNADO'});
  expect((await consultarRelatoriosNutricaoCustos({...base,fonte:'consumos',podeVerValores:false}))?.linhas[0]).toMatchObject({custoConhecido:null,cobertura:'OCULTO'});
 });
 it('exige animal e autorização de custos antes de consultar',async()=>{
  await expect(consultarRelatoriosNutricaoCustos({...base,fonte:'custos'})).rejects.toThrow('animal');await expect(consultarRelatoriosNutricaoCustos({...base,fonte:'custos',animalId:'a',podeConsultarCustos:false})).rejects.toThrow();expect(m.custos).not.toHaveBeenCalled();
 });
 it('retorna componentes já deduplicados pelo serviço sem repetir total e mascara valor/origem',async()=>{
  m.custos.mockResolvedValue({componentes:[{chave:'c',fonteId:'f',tipoFonte:'EXAME',animalId:'a',data:'2026-10-05',descricao:'Exame',estadoFato:'VALIDO',participacaoId:null,finalidade:null,natureza:'SERVICO',estado:'CONHECIDO',valor:'0.00',origemId:'o'}],total:1,pagina:1,porPagina:25});
  const r=await consultarRelatoriosNutricaoCustos({...base,fonte:'custos',animalId:'a',podeVerValores:false});expect(r?.linhas[0]).toMatchObject({valor:null,origemId:null,visibilidade:'OCULTO'});expect(r?.linhas[0]).not.toHaveProperty('totalConhecido');expect(m.custos).toHaveBeenCalledWith(expect.anything(),7,expect.objectContaining({animalId:'a',inicio:base.inicio,fim:base.fim}),false,false);
 });
});
