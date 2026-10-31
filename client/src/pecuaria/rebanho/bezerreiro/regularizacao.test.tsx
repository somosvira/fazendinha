// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { consultarBezerreiro } from './api';
import { navegarPara } from '../../../router';
import { RebanhoApiError } from '../api';
import { DetalheColostro, HistoricoColostro, parametrosDetalheColostro } from './DetalheColostro';
vi.mock('../../../router',()=>({navegarPara:vi.fn()}));
vi.mock('./api',async()=>({...await vi.importActual<typeof import('./api')>('./api'),consultarBezerreiro:vi.fn()}));
const base={id:'destino',data:'2026-10-20',status:'CONFIRMADO',versao:3,responsavel:'Maria',origemId:'origem',ocorridoEm:null,horarioEstimado:false,criadoPorId:9,motivoEstorno:null,dependencias:[],unidades:[],fornecimentos:[{id:'alocacao',criaId:'cria',animalId:'animal',brinco:'601',nome:'Lua',fornecimentoId:'fato-original',quantidadeLitros:'4',ativo:true,criadoPelaDestinacao:false}]};
const mudar=vi.fn(),salvar=vi.fn();
function tela(podeLancar=true){return render(<DetalheColostro sitio={7} revisao={0} tipo="destinacoes" id="destino" podeLancar={podeLancar} mudar={mudar} aoSalvar={salvar}/>);}
beforeEach(()=>{vi.clearAllMocks();vi.mocked(consultarBezerreiro).mockResolvedValue(base);});
afterEach(cleanup);
describe('Regularização de colostro',()=>{
  it('abre detalhe por recurso, informa vínculo original e volta alterando somente parâmetros de detalhe',async()=>{
    tela();await screen.findAllByText('Desfaz somente o vínculo; conserva o fornecimento original');
    expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/destinacoes/destino',7);
    expect(screen.getAllByText('601 · Lua').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button',{name:'Ver na ficha'})[0]);expect(navegarPara).toHaveBeenCalledWith('/pecuaria/rebanho/animais/animal#bezerreiro');
    fireEvent.click(screen.getByRole('button',{name:'Voltar à consulta'}));
    expect(mudar).toHaveBeenCalledWith({origemId:'',destinacaoId:'',enriquecimentoId:''});
    const params=new URLSearchParams('de=2026-10-01&ate=2026-10-28&pagina=3&paginaBanco=2&destinacaoId=destino');
    for(const [k,v] of Object.entries(parametrosDetalheColostro()))v?params.set(k,v):params.delete(k);
    expect(params.get('pagina')).toBe('3');expect(params.get('de')).toBe('2026-10-01');expect(params.get('paginaBanco')).toBe('2');
  });
  it('identifica consumidor e código bloqueantes e oferece sua regularização sem estornar em cascata',async()=>{
    vi.mocked(consultarBezerreiro).mockResolvedValue({...base,dependencias:[{tipo:'enriquecimentos',id:'preparo-consumidor',unidadeCodigo:'BC-12'}]});tela();
    await screen.findByText(/Unidade BC-12/);
    expect(screen.getByRole('button',{name:'Estornar destinação'})).toHaveProperty('disabled',true);
    fireEvent.click(screen.getByRole('button',{name:'Abrir enriquecimento'}));expect(mudar).toHaveBeenCalledWith(parametrosDetalheColostro('enriquecimentos','preparo-consumidor'));
    expect(vi.mocked(consultarBezerreiro).mock.calls.every(c=>!c[2])).toBe(true);
  });
  it('estorna com motivo, versão e chave e atualiza os consumidores da consulta',async()=>{
    tela();fireEvent.click(await screen.findByRole('button',{name:'Estornar destinação'}));
    fireEvent.change(screen.getByLabelText('Motivo do estorno'),{target:{value:'Origem vinculada incorretamente'}});
    fireEvent.click(screen.getByLabelText('Conferi os vínculos e efeitos do estorno.'));
    fireEvent.submit(document.getElementById('estorno-registro-colostro')!);
    await waitFor(()=>expect(salvar).toHaveBeenCalledTimes(1));
    expect(consultarBezerreiro).toHaveBeenLastCalledWith('/colostro/destinacoes/destino/estorno',7,expect.objectContaining({motivo:'Origem vinculada incorretamente',versaoEsperada:3,chave:expect.any(String)}));
  });
  it('abre enriquecimento com volume final e permite seu estorno contextual',async()=>{
    vi.mocked(consultarBezerreiro).mockResolvedValue({...base,id:'preparo',volumeFinalLitros:'2.2',origemResultadoId:'enriquecida',origens:[],insumos:[]});
    render(<DetalheColostro sitio={7} revisao={0} tipo="enriquecimentos" id="preparo" podeLancar mudar={mudar} aoSalvar={salvar}/>);
    await screen.findByText(/Volume final medido:/);fireEvent.click(screen.getByRole('button',{name:'Abrir origem enriquecida'}));expect(mudar).toHaveBeenCalledWith(parametrosDetalheColostro('origens','enriquecida'));
    fireEvent.click(screen.getByRole('button',{name:'Estornar enriquecimento'}));fireEvent.change(screen.getByLabelText('Motivo do estorno'),{target:{value:'Correção do preparo registrado'}});fireEvent.submit(document.getElementById('estorno-registro-colostro')!);
    await waitFor(()=>expect(salvar).toHaveBeenCalledTimes(1));expect(consultarBezerreiro).toHaveBeenLastCalledWith('/colostro/enriquecimentos/preparo/estorno',7,expect.objectContaining({motivo:'Correção do preparo registrado',versaoEsperada:3}));
  });
  it('preserva motivo após conflito e só adota nova versão depois de conferir explicitamente',async()=>{
    let versao=3;
    vi.mocked(consultarBezerreiro).mockImplementation(async(_path,_sitio,body)=>{if(body){if(versao===3){versao=4;throw new RebanhoApiError('O registro mudou',409,'CONFLITO');}return {...base,versao};}return {...base,versao};});
    tela();fireEvent.click(await screen.findByRole('button',{name:'Estornar destinação'}));
    const motivo=screen.getByLabelText('Motivo do estorno');fireEvent.change(motivo,{target:{value:'Conferência da origem original'}});fireEvent.submit(document.getElementById('estorno-registro-colostro')!);
    fireEvent.click(await screen.findByRole('button',{name:'Atualizar contexto'}));await screen.findByText(/Versão 3 → 4/);
    expect(motivo).toHaveProperty('value','Conferência da origem original');expect(salvar).not.toHaveBeenCalled();
    fireEvent.submit(document.getElementById('estorno-registro-colostro')!);expect(vi.mocked(consultarBezerreiro).mock.calls.filter(c=>c[2])).toHaveLength(1);
    fireEvent.click(screen.getByRole('button',{name:'Conferi as alterações'}));fireEvent.submit(document.getElementById('estorno-registro-colostro')!);
    await waitFor(()=>expect(salvar).toHaveBeenCalledTimes(1));expect(consultarBezerreiro).toHaveBeenLastCalledWith(expect.any(String),7,expect.objectContaining({versaoEsperada:4,motivo:'Conferência da origem original'}));
  });
  it('abre ficha autorizada do fornecimento histórico bloqueante',async()=>{
    vi.mocked(consultarBezerreiro).mockResolvedValue({...base,dependencias:[{tipo:'fornecimentos',id:'legado',animalId:'animal',brinco:'601',unidadeCodigo:null}]});tela();
    fireEvent.click(await screen.findByRole('button',{name:'Ver na ficha da cria'}));expect(navegarPara).toHaveBeenCalledWith('/pecuaria/rebanho/animais/animal#bezerreiro');expect(screen.getByRole('button',{name:'Estornar destinação'})).toHaveProperty('disabled',true);
  });
  it('conserva navegação de leitura sem expor estorno para usuário sem lançamento',async()=>{tela(false);await screen.findByText('Responsável: Maria · Horário não informado');expect(screen.queryByRole('button',{name:'Estornar destinação'})).toBeNull();expect(screen.getByRole('button',{name:'Abrir origem'})).toBeTruthy();});
  it('históricos seguem filtros de período e paginação independente incluindo estornados',async()=>{
    vi.mocked(consultarBezerreiro).mockResolvedValue({itens:[{...base,status:'ESTORNADO'}],total:31,pagina:2,tamanho:30});
    render(<HistoricoColostro sitio={7} revisao={0} params={new URLSearchParams('de=2026-10-01&ate=2026-10-28&paginaDestinacoes=2')} mudar={mudar}/>);
    await screen.findAllByText('Estornado');expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/destinacoes?pagina=2&inicio=2026-10-01&fim=2026-10-28',7);
    fireEvent.click(screen.getAllByRole('button',{name:'Detalhes / regularizar'})[0]);expect(mudar).toHaveBeenCalledWith(parametrosDetalheColostro('destinacoes','destino'));
  });
});
