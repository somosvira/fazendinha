import { observacoesExameSchema } from "../exames/formatos.js";
import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";
export const uuid = z.string().uuid();
export const data = z.string().date();
export const motivo = z.string().trim().min(5).max(1000);
export const sitio = z.number().int().positive();
const base = { chave: uuid, animalId: uuid, propriedadeId: sitio, data };
const texto = z.string().trim().max(1000).nullish();
export const situacaoInicialSchema = z.object({ ...base, situacao: z.enum(["VAZIA", "DESCONHECIDA", "APTA"]), aptaDesde: data.nullish(), observacao: texto }).strict();
export const restricaoSchema = z.object({ ...base, tipo: z.enum(["TEMPORARIA", "PERMANENTE", "DESCARTE"]), motivo, acoes: z.array(z.enum(["IA", "TE", "COBERTURA", "IATF"])).min(1).default(["IA", "TE", "COBERTURA", "IATF"]), ate: data.nullish() }).strict();
export const regraSanitariaSchema = z.object({ propriedadeId: sitio, doencaId: uuid, acao: z.enum(["IA", "TE", "COBERTURA", "IATF"]), efeito: z.enum(["BLOQUEAR", "ALERTAR"]), motivo, ativo: z.boolean().default(true) }).strict();
export const tentativaSchema = z.object({ ...base, tipo: z.enum(["IA", "TE", "COBERTURA"]), materialId: uuid.nullish(), touroId: uuid.nullish(), touroExternoId: uuid.nullish(), origem: z.enum(["ESTOQUE", "SERVICO", "DOCUMENTADA"]), quantidade: z.coerce.number().positive().max(99999999).nullish(), partidaId: uuid.nullish(), operacaoServicoId: uuid.nullish(), valorServicoAtribuido: z.coerce.number().nonnegative().nullish(), responsavel: z.string().trim().max(160).nullish(), observacao: texto, cienciaValidadeDesconhecida: z.boolean().optional(), documentacaoExcepcional: z.boolean().optional(), motivoDocumentacaoExcepcional: motivo.optional(), cienciaSanitaria: z.boolean().optional(), justificativaSemOrigem: motivo.optional() }).strict();
export const avaliacaoSchema = z.object({ ...base, finalidade: z.enum(["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"]).optional(), resultados: observacoesExameSchema.optional(), tipoExameId: uuid.optional(), responsavel: z.string().trim().max(160).nullish(), cienciaSanitaria: z.boolean().optional(), motivoVinculoDesconhecido: motivo.optional(), resultado: z.enum(["POSITIVO", "NEGATIVO", "RECONFIRMACAO", "SEXAGEM", "INCONCLUSIVO", "NAO_AVALIADO"]), tentativaId: uuid.nullish(), gestacaoId: uuid.nullish(), sexoFetal: z.enum(["F", "M"]).nullish(), conduta: z.enum(["AGUARDAR", "IATF", "DESCARTE"]).nullish(), motivo: motivo.nullish(), anotacaoOriginal: texto, retornoEm: data.nullish(), previsaoParto: data.nullish(), observacao: texto }).strict();
export const partoSchema = z.object({ ...base, gestacaoId: uuid.nullish(), tipo: z.enum(["NORMAL", "DISTOCICO", "ABORTO", "NATIMORTO"]), responsavel: z.string().trim().max(160).nullish(), observacao: texto, iniciarLactacao: z.boolean().default(false), crias: z.array(z.object({ viva: z.boolean(), sexo: z.enum(["F", "M"]), aptidao: z.enum(["LEITE", "CORTE"]), brinco: z.string().trim().min(1).max(39).nullish(), nome: z.string().trim().max(120).nullish(), loteId: uuid.nullish(), pesoKg: z.number().positive().max(99999).nullish() }).strict()).max(10).default([]) }).strict();
export const perdaSchema = z.object({ ...base, gestacaoId: uuid, motivo }).strict();
export const exposicaoSchema = z.object({ chave: uuid, propriedadeId: sitio, loteId: uuid, touroId: uuid.nullish(), touroExternoId: uuid.nullish(), inicio: data, fim: data.nullish(), observacao: texto }).strict();
export const planoAplicacaoIatfSchema = z.object({ produtoId: uuid, dose: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v=>Number(v)>0,"Dose planejada deve ser positiva"), unidadeDose: z.nativeEnum(UnidadeMedida), via: z.string().trim().max(80).nullish() }).strict();
export const planoTentativaIatfSchema = z.object({ tipo: z.enum(["IA", "TE"]), materialId: uuid, quantidade: z.number().positive().max(99999999) }).strict();
export const planoAvaliacaoIatfSchema = z.object({ tipo: z.enum(["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"]) }).strict();
export const etapaIatfSchema = z.object({ nome: z.string().trim().min(1).max(120), tipo: z.enum(["APLICACAO", "MANEJO", "RETIRADA", "TENTATIVA", "AVALIACAO", "EXAME"]), intervalo: z.number().nonnegative().max(10000), unidade: z.enum(["DIAS", "HORAS"]), planoAplicacao: planoAplicacaoIatfSchema.optional(), planoTentativa: planoTentativaIatfSchema.optional(), planoExame: z.object({ tipoExameId: uuid }).strict().optional(), planoAvaliacao: planoAvaliacaoIatfSchema.optional() }).strict().superRefine((etapa,ctx)=>{
  for(const [campo,tipo] of [["planoExame","EXAME"],["planoAplicacao","APLICACAO"],["planoTentativa","TENTATIVA"],["planoAvaliacao","AVALIACAO"]] as const) if(etapa[campo] && etapa.tipo!==tipo)ctx.addIssue({code:"custom",path:[campo],message:"Planejamento incompatível com a ação da etapa"});
});
export const protocoloSchema = z.object({ descricao: texto, nome: z.string().trim().min(2).max(120), versao: z.number().int().positive(), publicado: z.boolean().default(false), etapas: z.array(etapaIatfSchema).min(1).max(100) }).strict().superRefine((protocolo,ctx)=>{
  if(!protocolo.publicado)return;
  if(!protocolo.etapas.some(e=>e.tipo==="TENTATIVA"))ctx.addIssue({code:"custom",path:["etapas"],message:"Protocolo publicado exige etapa de tentativa planejada"});
  protocolo.etapas.forEach((etapa,i)=>{const campo=etapa.tipo==="APLICACAO"?"planoAplicacao":etapa.tipo==="TENTATIVA"?"planoTentativa":etapa.tipo==="AVALIACAO"?"planoAvaliacao":etapa.tipo==="EXAME"?"planoExame":null;if(campo && !etapa[campo])ctx.addIssue({code:"custom",path:["etapas",i,campo],message:"Defina o planejamento desta etapa antes de publicar"});});
});
export const programacaoSchema = z.object({ chave: uuid, propriedadeId: sitio, cienciaSanitaria:z.boolean().optional(), protocoloId: uuid, nome: z.string().trim().min(2).max(120), inicioPrevisto: z.string().datetime({ offset: true }), animais: z.array(z.object({ animalId: uuid, inicioPrevisto: z.string().datetime({ offset: true }).optional() })).min(1).max(100) }).strict();
export const visitaSchema = z.object({ propriedadeId: sitio, data, nome: z.string().trim().min(2).max(120), responsavel: z.string().trim().max(160).nullish() }).strict();
export const atividadeSchema = z.object({ propriedadeId: sitio, tipo: z.enum(["AVALIACAO_REPRODUTIVA", "APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO", "TAREFA_IATF", "INICIAR_IATF"]), nome: z.string().trim().min(2).max(120), extra: z.boolean().default(false), contexto: z.record(z.unknown()).default({}), participantes: z.array(z.object({ animalId: uuid, tarefaSanitariaId: uuid.nullish(), tarefaIatfId: uuid.nullish(), motivos: z.array(z.string().trim().min(1).max(300)).max(20).optional() }).strict()).min(1).max(1000) }).strict();
export const confirmacaoVisitaSchema = z.object({ propriedadeId: sitio, chave: uuid, cienciaAlteracoes: z.boolean().optional(), fingerprintPrevia: z.string().regex(/^[a-f0-9]{64}$/).optional(), itens: z.array(z.object({ participanteId: uuid, dados: z.record(z.unknown()).optional(), status: z.enum(["CONFIRMADO", "ADIADO", "NAO_ATENDIDO"]).default("CONFIRMADO"), motivo: motivo.optional() }).strict()).min(1).max(100) }).strict();
export type TentativaInput = z.infer<typeof tentativaSchema>;
export type AvaliacaoInput = z.infer<typeof avaliacaoSchema>;
export type PartoInput = z.infer<typeof partoSchema>;
export type EtapaIatf = z.infer<typeof etapaIatfSchema>;

