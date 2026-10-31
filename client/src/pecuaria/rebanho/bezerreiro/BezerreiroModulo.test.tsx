// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BezerreiroModulo } from './BezerreiroModulo';
import { AcompanhamentoBezerreiro } from './AcompanhamentoBezerreiro';
import { consultarBezerreiro } from './api';
import { setPropriedadeAtiva } from '../../../propriedadeScope';
import type { AcompanhamentoAnimal, Configuracao, Participacao } from './types';
vi.mock('./api',async()=>({...await vi.importActual<typeof import('./api')>('./api'),consultarBezerreiro:vi.fn()}));
const config:Configuracao={vigente:null,coleiras:[],fases:[],perfis:[]};
beforeEach(()=>{vi.clearAllMocks();setPropriedadeAtiva(1);history.replaceState(null,'','/pecuaria/bezerreiro?coleira=coleira-a&fase=fase-v1&historico=true');});
afterEach(cleanup);
describe('Bezerreiro: consultas e acessos',()=>{
  it('abre histórico diretamente e aplica coleira/fase no servidor sem oferecer escrita ao leitor',async()=>{
    vi.mocked(consultarBezerreiro).mockImplementation(async(path)=>path==='/configuracoes'?config:{itens:[],total:0,pagina:1,porPagina:20});
    render(<BezerreiroModulo podeLancar={false}/>);
    await screen.findByText('Nenhum animal corresponde aos filtros. Ajuste ou limpe os critérios.');
    expect(screen.getByRole('heading',{name:'Histórico de saídas'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Registrar entrada'})).toBeNull();
    expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path,sitio])=>path.includes('historico=true')&&path.includes('coleiraId=coleira-a')&&path.includes('faseVersaoId=fase-v1')&&sitio===1)).toBe(true);
  });
  it('mantém falha de consulta distinta de ausência e permite tentar novamente',async()=>{
    let falhar=true;vi.mocked(consultarBezerreiro).mockImplementation(async(path)=>{if(path==='/configuracoes')return config;if(falhar)throw new Error('Conexão indisponível');return {itens:[],total:0,pagina:1};});
    render(<BezerreiroModulo podeLancar={false}/>);await screen.findByText('Conexão indisponível');
    expect(screen.queryByText('Nenhum animal corresponde aos filtros. Ajuste ou limpe os critérios.')).toBeNull();
    falhar=false;fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await screen.findByText('Nenhum animal corresponde aos filtros. Ajuste ou limpe os critérios.');
  });
  it('troca de rotina mantém as cinco abas e o caminho canônico',async()=>{
    vi.mocked(consultarBezerreiro).mockImplementation(async(path)=>path==='/configuracoes'?config:{itens:[],total:0,pagina:1});
    render(<BezerreiroModulo podeLancar={false}/>);await screen.findByRole('heading',{name:'Histórico de saídas'});
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab',{name:'Sanidade'}));
    await waitFor(()=>expect(location.search).toBe('?aba=sanidade'));
    expect(location.pathname).toBe('/pecuaria/bezerreiro');
  });
  it('conserva acompanhamento depois da saída sem oferecer mudança de fase ou nova saída',async()=>{
    const participacao:Participacao={id:'participacao',animalId:'animal',animal:{id:'animal',brinco:'601',nome:'Lua'},perfilId:'perfil',perfil:{id:'perfil',loteId:'lote',ativo:true,lote:{id:'lote',nome:'Bezerreiro'}},desde:'2026-09-01',ate:'2026-10-20',motivoSaida:'Saída após desmame',versao:2,fases:[]};
    const dados:AcompanhamentoAnimal={animal:participacao.animal,participacoes:[participacao],acompanhamento:null,colostro:[],exames:[],temHistorico:true};
    vi.mocked(consultarBezerreiro).mockResolvedValue(config);
    render(<AcompanhamentoBezerreiro animalId="animal" sitio={1} podeLancar dadosIniciais={dados}/>);
    expect(screen.getByText('Histórico do bezerreiro')).toBeTruthy();
    expect(screen.getByText(/Saída após desmame/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Alterar fase'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Registrar saída'})).toBeNull();
  });
});
