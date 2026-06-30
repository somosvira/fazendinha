import type { Talhao, ResumoTalhao } from "./mock.js";

function iso(d: Date | null | undefined): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

// Number() converte Prisma Decimal | number | null → number | undefined (o
// contrato do mock usa campos opcionais, não nulos, nos resumos).
function num(v: any): number | undefined {
  return v == null ? undefined : Number(v);
}

export function toResumoDTO(r: any | null | undefined): ResumoTalhao | null {
  if (!r) return null;
  return {
    talhaoId: String(r.talhaoId),
    fase: r.fase,
    diasNaFase: r.diasNaFase ?? undefined,
    proximaOperacao: r.proximaOperacao ?? undefined,
    proximaOperacaoEm: iso(r.proximaOperacaoEm) ?? undefined,
    produtividadeEsperada: num(r.produtividadeEsperada),
    produtividadeUltima: num(r.produtividadeUltima),
    bienalidade: r.bienalidade ?? undefined,
    maturacaoCereja: num(r.maturacaoCereja),
    maturacaoVerde: num(r.maturacaoVerde),
    maturacaoBoia: num(r.maturacaoBoia),
    ferrugem: num(r.ferrugem),
    bichoMineiro: num(r.bichoMineiro),
    broca: num(r.broca),
    cercosporiose: num(r.cercosporiose),
    tendFerrugem: r.tendFerrugem ?? undefined,
    ultimaInspecaoData: iso(r.ultimaInspecaoData) ?? undefined,
    ultimaAnaliseSolo: iso(r.ultimaAnaliseSolo) ?? undefined,
    pH: num(r.pH),
    v: num(r.v),
    mo: num(r.mo),
    fosforo: num(r.fosforo),
    potassio: num(r.potassio),
    ultimaAnaliseFoliar: iso(r.ultimaAnaliseFoliar) ?? undefined,
    nFoliar: num(r.nFoliar),
    kFoliar: num(r.kFoliar),
  };
}

export function toTalhaoDTO(t: any): Talhao {
  return {
    id: String(t.id),
    codigo: t.codigo,
    nome: t.nome ?? "",
    variedade: t.variedade?.nome ?? "",
    espacamento: t.espacamento ?? "",
    plantasHa: Number(t.plantasHa),
    areaHa: Number(t.areaHa),
    anoPlantio: Number(t.anoPlantio),
    altitude: t.altitude != null ? Number(t.altitude) : 0,
    exposicao: (t.exposicao ?? null) as Talhao["exposicao"],
    declive: t.declive != null ? Number(t.declive) : null,
    irrigado: !!t.irrigado,
    estado: t.estado,
    lavoura: t.lavoura?.nome ?? "",
    ultimaRecepa: iso(t.ultimaRecepa),
    dataPlantio: iso(t.dataPlantio)!,
    observacao: t.observacao ?? null,
    resumo: toResumoDTO(t.resumo),
  };
}
