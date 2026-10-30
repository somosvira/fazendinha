// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {RelatoriosComplementares} from './RelatoriosComplementares';
import {consultarFonte,type ResultadoBuilder} from './fontes';
vi.mock('./fontes',()=>({consultarFonte:vi.fn()}));
const resultado:ResultadoBuilder={linhas:[{id:'p',animal:'Camila',animalId:'a',partoAnterior:'10/09/2025',partoAtual:'25/10/2026',intervalo:410,abortos:0}],total:1,pagina:1,porPagina:12,paginado:false,consultadoEm:'',resumo:[{nome:'Intervalo médio',valor:410,unidade:'dias'}]};
beforeEach(()=>vi.mocked(consultarFonte).mockResolvedValue(resultado));afterEach(()=>{cleanup();vi.clearAllMocks()});
it('cartões e tabela usam o mesmo resultado e exportação respeita permissão',async()=>{
 render(<RelatoriosComplementares propriedadeId={2} fonte="iep" selecionar={vi.fn()} personalizar={vi.fn()} podeExportar={false}/>);
 await screen.findByRole('cell',{name:'410 dias'});
 fireEvent.click(screen.getByRole('button',{name:'Cartões'}));
 expect(screen.getAllByText('Camila').length).toBe(1);
 expect(consultarFonte).toHaveBeenCalledTimes(1);
 expect(screen.queryByRole('button',{name:/Exportar/})).toBeNull();
});
it('editar datas mantém a consulta até aplicar e a troca de fonte ignora resposta atrasada',async()=>{
 let resolver!:(r:ResultadoBuilder)=>void;
 vi.mocked(consultarFonte).mockImplementationOnce(()=>new Promise(r=>resolver=r)).mockResolvedValue({...resultado,linhas:[]});
 const props={propriedadeId:2,selecionar:vi.fn(),personalizar:vi.fn(),podeExportar:true};
 const {rerender}=render(<RelatoriosComplementares {...props} fonte="iep"/>);
 rerender(<RelatoriosComplementares {...props} fonte="perdas"/>);
 await screen.findByText('Nenhum registro neste recorte');
 resolver(resultado);await waitFor(()=>expect(screen.queryByText('Camila')).toBeNull());
 const chamadas=vi.mocked(consultarFonte).mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Período e filtros'}));
 fireEvent.change(screen.getByLabelText('Início'),{target:{value:'2026-01-01'}});
 expect(consultarFonte).toHaveBeenCalledTimes(chamadas);
 fireEvent.click(screen.getByRole('button',{name:'Consultar período'}));
 await waitFor(()=>expect(consultarFonte).toHaveBeenCalledTimes(chamadas+1));
});
