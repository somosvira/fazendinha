import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({usuario:vi.fn(),local:vi.fn(),leite:vi.fn(),compromissos:vi.fn(),alertas:vi.fn(),env:{ASSISTENTE_CONSULTA_ENABLED:true,OPENAI_API_KEY:'',OPENAI_MODEL:'gpt-5-nano'},execute:vi.fn(),transaction:vi.fn(),query:vi.fn()}));
vi.mock('../../../db.js',()=>({prisma:{usuario:{findUnique:m.usuario},localizacaoAnimal:{count:m.local},diaProducaoLeite:{findFirst:m.leite},$executeRaw:m.execute,$transaction:m.transaction,$queryRaw:m.query}}));
vi.mock('../../../env.js',()=>({env:m.env}));
vi.mock('../../financeiro/operacoes.js',()=>({listarCompromissos:m.compromissos}));
vi.mock('../../pecuaria/sanidade/alertas/consulta-alertas.js',()=>({consultaAlertasSchema:{parse:(v:unknown)=>v},consultarAlertas:m.alertas}));
vi.mock('../conversas.js',()=>({contextoHistorico:(ctx:ContextoAssistente)=>JSON.stringify(ctx.usuario.flags)}));
import {coletarRadar} from './coleta.js';
import {obterRadar,revalidarContexto,sintetizarRadar,processarRadarDiario} from './servico.js';
import type {ContextoAssistente} from '../tipos.js';
const ctx:ContextoAssistente={usuario:{id:2,nome:'Pessoa',email:'p@example.test',papel:'consulta',dono:false,status:'ATIVO',areas:['pecuaria'],flags:[],abas:[]},propriedadeId:null,nomeEscopo:'Consolidado',agora:new Date('2026-11-03T12:00:00Z')};
beforeEach(()=>{vi.clearAllMocks();m.local.mockResolvedValue(3);m.leite.mockResolvedValue(null);m.alertas.mockResolvedValue({itens:[],cobertura:{estado:'NAO_AVALIADO',diaCoberto:null}});m.compromissos.mockResolvedValue([]);m.env.ASSISTENTE_CONSULTA_ENABLED=true;});
describe('Radar autorizado',()=>{
 it('acesso pecuário nunca coleta nem menciona financeiro',async()=>{const r=await coletarRadar(ctx);expect(m.compromissos).not.toHaveBeenCalled();expect(JSON.stringify(r)).not.toMatch(/financeiro|compromisso|saldo|custo/i);expect(r.cobertura.some(c=>c.texto.includes('Produção desconhecida'))).toBe(true);});
 it('sem todas as flags financeiras não coleta agregados',async()=>{await coletarRadar({...ctx,usuario:{...ctx.usuario,areas:['financeiro'],abas:['gastos'],flags:['verValores','verInvestimento']}});expect(m.compromissos).not.toHaveBeenCalled();});
 it('todas as flags e aba habilitam somente fonte autorizada',async()=>{const r=await coletarRadar({...ctx,usuario:{...ctx.usuario,areas:['financeiro'],abas:['gastos'],flags:['verValores','verInvestimento','verSalarios']}});expect(m.compromissos).toHaveBeenCalledOnce();expect(r.leitura[0].titulo).toContain('financeiros');expect(m.local).not.toHaveBeenCalled();});
 it('sem chave conserva fatos e rotula síntese determinística',async()=>{const r=await coletarRadar(ctx);expect((await sintetizarRadar(r)).sintese.modo).toBe('deterministica');});
 it('revalida status real antes de usar snapshot',async()=>{m.usuario.mockResolvedValue({...ctx.usuario,status:'INATIVO'});await expect(revalidarContexto(ctx)).rejects.toThrow('indisponível');});
 it('cron não consulta assinaturas antes de 7h local',async()=>{await processarRadarDiario(new Date('2026-11-03T09:59:00Z'));expect(m.query).not.toHaveBeenCalled();});
});

