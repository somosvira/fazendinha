/* Serviço de Pesagem do lote — KPI central do corte.
 *
 * Ao registrar uma pesagem: calcula pesoTotal e gmdDesdeUltima contra a pesagem
 * anterior, persiste, e dispara recomputarResumo(loteId) para atualizar o
 * read-model (pesoMedio / gmd / ua / arrobas / diasParaAlvo).
 */
import { prisma } from "../../db.js";
import { LoteError } from "./lotes.js";
import { recomputarResumo } from "./resumos.recompute.js";
import type { CriarPesagemInput } from "@rionovo/shared";
// criarPesagemSchema é compartilhado com o client (validação antes de
// enfileirar offline) — fonte real em packages/shared, aqui é só re-export
// pra quem já importa daqui não precisar mudar (ver routes/corte/lotes.ts).
export { metodoPesagem, criarPesagemSchema, type CriarPesagemInput } from "@rionovo/shared";

// DTO de Pesagem na rede — mesma forma do client/src/corte/types.ts.
export interface PesagemDTO {
  id: string;
  loteId: string;
  data: string;
  pesoMedio: number;
  numCabecas: number;
  pesoTotal: number;
  metodo: string;
  responsavel?: string;
  observacao?: string;
  gmdDesdeUltima?: number;
}

const MS = 86_400_000;
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

function toPesagemDTO(p: any): PesagemDTO {
  return {
    id: String(p.id),
    loteId: String(p.loteId),
    data: iso(p.data),
    pesoMedio: Number(p.pesoMedio),
    numCabecas: p.numCabecas,
    pesoTotal: Number(p.pesoTotal),
    metodo: p.metodo,
    responsavel: p.responsavel ?? undefined,
    observacao: p.observacao ?? undefined,
    gmdDesdeUltima: p.gmdDesdeUltima == null ? undefined : Number(p.gmdDesdeUltima),
  };
}

export async function listarPesagens(loteId: number): Promise<PesagemDTO[]> {
  const rows = await prisma.pesagemLote.findMany({ where: { loteId }, orderBy: { data: "asc" } });
  return rows.map(toPesagemDTO);
}

export async function criarPesagem(loteId: number, input: CriarPesagemInput): Promise<PesagemDTO> {
  const lote = await prisma.loteCorte.findUnique({ where: { id: loteId } });
  if (!lote) throw new LoteError("NAO_ENCONTRADO", "lote não encontrado");

  // GMD desde a última pesagem (a anterior em data à que estamos registrando).
  const anterior = await prisma.pesagemLote.findFirst({
    where: { loteId, data: { lt: new Date(input.data) } },
    orderBy: { data: "desc" },
  });
  let gmdDesdeUltima: number | null = null;
  if (anterior) {
    const dias = Math.round((Date.parse(input.data) - new Date(anterior.data).getTime()) / MS);
    if (dias > 0) gmdDesdeUltima = Number(((input.pesoMedio - Number(anterior.pesoMedio)) / dias).toFixed(3));
  }

  const pesoTotal = Number((input.pesoMedio * input.numCabecas).toFixed(2));
  const row = await prisma.pesagemLote.create({
    data: {
      loteId,
      data: new Date(input.data),
      pesoMedio: input.pesoMedio,
      numCabecas: input.numCabecas,
      pesoTotal,
      metodo: input.metodo,
      responsavel: input.responsavel ?? null,
      observacao: input.observacao ?? null,
      gmdDesdeUltima,
    },
  });

  await recomputarResumo(loteId);
  return toPesagemDTO(row);
}
