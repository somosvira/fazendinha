// Efeito da compra e da devolução de animais dentro da transação da operação.
// O animal é entidade do Rebanho: a operação só cadastra (compra), dá baixa (devolução/estorno)
// ou reativa (correção/estorno da devolução) pelos executores do próprio Rebanho, e liga o item
// ao animal por `ItemOperacao.animalId`.
import type { Prisma } from "@prisma/client";
import { FinanceiroError } from "./regras.js";
import { cadastrarTx, estornarBaixaTx, registrarBaixaTx } from "../pecuaria/rebanho/animais.js";
import { hojeFazenda, RebanhoError } from "../pecuaria/rebanho/regras.js";
import type { AnimalCompraInput } from "../pecuaria/rebanho/schemas.js";

type ItemComAnimal = { animal?: AnimalCompraInput; animalId?: string };
export type ContextoAnimaisOperacao = {
  tipo: string; data: Date; propriedadeId: number; parceiroId?: string; corrigeOperacaoId?: string;
  usuarioId?: number | null; itens: ItemComAnimal[];
};
type OperacaoCriada = { id: string; numero: number };

const dia = (data: Date) => data.toISOString().slice(0, 10);
const autor = (usuarioId?: number | null) => (usuarioId && usuarioId > 0 ? usuarioId : null);

export function temItensAnimais(input: { itens: Array<{ animal?: unknown; animalId?: string }> }): boolean {
  return input.itens.some((item) => item.animal || item.animalId);
}

/** Converte a recusa do Rebanho no erro do Financeiro, apontando o item do formulário. */
async function noItem<T>(indice: number, campoBase: string, executar: () => Promise<T>): Promise<T> {
  try {
    return await executar();
  } catch (erro) {
    if (!(erro instanceof RebanhoError)) throw erro;
    const codigo = erro.code === "NAO_ENCONTRADO" ? "NAO_ENCONTRADO" : erro.code === "VALIDACAO" ? "VALIDACAO" : "CONFLITO";
    throw new FinanceiroError(codigo, erro.message, erro.campo ? `itens.${indice}.${campoBase}.${erro.campo}` : `itens.${indice}.${campoBase}`);
  }
}

/** Animais desta operação por item (os demais itens, como frete, ficam null). */
function idsInformados(itens: ItemComAnimal[]) {
  return itens.map((item) => item.animalId ?? null);
}

async function compraAtivaDoAnimal(tx: Prisma.TransactionClient, animalId: string, propriedadeId: number) {
  return tx.itemOperacao.findFirst({
    where: { animalId, operacao: { tipo: "COMPRA_ANIMAIS", status: "CONFIRMADA", propriedadeId } },
    select: { id: true, valorTotal: true, operacao: { select: { id: true, numero: true, parceiroId: true } } },
  });
}

/**
 * Antes de gravar a operação: cadastra os animais novos da compra, ou confere os animais
 * existentes da correção e da devolução. Devolve o `animalId` de cada item de entrada.
 */
export async function prepararAnimaisTx(tx: Prisma.TransactionClient, ctx: ContextoAnimaisOperacao): Promise<(string | null)[]> {
  if (ctx.tipo === "COMPRA_ANIMAIS" && !ctx.corrigeOperacaoId) {
    const ids: (string | null)[] = [];
    for (const [indice, item] of ctx.itens.entries()) {
      if (!item.animal) { ids.push(null); continue; }
      const animal = item.animal;
      const { animal: criado } = await noItem(indice, "animal", () => cadastrarTx(tx, {
        ...animal, origem: "COMPRADO", propriedadeId: ctx.propriedadeId, dataEntrada: animal.dataEntrada ?? dia(ctx.data),
      }, autor(ctx.usuarioId)));
      ids.push(criado.id);
    }
    return ids;
  }

  const ids = idsInformados(ctx.itens);
  if (ctx.tipo === "COMPRA_ANIMAIS") {
    // Correção: os mesmos animais da compra original, nem mais nem menos (D5).
    const original = await tx.itemOperacao.findMany({ where: { operacaoId: ctx.corrigeOperacaoId, animalId: { not: null } }, select: { animalId: true } });
    const esperados = new Set(original.map((item) => item.animalId!));
    const informados = new Set(ids.filter((id): id is string => id != null));
    if (esperados.size !== informados.size || [...esperados].some((id) => !informados.has(id)))
      throw new FinanceiroError("CONFLITO", "A correção da compra mantém exatamente os animais da compra original. Para devolver cabeças, use a devolução.", "itens");
    return ids;
  }

  if (ctx.tipo === "DEVOLUCAO") {
    for (const [indice, animalId] of ids.entries()) {
      if (!animalId) continue;
      const compra = await compraAtivaDoAnimal(tx, animalId, ctx.propriedadeId);
      if (!compra) throw new FinanceiroError("CONFLITO", "Só é possível devolver animal de uma compra confirmada neste sítio", `itens.${indice}.animalId`);
      if (compra.operacao.parceiroId !== ctx.parceiroId)
        throw new FinanceiroError("VALIDACAO", `Devolva ao fornecedor da compra #${compra.operacao.numero}`, "parceiroId");
    }
  }
  return ids;
}

