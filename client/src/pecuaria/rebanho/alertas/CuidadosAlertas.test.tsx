// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {CuidadosAlertas} from "./CuidadosAlertas";
import type {GrupoAlerta} from "./api";
afterEach(cleanup);
const cuidado:GrupoAlerta={chave:'campanha',titulo:'Aplicar Vacina contra raiva',motivo:'Campanha de outubro',produtor:'sanidade',tipo:'DATA_FIXA',propriedadeId:1,produtoId:'produto',produtoNome:'Vacina contra raiva',necessidades:561,animais:561,situacoes:{PENDENTE:560,REALIZADO:1},primeiraData:'2026-10-28'};
describe('cuidado coletivo',()=>{
 it('apresenta um cuidado com seu produto e entrega o grupo ao abrir participantes',()=>{const abrir=vi.fn();render(<CuidadosAlertas grupos={[cuidado]} modo="visual" onAbrir={abrir}/>);expect(screen.getAllByRole('heading',{name:'Aplicar Vacina contra raiva'})).toHaveLength(1);expect(screen.getByText('561 animais')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Ver animais'}));expect(abrir).toHaveBeenCalledWith(cuidado);});
 it('recorte da ficha mostra apenas este animal e conserva a ação independente',()=>{render(<CuidadosAlertas grupos={[{...cuidado,animais:1,necessidades:1,situacoes:{PENDENTE:1}}]} modo="visual" onAbrir={()=>{}} individual/>);expect(screen.getByText('Este animal')).toBeTruthy();expect(screen.queryByText('561 animais')).toBeNull();expect(screen.getByRole('button',{name:'Ver cuidado'})).toBeTruthy();});
});
