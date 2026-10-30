import {describe,it,expect,vi} from 'vitest';
import {observacoesRelatorio,consultarRelatoriosSanidadeLeite} from './sanidade-leite.js';
const mocks=vi.hoisted(()=>({ocorrencias:vi.fn(),vendas:vi.fn(),estoque:vi.fn(),animal:vi.fn(),carencia:vi.fn()}));
vi.mock('../../../db.js',()=>({prisma:{ocorrenciaSanitaria:{findMany:mocks.ocorrencias},animal:{findUnique:mocks.animal}}}));
vi.mock('../sanidade/aplicacoes.js',()=>({carenciaAnimal:mocks.carencia}));
vi.mock('../leite/vendas-unificadas.js',()=>({consultarVendasUnificadasLeite:mocks.vendas}));
vi.mock('../leite/resumo-estoque.js',()=>({consultarResumoEstoqueLeite:mocks.estoque}));
const q={fonte:'ocorrencias',propriedadeId:7,inicio:'2026-10-01',fim:'2026-10-27',pagina:1,porPagina:20,podeVerValores:false,podeConsultarCustos:false};
describe('observações de relatórios sanitários e lácteos',()=>{
 it('preserva campos, versão, unidade e zero sem juntar formatos',()=>{
  expect(observacoesRelatorio({nome:'Laudo',versao:2,campos:[{codigo:'CCS',rotulo:'Células',unidade:'mil/mL'}]},[{campo:'CCS',valor:0,unidade:'mil/mL'}])).toEqual([{formato:'Laudo',versaoFormato:2,campo:'CCS',parametro:'Células',unidade:'mil/mL',resultado:0,situacaoResultado:'INFORMADO'}]);
 });
 it('mantém registro pendente quando não existe resultado',()=>{
  expect(observacoesRelatorio({nome:'Laudo',versao:1},[])[0]).toMatchObject({resultado:null,situacaoResultado:'PENDENTE'});
 });
 it('retorna null para fonte de outro domínio',async()=>{expect(await consultarRelatoriosSanidadeLeite({fonte:'partos'} as never)).toBeNull();});
});

describe('recorte e permissões',()=>{
 it('consulta ocorrência pelo sítio histórico e conserva nome histórico',async()=>{
  mocks.ocorrencias.mockResolvedValue([{id:'o',animal:{brinco:'001'},inicio:new Date('2026-10-02Z'),fim:null,doencaNomeSnapshot:'Nome histórico',doenca:{nome:'Atual'},status:'VALIDO',desfecho:null,origem:'MANUAL',observacao:null}]);
  const r=await consultarRelatoriosSanidadeLeite({...q,animalId:'a'});
  expect(mocks.ocorrencias.mock.calls[0][0].where).toMatchObject({propriedadeId:7,animalId:'a',inicio:{gte:new Date('2026-10-01Z'),lte:new Date('2026-10-27Z')}});
  expect(r?.linhas[0]).toMatchObject({animal:'001',doenca:'Nome histórico',situacao:'ABERTA'});
 });
 it('delega mascaramento monetário das vendas ao serviço no servidor',async()=>{
  mocks.vendas.mockResolvedValue({total:1,itens:[{id:'v',data:'2026-10-02',inicio:'2026-10-01',fim:'2026-10-27',modalidade:'PERIODO',parceiroNome:'Comprador',referencia:'Outubro',quantidadeLitros:'0',valorTotal:null,situacao:'ABERTA',versaoComercial:null}]});
  const r=await consultarRelatoriosSanidadeLeite({...q,fonte:'vendas'});
  expect(mocks.vendas).toHaveBeenCalledWith(7,{de:q.inicio,ate:q.fim,pagina:1,porPagina:20},false);
  expect(r?.linhas[0]).toMatchObject({litros:'0',valor:null});
 });
 it('custo do estoque exige conjuntamente consulta de custos e valores',async()=>{
  mocks.estoque.mockResolvedValue({total:0,itens:[]});
  await consultarRelatoriosSanidadeLeite({...q,fonte:'estoque',podeVerValores:true,podeConsultarCustos:false});
  expect(mocks.estoque).toHaveBeenLastCalledWith(7,{pagina:1,porPagina:20},false);
 });
 it('não executa consulta de carência sem animal',async()=>{
  await expect(consultarRelatoriosSanidadeLeite({...q,fonte:'carencias'})).rejects.toThrow('Selecione o animal');
 });
});

it('carências apresentam identificação do animal após autorizar a consulta',async()=>{mocks.carencia.mockResolvedValue({leite:{estado:'NENHUMA'},carne:{estado:'NENHUMA'},revisaoLeitePendente:false,revisaoAdministracaoPendente:false});mocks.animal.mockResolvedValue({brinco:'001',nome:'Camila'});const r=await consultarRelatoriosSanidadeLeite({...q,fonte:'carencias',animalId:'a'});expect(r?.linhas[0]).toMatchObject({animal:'001 · Camila',destino:'leite',data:q.fim})});
