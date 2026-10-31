import type {ParticipanteAlerta} from "./api";
import type {AplicacaoInput} from "../sanidade/api";
export function alternarSelecao(atual:string[],id:string){if(atual.includes(id))return atual.filter(v=>v!==id);if(atual.length>=100)throw new Error("Selecione até 100 animais por confirmação.");return [...atual,id]}
export function montarAplicacoesAlertas(selecao:ParticipanteAlerta[],entradas:AplicacaoInput[],produtoId:string){
 if(!selecao.length||selecao.length>100||entradas.length!==selecao.length||new Set(selecao.map(v=>v.animalId)).size!==selecao.length||new Set(entradas.map(v=>v.animalId)).size!==entradas.length)throw new Error("Confira de 1 a 100 animais distintos da seleção.");
 return entradas.map(item=>{const alvo=selecao.find(v=>v.animalId===item.animalId);if(!alvo||alvo.propriedadeId!==item.propriedadeId)throw new Error("Os animais e o sítio precisam corresponder à seleção conferida.");if(item.produtoId!==produtoId)throw new Error("O produto aplicado deve corresponder ao cuidado selecionado.");return {...item,alertaId:alvo.id,alertaRevisao:alvo.revisao,confirmarCuidadoAlerta:true as const};});
}
