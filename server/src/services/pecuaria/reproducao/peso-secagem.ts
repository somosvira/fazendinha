import { Prisma } from "@prisma/client";
import { conferirAnimalNoFato } from "../fatos.js";
import { registrarPesagemTx, editarPesagemTx } from "../rebanho/animais.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { transacaoPecuaria } from "../transacao.js";
import { operacaoIdempotenteTx } from "./operacoes.js";
import type { PesoSecagemInput } from "./peso-secagem.schemas.js";

type Tx = Prisma.TransactionClient;
type Lactacao = Prisma.LactacaoAnimalGetPayload<Record<string, never>>;
export type VincularPesoSecagemInput = { lactacaoId: string; pesagemId: string; propriedadeId: number; evidenciaOrigem?: Prisma.InputJsonValue };
const diaTexto = (d: Date) => d.toISOString().slice(0, 10);
function erro(mensagem: string, campo = "pesoSecagem"): never { throw new RebanhoError("VALIDACAO", mensagem, campo); }
export async function exigirAutorRealSecagemTx(tx: Tx, usuarioId: number | null): Promise<number> {
  if (!usuarioId || usuarioId <= 0) erro("Peso na secagem exige usuário real ativo", "usuarioId");
  const autor = await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true, status: true } });
  if (!autor || autor.status !== "ATIVO") erro("Peso na secagem exige usuário real ativo", "usuarioId");
  return autor.id;
}

