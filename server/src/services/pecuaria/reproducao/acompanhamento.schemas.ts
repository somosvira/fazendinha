import { z } from "zod";

const id=z.string().uuid();
const sitio=z.number().int().positive().max(2147483647);
const motivo=z.string().trim().min(5).max(1000);
const tipoExame={tipoExameId:id.optional(),tipoExameVersao:z.number().int().positive().optional()};
const parametrosAcompanhamentoV1Schema=z.object({
 versao:z.literal(1),efeito:z.literal("ALERTA"),
 diagnostico:z.object({...tipoExame,diasAposTentativa:z.number().int().min(0).max(1000)}).strict().nullable(),
 reconfirmacoes:z.array(z.object({...tipoExame,ocorrencia:z.number().int().min(1).max(100),diasAposPrimeiroPositivo:z.number().int().min(1).max(1000)}).strict()).max(100),
}).strict().superRefine((v,c)=>{
 if(new Set(v.reconfirmacoes.map(r=>r.ocorrencia)).size!==v.reconfirmacoes.length)c.addIssue({code:"custom",path:["reconfirmacoes"],message:"Não repita a ocorrência de reconfirmação"});
 if(!v.diagnostico&&!v.reconfirmacoes.length)c.addIssue({code:"custom",path:["diagnostico"],message:"Configure ao menos um acompanhamento"});
 for(const r of [...v.diagnostico?[v.diagnostico]:[],...v.reconfirmacoes])if(r.tipoExameVersao&&!r.tipoExameId)c.addIssue({code:"custom",path:["diagnostico"],message:"A versão do exame exige seu tipo identificado"});
});
const regraAcompanhamentoV2Schema = z.object({
 finalidade: z.enum(["DIAGNOSTICO", "RECONFIRMACAO"]), ocorrencia: z.number().int().min(1).max(100),
 publico: z.enum(["IA", "TE", "COBERTURA", "GESTACAO"]),
 referencia: z.enum(["IA", "TE", "COBERTURA", "PRIMEIRO_DG_POSITIVO"]),
 intervalo: z.number().int().min(0).max(1000), unidade: z.literal("DIAS"),
 antecedencia: z.number().int().min(0).max(1000), tolerancia: z.number().int().min(0).max(1000),
 resolucao: z.enum(["DIAGNOSTICO_CONCLUSIVO", "RECONFIRMACAO_CONCLUSIVA"]), ...tipoExame,
}).strict().superRefine((r,c) => {
 if (r.finalidade === "DIAGNOSTICO" && (r.publico === "GESTACAO" || r.referencia !== r.publico || r.ocorrencia !== 1 || r.resolucao !== "DIAGNOSTICO_CONCLUSIVO")) c.addIssue({code:"custom",message:"Regra de diagnóstico incompatível com público ou referência"});
 if (r.finalidade === "RECONFIRMACAO" && (r.publico !== "GESTACAO" || r.referencia !== "PRIMEIRO_DG_POSITIVO" || r.resolucao !== "RECONFIRMACAO_CONCLUSIVA")) c.addIssue({code:"custom",message:"Regra de reconfirmação exige primeiro DG positivo"});
 if (r.tipoExameVersao && !r.tipoExameId) c.addIssue({code:"custom",path:["tipoExameId"],message:"Versão exige tipo de exame"});
});
export const parametrosAcompanhamentoV2Schema = z.object({ versao:z.literal(2), efeito:z.literal("ALERTA"), regras:z.array(regraAcompanhamentoV2Schema).min(1).max(100) }).strict().superRefine((v,c) => {
 const ids = v.regras.map(r => `${r.publico}:${r.finalidade}:${r.ocorrencia}`);
 if(new Set(ids).size !== ids.length)c.addIssue({code:"custom",path:["regras"],message:"Não repita regra para o mesmo público e ocorrência"});
});
export const parametrosAcompanhamentoSchema=z.union([parametrosAcompanhamentoV1Schema,parametrosAcompanhamentoV2Schema]);
export const criarPoliticaAcompanhamentoSchema=z.object({chave:id,propriedadeId:sitio,vigenteDesde:z.string().date(),parametros:parametrosAcompanhamentoSchema}).strict();
export const consultaAcompanhamentoSchema=z.object({animalId:id.optional(),data:z.string().date().optional(),pagina:z.coerce.number().int().min(1).max(100000).default(1),porPagina:z.coerce.number().int().min(1).max(10).default(10),estado:z.enum(["PENDENTE","RESOLVIDA","ENCERRADA"]).optional(),finalidade:z.enum(["DIAGNOSTICO","RECONFIRMACAO","SEXAGEM"]).optional()}).strict();
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

const selecaoRevisaoPrazo = { propriedadeId:sitio, politicaId:id, demandaIds:z.array(id).min(1).max(100) };
const idsUnicos = (v:{demandaIds:string[]}, c:z.RefinementCtx) => { if(new Set(v.demandaIds).size!==v.demandaIds.length)c.addIssue({code:"custom",path:["demandaIds"],message:"Não repita demandas na seleção"}); };
export const previaRevisaoPrazosSchema = z.object(selecaoRevisaoPrazo).strict().superRefine(idsUnicos);
export const revisarPrazosSchema = z.object({ ...selecaoRevisaoPrazo, chave:id, motivo, revisao:z.string().regex(/^[a-f0-9]{64}$/) }).strict().superRefine(idsUnicos);
export type PreviaRevisaoPrazos = z.infer<typeof previaRevisaoPrazosSchema>;
export type RevisarPrazos = z.infer<typeof revisarPrazosSchema>;
