import {beforeEach,describe,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>Object.fromEntries(['animal','pesagem','localizacaoAnimal','baixaAnimal','movimentacaoAnimal','gestacaoAnimal','lactacaoAnimal','tarefaProtocolo','genitorExterno','materialGenetico','lote','categoriaAnimal'].map(k=>[k,{findMany:vi.fn().mockResolvedValue([]),count:vi.fn().mockResolvedValue(0)}])));
vi.mock('../../../db.js',()=>({prisma:db}));
import {consultarRelatoriosRebanho} from './rebanho.js';
const q={fonte:'pesagens',propriedadeId:7,inicio:'2026-01-01',fim:'2026-01-31',pagina:1,porPagina:10,podeVerValores:false,podeConsultarCustos:false};
describe('fontes factuais do rebanho',()=>{
 beforeEach(()=>{vi.clearAllMocks();for(const model of Object.values(db)){model.findMany.mockResolvedValue([]);model.count.mockResolvedValue(0);}});
 it('delega fontes de outros domínios',async()=>expect(await consultarRelatoriosRebanho({...q,fonte:'tentativas'})).toBeNull());
 it('localiza pesagens pela localização na data e preserva zero',async()=>{
  db.pesagem.findMany.mockResolvedValueOnce([{id:'p',animalId:'a',animal:{brinco:'001',nome:null},data:new Date('2026-01-10'),pesoKg:0,tipo:'ROTINA',origem:'MANUAL',observacao:null,criadoPorId:null,criadoEm:new Date('2026-01-11')}]);
  db.localizacaoAnimal.findMany.mockResolvedValueOnce([{animalId:'a',propriedadeId:7,loteId:'l',desde:new Date('2026-01-01'),ate:new Date('2026-01-11'),propriedade:{nome:'Origem'},lote:{nome:'Lote'}}]);
  const r=await consultarRelatoriosRebanho(q);
  expect(r?.linhas[0]).toMatchObject({peso:0,sitio:'Origem',lote:'Lote'});
  expect(db.localizacaoAnimal.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({animalId:{in:['a']}})}));
 });
 it('não usa o sítio atual para preencher localização desconhecida de pesagem',async()=>{
  db.pesagem.findMany.mockResolvedValueOnce([{id:'p',animalId:'a',animal:{brinco:'001',nome:null},data:new Date('2026-01-10'),pesoKg:100,tipo:'ROTINA',origem:'MANUAL',observacao:null,criadoPorId:null,criadoEm:new Date('2026-01-11')}]);
  db.localizacaoAnimal.findMany.mockResolvedValueOnce([]);
  expect((await consultarRelatoriosRebanho(q))?.linhas).toEqual([]);
 });
 it('uma tarefa preserva vínculos substituídos sem multiplicar linhas',async()=>{
  db.tarefaProtocolo.findMany.mockResolvedValueOnce([{id:'t',execucaoId:'p',etapaId:'e',previstaPara:new Date('2026-01-10'),realizadaEm:null,dispensadaEm:null,previsaoPendente:false,precisaoTemporal:'DIA',regularizacaoPendente:false,historicoRegularizacao:[],nomeSnapshot:'Exame',execucao:{animal:{brinco:'1'},animalId:'a',propriedadeId:7,propriedade:{nome:'Sítio'},canceladaEm:null,rodadaId:null,protocolo:{nome:'Protocolo',versao:2,tipo:'REPRODUTIVO'}},etapa:{nome:'Exame',tipo:'EXAME'},aplicacoes:[],exames:[],tentativas:[],manejos:[],eventos:[],vinculos:[{id:'v',ordem:1,estado:'SUBSTITUIDO',exameId:'x',aplicacaoId:null,tentativaId:null,manejoId:null,origem:'EXECUCAO',motivo:'Corrigido'}]}]);
  const r=await consultarRelatoriosRebanho({...q,fonte:'protocolos'});
  expect(r?.linhas).toHaveLength(1);
  expect(r?.linhas[0].vinculos).toContain('SUBSTITUIDO');
  expect(r?.linhas[0].vinculos).toContain('x');
 });
 it('preserva pesagem na data da baixa com vínculo explícito',async()=>{
  db.pesagem.findMany.mockResolvedValueOnce([{id:'p',animalId:'a',animal:{brinco:'001',nome:null},data:new Date('2026-01-10'),pesoKg:100,tipo:'ROTINA',origem:'MANUAL',observacao:null,criadoPorId:null,criadoEm:new Date('2026-01-11')}]);
  db.localizacaoAnimal.findMany.mockResolvedValueOnce([{id:'l',animalId:'a',propriedadeId:7,loteId:null,desde:new Date('2026-01-01'),ate:new Date('2026-01-10'),propriedade:{nome:'Origem'},lote:null}]);
  db.baixaAnimal.findMany.mockResolvedValueOnce([{animalId:'a',data:new Date('2026-01-10'),localizacaoFechadaId:'l'}]);
  expect((await consultarRelatoriosRebanho(q))?.linhas[0]).toMatchObject({peso:100,sitio:'Origem'});
 });
 it('recusa atribuição ambígua de localização mesmo no mesmo sítio',async()=>{
  db.pesagem.findMany.mockResolvedValueOnce([{id:'p',animalId:'a',animal:{brinco:'001',nome:null},data:new Date('2026-01-10'),pesoKg:100}]);
  const local={animalId:'a',propriedadeId:7,loteId:null,desde:new Date('2026-01-01'),ate:null,propriedade:{nome:'Origem'},lote:null};
  db.localizacaoAnimal.findMany.mockResolvedValueOnce([local,{...local,id:'outro'}]);
  expect((await consultarRelatoriosRebanho(q))?.linhas).toEqual([]);
 });
 it('pagina depois de resolver o escopo histórico de pesagens',async()=>{
  db.pesagem.findMany.mockResolvedValueOnce([1,2,3].map(i=>({id:`p${i}`,animalId:'a',animal:{brinco:'001',nome:null},data:new Date('2026-01-10'),pesoKg:i,tipo:'ROTINA',origem:'MANUAL',observacao:null,criadoPorId:null,criadoEm:new Date('2026-01-11')})));
  db.localizacaoAnimal.findMany.mockResolvedValueOnce([{animalId:'a',propriedadeId:7,loteId:null,desde:new Date('2026-01-01'),ate:null,propriedade:{nome:'Origem'},lote:null}]);
  const r=await consultarRelatoriosRebanho({...q,pagina:2,porPagina:2});
  expect(r).toMatchObject({total:3,pagina:2,porPagina:2,linhas:[{id:'p3'}]});
 });
 it('pesa animais ativos com cálculo real e GMD desconhecido sem duas pesagens',async()=>{
  db.animal.findMany.mockResolvedValueOnce([{id:'a',brinco:'1',nome:null,sexo:'F',dataNascimento:new Date('2025-01-01'),partosAntesDaEntrada:0,partos:[],categoriasManuais:[],papeisReprodutivos:[],localizacoes:[{propriedade:{nome:'Sítio'},lote:null}],pesagens:[{data:new Date('2026-01-10'),pesoKg:0}]}]);
  db.animal.count.mockResolvedValueOnce(1);
  const r=await consultarRelatoriosRebanho({...q,fonte:'peso'});
  expect(r?.linhas[0]).toMatchObject({animalId:'a',peso:0,gmd:null});
  expect(r?.avisos?.[0]).toContain('Posição atual');
 });

 it('recorta tarefas HORA pela data civil de São Paulo e DIA pelo calendário UTC',async()=>{
  const tarefa={execucaoId:'p',etapaId:'e',realizadaEm:null,dispensadaEm:null,previsaoPendente:false,regularizacaoPendente:false,historicoRegularizacao:[],nomeSnapshot:'Exame',execucao:{animal:{brinco:'1'},animalId:'a',propriedadeId:7,propriedade:{nome:'Sítio'},canceladaEm:null,rodadaId:null,protocolo:{nome:'Protocolo',versao:2,tipo:'REPRODUTIVO'}},etapa:{nome:'Exame',tipo:'EXAME'},aplicacoes:[],exames:[],tentativas:[],manejos:[],eventos:[],vinculos:[]};
  db.tarefaProtocolo.findMany.mockResolvedValueOnce([
   {...tarefa,id:'fim-hora',previstaPara:new Date('2026-02-01T02:00:00Z'),precisaoTemporal:'HORA'},
   {...tarefa,id:'antes-hora',previstaPara:new Date('2026-01-01T02:00:00Z'),precisaoTemporal:'HORA'},
   {...tarefa,id:'inicio-dia',previstaPara:new Date('2026-01-01T00:00:00Z'),precisaoTemporal:'DIA'},
   {...tarefa,id:'depois-dia',previstaPara:new Date('2026-02-01T00:00:00Z'),precisaoTemporal:'DIA'},
  ]);
  const r=await consultarRelatoriosRebanho({...q,fonte:'protocolos'});
  expect(r?.total).toBe(2);
  expect(r?.linhas.map(l=>l.id)).toEqual(['fim-hora','inicio-dia']);
 });

});
