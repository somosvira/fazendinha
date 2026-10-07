import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { auditar, RebanhoError, travarAnimais, hojeFazenda } from "../rebanho/regras.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { transacaoPecuaria } from "../transacao.js";
import { criarAplicacaoTx, travarOrigensAplicacoesTx } from "../sanidade/aplicacoes.js";
import { registrarExameTx, travarTiposExame } from "../sanidade/exames.js";
import { prepararColetaSchema, rascunhoColetaSchema, snapshotColetaSchema, type PrepararColetaInput, type RascunhoColeta } from "./schemas.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));

export async function prepararColeta(entrada: PrepararColetaInput, usuarioId: number | null) {
  const input = prepararColetaSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-coleta:${input.id}`}))`;
    const existente = await tx.coletaCampo.findUnique({ where: { id: input.id } });
    if (existente) {
      const snapshot = snapshotColetaSchema.parse(existente.snapshot);
      const lotes = snapshot.loteIds ?? snapshot.animais.map((a) => a.loteId);
      if (existente.propriedadeId !== input.propriedadeId || existente.criadoPorId !== usuarioId || existente.tipo !== input.tipo || existente.titulo !== input.titulo || existente.data.getTime() !== dia(input.data).getTime() || [...new Set(lotes)].sort().join() !== [...new Set(input.loteIds)].sort().join()) {
        throw new RebanhoError("CONFLITO", "A ficha já foi preparada com outros dados. Abra a ficha existente.");
      }
      return existente;
    }
    const lotes = await tx.lote.findMany({ where: { id: { in: input.loteIds }, propriedadeId: input.propriedadeId, ativo: true } });
    if (lotes.length !== new Set(input.loteIds).size) throw new RebanhoError("VALIDACAO", "Selecione lotes ativos do mesmo sítio", "loteIds");
    const locais = await tx.localizacaoAnimal.findMany({ where: { propriedadeId: input.propriedadeId, loteId: { in: input.loteIds }, desde: { lte: dia(input.data) }, OR: [{ ate: null }, { ate: { gt: dia(input.data) } }] }, include: { animal: true, lote: true }, take: 501 });
    const limite = input.tipo === "PESAGEM" ? 500 : 100;
    if (!locais.length || locais.length > limite) throw new RebanhoError("VALIDACAO", `A ficha deve ter de 1 a ${limite} animais. Ajuste os lotes selecionados.`, "loteIds");
    const animais = locais.map((l) => ({ animalId: l.animalId, brinco: l.animal.brinco, nome: l.animal.nome, loteId: l.loteId!, loteNome: l.lote!.nome }))
      .sort((a, b) => a.loteNome.localeCompare(b.loteNome, "pt-BR", { numeric: true }) || a.brinco.localeCompare(b.brinco, "pt-BR", { numeric: true }) || a.animalId.localeCompare(b.animalId));
    const propriedade = await tx.propriedade.findUniqueOrThrow({ where: { id: input.propriedadeId } });
    const criado = await tx.coletaCampo.create({ data: { id: input.id, propriedadeId: input.propriedadeId, tipo: input.tipo, data: dia(input.data), titulo: input.titulo,
      snapshot: json({ propriedadeNome: propriedade.nome, loteIds: [...new Set(input.loteIds)].sort(), animais }), rascunho: json({ tipoPesagem: "ROTINA", origemPesagem: "MANUAL", itens: animais.map((a) => ({ animalId: a.animalId, situacao: "PENDENTE", peso: "", motivo: "", observacao: "" })) }), criadoPorId: usuarioId } });
    await auditar(tx, { entidade: "ColetaCampo", entidadeId: criado.id, propriedadeId: input.propriedadeId, acao: "PREPARACAO", usuarioId, depois: criado });
    return criado;
  });
}

