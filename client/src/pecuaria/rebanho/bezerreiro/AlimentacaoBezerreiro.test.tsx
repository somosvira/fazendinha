// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { alterarControle } from '../../../lib/controles.fixture';
import { AlimentacaoBezerreiro } from './AlimentacaoBezerreiro';
import { consultarBezerreiro } from './api';
import { RebanhoApiError } from '../api';
import { idOfertaDaPrevisao, ofertaJaRealizada } from './modelo';
import type { Configuracao, Previsao } from './types';
vi.mock('./api',async()=>({...await vi.importActual<typeof import('./api')>('./api'),consultarBezerreiro:vi.fn()}));
const identidade='00000000-0000-4000-8000-000000000001',versaoId='00000000-0000-4000-8000-000000000002',atualConfigId='00000000-0000-4000-8000-000000000003';
const configuracao:Configuracao={vigente:null,coleiras:[],perfis:[{id:'perfil',loteId:'lote',ativo:true,lote:{id:'lote',nome:'Bezerreiro'}}],fases:[{id:'fase-config',identidadeId:'fase-identidade',nome:'Inicial',coleiraId:'vermelha',coleira:null,litrosDia:'4',publicada:true,ofertas:[{id:atualConfigId,identidadeId:identidade,ordem:0,percentual:'100'}]}]};
const previsao:Previsao={contextoToken:'a'.repeat(64),data:'2026-10-28',previsaoCompleta:true,pendentes:[],totalPrevistoLitros:'4',totalFornecidoLitros:'0',ofertasRealizadas:[],origens:[{entradaId:'entrada',produtoId:'produto',produtoNome:'Leite',natureza:'NAO_COMERCIAL',quantidadeDisponivelLitros:'10'}],grupos:[{coleiraId:'vermelha',nome:'Vermelha',cor:'#bc4749',litrosDia:'4',fornecidoLitros:'0',restanteLitros:'4',participantes:[{animalId:'animal',brinco:'601',participacaoId:'participacao',faseVersaoId:'fase-historica',litrosDia:'4',ofertas:[{id:versaoId,identidadeId:identidade,ordem:0,percentual:'100'}]}]}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(consultarBezerreiro).mockImplementation(async(path,_sitio,body)=>body?{}:path.startsWith('/previsao')?previsao:{itens:[],total:0,pagina:1});});
afterEach(cleanup);
async function abrir(){render(<AlimentacaoBezerreiro sitio={1} config={configuracao} podeLancar revisao={0} aoSalvar={vi.fn()} params={new URLSearchParams('data=2026-10-28')} mudar={vi.fn()}/>);const botao=screen.getByRole('button',{name:'Registrar fornecimento'});await waitFor(()=>expect((botao as HTMLButtonElement).disabled).toBe(false));fireEvent.click(botao);return await screen.findByRole('dialog',{name:'Registrar fornecimento'});}
describe('Contrato de ofertas versionadas',()=>{
  it('envia a versão da oferta da própria previsão e distingue identidade da configuração vigente',async()=>{
    const dialog=await abrir();fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});fireEvent.click(within(dialog).getByRole('checkbox',{name:'Conferi as quantidades fornecidas por coleira.'}));fireEvent.click(within(dialog).getByRole('button',{name:'Confirmar fornecimento'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/ofertas',1,expect.objectContaining({ofertaProgramadaId:versaoId,contextoToken:previsao.contextoToken,grupos:[{coleiraId:'vermelha',quantidadeLitros:'4'}]})));
    expect(versaoId).not.toBe(identidade);expect(versaoId).not.toBe(atualConfigId);
  });
  it('exige e envia justificativa para avulsa mesmo igual ao volume restante previsto',async()=>{
    const dialog=await abrir();await alterarControle(within(dialog).getByLabelText('Oferta prevista'),{target:{value:''}});
    fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});fireEvent.click(within(dialog).getByRole('checkbox',{name:'Conferi as quantidades fornecidas por coleira.'}));
    fireEvent.submit(dialog.querySelector('form')!);
    await screen.findByText('Informe um motivo de pelo menos cinco caracteres para o fornecimento avulso.');
    expect(vi.mocked(consultarBezerreiro).mock.calls.some(([, ,body])=>body!==undefined)).toBe(false);
    fireEvent.change(within(dialog).getByLabelText('Observação / motivo das diferenças'),{target:{value:'Oferta extra conferida'}});fireEvent.click(within(dialog).getByRole('button',{name:'Confirmar fornecimento'}));
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/ofertas',1,expect.objectContaining({ofertaProgramadaId:null,grupos:[{coleiraId:'vermelha',quantidadeLitros:'4',justificativa:'Oferta extra conferida'}]})));
  });
  it('preserva rascunho após A→B e só envia novo contexto depois de conferir explicitamente',async()=>{
    let atualizada=false,conflitou=false;
    const nova:Previsao={...previsao,contextoToken:'b'.repeat(64),grupos:previsao.grupos.map(g=>({...g,participantes:g.participantes.map(p=>({...p,animalId:'animal-b',brinco:'602',participacaoId:'participacao-b'}))}))};
    vi.mocked(consultarBezerreiro).mockImplementation(async(path,_sitio,body)=>{
      if(body){if(!conflitou){conflitou=true;throw new RebanhoApiError('Participantes mudaram; confira novamente',409,'CONFLITO','contextoToken');}return {};}
      if(path.startsWith('/previsao'))return atualizada?nova:previsao;
      return {itens:[],total:0,pagina:1};
    });
    const dialog=await abrir();
    fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});
    fireEvent.change(within(dialog).getAllByLabelText('Litros coletivos Vermelha')[0],{target:{value:'3'}});
    fireEvent.change(within(dialog).getByLabelText('Horário realizado (opcional)'),{target:{value:'09:30'}});
    fireEvent.change(within(dialog).getByLabelText('Observação / motivo das diferenças'),{target:{value:'Volume real conferido'}});
    fireEvent.click(within(dialog).getByRole('checkbox',{name:'Conferi as quantidades fornecidas por coleira.'}));
    fireEvent.submit(dialog.querySelector('form')!);
    await screen.findByRole('button',{name:'Atualizar contexto'});
    atualizada=true;fireEvent.click(within(dialog).getByRole('button',{name:'Atualizar contexto'}));
    await screen.findByRole('button',{name:'Conferi as alterações'});
    fireEvent.submit(dialog.querySelector('form')!);
    expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,body])=>body)).toHaveLength(1);
    expect((within(dialog).getByLabelText('Responsável') as HTMLInputElement).value).toBe('Operadora');
    expect((within(dialog).getAllByLabelText('Litros coletivos Vermelha')[0] as HTMLInputElement).value).toBe('3');
    expect((within(dialog).getByLabelText('Horário realizado (opcional)') as HTMLInputElement).value).toBe('09:30');
    fireEvent.click(within(dialog).getByRole('button',{name:'Conferi as alterações'}));
    expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,body])=>body)).toHaveLength(1);
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(()=>expect(vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,body])=>body)).toHaveLength(2));
    const comandos=vi.mocked(consultarBezerreiro).mock.calls.filter(([, ,body])=>body).map(([, ,body])=>body as Record<string,unknown>);
    expect(comandos[0].contextoToken).toBe(previsao.contextoToken);expect(comandos[1].contextoToken).toBe(nova.contextoToken);
    expect(comandos[0].chave).not.toBe(comandos[1].chave);
    expect(comandos[1]).toMatchObject({responsavel:'Operadora',observacao:'Volume real conferido',grupos:[{coleiraId:'vermelha',quantidadeLitros:'3',justificativa:'Volume real conferido'}]});
  });
  it('consumo adicional exige declaração e justificativa distintas de reutilizar leite',async()=>{
    const dialog=await abrir();fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Operadora'}});
    fireEvent.click(within(dialog).getByRole('checkbox',{name:/Este é um consumo adicional/}));
    fireEvent.submit(dialog.querySelector('form')!);await screen.findByText('Justifique o consumo adicional explicitamente conferido.');
    fireEvent.change(within(dialog).getByLabelText('Observação / motivo das diferenças'),{target:{value:'Oferta realmente adicional ao fechamento'}});
    fireEvent.submit(dialog.querySelector('form')!);
    await waitFor(()=>expect(consultarBezerreiro).toHaveBeenCalledWith('/ofertas',1,expect.objectContaining({grupos:[{coleiraId:'vermelha',quantidadeLitros:'4',consumoAdicional:true,justificativa:'Oferta realmente adicional ao fechamento'}]})));
  });
  it('mudança de sítio mantém o rascunho no alvo original e impede transportá-lo silenciosamente',async()=>{
    const props={config:configuracao,podeLancar:true,revisao:0,aoSalvar:vi.fn(),params:new URLSearchParams('data=2026-10-28'),mudar:vi.fn()};
    const tela=render(<AlimentacaoBezerreiro {...props} sitio={1}/>);
    const botao=screen.getByRole('button',{name:'Registrar fornecimento'});await waitFor(()=>expect((botao as HTMLButtonElement).disabled).toBe(false));fireEvent.click(botao);
    const dialog=await screen.findByRole('dialog',{name:'Registrar fornecimento'});
    fireEvent.change(within(dialog).getByLabelText('Responsável'),{target:{value:'Responsável original'}});
    tela.rerender(<AlimentacaoBezerreiro {...props} sitio={2}/>);
    await screen.findByText(/O sítio, bezerreiro ou data da consulta mudou/);
    expect((within(dialog).getByLabelText('Responsável') as HTMLInputElement).value).toBe('Responsável original');
    fireEvent.submit(dialog.querySelector('form')!);
    expect(vi.mocked(consultarBezerreiro).mock.calls.some(([, ,body])=>body)).toBe(false);
    tela.rerender(<AlimentacaoBezerreiro {...props} sitio={1}/>);
    expect((within(dialog).getByLabelText('Responsável') as HTMLInputElement).value).toBe('Responsável original');
  });
  it('reconhece realizada pelo ID da versão correspondente à identidade lógica',()=>{
    expect(idOfertaDaPrevisao(previsao,identidade)).toBe(versaoId);
    expect(ofertaJaRealizada({...previsao,ofertasRealizadas:[{id:'realizada',data:previsao.data,ocorridoEm:null,ofertaProgramadaId:versaoId,versao:1}]},identidade)).toBe(true);
  });
});
