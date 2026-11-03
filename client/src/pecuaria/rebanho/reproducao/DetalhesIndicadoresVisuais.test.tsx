// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {DetalhesIndicadoresVisuais} from './DetalhesIndicadoresVisuais';
import {exemploDocumento} from './indicadores-documento.fixture';
import '@/lib/controles.fixture';
afterEach(cleanup);
it('alterna base visual e tabela com taxas nulas, conservando a consulta original',()=>{
 const s=exemploDocumento();const selecionar=vi.fn();render(<DetalhesIndicadoresVisuais snapshot={s} aba="bases" periodo={s.periodos[0]} selecionar={selecionar} verAnimais={vi.fn()}/>);
 expect(screen.getByRole('heading',{name:'Composição da base'})).toBeTruthy();expect(screen.getAllByText('Não informado').length).toBeGreaterThan(0);
 fireEvent.click(screen.getByRole('button',{name:'Tabela'}));expect(screen.getAllByText('Não calculável')).toHaveLength(3);
 fireEvent.click(screen.getByRole('button',{name:'01/01/2026 a 21/01/2026'}));expect(selecionar).toHaveBeenCalledWith('janela');expect(screen.getByRole('heading',{name:'Composição da base'})).toBeTruthy();
});
