import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prepararVinculoPesoSecagemTx, vincularPesoSecagemTx } from "../reproducao/peso-secagem.js";
import { RebanhoError, travarAnimais } from "../rebanho/regras.js";
import type { OpcoesFatoHistorico } from "./historico.js";

export const associacaoPesoSecagemHistoricaSchema = z.object({
  bancoOrigem: z.string().trim().min(1).max(120), chaveOrigem: z.string().trim().min(1).max(200),
  pesagem: z.union([z.object({ id: z.string().uuid() }).strict(), z.object({ chaveOrigem: z.string().trim().max(200).regex(/^[^:\s]+:.+$/, "Use a chave completa TABELA:id da pesagem conciliada.") }).strict()]),
  lactacaoId: z.string().uuid().nullish().default(null), propriedadeId: z.number().int().positive().max(2_147_483_647).nullish().default(null),
  evidenciaEncerramento: z.string().trim().min(5).max(2000).nullish().default(null),
}).strict();
type Dados = z.output<typeof associacaoPesoSecagemHistoricaSchema>;
type AssociacaoSecagem = { estado: "COMPROVADA" | "PENDENTE"; pesagemId: string | null; lactacaoId: string | null; propriedadeId: number | null; pesagemReferencia: Dados["pesagem"]; evidenciaEncerramento: string | null; motivo?: string; vinculoId: string | null };
export interface PreviaAssociacaoPesoSecagem {
  entidade: "VinculoPesagemSecagem"; existenteId: string | null; candidatosDuplicidade: string[];
  pendente?: { motivo: string }; pesagemId: string | null; animalId: string | null;
  contexto: { associacaoSecagem: AssociacaoSecagem; pesagem?: unknown; snapshot?: unknown };
}
function evidencia(dados: Dados): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({ bancoOrigem: dados.bancoOrigem, chaveOrigem: dados.chaveOrigem, evidenciaEncerramento: dados.evidenciaEncerramento, pesagemReferencia: dados.pesagem })) as Prisma.InputJsonValue;
}
async function resolverPesagem(tx: Prisma.TransactionClient, dados: Dados) {
  let id: string;
  if ("id" in dados.pesagem) id = dados.pesagem.id;
  else {
    const separador = dados.pesagem.chaveOrigem.indexOf(":");
    const vinculo = await tx.vinculoImportacaoPecuaria.findUnique({ where: { bancoOrigem_tabelaOrigem_chaveOrigem: { bancoOrigem: dados.bancoOrigem, tabelaOrigem: dados.pesagem.chaveOrigem.slice(0, separador), chaveOrigem: dados.pesagem.chaveOrigem.slice(separador + 1) } } });
    if (!vinculo) return null;
    if (vinculo.entidadeDestino !== "Pesagem") throw new RebanhoError("CONFLITO", "A origem informada não referencia uma Pesagem conciliada.", "pesagem");
    id = vinculo.destinoId;
  }
  const peso = await tx.pesagem.findUnique({ where: { id } });
  if (!peso) throw new RebanhoError("CONFLITO", "A pesagem referenciada não existe; reconcilie a identidade antes da associação.", "pesagem");
  return peso;
}

