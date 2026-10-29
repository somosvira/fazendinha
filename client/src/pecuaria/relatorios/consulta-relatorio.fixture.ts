import {fireEvent,screen} from '@testing-library/react';
import '@/lib/controles.fixture';
export async function abrirMenuRelatorio(){
 fireEvent.keyDown(screen.getByRole('button',{name:'Exportar e gerenciar relatório'}),{key:'ArrowDown'});
 return screen.findByRole('menu');
}
export async function acionarMenuRelatorio(nome:string){
 await abrirMenuRelatorio();
 fireEvent.click(await screen.findByRole('menuitem',{name:nome}));
}
