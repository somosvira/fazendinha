import type { Lote, ResumoLote, Piquete } from "./mock.js";

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
}

// Number() converte Prisma Decimal | number | null → number | undefined. O
// contrato do mock usa campos opcionais (não nulos) no resumo.
function num(v: any): number | undefined {
  return v == null ? undefined : Number(v);
}

export function toResumoLoteDTO(r: any | null | undefined): ResumoLote | null {
  if (!r) return null;
  return {
    loteId: String(r.loteId),
    pesoMedio: num(r.pesoMedio),
    pesoMedioEntrada: num(r.pesoMedioEntrada),
    gmd: num(r.gmd),
    gmdAcumulado: num(r.gmdAcumulado),
    ultimaPesagem: iso(r.ultimaPesagem) ?? undefined,
    diasSemPesar: r.diasSemPesar ?? undefined,
    ua: num(r.ua),
    proximaVacina: r.proximaVacina ?? undefined,
    proximoVermifugo: r.proximoVermifugo ?? undefined,
    ultimoManejo: r.ultimoManejo ?? undefined,
    pesoAlvoVenda: num(r.pesoAlvoVenda),
    diasParaAlvo: r.diasParaAlvo ?? undefined,
    arrobasEstimadas: num(r.arrobasEstimadas),
    mortalidadeAcumulada: num(r.mortalidadeAcumulada),
    proximaAcao: r.proximaAcao ?? undefined,
    proximaAcaoEm: iso(r.proximaAcaoEm) ?? undefined,
  };
}

export function toLoteDTO(l: any): Lote {
  return {
    id: String(l.id),
    codigo: l.codigo,
    nome: l.nome,
    categoria: l.categoria,
    fase: l.fase,
    raca: l.raca,
    numCabecas: l.numCabecas,
    numCabecasEntrada: l.numCabecasEntrada,
    dataFormacao: iso(l.dataFormacao)!,
    origem: l.origem ?? undefined,
    piqueteAtual: l.piquete?.codigo ?? null,
    estado: l.estado,
    observacao: l.observacao ?? null,
    resumo: toResumoLoteDTO(l.resumo),
  };
}

export function toPiqueteDTO(p: any, loteAtual?: { id: number } | null): Piquete {
  return {
    id: String(p.id),
    codigo: p.codigo,
    nome: p.nome,
    capim: p.capim,
    areaHa: Number(p.areaHa),
    lotacaoMaxUA: Number(p.lotacaoMaxUA),
    cercaTipo: p.cercaTipo ?? undefined,
    ultimaReforma: iso(p.ultimaReforma) ?? undefined,
    estado: p.estado,
    loteAtualId: loteAtual ? String(loteAtual.id) : null,
    diasDescanso: p.diasDescanso ?? undefined,
    observacao: p.observacao ?? undefined,
  };
}