/** Consulta sem escrita: peso sozinho e coincidência de data nunca encerram lactação. */
export async function prepararAssociacaoPesoSecagemHistoricaTx(tx: Prisma.TransactionClient, input: unknown, usuarioId: number, opcoes: OpcoesFatoHistorico = { operacao: "CRIAR" }): Promise<PreviaAssociacaoPesoSecagem> {
  const dados = associacaoPesoSecagemHistoricaSchema.parse(input);
  if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) throw new RebanhoError("VALIDACAO", "Informe autoria real para a associação histórica.");
  if (opcoes.operacao === "CORRIGIR") throw new RebanhoError("CONFLITO", "Revise uma associação já gravada pelo fluxo auditado de manutenção da lactação; a carga não substitui vínculos.");
  const peso = await resolverPesagem(tx, dados);
  const base: PreviaAssociacaoPesoSecagem = { entidade: "VinculoPesagemSecagem", existenteId: null, candidatosDuplicidade: [], pesagemId: peso?.id ?? null, animalId: peso?.animalId ?? null,
    contexto: { associacaoSecagem: { estado: "PENDENTE", pesagemId: peso?.id ?? null, lactacaoId: dados.lactacaoId, propriedadeId: dados.propriedadeId, pesagemReferencia: dados.pesagem, evidenciaEncerramento: dados.evidenciaEncerramento, vinculoId: null },
      ...(peso ? { pesagem: { id: peso.id, animalId: peso.animalId, data: peso.data.toISOString().slice(0, 10), pesoKg: peso.pesoKg.toString(), tipo: peso.tipo, origem: peso.origem, precisao: peso.precisao, contextoHistorico: peso.contextoHistorico, propriedadeId: peso.propriedadeId } } : {}) } };
  const pendente = (motivo: string) => ({ ...base, pendente: { motivo }, contexto: { ...base.contexto, associacaoSecagem: { ...base.contexto.associacaoSecagem, motivo } } });
  if (!peso) return pendente("Pesagem da origem ainda não conciliada; importe/revise a pesagem antes de associar o encerramento.");
  if (!dados.lactacaoId || !dados.evidenciaEncerramento || dados.propriedadeId === null) return pendente("Falta lactação, sítio ou evidência suficiente do encerramento; a pesagem permanece preservada sem associação.");
  try {
    const preparada = await prepararVinculoPesoSecagemTx(tx, { lactacaoId: dados.lactacaoId, pesagemId: peso.id, propriedadeId: dados.propriedadeId, evidenciaOrigem: evidencia(dados) }, usuarioId);
    if (opcoes.operacao === "VINCULAR" && (!preparada.vinculoExistente || preparada.vinculoExistente.id !== opcoes.destinoId)) throw new RebanhoError("CONFLITO", "O vínculo selecionado não é a associação ativa comprovada desta lactação/pesagem.", "destinoId");
    return { ...base, existenteId: preparada.vinculoExistente?.id ?? null,
      contexto: { ...base.contexto, snapshot: preparada.snapshot, associacaoSecagem: { ...base.contexto.associacaoSecagem, estado: "COMPROVADA", vinculoId: preparada.vinculoExistente?.id ?? null } } };
  } catch (erro) {
    if (erro instanceof RebanhoError && (erro.code === "NAO_ENCONTRADO" || erro.code === "VALIDACAO" && erro.campo === "encerradaEm")) return pendente(erro.message);
    throw erro;
  }
}

/** Transação pertence ao importador comum; cria somente o vínculo pelo núcleo da lactação. */
export async function registrarAssociacaoPesoSecagemHistoricaTx(tx: Prisma.TransactionClient, input: unknown, usuarioId: number, opcoes: OpcoesFatoHistorico = { operacao: "CRIAR" }): Promise<{ id: string }> {
  const dados = associacaoPesoSecagemHistoricaSchema.parse(input);
  const inicial = await prepararAssociacaoPesoSecagemHistoricaTx(tx, dados, usuarioId, opcoes);
  if (inicial.pendente || !inicial.animalId || !inicial.pesagemId || !dados.lactacaoId || dados.propriedadeId === null) throw new RebanhoError("CONFLITO", inicial.pendente?.motivo ?? "A associação ainda está pendente.", "associacaoSecagem");
  await travarAnimais(tx, [inicial.animalId]);
  const preparada = await prepararAssociacaoPesoSecagemHistoricaTx(tx, dados, usuarioId, opcoes);
  if (preparada.pendente || !preparada.pesagemId) throw new RebanhoError("CONFLITO", "O contexto do encerramento mudou; confira uma nova prévia.", "associacaoSecagem");
  const vinculo = await vincularPesoSecagemTx(tx, { lactacaoId: dados.lactacaoId, pesagemId: preparada.pesagemId, propriedadeId: dados.propriedadeId, evidenciaOrigem: evidencia(dados) }, usuarioId);
  return { id: vinculo.id };
}
