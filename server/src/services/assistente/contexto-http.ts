import { z } from "zod";
import { prisma } from "../../db.js";
import { getUsuario } from "../../middleware/permissao.js";
import { PropriedadeError, resolverEscopoLeitura } from "../propriedade.js";
import { AssistenteError, type ContextoAssistente } from "./tipos.js";
export async function contextoAssistente(
  c: Parameters<typeof getUsuario>[0],
): Promise<ContextoAssistente> {
  const usuario = getUsuario(c)!;
  const propriedadeId = await resolverEscopoLeitura(c);
  const sitio =
    propriedadeId == null
      ? null
      : await prisma.propriedade.findFirst({
          where: { id: propriedadeId, ativo: true },
          select: { nome: true },
        });
  if (propriedadeId != null && !sitio)
    throw new PropriedadeError(
      "ESCOPO_INVALIDO",
      "Sítio não encontrado ou inativo.",
    );
  return {
    usuario,
    propriedadeId,
    nomeEscopo: sitio?.nome ?? "Consolidado",
    agora: new Date(),
  };
}
export function falhaAssistente(c: Parameters<typeof getUsuario>[0], erro: unknown) {
  if (erro instanceof PropriedadeError || erro instanceof z.ZodError)
    return c.json(
      {
        error: "Confira os parâmetros da consulta e o sítio selecionado.",
        code: "VALIDACAO",
      },
      422,
    );
  if (erro instanceof AssistenteError)
    return c.json(
      { error: erro.message, code: erro.code },
      erro.code === "VALIDACAO" ? 422 : erro.code === "CONFLITO" ? 409 : 503,
    );
  console.error(
    "[assistente] falha de consulta",
    erro instanceof Error ? erro.name : "desconhecida",
  );
  return c.json(
    {
      error: "Não foi possível consultar os dados. Tente novamente.",
      code: "INDISPONIVEL",
    },
    503,
  );
}