/** Prévia somente de leitura: não trava, não adota contexto e não fabrica encerramento. */
export async function prepararVinculoPesoSecagemTx(tx: Tx, input: VincularPesoSecagemInput, _usuarioId?: number | null) {
  const [lactacao, pesagem] = await Promise.all([
    tx.lactacaoAnimal.findUnique({ where: { id: input.lactacaoId } }), tx.pesagem.findUnique({ where: { id: input.pesagemId } }),
  ]);
  if (!lactacao) throw new RebanhoError("NAO_ENCONTRADO", "Lactação não encontrada", "lactacaoId");
  if (!pesagem) throw new RebanhoError("NAO_ENCONTRADO", "Pesagem não encontrada", "pesagemId");
  if (!lactacao.encerradaEm) erro("Associação de secagem exige encerramento factual comprovado", "encerradaEm");
  if (pesagem.animalId !== lactacao.animalId || pesagem.data.getTime() !== lactacao.encerradaEm.getTime()) erro("Pesagem deve pertencer ao mesmo animal e à data exata do encerramento");
  if (pesagem.contextoHistorico === "EXTERNO" || (pesagem.propriedadeId !== null && pesagem.propriedadeId !== input.propriedadeId)) erro("Pesagem tem contexto externo ou sítio explícito incompatível com a secagem");
  const animal = await conferirAnimalNoFato(tx, lactacao.animalId, input.propriedadeId, lactacao.encerradaEm, "pesoSecagem");
  if (animal.sexo !== "F") erro("Peso na secagem exige fêmea");
  const baixa = await tx.baixaAnimal.findFirst({ where: { animalId: lactacao.animalId, estornadaEm: null } });
  const locais = await tx.localizacaoAnimal.findMany({ where: { animalId: lactacao.animalId, desde: { lte: pesagem.data }, OR: [
    { ate: null }, { ate: { gt: pesagem.data } }, ...(baixa?.data.getTime() === pesagem.data.getTime() && baixa.localizacaoFechadaId ? [{ id: baixa.localizacaoFechadaId }] : []),
  ] } });
  if (locais.length !== 1 || locais[0].propriedadeId !== input.propriedadeId) erro("Sítio histórico da pesagem e do encerramento deve ser único e comprovado");
  const ativo = await tx.vinculoPesagemSecagem.findFirst({ where: { lactacaoId: lactacao.id, revogadoEm: null } });
  if (ativo && ativo.pesagemId !== pesagem.id) throw new RebanhoError("CONFLITO", "A lactação já possui outro peso ativo; use substituição explícita", "pesoSecagem");
  const outra = await tx.vinculoPesagemSecagem.findFirst({ where: { pesagemId: pesagem.id, revogadoEm: null } });
  if (outra && outra.lactacaoId !== lactacao.id) throw new RebanhoError("CONFLITO", "Pesagem já associada a outro encerramento de lactação", "pesoSecagem");
  const localizacao = locais[0];
  const snapshot = {
    versao: 1, lactacao: { id: lactacao.id, animalId: lactacao.animalId, inicio: diaTexto(lactacao.inicio), encerradaEm: diaTexto(lactacao.encerradaEm), versao: lactacao.versao },
    pesagem: { id: pesagem.id, animalId: pesagem.animalId, data: diaTexto(pesagem.data), pesoKg: String(pesagem.pesoKg), tipo: pesagem.tipo, origem: pesagem.origem, precisao: pesagem.precisao, contextoHistorico: pesagem.contextoHistorico, propriedadeId: pesagem.propriedadeId },
    localizacao: { id: localizacao.id, propriedadeId: localizacao.propriedadeId, desde: diaTexto(localizacao.desde), ate: localizacao.ate ? diaTexto(localizacao.ate) : null },
    ...(input.evidenciaOrigem ? { evidenciaOrigem: input.evidenciaOrigem } : {}),
  };
  return { lactacao, pesagem, localizacao, vinculoExistente: ativo, snapshot };
}
export async function vincularPesoSecagemTx(tx: Tx, input: VincularPesoSecagemInput, usuarioId: number | null) {
  const autor = await exigirAutorRealSecagemTx(tx, usuarioId);
  const referencia = await tx.lactacaoAnimal.findUnique({ where: { id: input.lactacaoId } });
  if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Lactação não encontrada", "lactacaoId");
  await travarAnimais(tx, [referencia.animalId]);
  const preparado = await prepararVinculoPesoSecagemTx(tx, input);
  if (preparado.vinculoExistente) return preparado.vinculoExistente;
  const criado = await tx.vinculoPesagemSecagem.create({ data: { lactacaoId: input.lactacaoId, pesagemId: input.pesagemId,
    propriedadeId: input.propriedadeId, evidenciaSnapshot: preparado.snapshot, criadoPorId: autor } });
  await auditar(tx, { entidade: "VinculoPesagemSecagem", entidadeId: criado.id, animalId: preparado.lactacao.animalId,
    propriedadeId: input.propriedadeId, acao: "REGISTRO", usuarioId: autor, depois: criado });
  return criado;
}
export async function revogarPesoSecagemTx(tx: Tx, lactacao: Lactacao, vinculoId: string, propriedadeId: number, motivo: string, usuarioId: number | null) {
  const autor = await exigirAutorRealSecagemTx(tx, usuarioId);
  if (motivo.trim().length < 5) erro("Descreva o motivo da revisão do vínculo");
  const anterior = await tx.vinculoPesagemSecagem.findFirst({ where: { id: vinculoId, lactacaoId: lactacao.id, revogadoEm: null } });
  if (!anterior || anterior.propriedadeId !== propriedadeId) erro("Vínculo de secagem ativo não encontrado neste sítio");
  const depois = await tx.vinculoPesagemSecagem.update({ where: { id: anterior.id }, data: { revogadoEm: new Date(Math.max(Date.now(), anterior.criadoEm.getTime())), revogadoPorId: autor, motivoRevogacao: motivo } });
  await auditar(tx, { entidade: "VinculoPesagemSecagem", entidadeId: anterior.id, animalId: lactacao.animalId, propriedadeId,
    acao: "REVOGACAO", usuarioId: autor, antes: anterior, depois });
  return anterior;
}
/** Alterações são explícitas; uma correção revoga o snapshot anterior, preservando a identidade da pesagem. */
export async function aplicarPesoSecagemTx(tx: Tx, lactacao: Lactacao, acao: PesoSecagemInput | undefined, usuarioId: number | null, propriedadeId: number, motivoGeral?: string) {
  if (!acao || acao.acao === "NAO_INFORMAR") return;
  const autor = await exigirAutorRealSecagemTx(tx, usuarioId);
  if (!lactacao.encerradaEm && acao.acao !== "DESVINCULAR") erro("Peso de secagem exige lactação encerrada", "encerradaEm");
  if (acao.acao === "DESVINCULAR") return revogarPesoSecagemTx(tx, lactacao, acao.vinculoId, propriedadeId, acao.motivo ?? motivoGeral ?? "", autor);
  let origem = acao;
  if (acao.acao === "CORRIGIR" || acao.acao === "SUBSTITUIR") {
    const anterior = await revogarPesoSecagemTx(tx, lactacao, acao.vinculoId, propriedadeId, acao.motivo ?? motivoGeral ?? "", autor);
    if (acao.acao === "CORRIGIR") {
      if (new Date(acao.data).getTime() !== lactacao.encerradaEm!.getTime()) erro("Pesagem deve manter a data exata do encerramento");
      await editarPesagemTx(tx, anterior.pesagemId, { data: acao.data, pesoKg: acao.pesoKg, origem: acao.origem, precisao: acao.precisao, observacao: acao.observacao }, autor);
      return vincularPesoSecagemTx(tx, { lactacaoId: lactacao.id, pesagemId: anterior.pesagemId, propriedadeId }, autor);
    }
    origem = acao.pesagem;
  }
  if (origem.acao === "REGISTRAR") {
    if (new Date(origem.data).getTime() !== lactacao.encerradaEm!.getTime()) erro("Pesagem deve pertencer à data exata do encerramento");
    if (await tx.vinculoPesagemSecagem.findFirst({ where: { lactacaoId: lactacao.id, revogadoEm: null } })) throw new RebanhoError("CONFLITO", "Desvincule ou substitua o peso atual antes de registrar outro", "pesoSecagem");
    const nova = await registrarPesagemTx(tx, { animalId: lactacao.animalId, data: origem.data, pesoKg: origem.pesoKg, tipo: "SECAGEM", origem: origem.origem, precisao: origem.precisao, observacao: origem.observacao }, autor);
    return vincularPesoSecagemTx(tx, { lactacaoId: lactacao.id, pesagemId: nova.id, propriedadeId }, autor);
  }
  if (origem.acao === "VINCULAR") return vincularPesoSecagemTx(tx, { lactacaoId: lactacao.id, pesagemId: origem.pesagemId, propriedadeId }, autor);
}

