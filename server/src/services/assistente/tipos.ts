import type { FunctionTool } from "openai/resources/responses/responses";
import type { UsuarioContexto } from "../auth/sessao.js";

export type ModoResposta = "dados" | "ajuda" | "fora_escopo" | "esclarecimento" | "acesso_negado";
export interface FonteAssistente { titulo: string; url: string; periodo?: { inicio: string; fim: string } }
export interface RespostaAssistente {
  modo: ModoResposta;
  resposta: string;
  fontes: FonteAssistente[];
  consultadoEm: string;
  escopo: { propriedadeId: number | null; nome: string };
}
// Identidade e sítio são resolvidos pelo servidor, nunca por argumentos da IA.
export interface ContextoAssistente {
  usuario: UsuarioContexto;
  propriedadeId: number | null;
  nomeEscopo: string;
  agora: Date;
}
export interface ConteudoAssistente { modo: ModoResposta; resposta: string; fontes: FonteAssistente[] }
export interface FerramentaAssistente {
  dominio: "financeiro" | "ajuda" | "sistema" | "estoque" | "rebanho";
  spec: FunctionTool;
  permitida: (ctx: ContextoAssistente) => boolean;
  executar: (args: unknown, ctx: ContextoAssistente) => Promise<ConteudoAssistente>;
}
export class AssistenteError extends Error {
  constructor(public code: "DESABILITADO" | "NAO_CONFIGURADO" | "VALIDACAO" | "INDISPONIVEL", mensagem: string) { super(mensagem); }
}
export function apresentar(conteudo: ConteudoAssistente, ctx: ContextoAssistente): RespostaAssistente {
  return { ...conteudo, consultadoEm: ctx.agora.toISOString(), escopo: { propriedadeId: ctx.propriedadeId, nome: ctx.nomeEscopo } };
}
