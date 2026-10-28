// @vitest-environment jsdom
import {afterEach,describe,expect,it} from "vitest";
import {filtrosDaUrl,retornoAlertas,urlParticipantes} from "./consulta";
import type {GrupoAlerta} from "./api";
const g:GrupoAlerta={chave:'sitio:vacina:campanha',titulo:'Aplicar vacina',motivo:'Campanha anual',produtor:'sanidade',tipo:'DATA_FIXA',propriedadeId:1,produtoId:'produto',produtoNome:'Vacina',necessidades:561,animais:561,situacoes:{PENDENTE:561},primeiraData:'2026-10-28'};
afterEach(()=>window.history.replaceState(null,'','/'));
describe('contexto dos cuidados',()=>{
 it('mantém busca, lote e histórico ao abrir participantes e valida retorno local',()=>{const origem='/pecuaria/rebanho/alertas/historico?busca=Estrela&loteId=novilhas';const destino=urlParticipantes(g,{disposicao:'HISTORICO',busca:'Estrela',loteId:'novilhas'},origem);window.history.replaceState(null,'',destino);expect(filtrosDaUrl()).toMatchObject({disposicao:'HISTORICO',busca:'Estrela',loteId:'novilhas'});expect(retornoAlertas()).toBe(origem);});
 it('recusa retorno externo e não interpreta outro domínio como central',()=>{window.history.replaceState(null,'','/pecuaria/rebanho/alertas/participantes?retorno=https%3A%2F%2Fexample.test');expect(retornoAlertas()).toBe('/pecuaria/rebanho/alertas');});
});