it('cache pronto sob permissões antigas nunca é lido após revogação',async()=>{
 const antigo={...ctx,usuario:{...ctx.usuario,areas:['financeiro'],abas:['gastos'],flags:['verValores','verSalarios','verInvestimento']}};
 m.usuario.mockResolvedValue({...ctx.usuario,areas:['pecuaria'],flags:[]});
 m.query.mockImplementation(async(_sql:unknown,chave:string)=>chave==='[]'?[]:[{conteudo:{sintese:{texto:'DADOS FINANCEIROS ANTIGOS'}}}]);
 m.transaction.mockResolvedValue({reservado:false,ia:false});
 const r=await obterRadar(antigo,false);
 expect(JSON.stringify(r)).not.toContain('FINANCEIROS ANTIGOS');expect(m.compromissos).not.toHaveBeenCalled();
 expect(m.query.mock.calls.every(c=>c[1]==='[]')).toBe(true);
});

it('sem capacidade de IA ainda produz e persiste fatos determinísticos',async()=>{
 m.usuario.mockResolvedValue(ctx.usuario);m.query.mockResolvedValue([]);m.execute.mockResolvedValue(1);
 const executar=vi.fn().mockResolvedValue(1),consultar=vi.fn().mockResolvedValue([{n:20}]);
 m.transaction.mockImplementation(async f=>f({$queryRaw:consultar,$executeRaw:executar}));
 const r=await obterRadar(ctx,false);
 expect(r.sintese.modo).toBe('deterministica');expect(r.leitura.length).toBeGreaterThan(0);expect(m.execute).toHaveBeenCalledTimes(2);
 expect(executar.mock.calls[0].at(-1)).toBe(false);
});
it('falha da coleta remove reserva vazia para permitir nova leitura',async()=>{
 m.usuario.mockResolvedValue(ctx.usuario);m.query.mockResolvedValue([]);m.execute.mockResolvedValue(1);m.local.mockRejectedValueOnce(new Error('coleta indisponível'));
 m.transaction.mockResolvedValue({reservado:true,ia:false});
 await expect(obterRadar(ctx,false)).rejects.toThrow('coleta indisponível');
 expect(m.execute.mock.calls[0][0].join('')).toContain('DELETE FROM');
});

it('vencimentos incluem a meia-noite do primeiro dos 30 dias e usam o mesmo período na fonte',async()=>{
 const primeiroDia=new Date('2026-10-05T00:00:00.000Z');
 m.compromissos.mockImplementation(async(_sitio:number,{inicio,fim}:{inicio:Date;fim:Date})=>primeiroDia>=inicio&&primeiroDia<=fim?[{tipo:'PAGAR',status:'PENDENTE'}]:[]);
 const r=await coletarRadar({...ctx,propriedadeId:3,usuario:{...ctx.usuario,areas:['financeiro'],abas:['gastos'],flags:['verValores','verInvestimento','verSalarios']}});
 expect(m.compromissos).toHaveBeenCalledWith(3,{inicio:primeiroDia,fim:new Date('2026-11-03T23:59:59.999Z')});
 expect(r.prioridades[0].descricao).toContain('1 compromissos');
 const url=new URL(r.prioridades[0].fonte.url,'https://terrano.test');
 expect(Object.fromEntries(url.searchParams)).toEqual({inicio:'2026-10-05',fim:'2026-11-03',situacao:'pagar',propriedadeId:'3'});
});
it('fonte do leite abre consulta canônica do dia registrado no sítio exato',async()=>{
 m.leite.mockResolvedValue({dataOperacional:new Date('2026-10-28T00:00:00Z')});
 const r=await coletarRadar({...ctx,propriedadeId:3});
 const fonte=r.cobertura.find(c=>c.titulo==='Registro de produção')!.fonte;
 const url=new URL(fonte.url,'https://terrano.test');
 expect(url.pathname).toBe('/pecuaria/leite');
 expect(Object.fromEntries(url.searchParams)).toEqual({leiteSecao:'ordenhas',leiteModo:'geral',ordenhasInicio:'2026-10-28',ordenhasFim:'2026-10-28',propriedadeId:'3'});
});
