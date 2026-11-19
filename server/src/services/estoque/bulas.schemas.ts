import { z } from "zod";

const https = z.string().url().refine(url => new URL(url).protocol === "https:", "A fonte deve usar HTTPS");
const referencia = z.object({ url: https, secao: z.string().min(1), pagina: z.number().int().positive().optional() });
const prazo = z.object({
  estado: z.enum(["PRAZO", "PROIBIDO", "NAO_INFORMADO"]),
  horas: z.number().int().nonnegative().nullable(),
  condicao: z.string().min(1),
}).superRefine((v, ctx) => {
  if ((v.estado === "PRAZO") !== (v.horas !== null))
    ctx.addIssue({ code: "custom", path: ["horas"], message: "Somente prazo conhecido admite horas; proibição e ausência não são zero" });
});

const orientacaoCompletaSchema = z.object({
  versao: z.literal(2),
  fonte: https,
  titulo: z.string().min(1),
  tipoFonte: z.enum(["BULA_OFICIAL", "FICHA_OFICIAL"]),
  consultadaEm: z.string().date(),
  documentoSha256: z.string().regex(/^[a-f0-9]{64}$/),
  documentosComplementares: z.array(referencia.extend({
    documentoSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })).optional(),
  origemOficial: https.optional(),
  registroMapa: z.string().optional(),
  revisaoDocumento: z.string().optional(),
  especie: z.string().min(1),
  concentracao: z.string().min(1),
  dosagem: z.string().min(1),
  proporcoes: z.array(z.object({
    quantidade: z.string().regex(/^\d+(\.\d+)?$/).refine(v => Number(v) > 0),
    quantidadeMaxima: z.string().regex(/^\d+(\.\d+)?$/).refine(v => Number(v) > 0).optional(),
    unidade: z.enum(["ML", "G", "DOSE", "UN"]),
    pesoKg: z.string().regex(/^\d+(\.\d+)?$/).refine(v => Number(v) > 0),
    condicao: z.string().min(1),
  }).refine(v => !v.quantidadeMaxima || Number(v.quantidadeMaxima) >= Number(v.quantidade), "Faixa de dosagem inválida")),
  via: z.string().min(1),
  carencias: z.object({ leite: prazo, carne: prazo }),
  cuidados: z.string().min(1),
  camposFonte: z.object({
    concentracao: referencia,
    dosagem: referencia,
    proporcoes: referencia,
    via: referencia,
    carenciasLeite: referencia,
    carenciasCarne: referencia,
    cuidados: referencia,
  }),
});
export const pendenciaBulaSchema = z.object({ campo: z.string().min(1), motivo: z.string().min(1) }).strict();
export const conferenciaBulaSchema = z.object({
  estado: z.enum(["PESQUISA_PENDENTE", "CONFERENCIA_PENDENTE", "IDENTIDADE_PENDENTE"]),
  pendencias: z.array(pendenciaBulaSchema).min(1),
  fontesParaConferencia: z.array(https).default([]),
}).strict();
const orientacaoParcialSchema = orientacaoCompletaSchema.extend({
  versao: z.literal(3),
  especie: z.string().min(1).nullable(), concentracao: z.string().min(1).nullable(),
  dosagem: z.string().min(1).nullable(), via: z.string().min(1).nullable(), cuidados: z.string().min(1).nullable(),
  camposFonte: orientacaoCompletaSchema.shape.camposFonte.partial().extend({ especie: referencia.optional() }),
  pendencias: z.array(pendenciaBulaSchema).min(1),
}).superRefine((v, ctx) => {
  for (const campo of ["especie", "concentracao", "dosagem", "via", "cuidados"] as const) {
    if (v[campo] !== null && !v.camposFonte[campo]) ctx.addIssue({ code: "custom", path: ["camposFonte", campo], message: "Informação confirmada exige fonte por campo" });
    if (v[campo] === null && !v.pendencias.some(p => p.campo === campo)) ctx.addIssue({ code: "custom", path: ["pendencias"], message: "Campo pendente exige motivo" });
  }
  for (const [destino, campo] of [["leite", "carenciasLeite"], ["carne", "carenciasCarne"]] as const)
    if (v.carencias[destino].estado === "NAO_INFORMADO" && !v.pendencias.some(p => p.campo === campo)) ctx.addIssue({ code: "custom", path: ["pendencias"], message: "Carência pendente exige motivo" });
    else if (v.carencias[destino].estado !== "NAO_INFORMADO" && !v.camposFonte[campo]) ctx.addIssue({ code: "custom", path: ["camposFonte", campo], message: "Carência confirmada exige fonte" });
  if (v.proporcoes.length && !v.camposFonte.proporcoes) ctx.addIssue({ code: "custom", path: ["camposFonte", "proporcoes"], message: "Proporção confirmada exige fonte" });
});
export const orientacaoBulaSchema = z.union([orientacaoCompletaSchema, orientacaoParcialSchema]);
export type OrientacaoBula = z.infer<typeof orientacaoBulaSchema>;