/** Depois de gravar a operação: baixas da devolução e reativação dos animais na correção. */
export async function concluirAnimaisTx(tx: Prisma.TransactionClient, ctx: ContextoAnimaisOperacao, operacao: OperacaoCriada, animalIds: (string | null)[]) {
  const usuario = autor(ctx.usuarioId);
  if (ctx.tipo === "DEVOLUCAO") {
    for (const [indice, animalId] of animalIds.entries()) {
      if (!animalId) continue;
      await noItem(indice, "animalId", () => registrarBaixaTx(tx, {
        animalId, tipo: "COMPRA_ESTORNADA", data: dia(ctx.data), motivoId: null,
        observacao: `Devolvido ao vendedor na operação #${operacao.numero}`,
      }, usuario));
    }
    return;
  }
  if (ctx.tipo === "COMPRA_ANIMAIS" && ctx.corrigeOperacaoId) {
    for (const [indice, animalId] of animalIds.entries()) {
      if (!animalId) continue;
      // Animal que saiu do rebanho por outro motivo (morte, venda) continua baixado.
      const baixa = await tx.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null }, select: { tipo: true } });
      if (baixa?.tipo !== "COMPRA_ESTORNADA") continue;
      await noItem(indice, "animalId", () => estornarBaixaTx(tx, animalId, { motivo: `Compra corrigida na operação #${operacao.numero}` }, usuario, true));
    }
  }
}

/**
 * Estorno da operação: a compra dá baixa `COMPRA_ESTORNADA` nos animais ainda ativos e mantém
 * todos os registros; a devolução reativa os animais devolvidos.
 */
export async function estornarAnimaisTx(tx: Prisma.TransactionClient, operacao: { id: string; tipo: string; numero: number }, motivo: string, usuarioId?: number | null) {
  const itens = await tx.itemOperacao.findMany({ where: { operacaoId: operacao.id, animalId: { not: null } }, select: { animalId: true }, orderBy: { ordem: "asc" } });
  const animalIds = itens.map((item) => item.animalId!);
  if (!animalIds.length) return;
  const usuario = autor(usuarioId);

  if (operacao.tipo === "COMPRA_ANIMAIS") {
    const devolucao = await tx.itemOperacao.findFirst({
      where: { animalId: { in: animalIds }, operacao: { tipo: "DEVOLUCAO", status: "CONFIRMADA" } },
      select: { operacao: { select: { numero: true } } },
    });
    if (devolucao) throw new FinanceiroError("CONFLITO", `Estorne antes a devolução #${devolucao.operacao.numero}, para o valor não ser devolvido duas vezes.`);
    for (const animalId of animalIds) {
      const baixa = await tx.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null }, select: { id: true } });
      if (baixa) continue;
      await traduzir(() => registrarBaixaTx(tx, {
        animalId, tipo: "COMPRA_ESTORNADA", data: hojeFazenda(), motivoId: null,
        observacao: `Compra #${operacao.numero} estornada: ${motivo}`,
      }, usuario));
    }
    return;
  }

  if (operacao.tipo === "DEVOLUCAO") {
    for (const animalId of animalIds) {
      const baixa = await tx.baixaAnimal.findFirst({ where: { animalId, estornadaEm: null }, select: { tipo: true } });
      if (!baixa) continue;
      await traduzir(() => estornarBaixaTx(tx, animalId, { motivo: `Devolução #${operacao.numero} estornada: ${motivo}` }, usuario, true));
    }
  }
}

async function traduzir<T>(executar: () => Promise<T>): Promise<T> {
  try {
    return await executar();
  } catch (erro) {
    if (erro instanceof RebanhoError) throw new FinanceiroError(erro.code === "NAO_ENCONTRADO" ? "NAO_ENCONTRADO" : "CONFLITO", erro.message);
    throw erro;
  }
}
