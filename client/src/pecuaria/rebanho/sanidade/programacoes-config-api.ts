import { reqSanidade } from "./api";
export interface ProgramacaoInput {
  propriedadeId:number;nome:string;tipo:"VACINACAO"|"VERIFICACAO"|"VERMIFUGACAO";meses:number[];ano:number|null;vigenciaInicio:string|null;vigenciaFim:string|null;
  precisao:"MES"|"DIA";dia:number|null;recorrencia:"JANELA_ELEGIBILIDADE"|"CAMPANHA_ANUAL"|"SEM_REPETICAO";produtoId:string|null;procedimento:string|null;
  publico:{sexo?:"F"|"M";idadeMinimaMeses?:number;idadeMaximaMeses?:number;criterioPendente?:string};publicoConferido:boolean;fonte:string|null;observacao:string|null;
  sujeitoTipo:"ANIMAL"|"LOTE"|"SITIO";executor:"APLICACAO"|"EXAME_ANIMAL"|null;tipoExameId:string|null;antecedenciaDias:number;regraEquivalenteId:string|null;
}
export interface ProgramacaoCadastro extends ProgramacaoInput {id:string;ativo:boolean;revisao:number;ativadoEm:string|null;pendenciasAtivacao:string[]}
export interface PreviaProgramacao {programacaoId:string;revisao:number;ativo:boolean;dia:string;pendencias:string[];animaisElegiveis:number;janelas:{ano:number;mes:number;precisao:string;dia:number|null;situacao:string}[];chavePrevia:string}
export interface PreviaRevisaoProgramacao {programacaoId:string;revisao:number;abertas:number;chavePrevia:string}
const post=<T>(path:string,body:unknown,site:number)=>reqSanidade<T>(`/programacoes${path}`,{method:"POST",body:JSON.stringify(body)},site);
export const listarCadastrosProgramacoes=()=>reqSanidade<ProgramacaoCadastro[]>("/programacoes/cadastros");
export const criarProgramacao=(body:ProgramacaoInput)=>post<ProgramacaoCadastro>("",body,body.propriedadeId);
export const previaProgramacao=(p:ProgramacaoCadastro)=>post<PreviaProgramacao>(`/${p.id}/previa`,{propriedadeId:p.propriedadeId},p.propriedadeId);
export const ativarProgramacao=(p:ProgramacaoCadastro,v:PreviaProgramacao)=>post<{revisao:number}>(`/${p.id}/ativacao`,{propriedadeId:p.propriedadeId,revisao:v.revisao,chavePrevia:v.chavePrevia},p.propriedadeId);
export const previaRevisaoProgramacao=(p:ProgramacaoCadastro)=>post<PreviaRevisaoProgramacao>(`/${p.id}/previa-revisao`,{propriedadeId:p.propriedadeId},p.propriedadeId);
export const revisarProgramacao=(p:ProgramacaoCadastro,v:PreviaRevisaoProgramacao,destinoAbertas:"MANTER"|"ENCERRAR",motivo:string,cadastro?:ProgramacaoInput)=>post<ProgramacaoCadastro>(`/${p.id}/revisao`,{propriedadeId:p.propriedadeId,revisao:v.revisao,chavePrevia:v.chavePrevia,destinoAbertas,motivo,...(cadastro?{cadastro}:{})},p.propriedadeId);
export function novoPlanejamento():ProgramacaoInput{return{propriedadeId:0,nome:"",tipo:"VACINACAO",meses:[],ano:null,vigenciaInicio:null,vigenciaFim:null,precisao:"MES",dia:null,recorrencia:"JANELA_ELEGIBILIDADE",produtoId:null,procedimento:null,publico:{},publicoConferido:false,fonte:null,observacao:null,sujeitoTipo:"ANIMAL",executor:null,tipoExameId:null,antecedenciaDias:0,regraEquivalenteId:null};}
/** Somente DTO completo de gestão. Ano da projeção calendário nunca entra na edição. */
export function programacaoParaFormulario(p:ProgramacaoCadastro):ProgramacaoInput {return {propriedadeId:p.propriedadeId,nome:p.nome,tipo:p.tipo,meses:[...p.meses],ano:p.ano,vigenciaInicio:p.vigenciaInicio?.slice(0,10)??null,vigenciaFim:p.vigenciaFim?.slice(0,10)??null,precisao:p.precisao,dia:p.dia,recorrencia:p.recorrencia,produtoId:p.produtoId,procedimento:p.procedimento,publico:{...p.publico},publicoConferido:p.publicoConferido,fonte:p.fonte,observacao:p.observacao,sujeitoTipo:p.sujeitoTipo,executor:p.executor,tipoExameId:p.tipoExameId,antecedenciaDias:p.antecedenciaDias,regraEquivalenteId:p.regraEquivalenteId};}
export function validarPlanejamento(p:ProgramacaoInput):string|null {if(!p.nome.trim()||!p.propriedadeId)return "Informe nome e sítio da programação";if(!p.meses.length)return "Selecione pelo menos um mês do calendário";if(p.precisao==="DIA"&&p.dia==null)return "Informe o dia definido pela fazenda";if(p.publicoConferido&&!p.fonte?.trim())return "Registre a fonte da conferência do público antes de confirmá-lo";if(p.publico.idadeMinimaMeses!=null&&p.publico.idadeMaximaMeses!=null&&p.publico.idadeMinimaMeses>p.publico.idadeMaximaMeses)return "Confira a faixa de idade do público";return null;}