export async function conferirPesoSecagemNaRevisaoTx(tx: Tx, lactacao: Lactacao, fim: Date | null, acao: PesoSecagemInput | undefined, propriedadeId: number, motivo: string, usuarioId: number | null) {
  const ativos = await tx.vinculoPesagemSecagem.findMany({ where: { lactacaoId: lactacao.id, revogadoEm: null }, include: { pesagem: true } });
  if (!fim) {
    if (acao && !["NAO_INFORMAR", "DESVINCULAR"].includes(acao.acao)) erro("Reabertura conserva a pesagem e revoga sua associação; não recebe outro peso");
    for (const ativo of ativos) await revogarPesoSecagemTx(tx, lactacao, ativo.id, propriedadeId, motivo, usuarioId);
    return;
  }
  if (!acao || acao.acao === "NAO_INFORMAR") {
    for (const ativo of ativos) if (ativo.pesagem.data.getTime() !== fim.getTime()) erro("Alterar a data do encerramento exige corrigir, substituir ou desvincular o peso na mesma revisão", "encerradaEm");
  }
}
export async function lerLactacaoComPesoSecagemTx(tx: Tx, id: string) {
  const lactacao = await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id }, include: { vinculosPesagemSecagem: { include: { pesagem: true }, orderBy: { criadoEm: "asc" } } } });
  return { ...lactacao, vinculosPesagemSecagem: lactacao.vinculosPesagemSecagem.map(v => ({ ...v, pesagem: { ...v.pesagem, pesoKg: Number(v.pesagem.pesoKg) } })) };
}
export function manterPesoSecagem(id: string, input: { chave: string; propriedadeId: number; motivo: string; versaoEsperada?: number; pesoSecagem: PesoSecagemInput }, usuarioId: number | null) {
  return transacaoPecuaria(async tx => {
    await exigirAutorRealSecagemTx(tx, usuarioId);
    const referencia = await tx.lactacaoAnimal.findUnique({ where: { id } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Lactação não encontrada");
    await travarAnimais(tx, [referencia.animalId]);
    return operacaoIdempotenteTx(tx, { id, ...input }, usuarioId, "PESO_SECAGEM_LACTACAO", async () => {
      const atual = await tx.lactacaoAnimal.findUniqueOrThrow({ where: { id } });
      if (input.versaoEsperada !== undefined && atual.versao !== input.versaoEsperada) throw new RebanhoError("CONFLITO", "A lactação mudou; atualize antes de revisar", "versaoEsperada");
      if (!atual.encerradaEm) erro("Manutenção de peso de secagem exige lactação encerrada", "encerradaEm");
      await conferirAnimalNoFato(tx, atual.animalId, input.propriedadeId, atual.encerradaEm);
      await aplicarPesoSecagemTx(tx, atual, input.pesoSecagem, usuarioId, input.propriedadeId, input.motivo);
      await tx.lactacaoAnimal.update({ where: { id }, data: { versao: { increment: 1 } } });
      return lerLactacaoComPesoSecagemTx(tx, id);
    });
  });
}
