// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AcompanhamentoBezerreiro } from './AcompanhamentoBezerreiro';
import { consultarBezerreiro } from './api';
import type { AcompanhamentoAnimal, Configuracao, Participacao } from './types';
vi.mock('./api',()=>({consultarBezerreiro:vi.fn()}));
const config:Configuracao={vigente:null,coleiras:[],fases:[],perfis:[]};
const participacao:Participacao={id:'participacao',animalId:'animal',animal:{id:'animal',brinco:'601',nome:'Lua'},perfilId:'perfil',perfil:{id:'perfil',loteId:'lote',ativo:true,lote:{id:'lote',nome:'Bezerreiro'}},desde:'2026-09-01',ate:'2026-10-20',motivoSaida:'Saída registrada',versao:2,fases:[{id:'periodo',desde:'2026-09-01',ate:'2026-10-20',motivo:'Registro original',faseVersao:{id:'fase',identidadeId:'identidade',nome:'Aleitamento inicial',coleiraId:null,coleira:null,litrosDia:'4',publicada:true,ofertas:[]}}]};
const dados:AcompanhamentoAnimal={animal:participacao.animal,participacoes:[participacao],acompanhamento:null,colostro:[],exames:[],temHistorico:true};
const props={animalId:'animal',sitio:1,podeLancar:true,dadosIniciais:dados};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(consultarBezerreiro).mockImplementation(async(path)=>path==='/configuracoes'?config:{...dados,participacoes:[{...participacao,fases:[]}]});});
afterEach(cleanup);
function abrir(){fireEvent.click(screen.getAllByRole('button',{name:'Cancelar programação'})[0]);return within(screen.getByRole('dialog'));}
it('cancela um período histórico com motivo e versão e atualiza a ficha após salvar',async()=>{
 render(<AcompanhamentoBezerreiro {...props}/>);const modal=abrir();
 expect(modal.getByText(/01\/09\/2026.*20\/10\/2026/)).toBeTruthy();
 fireEvent.change(modal.getByLabelText('Motivo do cancelamento'),{target:{value:'Registro atribuído ao animal errado'}});
 fireEvent.click(modal.getByRole('button',{name:'Cancelar programação'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(consultarBezerreiro).toHaveBeenCalledWith('/participantes/participacao/fases/periodo/cancelamento',1,expect.objectContaining({chave:expect.any(String),propriedadeId:1,versaoEsperada:2,motivo:'Registro atribuído ao animal errado'}));
 await waitFor(()=>expect(screen.queryByRole('button',{name:'Cancelar programação'})).toBeNull());
});
it('preserva motivo e modal quando alimentação confirmada bloqueia o cancelamento',async()=>{
 vi.mocked(consultarBezerreiro).mockImplementation(async(path)=>{if(path.endsWith('/cancelamento'))throw new Error('Estorne as ofertas confirmadas no período antes de cancelar.');return config;});
 render(<AcompanhamentoBezerreiro {...props}/>);const modal=abrir();
 fireEvent.change(modal.getByLabelText('Motivo do cancelamento'),{target:{value:'Corrigir registro equivocado'}});
 fireEvent.submit(document.getElementById('cancelar-programacao')!);
 await modal.findByRole('alert');
 expect(modal.getByLabelText('Motivo do cancelamento')).toHaveProperty('value','Corrigir registro equivocado');
 expect(modal.getByRole('button',{name:'Cancelar programação'})).toHaveProperty('disabled',false);
});
it('não envia motivo vazio e Voltar fecha sem escrita',()=>{
 render(<AcompanhamentoBezerreiro {...props}/>);const modal=abrir();fireEvent.submit(document.getElementById('cancelar-programacao')!);
 expect(modal.getByRole('alert').textContent).toContain('5 a 500');
 fireEvent.click(modal.getByRole('button',{name:'Voltar'}));expect(screen.queryByRole('dialog')).toBeNull();
 expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path])=>path.endsWith('/cancelamento'))).toBe(false);
});
it('leitor não recebe ação e trocar sítio ou animal descarta o modal antigo',()=>{
 const tela=render(<AcompanhamentoBezerreiro {...props} podeLancar={false}/>);
 expect(screen.queryByRole('button',{name:'Cancelar programação'})).toBeNull();
 tela.rerender(<AcompanhamentoBezerreiro {...props}/>);abrir();
 tela.rerender(<AcompanhamentoBezerreiro {...props} sitio={2}/>);expect(screen.queryByRole('dialog')).toBeNull();
 abrir();tela.rerender(<AcompanhamentoBezerreiro {...props} sitio={2} animalId="outro"/>);expect(screen.queryByRole('dialog')).toBeNull();
 expect(vi.mocked(consultarBezerreiro).mock.calls.some(([path])=>path.endsWith('/cancelamento'))).toBe(false);
});
