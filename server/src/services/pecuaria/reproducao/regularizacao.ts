import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { RebanhoError, auditar } from "../rebanho/regras.js";
import { regularizacaoSchema } from "./schemas.js";
export type RegularizacaoInput = z.infer<typeof regularizacaoSchema>;
export const jsonRegularizacao = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
export function eventoRegularizacao(historico: Prisma.JsonValue, input: RegularizacaoInput, anterior: unknown, usuarioId: number | null) {
  const eventos = Array.isArray(historico) ? historico : [];
  const anulacao = [...eventos].reverse().find(e => e && typeof e === "object" && !Array.isArray(e) && e.acao === "FATO_ANULADO") as { destinoConsumo?: string } | undefined;
  if(input.acao === "REABRIR" && (!input.cienciaNaoExecutado || anulacao?.destinoConsumo === "MANTER_CONSUMO"))
    throw new RebanhoError("VALIDACAO", "Reabertura exige procedimento não realizado e não permite repetir consumo mantido", "cienciaNaoExecutado");
  return jsonRegularizacao([...eventos, { acao: input.acao, motivo: input.motivo, fatoSubstitutoId: input.fatoId ?? null, anterior, usuarioId, registradoEm: new Date().toISOString() }]);
}
export async function validarSubstitutoTx(tx: Prisma.TransactionClient, fatoTipo: string, input: RegularizacaoInput, animalId: string, data: Date, anteriorId?: string|null) {
  const where = { id: input.fatoId!, animalId, propriedadeId: input.propriedadeId, status: "VALIDO" as const, data };
  const fato = fatoTipo === "TentativaReprodutiva" ? await tx.tentativaReprodutiva.findFirst({ where })
    : fatoTipo === "AvaliacaoReprodutiva" ? await tx.avaliacaoReprodutiva.findFirst({ where })
    : fatoTipo === "AplicacaoProduto" ? await tx.aplicacaoProduto.findFirst({where})
    : fatoTipo === "ExameAnimal" ? await tx.exameAnimal.findFirst({where}) : null;
  if(!fato) throw new RebanhoError("VALIDACAO", "Substituto deve ser fato válido do mesmo tipo, animal, sítio e data", "fatoId");
  if(fatoTipo === "TentativaReprodutiva") {
    const anterior = anteriorId ? await tx.tentativaReprodutiva.findUnique({where:{id:anteriorId}}) : null;
    if(anterior && "tipo" in fato && anterior.tipo !== fato.tipo)
      throw new RebanhoError("VALIDACAO", "Substituto deve preservar o tipo da tentativa original", "fatoId");
  }
  return fato;
}

/** A evidência clínica passa ao substituto; o consumo físico original continua preservado. */
export async function substituirEvidenciaAplicacaoTx(tx: Prisma.TransactionClient, anteriorId: string | null | undefined, input: RegularizacaoInput, usuarioId: number | null) {
  if (!anteriorId || input.acao !== "VINCULAR_SUBSTITUTO") return;
  const anterior = await tx.aplicacaoProduto.findFirst({ where: { id: anteriorId, propriedadeId: input.propriedadeId, status: "ANULADO", consumoMantido: true } });
  if (!anterior) return;
  const salvo = await tx.aplicacaoProduto.update({ where: { id: anterior.id }, data: { administracaoMantida: false } });
  await auditar(tx, { entidade: "AplicacaoProduto", entidadeId: anterior.id, animalId: anterior.animalId, propriedadeId: input.propriedadeId, usuarioId, acao: "EVIDENCIA_SUBSTITUIDA", antes: anterior, depois: { ...salvo, substitutoId: input.fatoId, motivo: input.motivo } });
}

export async function listarSubstitutosTx(tx: Prisma.TransactionClient, fatoTipo: string, anteriorId: string | null, animalId: string, propriedadeId: number) {
  if (!anteriorId) return [];
  const original = fatoTipo === "TentativaReprodutiva" ? await tx.tentativaReprodutiva.findFirst({ where: { id: anteriorId, animalId, propriedadeId } })
    : fatoTipo === "AvaliacaoReprodutiva" ? await tx.avaliacaoReprodutiva.findFirst({ where: { id: anteriorId, animalId, propriedadeId } })
    : fatoTipo === "AplicacaoProduto" ? await tx.aplicacaoProduto.findFirst({ where: { id: anteriorId, animalId, propriedadeId } })
    : fatoTipo === "ExameAnimal" ? await tx.exameAnimal.findFirst({ where: { id: anteriorId, animalId, propriedadeId } }) : null;
  if (!original) return [];
  const where = { animalId, propriedadeId, data: original.data, status: "VALIDO" as const };
  const data = original.data.toISOString().slice(0, 10);
  if (fatoTipo === "TentativaReprodutiva" && "tipo" in original) return (await tx.tentativaReprodutiva.findMany({ where: { ...where, tipo: original.tipo }, select: { id: true, tipo: true, responsavel: true }, orderBy: { criadoEm: "desc" } })).map(f => ({ id: f.id, descricao: `${f.tipo} · ${data}${f.responsavel ? ` · ${f.responsavel}` : ""}` }));
  if (fatoTipo === "AvaliacaoReprodutiva") return (await tx.avaliacaoReprodutiva.findMany({ where, select: { id: true, resultado: true, anotacaoOriginal: true }, orderBy: { criadoEm: "desc" } })).map(f => ({ id: f.id, descricao: `${f.anotacaoOriginal || ({POSITIVO:"Positivo",NEGATIVO:"Negativo",RECONFIRMACAO:"Reconfirmação",SEXAGEM:"Sexagem",INCONCLUSIVO:"Inconclusivo",NAO_AVALIADO:"Não avaliado"} as Record<string,string>)[f.resultado] || f.resultado} · ${data}` }));
  if (fatoTipo === "AplicacaoProduto") return (await tx.aplicacaoProduto.findMany({ where, select: { id: true, nomeProdutoAplicado: true, aplicadaEm: true }, orderBy: { criadoEm: "desc" } })).map(f => ({ id: f.id, descricao: `${f.nomeProdutoAplicado} · ${data}${f.aplicadaEm ? ` · ${f.aplicadaEm.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}` : ""}` }));
  if (fatoTipo === "ExameAnimal") return (await tx.exameAnimal.findMany({ where: { ...where, interpretacao: null }, select: { id: true, tipoExame: { select: { nome: true } } }, orderBy: { criadoEm: "desc" } })).map(f => ({ id: f.id, descricao: `${f.tipoExame.nome} · ${data}` }));
  return [];
}