const diasFiltro = z.coerce.number().int().nonnegative().max(100000).optional();
export const criteriosVisitaSchema = z.object({
  categoriaId: uuid.optional(), loteId: uuid.optional(),
  situacao: z.enum(["VAZIA", "GESTANTE", "DESCONHECIDA", "APTA", "AGUARDANDO_DIAGNOSTICO"]).optional(),
  diasTentativaMin: diasFiltro, diasTentativaMax: diasFiltro,
  diasPartoMin: diasFiltro, diasPartoMax: diasFiltro,
  diasGestacaoMin: diasFiltro, diasGestacaoMax: diasFiltro,
}).strict().superRefine((v, c) => {
  for (const eixo of ["Tentativa", "Parto", "Gestacao"] as const) {
    const min = v[`dias${eixo}Min`], max = v[`dias${eixo}Max`];
    if (min != null && max != null && min > max)
      c.addIssue({ code: "custom", path: [`dias${eixo}Max`], message: "Limite final deve ser maior ou igual ao inicial" });
  }
});
export type CriteriosVisita = z.infer<typeof criteriosVisitaSchema>;
export const regularizacaoSchema = z.object({
  propriedadeId: sitio, chave: uuid, motivo,
  acao: z.enum(["REABRIR", "ENCERRAR_SEM_SUBSTITUICAO", "VINCULAR_SUBSTITUTO"]),
  fatoId: uuid.optional(), cienciaNaoExecutado: z.boolean().optional(),
}).strict().superRefine((v,c)=>{
  if(v.acao === "VINCULAR_SUBSTITUTO" && !v.fatoId)c.addIssue({code:"custom",path:["fatoId"],message:"Informe o fato substituto"});
  if(v.acao === "REABRIR" && !v.cienciaNaoExecutado)c.addIssue({code:"custom",path:["cienciaNaoExecutado"],message:"Confirme que o procedimento não aconteceu"});
});
