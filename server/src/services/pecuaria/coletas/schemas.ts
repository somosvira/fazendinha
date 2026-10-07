import { z } from "zod";
import { executarAplicacaoEtapaSchema } from "../sanidade/execucao-etapas.schemas.js";

const uuid = z.string().uuid();
export const prepararColetaSchema = z.object({
  id: uuid, propriedadeId: z.number().int().positive(), data: z.string().date(),
  tipo: z.enum(["PESAGEM", "EXAME", "APLICACAO"]),
  titulo: z.string().trim().min(1, "Dê um nome à ficha").max(120),
  loteIds: z.array(uuid).min(1, "Selecione pelo menos um lote").max(100),
}).strict();
export const animalFichaSchema = z.object({ animalId: uuid, brinco: z.string(), nome: z.string().nullable(), loteId: uuid, loteNome: z.string() });
export const snapshotColetaSchema = z.object({ propriedadeNome: z.string(), loteIds: z.array(uuid).optional(), animais: z.array(animalFichaSchema).min(1).max(500) });
const aplicacao = executarAplicacaoEtapaSchema.omit({ tipo: true, tarefaId: true }).strict();
export const rascunhoColetaSchema = z.object({
  tipoPesagem: z.enum(["ROTINA", "ENTRADA", "DESMAMA", "SAIDA"]).default("ROTINA"),
  origemPesagem: z.enum(["MANUAL", "BALANCA"]).default("MANUAL"),
  tipoExameId: uuid.optional(), responsavel: z.string().trim().max(160).optional(),
  itens: z.array(z.object({
    animalId: uuid, situacao: z.enum(["PENDENTE", "REALIZADO", "NAO_REALIZADO"]),
    peso: z.string().max(20).default(""), motivo: z.string().trim().max(500).default(""),
    observacao: z.string().trim().max(500).default(""),
    aplicacao: aplicacao.optional(),
  }).strict()).min(1).max(500),
}).strict();
export const salvarColetaSchema = z.object({ propriedadeId: z.number().int().positive(), versao: z.number().int().positive(), rascunho: rascunhoColetaSchema }).strict();
export const concluirColetaSchema = z.object({ propriedadeId: z.number().int().positive(), versao: z.number().int().positive() }).strict();
export type PrepararColetaInput = z.infer<typeof prepararColetaSchema>;
export type RascunhoColeta = z.infer<typeof rascunhoColetaSchema>;
