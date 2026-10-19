import { z } from "zod";

const id=z.string().uuid();
const sitio=z.number().int().positive().max(2147483647);
const motivo=z.string().trim().min(5).max(1000);
const tipoExame={tipoExameId:id.optional(),tipoExameVersao:z.number().int().positive().optional()};
export const parametrosAcompanhamentoSchema=z.object({
 versao:z.literal(1),efeito:z.literal("ALERTA"),
 diagnostico:z.object({...tipoExame,diasAposTentativa:z.number().int().min(0).max(1000)}).strict().nullable(),
 reconfirmacoes:z.array(z.object({...tipoExame,ocorrencia:z.number().int().min(1).max(100),diasAposPrimeiroPositivo:z.number().int().min(1).max(1000)}).strict()).max(100),
}).strict().superRefine((v,c)=>{
 if(new Set(v.reconfirmacoes.map(r=>r.ocorrencia)).size!==v.reconfirmacoes.length)c.addIssue({code:"custom",path:["reconfirmacoes"],message:"Não repita a ocorrência de reconfirmação"});
 if(!v.diagnostico&&!v.reconfirmacoes.length)c.addIssue({code:"custom",path:["diagnostico"],message:"Configure ao menos um acompanhamento"});
 for(const r of [...v.diagnostico?[v.diagnostico]:[],...v.reconfirmacoes])if(r.tipoExameVersao&&!r.tipoExameId)c.addIssue({code:"custom",path:["diagnostico"],message:"A versão do exame exige seu tipo identificado"});
});
export const criarPoliticaAcompanhamentoSchema=z.object({chave:id,propriedadeId:sitio,vigenteDesde:z.string().date(),parametros:parametrosAcompanhamentoSchema}).strict();
export const consultaAcompanhamentoSchema=z.object({animalId:id.optional(),data:z.string().date().optional()}).strict();
const selecaoAdocao={propriedadeId:sitio,politicaId:id,tentativaIds:z.array(id).max(100).default([]),gestacaoIds:z.array(id).max(100).default([])};
const validarSelecao=(v:{tentativaIds:string[];gestacaoIds:string[]},c:z.RefinementCtx)=>{
 if(!v.tentativaIds.length&&!v.gestacaoIds.length)c.addIssue({code:"custom",path:["tentativaIds"],message:"Selecione os fatos existentes para conferir a adoção"});
 if(new Set(v.tentativaIds).size!==v.tentativaIds.length||new Set(v.gestacaoIds).size!==v.gestacaoIds.length)c.addIssue({code:"custom",path:["tentativaIds"],message:"Não repita fatos na seleção"});
};
export const previaAdocaoAcompanhamentoSchema=z.object(selecaoAdocao).strict().superRefine(validarSelecao);
export const adotarAcompanhamentoSchema=z.object({...selecaoAdocao,chave:id,motivo,revisao:z.string().regex(/^[a-f0-9]{64}$/)}).strict().superRefine(validarSelecao);
export const causaClinicaPerdaSchema=z.object({estado:z.enum(["DESCONHECIDA","SUSPEITA","CONFIRMADA"]),descricao:z.string().trim().min(2).max(1000).optional(),evidencias:z.array(z.string().trim().min(2).max(1000)).max(20).optional()}).strict().superRefine((v,c)=>{
 if(v.estado!=="DESCONHECIDA"&&!v.descricao)c.addIssue({code:"custom",path:["descricao"],message:"Descreva a causa informada e seu grau de certeza"});
});
export type ParametrosAcompanhamento=z.infer<typeof parametrosAcompanhamentoSchema>;
export type CriarPoliticaAcompanhamentoInput=z.infer<typeof criarPoliticaAcompanhamentoSchema>;
export type PreviaAdocaoAcompanhamentoInput=z.infer<typeof previaAdocaoAcompanhamentoSchema>;
export type AdotarAcompanhamentoInput=z.infer<typeof adotarAcompanhamentoSchema>;
