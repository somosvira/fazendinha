// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import{cleanup,fireEvent,render,screen,within}from'@testing-library/react';
import{TabelaOrdenhasPorDia}from'./TabelaOrdenhasPorDia';
import type{RegistroOrdenhaConsulta}from'./parcelas-types';
afterEach(cleanup);
const item=(id:string,data:string,nome:string,ordem:number,litros:number|null):RegistroOrdenhaConsulta=>({id,diaId:data,dataOperacional:data,posicaoId:id,nome,ordem,litros,fonteProducao:'GERAL',situacao:litros===null?'SEM_AFERICAO':'CONFIRMADA',porNatureza:[{natureza:'COMERCIAL',litros}],parcelas:[]});
it('agrupa dias recentes primeiro e ordena os turnos pela rotina sem alterar a entrada',()=>{
 const itens=[item('n','2026-10-26','Noite',3,null),item('ontem','2026-10-25','Manhã',1,10),item('t','2026-10-26','Tarde',2,20),item('m','2026-10-26','Manhã',1,0)];
 render(<TabelaOrdenhasPorDia itens={itens} abrir={vi.fn()} podeLancar/>);
 const grupos=screen.getAllByRole('rowgroup');
 expect(grupos[1].getAttribute('aria-label')).toBe('Ordenhas de 26/10/2026');
 const linhas=within(grupos[1]).getAllByRole('row');
 expect(linhas[1].textContent).toContain('Manhã');expect(linhas[2].textContent).toContain('Tarde');expect(linhas[3].textContent).toContain('Noite');
 expect(linhas[1].textContent).toContain('0 L');expect(linhas[3].textContent).toContain('Não aferido');expect(itens.map(i=>i.id)).toEqual(['n','ontem','t','m']);
});
it('a ação consulta o mesmo registro e não oferece edição a quem só consulta',()=>{
 const registro=item('m','2026-10-26','Manhã',1,0),abrir=vi.fn();render(<TabelaOrdenhasPorDia itens={[registro]} abrir={abrir} podeLancar={false}/>);
 fireEvent.click(screen.getByRole('button',{name:'Consultar Manhã de 26/10/2026'}));expect(abrir).toHaveBeenCalledOnce();expect(abrir).toHaveBeenCalledWith(registro);
});

it('mostra apenas os registros em um único dia, sem repetir data ou contagem em faixa',()=>{
 render(<TabelaOrdenhasPorDia itens={[item('m','2026-10-26','Manhã',1,10),item('t','2026-10-26','Tarde',2,20)]} abrir={vi.fn()} podeLancar/>);
 expect(screen.getAllByRole('row')).toHaveLength(3);
 expect(screen.queryByText('26/10/2026')).toBeNull();
 expect(screen.queryByText(/nesta página/)).toBeNull();
 expect(screen.getByRole('button',{name:'Consultar Manhã de 26/10/2026'})).toBeTruthy();
});

it('preserva a data quando a página de um intervalo contém apenas um dia',()=>{
 render(<TabelaOrdenhasPorDia itens={[item('m','2026-10-26','Manhã',1,10)]} exibirDatas abrir={vi.fn()} podeLancar/>);
 expect(screen.getByText('26/10/2026')).toBeTruthy();
});
