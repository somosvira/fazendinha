// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { alterarControle } from '../../../lib/controles.fixture';
import { ColostragemBezerreiro } from './ColostragemBezerreiro';
import { consultarBezerreiro } from './api';
import { RebanhoApiError } from '../api';
import type { Configuracao, ContextoBezerreiro, OrigemColostro, UnidadeColostro } from './types';
vi.mock('./api',async()=>({...await vi.importActual<typeof import('./api')>('./api'),consultarBezerreiro:vi.fn()}));
const config:Configuracao={vigente:{versao:1,brixReferencia:'25',percentualPesoColostro:'10'},coleiras:[],fases:[],perfis:[]};
const contexto:ContextoBezerreiro={lotes:[],animais:[],partos:[{id:'parto',data:'2026-10-28',matrizId:'matriz',matriz:{brinco:'M01',nome:null},crias:[{id:'cria',animalId:'animal',animal:{brinco:'601',nome:'Lua'}}]}],tanques:[],posicoes:[],producoes:[],produtos:[{id:'insumo',nome:'Suplemento',unidade:'G'}],formatosExame:[]};
const congelada:UnidadeColostro={id:'unidade',codigo:'BC001',volumeLitros:'2',saldoRestanteLitros:'2',status:'CONGELADA',versao:1,dataCongelamento:'2026-10-28'};
const retirada:UnidadeColostro={...congelada,id:'retirada',codigo:'BC002',saldoRestanteLitros:'0.5',status:'RETIRADA',versao:2};
function origem(unidade:UnidadeColostro):OrigemColostro{return {id:`origem-${unidade.id}`,versao:2,status:'CONFIRMADO',tipo:'NAO_ENRIQUECIDO',loteColostroId:'lote',preparoId:null,partoId:'parto',matrizId:'matriz',entradaId:'entrada',data:'2026-10-28',ocorridoEm:null,quantidadeLitros:'2',saldoLitros:unidade.saldoRestanteLitros,livreLitros:'0',reservadoLitros:unidade.saldoRestanteLitros,origemFisica:null,brix:brixTeste??{amostraId:'amostra',data:'2026-10-28',resultado:'26',limiteInclusivo:'25',situacao:'ADEQUADO'},custo:{situacao:'A_APURAR',valorTotal:null},unidades:[unidade]};}
function montar(configuracao=config,params=new URLSearchParams()){return render(<ColostragemBezerreiro sitio={1} podeLancar revisao={0} aoSalvar={vi.fn()} config={configuracao} params={params} mudar={vi.fn()}/>);}
let rastrearPartidas=false;
let brixTeste:OrigemColostro['brix']|null=null;
beforeEach(()=>{rastrearPartidas=false;brixTeste=null;vi.clearAllMocks();vi.mocked(consultarBezerreiro).mockImplementation(async(path,_sitio,body)=>{
  if(body)return {};
  if(path.startsWith('/contexto'))return {...contexto,produtos:contexto.produtos.map(p=>({...p,rastrearPartidas}))};
  if(path.startsWith('/insumos/'))return [{id:'partida',codigo:'SUP-01',validade:'2027-01-01',saldo:'200'}];
  if(path.startsWith('/colostro/partos')){const q=new URLSearchParams(path.split('?')[1]);return {itens:contexto.partos,total:1,pagina:1,porPagina:20,selecionado:q.get('partoId')||q.get('criaId')?contexto.partos[0]:null};}
  if(path.startsWith('/colostro/fornecimentos'))return {itens:[],total:0,pagina:1,porPagina:20,selecionado:null};
  if(path.startsWith('/colostro/producoes'))return {itens:[]};
  if(path.startsWith('/colostro/origens/'))return origem(path.endsWith('retirada')?retirada:congelada);
  if(path.startsWith('/colostro/unidades')){const u=path.includes('situacao=RETIRADA')?retirada:congelada;return {itens:[{...u,origemId:`origem-${u.id}`,tipo:'NAO_ENRIQUECIDO',brix:{resultado:'26',situacao:'ADEQUADO'}}],total:1,pagina:1,porPagina:20};}
  return {itens:[origem(congelada)],total:1,pagina:1,tamanho:30};
});});
afterEach(cleanup);
describe('Consumo parcial das embalagens de colostro',()=>{
  it('separa congeladas de remanescentes retirados e confirma 1,5 L sem impor os 2 L iniciais',async()=>{
    montar();
    expect(await screen.findByRole('table',{name:'Origens de colostro'})).toBeTruthy();
    expect(screen.getByRole('heading',{name:'Banco de colostro'})).toBeTruthy();
    const banco=await screen.findByRole('table',{name:'Banco de colostro'}),fora=await screen.findByRole('table',{name:'Embalagens retiradas'});
    expect(within(banco).getByText('BC001')).toBeTruthy();expect(within(fora).getByText('BC002')).toBeTruthy();expect(within(fora).getByText('0,5 L')).toBeTruthy();
    fireEvent.click(within(banco).getByRole('button',{name:'Fornecer à cria'}));
    const dialog=await screen.findByRole('dialog',{name:'Fornecer unidade BC001'});
    const volume=within(dialog).getByLabelText('Fornecido à cria (L)') as HTMLInputElement;
    expect(volume.readOnly).toBe(false);expect(volume.max).toBe('2');
    fireEvent.change(volume,{target:{value:'1.5'}});
    await alterarControle(within(dialog).getByLabelText('Cria destinatária'),{target:{value:'cria'}});
    fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});
    fireEvent.click(within(dialog).getByRole('checkbox'));
    fireEvent.click(within(dialog).getByRole('button',{name:'Confirmar destinação'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/origens/origem-unidade/destinacoes',1,expect.objectContaining({unidadeId:'unidade',versaoEsperada:2,crias:[{criaId:'cria',quantidadeLitros:1.5,tipo:'DESCONGELADO'}],unidades:[]})));
  });
  it('limita enriquecimento ao saldo de 0,5 L da embalagem retirada',async()=>{
    montar();const fora=await screen.findByRole('table',{name:'Embalagens retiradas'});
    fireEvent.click(within(fora).getByRole('button',{name:'Enriquecer'}));
    const dialog=await screen.findByRole('dialog',{name:'Enriquecer colostro'}),volume=within(dialog).getByLabelText('Volume consumido da origem (L)') as HTMLInputElement;
    expect(volume.readOnly).toBe(false);expect(volume.value).toBe('0.5');expect(volume.max).toBe('0.5');
    fireEvent.change(volume,{target:{value:'0.3'}});fireEvent.change(within(dialog).getByLabelText('Volume final medido (L)'),{target:{value:'0.32'}});
    await alterarControle(within(dialog).getByLabelText('Insumo utilizado'),{target:{value:'insumo'}});
    fireEvent.change(within(dialog).getByLabelText('Quantidade do insumo (G)'),{target:{value:'10'}});fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});
    fireEvent.click(within(dialog).getByRole('button',{name:'Registrar enriquecimento'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/enriquecimentos',1,expect.objectContaining({origens:[{origemId:'origem-retirada',versaoEsperada:2,quantidadeLitros:0.3,unidadeId:'retirada'}],volumeFinalLitros:0.32})));
  });
  it('consulta e exige partida do insumo com rastreamento na data operacional',async()=>{
    rastrearPartidas=true;montar();const fora=await screen.findByRole('table',{name:'Embalagens retiradas'});fireEvent.click(within(fora).getByRole('button',{name:'Enriquecer'}));
    const dialog=await screen.findByRole('dialog',{name:'Enriquecer colostro'});
    await alterarControle(within(dialog).getByLabelText('Insumo utilizado'),{target:{value:'insumo'}});
    await waitFor(()=>expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path])=>path.startsWith('/insumos/insumo/partidas?data='))).toBe(true));
    fireEvent.submit(dialog.querySelector('form')!);await screen.findByText('Selecione uma partida do insumo com saldo disponível nesta data.');
    await alterarControle(within(dialog).getByLabelText('Partida do insumo'),{target:{value:'partida'}});
    fireEvent.change(within(dialog).getByLabelText('Volume final medido (L)'),{target:{value:'0.52'}});fireEvent.change(within(dialog).getByLabelText('Quantidade do insumo (G)'),{target:{value:'10'}});fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});fireEvent.click(within(dialog).getByRole('button',{name:'Registrar enriquecimento'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/enriquecimentos',1,expect.objectContaining({insumos:[expect.objectContaining({produtoId:'insumo',partidaId:'partida'})]})));
  });

  it.each([
    {limite:'25',atual:'20',situacao:'ABAIXO_REFERENCIA',obrigatorio:true},
    {limite:'20',atual:'25',situacao:'ADEQUADO',obrigatorio:false},
  ])('usa política Brix da amostra (limite $limite) em vez da configuração atual ($atual)',async caso=>{
    brixTeste={amostraId:'amostra',data:'2026-10-28',resultado:'24',limiteInclusivo:caso.limite,situacao:caso.situacao};
    montar({...config,vigente:{...config.vigente!,brixReferencia:caso.atual}});
    const banco=await screen.findByRole('table',{name:'Banco de colostro'});fireEvent.click(within(banco).getByRole('button',{name:'Fornecer à cria'}));
    const dialog=await screen.findByRole('dialog',{name:'Fornecer unidade BC001'}),motivo=within(dialog).getByLabelText('Motivo da exceção Brix') as HTMLTextAreaElement;
    expect(motivo.required).toBe(caso.obrigatorio);expect(within(dialog).getByText(new RegExp(`Limite registrado: ≥ ${caso.limite}%`))).toBeTruthy();
    await alterarControle(within(dialog).getByLabelText('Cria destinatária'),{target:{value:'cria'}});fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});
    if(caso.obrigatorio){fireEvent.submit(dialog.querySelector('form')!);await screen.findByText('Informe um motivo de pelo menos cinco caracteres para a exceção Brix.');}
    fireEvent.change(motivo,{target:{value:'Exceção registrada na data'}});fireEvent.click(within(dialog).getByRole('checkbox'));fireEvent.click(within(dialog).getByRole('button',{name:'Confirmar destinação'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/origens/origem-unidade/destinacoes',1,expect.objectContaining({excecaoBrix:{motivo:'Exceção registrada na data',responsavel:'Operadora'}})));
  });
  it('abre retirada pelo parto indicado sem efetuar escrita ao entrar',async()=>{
    montar(config,new URLSearchParams('partoId=parto&novaRetirada=1'));
    const dialog=await screen.findByRole('dialog',{name:'Registrar retirada de colostro no parto'});
    await waitFor(()=>expect(within(dialog).getByLabelText('Parto / matriz').textContent).toContain('M01'));
    expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path])=>path.includes('/colostro/producoes?partoId=parto&data='))).toBe(true);
    expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path])=>path.startsWith('/colostro/partos?data=')&&path.includes('&partoId=parto'))).toBe(true);
    expect(vi.mocked(consultarBezerreiro).mock.calls.every(([, ,body])=>body===undefined)).toBe(true);
  });

});

