// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RegularizarParticipacao } from './RegularizarParticipacao';
import { buscarFichaAnimal, listarAnimais } from '../api';
import { consultarBezerreiro } from './api';
import type { AnimalFicha, AnimalResumo } from '../types';
import type { Configuracao } from './types';
vi.mock('../api',async()=>({...await vi.importActual('../api'),buscarFichaAnimal:vi.fn(),listarAnimais:vi.fn()}));
vi.mock('./api',()=>({consultarBezerreiro:vi.fn()}));
vi.mock('@/financeiro/SelectCampo',()=>({SelectCampo:({onValueChange,...p}:ComponentProps<'select'> & {onValueChange:(v:string)=>void})=><select {...p} onChange={e=>onValueChange(e.target.value)}/>}));
const animal:AnimalResumo={id:'a',brinco:'601',nome:'Lua',sexo:'F',categoria:null,categoriaOrigem:'SEM_CATEGORIA',categoriaCalculada:null,idadeMeses:2,idadeNaBaixa:false,dataNascimento:'2026-08-01',dataEntrada:'2026-09-22',origem:'NASCIDO',propriedade:{id:7,nome:'Sede'},lote:{id:'l',nome:'Bezerreiro'},aptidao:'LEITE',papelReprodutivo:'NENHUM',composicaoRotulo:'',ultimoPeso:null,situacao:'ATIVO',gmdRecente:null,noLocalDesde:'2026-09-22',baixa:null};
const ficha:AnimalFicha={...animal,baixa:null,brincoEletronico:null,sisbov:null,nascimentoEstimado:false,partosAntesDaEntrada:0,observacao:null,composicao:[],historicoLocalizacoes:[{id:'loc',desde:'2026-09-22T00:00:00.000Z',ate:null,lote:{id:'l',nome:'Bezerreiro'},propriedade:{id:7,nome:'Sede'},motivo:null,movimentacaoId:null}],historicoDestinos:[],historicoPesagens:[],historicoCategoriasManuais:[],filiacao:{mae:null,pai:null},filhosCount:0,peso:{ultimo:null,gmdRecente:null,gmdDesdeEntrada:null,gmdPeriodo:{dias:null,valor:null,pesagens:0}},historicoBaixas:[]};
const config:Configuracao={vigente:null,coleiras:[],fases:[],perfis:[{id:'p',ativo:true,loteId:'l',lote:{id:'l',nome:'Bezerreiro'}}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listarAnimais).mockResolvedValue({itens:[animal],total:1,painel:{totalAtivos:1,porCategoria:[],porSitio:[],femeasAtivas:1,receptorasAtivas:0}});vi.mocked(buscarFichaAnimal).mockResolvedValue(ficha);vi.mocked(consultarBezerreiro).mockResolvedValue({id:'participacao'});});
afterEach(cleanup);
it('regulariza somente a participação na data comprovada e sem fase ou movimento',async()=>{
 const salvo=vi.fn();render(<RegularizarParticipacao sitio={7} config={config} aoFechar={vi.fn()} aoSalvar={salvo}/>);
 await waitFor(()=>expect(screen.getByLabelText('Animal já localizado neste lote')).not.toHaveProperty('disabled',true));
 fireEvent.change(screen.getByLabelText('Animal já localizado neste lote'),{target:{value:'a'}});await screen.findByText(/22\/09\/2026/);
 expect(listarAnimais).toHaveBeenCalledWith(expect.objectContaining({loteId:'l',situacao:'ATIVO',pageSize:20}),7);
 fireEvent.change(screen.getByLabelText('Motivo da regularização'),{target:{value:'Localização conferida'}});fireEvent.submit(document.getElementById('regularizar-participacao')!);
 await waitFor(()=>expect(salvo).toHaveBeenCalled());
 expect(consultarBezerreiro).toHaveBeenCalledWith('/participantes',7,expect.objectContaining({animalId:'a',perfilId:'p',desde:'2026-09-22',motivo:'Localização conferida'}));
 const enviado=vi.mocked(consultarBezerreiro).mock.calls[0][2];expect(enviado).not.toHaveProperty('faseVersaoId');
});
it('recusa salvar sem prova atual da localização e preserva motivo',async()=>{
 vi.mocked(buscarFichaAnimal).mockResolvedValue({...ficha,historicoLocalizacoes:[]});
 render(<RegularizarParticipacao sitio={7} config={config} aoFechar={vi.fn()} aoSalvar={vi.fn()}/>);
 await waitFor(()=>expect(screen.getByLabelText('Animal já localizado neste lote')).not.toHaveProperty('disabled',true));fireEvent.change(screen.getByLabelText('Animal já localizado neste lote'),{target:{value:'a'}});await screen.findByText(/A localização atual não comprova/);
 fireEvent.change(screen.getByLabelText('Motivo da regularização'),{target:{value:'Conferência pendente'}});fireEvent.submit(document.getElementById('regularizar-participacao')!);expect(consultarBezerreiro).not.toHaveBeenCalled();expect(screen.getByLabelText('Motivo da regularização')).toHaveProperty('value','Conferência pendente');
});
