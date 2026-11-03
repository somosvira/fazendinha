// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {ContextoRelatorio} from './ContextoRelatorio';
import {listarAnimais} from '../rebanho/api';
import {reqV4} from '../rebanho/reproducao/api';
vi.mock('../rebanho/api',()=>({listarAnimais:vi.fn(),listarLotes:vi.fn()}));
vi.mock('../rebanho/reproducao/api',()=>({reqV4:vi.fn()}));
beforeEach(()=>{vi.mocked(listarAnimais).mockResolvedValue({itens:[]} as never);vi.mocked(reqV4).mockResolvedValue({propriedadeId:7,itens:[{id:'a',brinco:'42',nome:'Violeta'}]})});
afterEach(()=>{cleanup();vi.clearAllMocks()});
it('oferece o animal transferido por busca histórica quando solicitado',async()=>{
 render(<ContextoRelatorio tipo="animal" historico propriedadeId={7} valor="a" onChange={vi.fn()}/>);
 expect(await screen.findByText('42 · Violeta')).toBeTruthy();
 expect(listarAnimais).not.toHaveBeenCalled();
 expect(reqV4).toHaveBeenCalledWith('/relatorios/animais-historicos?busca=&propriedadeId=7',undefined,'GET',7);
});
it('mantém carências na consulta atual de animais',async()=>{
 render(<ContextoRelatorio tipo="animal" propriedadeId={7} valor="" onChange={vi.fn()}/>);
 await waitFor(()=>expect(listarAnimais).toHaveBeenCalled());expect(reqV4).not.toHaveBeenCalled();
});
it('recusa opções históricas devolvidas para outro sítio',async()=>{
 vi.mocked(reqV4).mockResolvedValue({propriedadeId:8,itens:[{id:'a',brinco:'42',nome:'Violeta'}]});
 render(<ContextoRelatorio tipo="animal" historico propriedadeId={7} valor="a" onChange={vi.fn()}/>);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText('42 · Violeta')).toBeNull();
});
