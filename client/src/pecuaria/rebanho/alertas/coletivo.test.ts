import {describe,expect,it} from "vitest";
import {alternarSelecao,montarAplicacoesAlertas} from "./coletivo";
import type {ParticipanteAlerta} from "./api";
import type {AplicacaoInput} from "../sanidade/api";
const participante=(i:number):ParticipanteAlerta=>({id:`alerta-${i}`,necessidadeId:`n-${i}`,animalId:`animal-${i}`,brinco:String(i),nome:null,loteId:null,loteNome:null,titulo:'Cuidado A',motivo:'Data fixa',situacao:'PENDENTE',dataReferencia:null,dataAtencao:null,revisao:2,chaveAgrupamento:'grupo',propriedadeId:1});
const entrada=(i:number)=>({animalId:`animal-${i}`,propriedadeId:1,produtoId:'produto'} as AplicacaoInput);
describe('seleção explícita para atendimento coletivo',()=>{
 it('limita a cem animais sem selecionar o restante da campanha',()=>{const cem=Array.from({length:100},(_,i)=>`alerta-${i}`);expect(()=>alternarSelecao(cem,'alerta-100')).toThrow('100');expect(alternarSelecao(cem,'alerta-2')).toHaveLength(99)});
 it('atender um de 561 vincula somente o escolhido e sua revisão',()=>{const itens=montarAplicacoesAlertas([participante(1)],[entrada(1)],'produto');expect(itens).toHaveLength(1);expect(itens[0]).toMatchObject({alertaId:'alerta-1',alertaRevisao:2,confirmarCuidadoAlerta:true});});
 it('recusa entrada que não pertence à seleção e produto diferente',()=>{expect(()=>montarAplicacoesAlertas([participante(1)],[entrada(2)],'produto')).toThrow('seleção');expect(()=>montarAplicacoesAlertas([participante(1)],[{...entrada(1),produtoId:'outro'}],'produto')).toThrow('produto')});
});
