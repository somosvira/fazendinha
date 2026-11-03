import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({indicadores:vi.fn(),partos:vi.fn(),ordenhas:vi.fn(),tentativas:vi.fn()}));
vi.mock('../reproducao/indicadores.js',()=>({consultarIndicadoresReprodutivos:m.indicadores}));
vi.mock('../reproducao/relatorio-partos.js',()=>({emitirRelatorioPartos:m.partos}));
vi.mock('../leite/consultas-ordenhas.js',()=>({consultarOrdenhasPeriodo:m.ordenhas}));
vi.mock('../../../db.js',()=>({prisma:{tentativaReprodutiva:{findMany:m.tentativas}}}));
import {consultarRelatoriosAnteriores} from './anteriores.js';
import type {ConsultaRelatorio} from './tipos.js';
const q=(fonte:string):ConsultaRelatorio=>({fonte,propriedadeId:3,inicio:'2026-10-01',fim:'2026-10-27',pagina:1,porPagina:2,podeVerValores:false,podeConsultarCustos:false});
beforeEach(()=>vi.clearAllMocks());
describe('adapter de relatórios anteriores',()=>{
 it('ignora fonte que não atende',async()=>expect(await consultarRelatoriosAnteriores(q('animais'))).toBeNull());
 it('encaminha critérios populacionais ao motor e preserva resumo e rastreabilidade antes da paginação',async()=>{
  m.indicadores.mockResolvedValue({acompanhamento:{versao:2,identificacoes:[{id:'a',brinco:'42',nome:'Lua'}],exclusoesEscopo:[{}],iep:{pares:[{animalId:'a',atualId:'p2',anteriorId:'p1',anteriorEm:'2025-10-01',atualEm:'2026-10-01',dias:365,abortosIntermediarios:[{id:'ab',data:'2026-01-01'}]}],mediaDias:365,semAnterior:[{}],pendencias:[]}}});
  const filtros={...q('iep'),corte:'2026-10-28',deslocamentoTeDias:9,concepcaoEstimada:20,janelaPerdaDias:45,iepModo:'TODOS_PARTOS' as const,loteId:'l',tiposTentativa:['TE' as const],papeis:['RECEPTORA' as const]};
  const r=await consultarRelatoriosAnteriores(filtros);
  expect(m.indicadores).toHaveBeenCalledWith({propriedadeId:3,inicio:filtros.inicio,fim:filtros.fim,corte:filtros.corte,deslocamentoTeDias:9,concepcaoEstimada:20,janelaPerdaDias:45,iepModo:'TODOS_PARTOS',loteId:'l',tiposTentativa:['TE'],papeis:['RECEPTORA']});
  expect(r).toMatchObject({resumoEscopo:'POPULACAO',total:1,linhas:[{animal:'42 · Lua',animalId:'a',partoAnterior:'2025-10-01',partoAtual:'2026-10-01',abortosDetalhes:'2026-01-01: ab'}],resumo:[{nome:'Intervalo médio',valor:365,unidade:'dias'},{nome:'Pares de partos',valor:1},{nome:'Sem parto anterior',valor:1},{nome:'Pendências',valor:0}]});
  expect(r?.avisos?.[0]).toContain('escopo histórico');
 });
 it('partos mantém uma linha para gêmeos, valores desconhecidos e autoria',async()=>{
  m.partos.mockResolvedValue({partos:[{id:'p',matriz:{id:'a',brinco:'12',nome:null},data:'2026-10-02',desfecho:'NASCIMENTO',tipo:'NORMAL',crias:[{viva:true,colostro:[{}]},{viva:false,colostro:[]}],induzido:false,dificuldade:null,assistenciaDescricao:null,retencaoPlacenta:null,responsavel:null,observacao:'registro',versao:2,lancador:{nome:'Maria'}}]});
  const r=await consultarRelatoriosAnteriores(q('partos'));
  expect(r).toMatchObject({total:1,linhas:[{data:'2026-10-02',desfecho:'NASCIMENTO',crias:2,vivas:1,semVida:1,colostro:1,placenta:null,lancador:'Maria'}]});
 });
 it('ordenhas mantém paginação e volumes null, sem somar parcelas por conta própria',async()=>{
  m.ordenhas.mockResolvedValue({total:8,pagina:2,porPagina:2,itens:[{id:'o',dataOperacional:'2026-10-02',nome:'Manhã',situacao:'PENDENTE_ESTOQUE',fonteProducao:'GERAL',litros:null,porNatureza:[{natureza:'COMERCIAL',litros:null}]}]});
  const r=await consultarRelatoriosAnteriores({...q('ordenhas'),pagina:2});
  expect(m.ordenhas).toHaveBeenCalledWith(3,{inicio:'2026-10-01',fim:'2026-10-27',pagina:2,porPagina:2});
  expect(r).toMatchObject({total:8,pagina:2,linhas:[{data:'2026-10-02',comercial:null,total:null,fonte:'GERAL'}]});
 });
 it('tentativas inclui identidade histórica em uma consulta escopada sem valores de custos',async()=>{
  m.tentativas.mockResolvedValue([{id:'t',animalId:'a',Animal_TentativaReprodutiva_animalIdToAnimal:{brinco:'15',nome:'Flor'},data:new Date('2026-10-05'),tipo:'IA',status:'ANULADO',ciclo:1,ordem:2,origem:'IDEAGRI',responsavel:null,observacao:null,valorServicoAtribuido:'99'}]);
  const r=await consultarRelatoriosAnteriores(q('tentativas'));
  expect(m.tentativas.mock.calls[0][0].where).toMatchObject({propriedadeId:3,data:{gte:new Date('2026-10-01'),lte:new Date('2026-10-27')}});
  expect(r?.linhas).toEqual([{id:'t',animal:'15 · Flor',animalId:'a',data:'2026-10-05',tipo:'IA',situacao:'ANULADO',ciclo:1,ordem:2,origem:'IDEAGRI',responsavel:null,observacao:null}]);
 });
 it('indicadores conserva taxas e bases por janela antes de paginar',async()=>{
  const periodo={id:'j',inicio:'2026-10-01',fim:'2026-10-21',taxas:{servico:null,concepcao:25,prenhez:0},contagens:{elegiveis:null,matrizesServidas:0,tentativas:4,positivas:1,negativas:3,abertas:0,denominadorConcepcao:4},pendencias:['SEM_BASE']};
  m.indicadores.mockResolvedValue({periodos:[periodo,{...periodo,id:'j2'}]});
  const r=await consultarRelatoriosAnteriores({...q('indicadores'),porPagina:1});
  expect(r).toMatchObject({total:2,linhas:[{id:'j',inicio:'2026-10-01',fim:'2026-10-21',servico:null,concepcao:25,prenhez:0,denominador:4,pendencias:'SEM_BASE'}]});
 });
 it('perdas sem janela conserva lacunas e não fabrica percentual',async()=>{
  m.indicadores.mockResolvedValue({acompanhamento:{versao:2,identificacoes:[],perdas:{janelaDias:null,percentual:null,contagens:{gestacoes:1,perdasAteCorte:0,incompletos:1},coorte:[{animalId:'a',gestacaoId:'g',primeiroDgPositivo:{id:'dg',data:'2026-10-01'},estado:'SEM_JANELA',fimJanela:null,encerramento:null,evidenciaIds:['dg'],lacunas:['SEM_SEGUIMENTO'],motivos:['SEM_JANELA']}]}}});
  const r=await consultarRelatoriosAnteriores(q('perdas'));
  expect(r?.linhas[0]).toMatchObject({gestacaoId:'g',primeiroDg:'2026-10-01',dgId:'dg',situacao:'SEM_JANELA',evidencias:'dg',lacunas:'SEM_SEGUIMENTO',dataDesfecho:null});
  expect(r?.resumo).toHaveLength(3);
  expect(r?.resumoEscopo).toBe('POPULACAO');
 });
 it('espera sem serviço conserva desconhecido e resumo da população ao filtrar animal',async()=>{
  m.indicadores.mockResolvedValue({acompanhamento:{versao:2,identificacoes:[],espera:{resumoCoorte:{ciclos:7,comServico:4,semServico:3,mediaDiasLiberacaoServico:12},coorte:[{animalId:'a',cicloId:'c',inicio:'2026-10-01',primeiraLiberacao:null,primeiroServico:null,diasLiberacaoServico:null,diasPartoServico:null,diasFimPevServico:null,diasEsperaObservada:10,esperaObservadaAte:'2026-10-11',repeticoes:0,saidaEm:null,restricoesIntermediarias:[],antecipacoes:[],pendencias:['SEM_SERVICO']}]}}});
  const r=await consultarRelatoriosAnteriores({...q('espera'),animalId:'outro'});
  expect(r).toMatchObject({total:0,linhas:[],resumoEscopo:'POPULACAO',resumo:[{nome:'Ciclos no período',valor:7},{nome:'Com primeiro serviço',valor:4},{nome:'Sem primeiro serviço',valor:3},{nome:'Liberação → serviço',valor:12,unidade:'dias'}]});
 });
 it('concepções conserva todos os IDs de provas e tentativas acumuladas no ciclo',async()=>{
  m.indicadores.mockResolvedValue({acompanhamento:{versao:2,identificacoes:[],tentativasPorConcepcao:{estado:'CALCULADO',mediaTentativas:3,pendencias:[],linhas:[{animalId:'a',concepcaoId:'g',servicoEm:'2026-10-02',confirmadaEm:'2026-10-25',numeroTentativas:3,tipos:['IA','TE'],tentativaId:'t3',tentativaIds:['t1','t2','t3'],evidenciaIds:['dg','g'],pendencias:[]}]}}});
  const r=await consultarRelatoriosAnteriores(q('concepcoes'));
  expect(r?.linhas[0]).toMatchObject({servico:'2026-10-02',confirmacao:'2026-10-25',tentativas:3,tipos:'IA; TE',concepcaoId:'g',tentativaId:'t3',tentativaIds:'t1; t2; t3',evidencias:'dg; g'});
  expect(r?.resumoEscopo).toBe('POPULACAO');
 });

});
