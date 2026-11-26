import { avaliacaoContextualSchema } from "./avaliacao-contextual.schemas.js";
import { regraImpactoProtocolarSchema } from "./impactos.schemas.js";
import { automacoesAdesaoSchema, revisaoRetroativaSchema } from "../protocolos/automacao.schemas.js";
import { referenciasCustoSchema } from "../custos/referencias-planejadas.js";
import { momentoAcaoSchema } from "../protocolos/momentos.js";
import { causaClinicaPerdaSchema, parametrosAcompanhamentoV2Schema } from "./acompanhamento.schemas.js";
import { observacoesExameSchema } from "../exames/formatos.js";
import { TIPO_EXAME_REPRODUTIVO } from "../exames/evidencia-reprodutiva.js";
import { z } from "zod";
import { UnidadeMedida } from "@prisma/client";
export const uuid = z.string().uuid();
export const data = z.string().date();
export const dataOuHorario = z.union([data, z.string().datetime({ offset: true })]);
export const motivo = z.string().trim().min(5).max(1000);
export const sitio = z.number().int().positive();
const base = { chave: uuid, animalId: uuid, propriedadeId: sitio, data };
const texto = z.string().trim().max(1000).nullish();
export const situacaoInicialSchema = z.object({ ...base, situacao: z.enum(["VAZIA", "DESCONHECIDA"]), aptaDesde: data.nullish(),
  classeReprodutiva: z.enum(["NOVILHA", "VACA"]).nullish(), observacao: texto,
}).strict().superRefine((v, ctx) => {
  if (v.classeReprodutiva && (v.observacao?.trim().length ?? 0) < 5)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["observacao"], message: "Descreva a evidência da classe reprodutiva" });
});
export const restricaoSchema = z.object({ ...base, tipo: z.enum(["TEMPORARIA", "PERMANENTE", "DESCARTE"]), motivo, acoes: z.array(z.enum(["IA", "TE", "COBERTURA", "IATF"])).min(1).default(["IA", "TE", "COBERTURA", "IATF"]), ate: data.nullish() }).strict();
export const regraSanitariaSchema = z.object({ propriedadeId: sitio, doencaId: uuid, impactoProtocolar: regraImpactoProtocolarSchema.refine(v=>v.gatilho==="OCORRENCIA", "Regra por doença admite apenas ocorrência; use a regra própria para procedimento").optional(), acao: z.enum(["IA", "TE", "COBERTURA", "IATF", "TETF", "PROTOCOLO"]), efeito: z.enum(["BLOQUEAR", "ALERTAR"]), motivo, ativo: z.boolean().default(true) }).strict();
export const tentativaSchema = z.object({ ...base, tipo: z.enum(["IA", "TE", "COBERTURA"]), materialId: uuid.nullish(), touroId: uuid.nullish(), touroExternoId: uuid.nullish(), origem: z.enum(["ESTOQUE", "SERVICO", "DOCUMENTADA"]), quantidade: z.coerce.number().positive().max(99999999).nullish(), motivoQuantidadeExcepcional: motivo.optional(), partidaId: uuid.nullish(), operacaoServicoId: uuid.nullish(), valorServicoAtribuido: z.coerce.number().nonnegative().nullish(), responsavel: z.string().trim().max(160).nullish(), observacao: texto, cienciaValidadeDesconhecida: z.boolean().optional(), documentacaoExcepcional: z.boolean().optional(), motivoDocumentacaoExcepcional: motivo.optional(), cienciaSanitaria: z.boolean().optional(), justificativaSemOrigem: motivo.optional() }).strict();
export const avaliacaoSchema = z.object({ ...base, demandaAcompanhamentoId: uuid.optional(), vinculosConclusao: z.array(z.object({ demandaId: uuid, campo: z.enum(["CONCLUSAO_GESTACIONAL", "SEXO_FETAL", "APTIDAO_REPRODUTIVA"]) }).strict()).max(20).optional(), realizadoSemDG: z.boolean().optional(), revisaoContextual: z.string().regex(/^[a-f0-9]{64}$/).optional(), avaliacaoContextual: avaliacaoContextualSchema.optional(), finalidade: z.enum(["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"]).optional(), resultados: observacoesExameSchema.optional(), formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/).optional(), tipoExameId: uuid.optional(), responsavel: z.string().trim().max(160).nullish(), cienciaSanitaria: z.boolean().optional(), motivoVinculoDesconhecido: motivo.optional(), resultado: z.enum(["POSITIVO", "NEGATIVO", "RECONFIRMACAO", "SEXAGEM", "INCONCLUSIVO", "NAO_AVALIADO"]), tentativaId: uuid.nullish(), gestacaoId: uuid.nullish(), sexoFetal: z.enum(["F", "M"]).nullish(), conduta: z.enum(["AGUARDAR", "IATF", "DESCARTE"]).nullish(), decisaoIatf: z.enum(["INDICAR", "NAO_INDICAR"]).nullish(), resultadoAptidao: z.enum(["APTO", "NAO_APTO", "INCONCLUSIVO"]).nullish(), retornoAptidaoEm: data.nullish(), motivo: motivo.nullish(), anotacaoOriginal: texto, retornoEm: data.nullish(), previsaoParto: data.nullish(), observacao: texto }).strict();
export { partoAmpliadoSchema as partoSchema } from "./partos.schemas.js";
export const perdaSchema = z.object({ ...base, gestacaoId: uuid, motivo, causaClinica: causaClinicaPerdaSchema.optional() }).strict();
export const exposicaoSchema = z.object({ chave: uuid, propriedadeId: sitio, loteId: uuid, touroId: uuid.nullish(), touroExternoId: uuid.nullish(), inicio: data, fim: data.nullish(), observacao: texto }).strict();
export const planoAplicacaoIatfSchema = z.object({ produtoId: uuid.optional(), produtoCatalogoId: uuid.optional(), categoriaId: uuid.nullish(), tipoAplicacaoId: uuid.nullish(), orientacaoUso: z.string().trim().max(2000).nullish(), dose: z.string().regex(/^\d+(\.\d{1,3})?$/).refine(v=>Number(v)>0,"Dose planejada deve ser positiva"), unidadeDose: z.nativeEnum(UnidadeMedida), via: z.string().trim().max(80).nullish() }).strict().superRefine((v, ctx) => { if (!!v.produtoId === !!v.produtoCatalogoId) ctx.addIssue({ code: "custom", path: ["produtoId"], message: "Informe produto da fazenda ou do catálogo" }); });
export const planoTentativaIatfSchema = z.object({ tipo: z.enum(["IA", "TE"]), materialId: uuid, quantidade: z.number().positive().max(99999999) }).strict();
export const planoAvaliacaoIatfSchema = z.object({ tipoExameId: uuid.optional(), tipo: z.enum(["DIAGNOSTICO", "RECONFIRMACAO", "SEXAGEM"]) }).strict();
export const orientacaoTemporalSchema = z.object({versao:z.literal(1),referencia:z.enum(["INICIO_EFETIVO","ETAPA_ANTERIOR"]),intervaloHoras:z.number().nonnegative().max(24000),toleranciaAntesMinutos:z.number().int().nonnegative().max(10080),toleranciaDepoisMinutos:z.number().int().nonnegative().max(10080),efeito:z.literal("ALERTA")}).strict();
export const etapaIatfSchema = z.object({ referenciaPrazoDiagnostico: z.literal(true).optional(), referenciaPrazoReconfirmacao: z.literal(true).optional(), referenciasCusto: referenciasCustoSchema.optional(), momento: momentoAcaoSchema.optional(), subtipo: z.enum(["APLICACAO", "INSERCAO_DISPOSITIVO"]).optional(), tentativaTipo: z.enum(["IA", "TE", "COBERTURA"]).optional(), nome: z.string().trim().min(1).max(120), tipo: z.enum(["APLICACAO", "MANEJO", "RETIRADA", "TENTATIVA", "AVALIACAO", "EXAME"]), intervalo: z.number().nonnegative().max(10000), unidade: z.enum(["DIAS", "HORAS"]), orientacaoTemporal:orientacaoTemporalSchema.optional(), planoAplicacao: planoAplicacaoIatfSchema.optional(), planoTentativa: planoTentativaIatfSchema.optional(), planoExame: z.object({ tipoExameId: uuid }).strict().optional(), planoAvaliacao: planoAvaliacaoIatfSchema.optional() }).strict().superRefine((etapa,ctx)=>{
  if (etapa.referenciaPrazoDiagnostico && (etapa.tipo !== "AVALIACAO" || etapa.planoAvaliacao?.tipo !== "DIAGNOSTICO")) ctx.addIssue({code:"custom",path:["referenciaPrazoDiagnostico"],message:"A referência factual exige avaliação de diagnóstico"});
  if (etapa.referenciaPrazoReconfirmacao && (etapa.tipo !== "AVALIACAO" || etapa.planoAvaliacao?.tipo !== "RECONFIRMACAO")) ctx.addIssue({code:"custom",path:["referenciaPrazoReconfirmacao"],message:"A referência factual exige avaliação de reconfirmação"});
  if (etapa.tentativaTipo && etapa.tipo !== "TENTATIVA") ctx.addIssue({code:"custom",path:["tentativaTipo"],message:"Tipo de tentativa exige ação de tentativa"});
  if (etapa.momento?.modoAtendimento === "AUTOMATIZADA" && ["TENTATIVA", "AVALIACAO", "EXAME"].includes(etapa.tipo)) ctx.addIssue({code:"custom",path:["momento","modoAtendimento"],message:"Exames e tentativas exigem atendimento manual"});
  if (etapa.referenciasCusto?.material && !["APLICACAO", "TENTATIVA"].includes(etapa.tipo)) ctx.addIssue({code:"custom",path:["referenciasCusto","material"],message:"Ação não utiliza material planejado"});
  if (etapa.subtipo && etapa.tipo !== "APLICACAO") ctx.addIssue({ code:"custom",path:["subtipo"],message:"Subtipo de aplicação exige ação de aplicação" });
  for(const [campo,tipo] of [["planoExame","EXAME"],["planoAplicacao","APLICACAO"],["planoTentativa","TENTATIVA"],["planoAvaliacao","AVALIACAO"]] as const) if(etapa[campo] && etapa.tipo!==tipo)ctx.addIssue({code:"custom",path:[campo],message:"Planejamento incompatível com a ação da etapa"});
});
export const protocoloSchema = z.object({ encerramentoGuiado: z.literal(true).optional(), configuracaoAcompanhamento: parametrosAcompanhamentoV2Schema.nullish(), modalidadeTentativa: z.enum(["ETAPA", "EXTERNA"]).nullish(), modalidadeDiagnostico: z.enum(["PROTOCOLO", "EXTERNO"]).nullish(), finalidade: z.enum(["PRE_SINCRONIZACAO", "IATF", "TETF"]).nullish(), origemVersaoId:uuid.optional(), descricao: texto, nome: z.string().trim().min(2).max(120), versao: z.number().int().positive(), publicado: z.boolean().default(false), etapas: z.array(etapaIatfSchema).min(1).max(100) }).strict().superRefine((protocolo,ctx)=>{
  const builder = protocolo.finalidade != null;
  const dependentes = protocolo.etapas.filter(e => e.referenciaPrazoDiagnostico);
  if (dependentes.length) {
    const tentativaExterna = protocolo.modalidadeTentativa === "EXTERNA";
    const publico = tentativaExterna
      ? (protocolo.finalidade === "IATF" ? "IA" : "TE")
      : protocolo.etapas.find(e => e.tipo === "TENTATIVA")?.tentativaTipo;
    const regras = protocolo.configuracaoAcompanhamento?.regras.filter(r => r.finalidade === "DIAGNOSTICO" && r.ocorrencia === 1) ?? [];
    const regrasAplicaveis = publico ? regras.filter(r => r.publico === publico) : regras;
    const regrasExigidas = !tentativaExterna && protocolo.encerramentoGuiado && protocolo.publicado ? regrasAplicaveis : regras;
    if (dependentes.length !== 1 || protocolo.modalidadeDiagnostico !== "PROTOCOLO" || !["IATF", "TETF"].includes(protocolo.finalidade ?? "") || !regrasExigidas.length) ctx.addIssue({code:"custom",path:["configuracaoAcompanhamento"],message:"A avaliação dependente exige regra de primeiro diagnóstico para a tentativa planejada"});
    const tipoExame = dependentes[0]?.planoAvaliacao?.tipoExameId ?? TIPO_EXAME_REPRODUTIVO;
    const formatoCompativel = (regra: typeof regras[number]) => !regra.tipoExameId || regra.tipoExameId === tipoExame;
    const formatos = tentativaExterna && !regrasAplicaveis.length ? regras : regrasAplicaveis;
    if (formatos.length && !formatos.some(formatoCompativel)) ctx.addIssue({code:"custom",path:["configuracaoAcompanhamento"],message:"O exame da regra de diagnóstico deve corresponder ao exame da ação"});
  }
  const reconfirmacoes = protocolo.etapas.filter(e => e.referenciaPrazoReconfirmacao);
  if (reconfirmacoes.length && (reconfirmacoes.length !== 1 || !["IATF", "TETF"].includes(protocolo.finalidade ?? "") || !protocolo.configuracaoAcompanhamento?.regras.some(r => r.finalidade === "RECONFIRMACAO" && r.ocorrencia === 1))) ctx.addIssue({code:"custom",path:["configuracaoAcompanhamento"],message:"A reconfirmação dependente exige uma regra de primeiro DG positivo"});
  if (reconfirmacoes.length && (reconfirmacoes[0].planoAvaliacao?.tipoExameId || protocolo.configuracaoAcompanhamento?.regras.some(r => r.finalidade === "RECONFIRMACAO" && r.ocorrencia === 1 && r.tipoExameId))) ctx.addIssue({code:"custom",path:["configuracaoAcompanhamento"],message:"A reconfirmação guiada usa a avaliação reprodutiva padrão"});
  protocolo.etapas.forEach((etapa, i) => {
    if (builder && etapa.tipo === "MANEJO") ctx.addIssue({ code: "custom", path: ["etapas", i, "tipo"], message: "O novo builder não oferece procedimentos livres" });
    if (builder && etapa.planoTentativa) ctx.addIssue({ code: "custom", path: ["etapas", i, "planoTentativa"], message: "Material genético é definido na realização, sem plano fixo no builder" });
    if (builder && etapa.tipo === "TENTATIVA" && !etapa.tentativaTipo) ctx.addIssue({ code: "custom", path: ["etapas", i, "tentativaTipo"], message: "Declare IA, TE ou cobertura para esta ação" });
  });
  if ((protocolo.modalidadeTentativa == null) !== (protocolo.modalidadeDiagnostico == null)) ctx.addIssue({ code: "custom", path: ["modalidadeDiagnostico"], message: "Declare as duas modalidades" });
  if (protocolo.modalidadeTentativa && !["IATF", "TETF"].includes(protocolo.finalidade ?? "")) ctx.addIssue({ code: "custom", path: ["modalidadeTentativa"], message: "Modalidades disponíveis para IATF ou TETF" });
  if(!protocolo.publicado)return;
  if (!builder && !protocolo.etapas.some(e=>e.tipo==="TENTATIVA")) ctx.addIssue({code:"custom",path:["etapas"],message:"Protocolo publicado exige etapa de tentativa planejada"});
  if (protocolo.encerramentoGuiado && ["IATF", "TETF"].includes(protocolo.finalidade ?? "") && protocolo.modalidadeTentativa !== "EXTERNA") {
    const tentativas = protocolo.etapas.flatMap((etapa, i) => etapa.tipo === "TENTATIVA" ? [i] : []);
    if (tentativas.length !== 1) ctx.addIssue({code:"custom",path:["etapas"],message:"Inclua exatamente uma tentativa interna"});
    else {
      const indice = tentativas[0];
      const tentativa = protocolo.etapas[indice];
      const horas = (etapa: typeof tentativa) => etapa.intervalo * (etapa.unidade === "DIAS" ? 24 : 1);
      if (protocolo.etapas.some((etapa, i) => etapa.tipo !== "AVALIACAO" && i !== indice && (horas(etapa) > horas(tentativa) || horas(etapa) === horas(tentativa) && i > indice))) ctx.addIssue({code:"custom",path:["etapas",indice],message:"A tentativa deve ser a última ação antes das avaliações"});
    }
  }
  const tentativaExigida = protocolo.finalidade === "IATF" ? "IA" : protocolo.finalidade === "TETF" ? "TE" : null;
  if (tentativaExigida && protocolo.modalidadeTentativa !== "EXTERNA" && !protocolo.etapas.some(e => e.tipo === "TENTATIVA" && e.tentativaTipo)) ctx.addIssue({ code: "custom", path: ["etapas"], message: "Inclua uma ação de tentativa reprodutiva" });
  if (tentativaExigida && protocolo.modalidadeTentativa === "EXTERNA" && protocolo.etapas.some(e => e.tipo === "TENTATIVA")) ctx.addIssue({ code: "custom", path: ["etapas"], message: "Tentativa externa não pode ser etapa do modelo" });
  const temDg = protocolo.etapas.some(e => e.tipo === "AVALIACAO" && e.planoAvaliacao?.tipo === "DIAGNOSTICO");
  if (protocolo.modalidadeDiagnostico === "PROTOCOLO" && !temDg) ctx.addIssue({ code: "custom", path: ["etapas"], message: "Inclua uma avaliação de diagnóstico no protocolo" });
  if (protocolo.modalidadeDiagnostico === "EXTERNO" && temDg) ctx.addIssue({ code: "custom", path: ["etapas"], message: "Diagnóstico externo não pode ser etapa do modelo" });
  protocolo.etapas.forEach((etapa,i)=>{const campo=etapa.tipo==="APLICACAO"?"planoAplicacao":etapa.tipo==="TENTATIVA" && !builder?"planoTentativa":etapa.tipo==="AVALIACAO"?"planoAvaliacao":etapa.tipo==="EXAME"?"planoExame":null;if(campo && !etapa[campo])ctx.addIssue({code:"custom",path:["etapas",i,campo],message:"Defina o planejamento desta etapa antes de publicar"});});
});
export const programacaoSchema = z.object({ cienciaAvisosAptidao: z.array(uuid).max(100).optional(), automacoes: automacoesAdesaoSchema.optional(), revisaoRetroativa: revisaoRetroativaSchema.optional(), chave: uuid, propriedadeId: sitio, cienciaSanitaria:z.boolean().optional(), protocoloId: uuid, nome: z.string().trim().min(2).max(120), inicioPrevisto: dataOuHorario, animais: z.array(z.object({ animalId: uuid, inicioPrevisto: dataOuHorario.optional(), diagnosticoIndividualEm: data.optional() }).strict()).min(1).max(100) }).strict();
export const visitaSchema = z.object({ chave: uuid.optional(), propriedadeId: sitio, data, nome: z.string().trim().min(2).max(120), responsavel: z.string().trim().max(160).nullish() }).strict();
export const atividadeSchema = z.object({ propriedadeId: sitio, tipo: z.enum(["AVALIACAO_REPRODUTIVA", "APLICACAO_SANITARIA", "EXAME_SANITARIO", "INICIAR_SANITARIO", "TAREFA_IATF", "INICIAR_IATF"]), nome: z.string().trim().min(2).max(120), extra: z.boolean().default(false), contexto: z.record(z.unknown()).default({}), participantes: z.array(z.object({ animalId: uuid, tarefaSanitariaId: uuid.nullish(), tarefaIatfId: uuid.nullish(), motivos: z.array(z.string().trim().min(1).max(300)).max(20).optional() }).strict()).min(1).max(1000) }).strict();
export const confirmacaoVisitaSchema = z.object({ propriedadeId: sitio, chave: uuid, cienciaAlteracoes: z.boolean().optional(), fingerprintPrevia: z.string().regex(/^[a-f0-9]{64}$/).optional(), itens: z.array(z.object({ participanteId: uuid, versaoRascunho: z.number().int().nonnegative().optional(), dados: z.record(z.unknown()).optional(), status: z.enum(["CONFIRMADO", "ADIADO", "NAO_ATENDIDO"]).default("CONFIRMADO"), motivo: motivo.optional() }).strict()).min(1).max(100) }).strict();
export type TentativaInput = z.infer<typeof tentativaSchema>;
export type AvaliacaoInput = z.infer<typeof avaliacaoSchema>;
export type { PartoAmpliadoInput as PartoInput } from "./partos.schemas.js";
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
