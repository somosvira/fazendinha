// @vitest-environment jsdom
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {AgendaCalendario} from './AgendaCalendario';
import {consultarProgramacoes,type EventoProgramacao,type ConsultaProgramacoes} from './programacoes-api';
import {exportarCalendarioSanitario} from './calendario-pdf';
vi.mock('./programacoes-api',async original=>({...await original<typeof import('./programacoes-api')>(),consultarProgramacoes:vi.fn()}));
vi.mock('./calendario-pdf',()=>({exportarCalendarioSanitario:vi.fn().mockResolvedValue(undefined)}));
const evento=(n=1):EventoProgramacao=>({id:`evento-${n}`,programacaoId:`programa-${n}`,ano:2026,mes:11,precisao:'MES',dia:null,inicioJanela:'2026-11-01',fimJanela:'2026-11-30',periodo:'2026',nome:`Cuidado ${n}`,tipo:'VACINACAO',propriedadeId:1,ativo:false,produtoId:null,produtoNome:null,procedimento:'Conferência',sujeitoTipo:'ANIMAL',recorrencia:'SEM_REPETICAO',publico:{},fonte:null,observacao:null,revisao:1,pendenciasAtivacao:['Conferir público'],previstos:0,atendidos:0,pendentes:0});
function pagina(itens:EventoProgramacao[],total=itens.length,num=1,matriz=itens):ConsultaProgramacoes{return{ano:2026,mes:11,meses:Array.from({length:12},(_,i)=>({mes:i+1,eventos:i===10?matriz:[],total:i===10?matriz.length:0})),itens,total,pagina:num,tamanho:100}}
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();window.history.replaceState(null,'','/pecuaria/sanidade/calendario?ano=2026&mes=11')});
describe('calendário sanitário navegável',()=>{
 it('não apresenta ausência de atividade durante carregamento ou falha',async()=>{
  vi.mocked(consultarProgramacoes).mockRejectedValueOnce(new Error('Falha de consulta')).mockResolvedValueOnce(pagina([]));render(<AgendaCalendario/>);
  expect(screen.getByRole('status').textContent).toContain('Consultando programação');expect(screen.queryByText('Nenhuma atividade neste recorte.')).toBeNull();
  await screen.findByText('Falha de consulta');expect(screen.queryByText('Nenhuma atividade neste recorte.')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));expect(await screen.findByText('Nenhuma atividade neste recorte.')).toBeTruthy();
 });
 it('consulta outra página no servidor, registra URL e reinicia ao mudar os critérios',async()=>{
  vi.mocked(consultarProgramacoes).mockImplementation(async f=>pagina([evento(f.pagina??1)],201,f.pagina??1));render(<AgendaCalendario/>);await screen.findByText('201 atividades neste recorte');
  fireEvent.click(screen.getByRole('button',{name:'Próxima'}));await waitFor(()=>expect(consultarProgramacoes).toHaveBeenLastCalledWith(expect.objectContaining({pagina:2,mes:11}),expect.any(AbortSignal)));expect(new URLSearchParams(window.location.search).get('pagina')).toBe('2');
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'Cuidado'}});await waitFor(()=>expect(consultarProgramacoes).toHaveBeenLastCalledWith(expect.objectContaining({pagina:1,busca:'Cuidado'}),expect.any(AbortSignal)));
  await screen.findByRole('button',{name:'Próxima'});fireEvent.click(screen.getByRole('button',{name:'Próxima'}));await waitFor(()=>expect(new URLSearchParams(window.location.search).get('pagina')).toBe('2'));
  fireEvent.click(screen.getByRole('button',{name:'Dez'}));await waitFor(()=>expect(consultarProgramacoes).toHaveBeenLastCalledWith(expect.objectContaining({pagina:1,mes:12}),expect.any(AbortSignal)));
 });
 it('restaura a página da URL e reinicia em outro ano de consulta',async()=>{
  window.history.replaceState(null,'','/pecuaria/sanidade/calendario?ano=2026&mes=11&pagina=2');
  vi.mocked(consultarProgramacoes).mockImplementation(async f=>pagina([evento()],201,f.pagina??1));render(<AgendaCalendario/>);await screen.findByText('201 atividades neste recorte');
  expect(consultarProgramacoes).toHaveBeenCalledWith(expect.objectContaining({ano:2026,pagina:2}),expect.any(AbortSignal));
  fireEvent.change(screen.getByRole('spinbutton',{name:'Ano da consulta'}),{target:{value:'2027'}});
  await waitFor(()=>expect(consultarProgramacoes).toHaveBeenLastCalledWith(expect.objectContaining({ano:2027,pagina:1}),expect.any(AbortSignal)));
 });
 it('matriz usa todos os eventos do ano e abre a página mensal da marcação escolhida sem inventar dia',async()=>{
  const todos=Array.from({length:101},(_,i)=>evento(i+1));window.history.replaceState(null,'','/pecuaria/sanidade/calendario?ano=2026&mes=11&visao=anual');
  vi.mocked(consultarProgramacoes).mockImplementation(async f=>pagina(f.mes?todos.slice(((f.pagina??1)-1)*100,(f.pagina??1)*100):todos.slice(0,1),101,f.pagina??1,todos));render(<AgendaCalendario/>);
  fireEvent.click(await screen.findByRole('button',{name:'Cuidado 101 em Novembro'}));await waitFor(()=>expect(consultarProgramacoes).toHaveBeenLastCalledWith(expect.objectContaining({mes:11,pagina:2}),expect.any(AbortSignal)));
  expect((await screen.findByRole('button',{name:/Cuidado 101/})).getAttribute('aria-pressed')).toBe('true');expect(screen.getAllByText('Dia a definir').length).toBeGreaterThan(0);expect(screen.queryByText('Dia 1')).toBeNull();
 });
 it('PDF solicita a exportação anual completa independente de filtros e página mensal',async()=>{
  const anual=pagina([evento()]);vi.mocked(consultarProgramacoes).mockResolvedValue(anual);window.history.replaceState(null,'','/pecuaria/sanidade/calendario?ano=2026&mes=11&busca=exame&tipo=VERIFICACAO&pagina=2');render(<AgendaCalendario/>);
  fireEvent.click(screen.getByRole('button',{name:'Baixar calendário em PDF'}));await waitFor(()=>expect(exportarCalendarioSanitario).toHaveBeenCalledWith(anual));expect(consultarProgramacoes).toHaveBeenCalledWith({ano:2026,tamanho:100},undefined,true);
 });
});