describe('fornecimento existente e seleção histórica',()=>{
 function contextoHistorico(conflito=false){
  const base=vi.mocked(consultarBezerreiro).getMockImplementation()!;let falhou=false;
  vi.mocked(consultarBezerreiro).mockImplementation(async(path,sitio,body)=>{
   if(body&&path.endsWith('/destinacoes')){if(conflito&&!falhou){falhou=true;throw new RebanhoApiError('A origem mudou',409,'CONFLITO');}return {};}
   if(path.startsWith('/colostro/origens')){const o={...origem(congelada),livreLitros:'6',quantidadeLitros:'6',versao:falhou?3:2};return path.includes('origem-unidade')?o:{itens:[o],total:1,pagina:1,porPagina:20};}
   if(path.startsWith('/colostro/fornecimentos')){const q=new URLSearchParams(path.split('?')[1]),f={id:'fornecimento-4L',criaId:'cria',data:q.get('data'),ocorridoEm:null,horarioEstimado:false,quantidadeLitros:'4.000',tipo:'FRESCO',status:'VALIDO'};return {itens:[f],total:1,pagina:1,porPagina:20,selecionado:q.get('fornecimentoId')?f:null};}
   if(path.startsWith('/colostro/partos')){const q=new URLSearchParams(path.split('?')[1]),valido=q.get('data')!=='2026-10-01';return {itens:valido?contexto.partos:[],total:121,pagina:Number(q.get('pagina')),porPagina:20,selecionado:valido&&(q.get('criaId')||q.get('partoId'))?contexto.partos[0]:null};}
   return base(path,sitio,body);
  });
 }
 async function abrirDestino(){montar();const tabela=await screen.findByRole('table',{name:'Origens de colostro'});fireEvent.click(within(tabela).getByRole('button',{name:'Destinar'}));const d=await screen.findByRole('dialog',{name:'Destinar colostro para cria / banco'});await alterarControle(within(d).getByLabelText('Cria destinatária'),{target:{value:'cria'}});fireEvent.change(within(d).getByLabelText('Responsável'),{target:{value:'Operadora'}});return d;}
 it('vincula 4 L existentes sem mandar um segundo fornecimento e conserva horário desconhecido',async()=>{
  contextoHistorico();const d=await abrirDestino();await alterarControle(within(d).getByLabelText('Fornecimento'),{target:{value:'existente'}});
  await alterarControle(within(d).getByLabelText(/^Registro existente/),{target:{value:'fornecimento-4L'}});
  await waitFor(()=>expect(vi.mocked(consultarBezerreiro).mock.calls.some(([p])=>p.includes('fornecimentoId=fornecimento-4L'))).toBe(true));
  await waitFor(()=>expect(within(d).getByText(/Total: 4 L/)).toBeTruthy());
  fireEvent.click(within(d).getByRole('checkbox'));fireEvent.click(within(d).getByRole('button',{name:'Confirmar destinação'}));
  await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/origens/origem-unidade/destinacoes',1,expect.objectContaining({ocorridoEm:null,horarioEstimado:false,crias:[{criaId:'cria',quantidadeLitros:4,tipo:'FRESCO',fornecimentoColostroId:'fornecimento-4L'}]})));
 });
 it('preserva seleção por ID ao paginar além de 100 e valores ao invalidá-la em outra data',async()=>{
  contextoHistorico();const d=await abrirDestino();fireEvent.change(within(d).getByLabelText('Fornecido à cria (L)'),{target:{value:'1.5'}});
  for(let pagina=2;pagina<=7;pagina++){fireEvent.click(within(d).getByRole('button',{name:'Próxima'}));await waitFor(()=>expect(within(d).getByText(`Página ${pagina} de 7`)).toBeTruthy());}
  expect(within(d).getByLabelText('Cria destinatária').textContent).toContain('601');
  fireEvent.change(within(d).getByLabelText('Data'),{target:{value:'01/10/2026'}});
  await within(d).findByText(/A seleção não está disponível/);
  expect((within(d).getByLabelText('Responsável') as HTMLInputElement).value).toBe('Operadora');expect((within(d).getByLabelText('Fornecido à cria (L)') as HTMLInputElement).value).toBe('1.5');
  fireEvent.submit(d.querySelector('form')!);expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,b])=>b)).toHaveLength(0);
 });
 it('conflito atualiza e exige conferência sem apagar volume nem confirmar automaticamente',async()=>{
  contextoHistorico(true);const d=await abrirDestino();fireEvent.change(within(d).getByLabelText('Fornecido à cria (L)'),{target:{value:'1.5'}});fireEvent.submit(d.querySelector('form')!);
  await within(d).findByText('A origem mudou');fireEvent.click(within(d).getByRole('button',{name:'Atualizar contexto'}));await within(d).findByRole('button',{name:'Conferi as alterações'});
  expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,b])=>b)).toHaveLength(1);
  expect((within(d).getByLabelText('Fornecido à cria (L)') as HTMLInputElement).value).toBe('1.5');expect((within(d).getByLabelText('Responsável') as HTMLInputElement).value).toBe('Operadora');
  fireEvent.submit(d.querySelector('form')!);expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,b])=>b)).toHaveLength(1);
  fireEvent.click(within(d).getByRole('button',{name:'Conferi as alterações'}));await waitFor(()=>expect(within(d).getByLabelText('Cria destinatária').textContent).toContain('601'));fireEvent.submit(d.querySelector('form')!);
  await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/colostro/origens/origem-unidade/destinacoes',1,expect.objectContaining({versaoEsperada:3,crias:[{criaId:'cria',quantidadeLitros:1.5,tipo:'FRESCO'}]})));
 });
});
