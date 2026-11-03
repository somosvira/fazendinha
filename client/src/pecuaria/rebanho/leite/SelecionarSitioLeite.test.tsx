// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {SelecionarSitioLeite} from './SelecionarSitioLeite';
vi.mock('../../../api/propriedades',()=>({listarPropriedades:vi.fn(async()=>[{id:7,nome:'Sítio principal',ativo:true,principal:true},{id:8,nome:'Arquivado',ativo:false}])}));
afterEach(cleanup);
it('oferece somente sítios ativos e solicita a troca ao shell sem simular erro',async()=>{
 const selecionar=vi.fn();render(<SelecionarSitioLeite onSelecionar={selecionar}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Sítio principal/}));
 expect(selecionar).toHaveBeenCalledWith(7);
 expect(screen.queryByText('Arquivado')).toBeNull();expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByRole('button',{name:'Tentar novamente'})).toBeNull();
});
