// Efeito da compra e da devolução de animais dentro da transação da operação.
// O animal é entidade do Rebanho: a operação só cadastra (compra), dá baixa (devolução/estorno)
// ou reativa (correção/estorno da devolução) pelos executores do próprio Rebanho, e liga o item
// ao animal por `ItemOperacao.animalId`.
import { Prisma } from "@prisma/client";
import { dinheiro, FinanceiroError } from "./regras.js";
import { cadastrarTx, estornarBaixaTx, registrarBaixaTx } from "../pecuaria/rebanho/animais.js";
import { hojeFazenda, RebanhoError } from "../pecuaria/rebanho/regras.js";
import type { AnimalCompraInput } from "../pecuaria/rebanho/schemas.js";

type ItemComAnimal = { animal?: AnimalCompraInput; animalId?: string; quantidade?: number; valorUnitario?: number; valorTotal?: number };
export type ContextoAnimaisOperacao = {
  tipo: string; data: Date; propriedadeId: number; parceiroId?: string; corrigeOperacaoId?: string; animaisOriginais?: string[];
  usuarioId?: number | null; itens: ItemComAnimal[];
};
type OperacaoCriada = { id: string; numero: number };

const dia = (data: Date) => data.toISOString().slice(0, 10);
const autor = (usuarioId?: number | null) => (usuarioId && usuarioId > 0 ? usuarioId : null);

export function temItensAnimais(input: { itens: Array<{ animal?: unknown; animalId?: string }> }): boolean {
  return input.itens.some((item) => item.animal || item.animalId);
}

/** Itens que cadastram ou apontam um animal: base do limite de tempo da transação. */
export function contarItensAnimais(input: { itens: Array<{ animal?: unknown; animalId?: string }> }): number {
  return input.itens.filter((item) => item.animal || item.animalId).length;
}

