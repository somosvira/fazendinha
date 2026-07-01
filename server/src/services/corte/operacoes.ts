/* Serviço de operação comercial do Corte (Onda 2) — venda, descarte, compra,
 * transferência.
 *
 * Núcleo PURO (calcularOperacao) deriva pesoTotal/arrobas/receitaTotal sem DB,
 * testável. O wrapper persiste a OperacaoComercial, ajusta o estado/efetivo do
 * lote (VENDIDO em venda de cabeça-cheia; decremento em venda parcial/descarte)
 * e dispara recomputarResumo(loteId).
 *
 * Ponte financeira (lancamentoId) é Onda 3 — fica null aqui.
 *
 * Referencial: rendimento de carcaça 52%; @ = 15 kg (Embrapa Gado de Corte).
 */
import { prisma } from "../../db.js";
import { recomputarResumo } from "./resumos.recompute.js";
import { RENDIMENTO_CARCACA, KG_POR_ARROBA } from "./resumos.recompute.js";
import { CorteEventoError } from "./manejo.js";
import type { CriarOperacaoInput } from "./schemas.corte-eventos.js";

const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);
const num = (x: any) => (x != null ? Number(x) : undefined);

const round2 = (n: number) => Number(n.toFixed(2));

export interface OperacaoCalculada {
  pesoTotal: number;
  arrobas: number;
  receitaTotal: number | null;
}

/**
 * Núcleo PURO — deriva pesoTotal, arrobas e receitaTotal de uma operação.
 *   pesoTotal    = pesoMedio × numCabecas
 *   arrobas      = pesoTotal × 0,52 / 15            (carcaça → arroba)
 *   receitaTotal = arrobas × precoArroba            (só quando precoArroba dado)
 * `arrobas` explícito no input tem precedência sobre o cálculo.
 */
export function calcularOperacao(input: {
  numCabecas: number;
  pesoMedio: number;
  arrobas?: number | null;
  precoArroba?: number | null;
}): OperacaoCalculada {
  const pesoTotal = round2(input.pesoMedio * input.numCabecas);
  const arrobas =
    input.arrobas != null
      ? round2(input.arrobas)
      : round2((pesoTotal * RENDIMENTO_CARCACA) / KG_POR_ARROBA);
  const receitaTotal = input.precoArroba != null ? round2(arrobas * input.precoArroba) : null;
  return { pesoTotal, arrobas, receitaTotal };
}

export interface OperacaoComercialDTO {
  id: string;
  loteId: string | null;
  data: string;
  tipo: string;
  numCabecas: number;
  pesoMedio: number;
  pesoTotal: number;
  arrobas?: number;
  precoArroba?: number;
  receitaTotal?: number;
  comprador?: string;
  observacao?: string;
  lancamentoId?: number;
}

function toOperacaoDTO(o: any): OperacaoComercialDTO {
  return {
    id: String(o.id),
    loteId: o.loteId != null ? String(o.loteId) : null,
    data: iso(o.data),
    tipo: o.tipo,
    numCabecas: o.numCabecas,
    pesoMedio: Number(o.pesoMedio),
    pesoTotal: Number(o.pesoTotal),
    arrobas: num(o.arrobas),
    precoArroba: num(o.precoArroba),
    receitaTotal: num(o.receitaTotal),
    comprador: o.comprador ?? undefined,
    observacao: o.observacao ?? undefined,
    lancamentoId: o.lancamentoId ?? undefined,
  };
}

export async function listarOperacoes(loteId?: number): Promise<OperacaoComercialDTO[]> {
  const where = loteId != null ? { loteId } : {};
  const rows = await prisma.operacaoComercial.findMany({ where, orderBy: { data: "desc" } });
  return rows.map(toOperacaoDTO);
}

// Tipos que reduzem o efetivo do lote (saída de cabeças).
const TIPOS_SAIDA = new Set(["VENDA_ABATE", "VENDA_REPRODUCAO", "DESCARTE"]);

export async function criarOperacaoComercial(
  input: CriarOperacaoInput
): Promise<OperacaoComercialDTO> {
  // loteId é opcional no schema (ex.: COMPRA antes do lote existir), mas se vier
  // tem que apontar para um lote real.
  let lote: { id: number; numCabecas: number } | null = null;
  if (input.loteId != null) {
    lote = await prisma.loteCorte.findUnique({
      where: { id: input.loteId },
      select: { id: true, numCabecas: true },
    });
    if (!lote) throw new CorteEventoError("REF_INVALIDA", "lote inexistente");
  }

  const calc = calcularOperacao(input);

  const row = await prisma.operacaoComercial.create({
    data: {
      loteId: input.loteId ?? null,
      data: new Date(input.data),
      tipo: input.tipo,
      numCabecas: input.numCabecas,
      pesoMedio: input.pesoMedio,
      pesoTotal: calc.pesoTotal,
      arrobas: calc.arrobas,
      precoArroba: input.precoArroba ?? null,
      receitaTotal: calc.receitaTotal,
      comprador: input.comprador ?? null,
      observacao: input.observacao ?? null,
      // Ponte financeira (lancamentoId) é Onda 3 — fica null aqui.
      lancamentoId: null,
    },
  });

  // Efeito no lote: venda de abate de cabeça-cheia zera o lote (VENDIDO);
  // saída parcial / descarte apenas decrementa o efetivo.
  if (lote && TIPOS_SAIDA.has(input.tipo)) {
    if (input.tipo === "VENDA_ABATE" && input.numCabecas >= lote.numCabecas) {
      await prisma.loteCorte.update({
        where: { id: lote.id },
        data: { estado: "VENDIDO", numCabecas: 0 },
      });
    } else {
      await prisma.loteCorte.update({
        where: { id: lote.id },
        data: { numCabecas: Math.max(0, lote.numCabecas - input.numCabecas) },
      });
    }
    await recomputarResumo(lote.id);
  }

  return toOperacaoDTO(row);
}