export async function listarColetas(propriedadeId: number | null, pagina = 1, tipo?: PrepararColetaInput["tipo"]) {
  const where = { ...(propriedadeId == null ? {} : { propriedadeId }), ...(tipo ? { tipo } : {}) };
  const [itens, total] = await prisma.$transaction([
    prisma.coletaCampo.findMany({ where, select: { id: true, titulo: true, tipo: true, status: true, data: true, propriedadeId: true, propriedade: { select: { nome: true } }, versao: true }, orderBy: [{ criadoEm: "desc" }, { id: "asc" }], skip: (pagina - 1) * 20, take: 20 }),
    prisma.coletaCampo.count({ where }),
  ]);
  return { itens, total, pagina, limite: 20 };
}
export async function obterColeta(id: string, propriedadeId: number | null) {
  const coleta = await prisma.coletaCampo.findFirst({ where: { id, ...(propriedadeId == null ? {} : { propriedadeId }) } });
  if (!coleta) throw new RebanhoError("NAO_ENCONTRADO", "Ficha não encontrada neste sítio");
  return coleta;
}

export function conferirRascunho(snapshot: unknown, rascunho: RascunhoColeta, concluir = false) {
  const animais = snapshotColetaSchema.parse(snapshot).animais;
  const ids = rascunho.itens.map((i) => i.animalId);
  if (ids.length !== animais.length || new Set(ids).size !== ids.length || animais.some((a) => !ids.includes(a.animalId))) throw new RebanhoError("VALIDACAO", "Os animais devem corresponder à ficha impressa", "itens");
  if (concluir) rascunho.itens.forEach((i, linha) => {
    if (i.situacao === "PENDENTE") throw new RebanhoError("VALIDACAO", "Informe o que foi realizado em cada animal", `itens.${linha}.situacao`);
    if (i.situacao === "NAO_REALIZADO" && i.motivo.trim().length < 5) throw new RebanhoError("VALIDACAO", "Explique por que não foi realizado", `itens.${linha}.motivo`);
  });
}

export async function salvarColeta(id: string, propriedadeId: number, versao: number, entrada: RascunhoColeta, usuarioId: number | null) {
  const rascunho = rascunhoColetaSchema.parse(entrada);
  return transacaoPecuaria(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-coleta:${id}`}))`;
    const antes = await tx.coletaCampo.findFirst({ where: { id, propriedadeId } });
    if (!antes) throw new RebanhoError("NAO_ENCONTRADO", "Ficha não encontrada neste sítio");
    if (antes.status === "CONCLUIDA" || antes.versao !== versao) throw new RebanhoError("CONFLITO", "A ficha foi atualizada. Reabra a ficha antes de salvar.");
    conferirRascunho(antes.snapshot, rascunho);
    const depois = await tx.coletaCampo.update({ where: { id }, data: { rascunho: json(rascunho), status: "EM_PREENCHIMENTO", versao: { increment: 1 } } });
    await auditar(tx, { entidade: "ColetaCampo", entidadeId: id, propriedadeId, acao: "RASCUNHO", usuarioId, antes, depois });
    return depois;
  });
}

