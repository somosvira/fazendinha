// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {EntradaVisita} from './EntradaVisita';
beforeEach(()=>vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}}));
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('escolher um caminho não continua nem altera os participantes antes da ação explícita',()=>{
 const continuar=vi.fn();render(<EntradaVisita existente contexto={<dl><dt>Data da visita</dt><dd>02/11/2026</dd></dl>} ocupado={false} podeLancar onContinuar={continuar} onVoltar={()=>{}}/>);
 expect(screen.getByRole('button',{name:'Escolha um caminho'}).hasAttribute('disabled')).toBe(true);
 fireEvent.click(screen.getByRole('radio',{name:/Seleção livre/}));expect(continuar).not.toHaveBeenCalled();expect(screen.getByText('Filtrar animais')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Continuar para os filtros'}));expect(continuar).toHaveBeenCalledTimes(1);expect(continuar).toHaveBeenCalledWith('livre');
});
it('mantém a entrada bloqueada durante a operação',()=>{render(<EntradaVisita contexto="Contexto" ocupado podeLancar onContinuar={()=>{}} onVoltar={()=>{}}/>);expect(screen.getByRole('radio',{name:/Agenda do dia/}).hasAttribute('disabled')).toBe(true)});
