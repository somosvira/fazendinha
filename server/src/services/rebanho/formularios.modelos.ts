import type { Prisma } from "@prisma/client";
import { prisma } from "../../db.js";
import { validarCamposDoTemplate } from "./formularios.campos.js";
import type { IdTemplateRelatorio } from "./relatorios.catalogo.js";
import { configFormularioSchema, type ConfigFormulario, type CriarModeloFormularioInput, type EditarModeloFormularioInput } from "./formularios.schemas.js";

export class ModeloFormularioError extends Error {
  constructor(public code: "NAO_ENCONTRADO" | "CONFLITO", message: string) {
    super(message);
  }
}

export interface ModeloFormularioDTO {
  id: number;
  nome: string;
  templateId: string;
  config: ConfigFormulario;
  propriedadeId: number | null;
  createdAt: string;
  updatedAt: string;
}

type ModeloRow = {
  id: number;
  nome: string;
  templateId: string;
  config: Prisma.JsonValue;
  propriedadeId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapear(row: ModeloRow): ModeloFormularioDTO {
  const config = configFormularioSchema.safeParse(row.config);
  if (!config.success) throw new Error("configuração de formulário inválida");
  return {
    id: row.id,
    nome: row.nome,
    templateId: row.templateId,
    config: config.data,
    propriedadeId: row.propriedadeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function escopo(propriedadeId: number | null) {
  return propriedadeId != null ? { propriedadeId } : {};
}

async function obterNoEscopo(id: number, propriedadeId: number | null): Promise<ModeloRow> {
  const row = await prisma.modeloFormularioCampo.findFirst({ where: { id, ...escopo(propriedadeId) } });
  if (!row) throw new ModeloFormularioError("NAO_ENCONTRADO", "modelo de formulário não encontrado");
  return row;
}

export async function listarModelosFormulario(propriedadeId: number | null, templateId?: string): Promise<ModeloFormularioDTO[]> {
  const rows = await prisma.modeloFormularioCampo.findMany({
    where: { ...escopo(propriedadeId), ...(templateId ? { templateId } : {}) },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  return rows.map(mapear);
}

function validarConfig(templateId: IdTemplateRelatorio, config: ConfigFormulario): void {
  try {
    validarCamposDoTemplate(templateId, config.camposPapel);
  } catch (error) {
    throw new ModeloFormularioError("CONFLITO", error instanceof Error ? error.message : "configuração inválida");
  }
}

export async function criarModeloFormulario(input: CriarModeloFormularioInput, propriedadeId: number | null): Promise<ModeloFormularioDTO> {
  validarConfig(input.templateId, input.config);
  const row = await prisma.modeloFormularioCampo.create({
    data: {
      nome: input.nome,
      templateId: input.templateId,
      config: input.config,
      propriedadeId,
    },
  });
  return mapear(row);
}

export async function editarModeloFormulario(id: number, input: EditarModeloFormularioInput, propriedadeId: number | null): Promise<ModeloFormularioDTO> {
  const atual = await obterNoEscopo(id, propriedadeId);
  if (input.config != null) validarConfig((input.templateId ?? atual.templateId) as IdTemplateRelatorio, input.config);
  const row = await prisma.modeloFormularioCampo.update({
    where: { id },
    data: {
      ...(input.nome != null ? { nome: input.nome } : {}),
      ...(input.templateId != null ? { templateId: input.templateId } : {}),
      ...(input.config != null ? { config: input.config } : {}),
    },
  });
  return mapear(row);
}

export async function excluirModeloFormulario(id: number, propriedadeId: number | null): Promise<void> {
  await obterNoEscopo(id, propriedadeId);
  await prisma.modeloFormularioCampo.delete({ where: { id } });
}