async function gravarItens(tx: Prisma.TransactionClient, coleta: Awaited<ReturnType<typeof obterColeta>>, rascunho: RascunhoColeta, usuarioId: number | null) {
  const realizados = rascunho.itens.filter((i) => i.situacao === "REALIZADO");
  if (coleta.tipo === "APLICACAO") await travarOrigensAplicacoesTx(tx, realizados.flatMap((i) => i.aplicacao ? [i.aplicacao] : []));
  if (coleta.tipo === "EXAME" && rascunho.tipoExameId) await travarTiposExame(tx, [rascunho.tipoExameId]);
  const resultados: Array<{ animalId: string; id: string; tipo: string }> = [];
  for (const item of realizados) {
    try {
      await conferirAnimalNoFato(tx, item.animalId, coleta.propriedadeId, coleta.data);
      let fato: { id: string };
      if (coleta.tipo === "PESAGEM") {
        const peso = item.peso.replace(",", ".");
        if (!/^\d+(\.\d{1,2})?$/.test(peso) || new Prisma.Decimal(peso).lte(0) || new Prisma.Decimal(peso).gt(99999.99)) throw new RebanhoError("VALIDACAO", "Informe peso maior que zero, com até duas casas decimais", "peso");
        fato = await tx.pesagem.create({ data: { animalId: item.animalId, data: coleta.data, tipo: rascunho.tipoPesagem, origem: rascunho.origemPesagem, pesoKg: new Prisma.Decimal(peso), observacao: item.observacao || null, criadoPorId: usuarioId } });
        await auditar(tx, { entidade: "Pesagem", entidadeId: fato.id, animalId: item.animalId, propriedadeId: coleta.propriedadeId, acao: "COLETA_CAMPO", usuarioId, depois: { ...fato, coletaId: coleta.id, pesoKg: peso } });
      } else if (coleta.tipo === "EXAME") {
        if (!rascunho.tipoExameId) throw new RebanhoError("VALIDACAO", "Selecione o tipo de exame", "tipoExameId");
        fato = await registrarExameTx(tx, { animalId: item.animalId, propriedadeId: coleta.propriedadeId, data: coleta.data.toISOString().slice(0, 10), tipoExameId: rascunho.tipoExameId, responsavel: rascunho.responsavel }, usuarioId);
      } else {
        if (!item.aplicacao || item.aplicacao.animalId !== item.animalId || item.aplicacao.propriedadeId !== coleta.propriedadeId || item.aplicacao.data !== coleta.data.toISOString().slice(0, 10)) throw new RebanhoError("VALIDACAO", "Confira os dados da aplicação na data e no sítio desta ficha", "aplicacao");
        fato = await criarAplicacaoTx(tx, item.aplicacao, usuarioId);
      }
      resultados.push({ animalId: item.animalId, id: fato.id, tipo: coleta.tipo });
    } catch (erro) {
      if (erro instanceof RebanhoError) throw new RebanhoError(erro.code, `${snapshotColetaSchema.parse(coleta.snapshot).animais.find((a) => a.animalId === item.animalId)?.brinco}: ${erro.message}. Nenhum item foi gravado.`, `itens.${rascunho.itens.indexOf(item)}.${erro.campo ?? "situacao"}`);
      throw erro;
    }
  }
  return resultados;
}

export async function concluirColeta(id: string, propriedadeId: number, versao: number, usuarioId: number | null) {
  return transacaoPecuaria(async (tx) => {
    const referencia = await tx.coletaCampo.findFirst({ where: { id, propriedadeId } });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Ficha não encontrada neste sítio");
    await travarAnimais(tx, snapshotColetaSchema.parse(referencia.snapshot).animais.map((a) => a.animalId));
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pec-coleta:${id}`}))`;
    const antes = await tx.coletaCampo.findUniqueOrThrow({ where: { id } });
    if (antes.status === "CONCLUIDA" && antes.versao === versao + 1) return antes;
    if (antes.status === "CONCLUIDA" || antes.versao !== versao) throw new RebanhoError("CONFLITO", "A ficha mudou. Reabra e confira a versão atual.");
    if (antes.data.toISOString().slice(0, 10) > hojeFazenda()) throw new RebanhoError("VALIDACAO", "A coleta só pode ser concluída depois de realizada", "data");
    const rascunho = rascunhoColetaSchema.parse(antes.rascunho);
    conferirRascunho(antes.snapshot, rascunho, true);
    const resultados = await gravarItens(tx, antes, rascunho, usuarioId);
    const depois = await tx.coletaCampo.update({ where: { id }, data: { status: "CONCLUIDA", resultados: json(resultados), concluidoEm: new Date(), versao: { increment: 1 } } });
    await auditar(tx, { entidade: "ColetaCampo", entidadeId: id, propriedadeId, acao: "CONCLUSAO", usuarioId, antes, depois });
    return depois;
  });
}
