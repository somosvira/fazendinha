import { z } from "zod";
import { CHAVES_CAMPO_FORMULARIO } from "./formularios.campos.js";
import { IDS_TEMPLATE_RELATORIO } from "./relatorios.catalogo.js";
import { relatorioQuerySchema } from "./relatorios.schemas.js";

export const COLUNAS_SISTEMA_FORMULARIO = [
  "animal",
  "categoria",
  "grupo_setor",
  "data",
  "reprodutor",
  "protocolo",
  "doadora",
  "resultado",
  "partoPrevisto",
  "diasGestacao",
  "ultimaTentativa",
  "previsaoSecagem",
  "tipoParto",
  "auxilio",
  "crias",
  "vivas",
  "natimortas",
  "sexo",
  "motivo",
  "observacao",
] as const;

export const configFormularioSchema = z.object({
  colunasSistema: z.array(z.enum(COLUNAS_SISTEMA_FORMULARIO)).min(1).max(12)
    .refine((itens) => new Set(itens).size === itens.length, "não repita colunas do sistema"),
  camposPapel: z.array(z.enum(CHAVES_CAMPO_FORMULARIO)).min(1).max(12)
    .refine((itens) => new Set(itens).size === itens.length, "não repita campos do formulário"),
});
export type ConfigFormulario = z.infer<typeof configFormularioSchema>;

export const criarModeloFormularioSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome do modelo").max(120),
  templateId: z.enum(IDS_TEMPLATE_RELATORIO),
  config: configFormularioSchema,
});
export const editarModeloFormularioSchema = criarModeloFormularioSchema.partial().refine(
  (valor) => Object.keys(valor).length > 0,
  "informe ao menos uma alteração",
);
export type CriarModeloFormularioInput = z.infer<typeof criarModeloFormularioSchema>;
export type EditarModeloFormularioInput = z.infer<typeof editarModeloFormularioSchema>;

export const criarFolhaCampoSchema = z.object({
  nome: z.string().trim().min(1, "informe o nome da folha").max(120),
  filtros: relatorioQuerySchema,
  config: configFormularioSchema,
  modeloId: z.number().int().positive().optional(),
});
export type CriarFolhaCampoInput = z.infer<typeof criarFolhaCampoSchema>;

const linhaPendente = z.object({
  id: z.number().int().positive(),
  status: z.literal("PENDENTE"),
  respostas: z.record(z.unknown()).optional(),
});
const linhaPreenchida = z.object({
  id: z.number().int().positive(),
  status: z.literal("PREENCHIDA"),
  respostas: z.record(z.unknown()),
});
const linhaNaoRealizada = z.object({
  id: z.number().int().positive(),
  status: z.literal("NAO_REALIZADO"),
  motivoNaoRealizado: z.string().trim().min(1, "informe o motivo").max(200),
});

export const atualizarLinhasFolhaSchema = z.object({
  linhas: z.array(z.discriminatedUnion("status", [linhaPendente, linhaPreenchida, linhaNaoRealizada])).min(1).max(2000),
});
export type AtualizarLinhasFolhaInput = z.infer<typeof atualizarLinhasFolhaSchema>;

export const listarFolhasQuerySchema = z.object({
  status: z.enum(["RASCUNHO", "EM_CAMPO", "AGUARDANDO_LANCAMENTO", "CONCLUIDA", "CANCELADA"]).optional(),
});