const moeda = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valor do item de devolução, como a operação o grava (total informado ou quantidade × unitário). */
function valorDoItem(item: ItemComAnimal): Prisma.Decimal {
  return item.valorTotal !== undefined ? dinheiro(item.valorTotal) : dinheiro(new Prisma.Decimal(item.quantidade ?? 0).mul(item.valorUnitario ?? 0));
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

type CompraAtiva = { id: string; valorTotal: Prisma.Decimal; operacao: { id: string; numero: number; parceiroId: string | null } };

/** Compra ativa de cada animal (no máximo uma, garantida por índice parcial), numa única consulta. */
async function comprasAtivasDosAnimais(tx: Prisma.TransactionClient, animalIds: string[], propriedadeId: number): Promise<Map<string, CompraAtiva>> {
  if (!animalIds.length) return new Map();
  const itens = await tx.itemOperacao.findMany({
    where: { animalId: { in: animalIds }, operacao: { tipo: "COMPRA_ANIMAIS", status: "CONFIRMADA", propriedadeId } },
    select: { id: true, animalId: true, valorTotal: true, operacao: { select: { id: true, numero: true, parceiroId: true } } },
  });
  const mapa = new Map<string, CompraAtiva>();
  for (const { animalId, ...compra } of itens) if (animalId && !mapa.has(animalId)) mapa.set(animalId, compra);
  return mapa;
}

/** Baixa ativa (não estornada) de cada animal informado, numa única consulta: animalId -> tipo. */
async function baixasAtivasDosAnimais(tx: Prisma.TransactionClient, animalIds: string[]): Promise<Map<string, string>> {
  if (!animalIds.length) return new Map();
  const baixas = await tx.baixaAnimal.findMany({ where: { animalId: { in: animalIds }, estornadaEm: null }, select: { animalId: true, tipo: true } });
  return new Map(baixas.map((baixa) => [baixa.animalId, baixa.tipo]));
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
  if (ctx.corrigeOperacaoId) {
    // Correção (compra ou devolução): os mesmos animais da original, nem mais nem menos (D5).
    const esperados = new Set(ctx.animaisOriginais ?? []);
    const informados = new Set(ids.filter((id): id is string => id != null));
    if ((esperados.size || ctx.tipo === "COMPRA_ANIMAIS") && (esperados.size !== informados.size || [...esperados].some((id) => !informados.has(id))))
      throw new FinanceiroError("CONFLITO", "A correção mantém exatamente os animais da operação original. Para devolver cabeças, use a devolução.", "itens");
  }
  const informadosIds = ids.filter((id): id is string => id != null);
  if (ctx.tipo === "COMPRA_ANIMAIS") {
    const ativas = await comprasAtivasDosAnimais(tx, informadosIds, ctx.propriedadeId);
    for (const [indice, animalId] of ids.entries()) {
      if (!animalId) continue;
      const ativa = ativas.get(animalId);
      if (ativa) throw new FinanceiroError("CONFLITO", `O animal já está na compra ativa #${ativa.operacao.numero}`, `itens.${indice}.animalId`);
    }
    return ids;
  }

  if (ctx.tipo === "DEVOLUCAO") {
    const [compras, devolvidos, baixas] = await Promise.all([
      comprasAtivasDosAnimais(tx, informadosIds, ctx.propriedadeId),
      tx.itemOperacao.findMany({
        where: { animalId: { in: informadosIds }, operacao: { tipo: "DEVOLUCAO", status: "CONFIRMADA" } },
        select: { animalId: true, operacao: { select: { numero: true } } },
      }),
      baixasAtivasDosAnimais(tx, informadosIds),
    ]);
    const devolucoes = new Map<string, number>();
    for (const { animalId, operacao } of devolvidos) if (animalId && !devolucoes.has(animalId)) devolucoes.set(animalId, operacao.numero);
    for (const [indice, animalId] of ids.entries()) {
      if (!animalId) continue;
      const compra = compras.get(animalId);
      if (!compra) throw new FinanceiroError("CONFLITO", "Só é possível devolver animal de uma compra confirmada neste sítio", `itens.${indice}.animalId`);
      if (compra.operacao.parceiroId !== ctx.parceiroId)
        throw new FinanceiroError("VALIDACAO", `Devolva ao fornecedor da compra #${compra.operacao.numero}`, "parceiroId");
      const devolucao = devolucoes.get(animalId);
      if (devolucao !== undefined) throw new FinanceiroError("CONFLITO", `O animal já foi devolvido na operação #${devolucao}`, `itens.${indice}.animalId`);
      if (baixas.has(animalId))
        throw new FinanceiroError("CONFLITO", "O animal já saiu do rebanho; só é possível devolver animal ativo", `itens.${indice}.animalId`);
      // `valorTotal` da compra já é líquido do desconto comercial: é o que foi de fato pago pela cabeça.
      if (valorDoItem(ctx.itens[indice]).gt(compra.valorTotal))
        throw new FinanceiroError("VALIDACAO", `O valor devolvido não pode passar do valor pago (R$ ${moeda.format(compra.valorTotal.toNumber())})`, `itens.${indice}.valorTotal`);
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
    const baixas = await baixasAtivasDosAnimais(tx, animalIds.filter((id): id is string => id != null));
    for (const [indice, animalId] of animalIds.entries()) {
      if (!animalId) continue;
      // Animal que saiu do rebanho por outro motivo (morte, venda) continua baixado.
      if (baixas.get(animalId) !== "COMPRA_ESTORNADA") continue;
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
    const baixas = await baixasAtivasDosAnimais(tx, animalIds);
    for (const animalId of animalIds) {
      if (baixas.has(animalId)) continue;
      await traduzir(() => registrarBaixaTx(tx, {
        animalId, tipo: "COMPRA_ESTORNADA", data: hojeFazenda(), motivoId: null,
        observacao: `Compra #${operacao.numero} estornada: ${motivo}`,
      }, usuario));
    }
    return;
  }

  if (operacao.tipo === "DEVOLUCAO") {
    const baixas = await baixasAtivasDosAnimais(tx, animalIds);
    for (const animalId of animalIds) {
      if (!baixas.has(animalId)) continue;
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
