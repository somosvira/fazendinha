import { prisma } from "../../../db.js";
import { calcularTaxasIndicadores, type ContagensIndicadores, type SnapshotIndicadoresReprodutivos } from "./indicadores.calc.js";
import { consultarIndicadoresReprodutivos } from "./indicadores.js";
import { filtrosIndicadoresSchema } from "./indicadores.schemas.js";
import { emitirRelatorioPartos } from "./relatorio-partos.js";

const somaOuNulo = (vs: (number | null)[]) => vs.some(v => v === null) ? null : vs.reduce<number>((s, v) => s + (v as number), 0);
/** Soma contagens de sítios distintos; um valor desconhecido em qualquer sítio mantém o total desconhecido. */
export function somarContagens(partes: ContagensIndicadores[]): ContagensIndicadores {
  const n = (k: keyof ContagensIndicadores) => partes.reduce((s, p) => s + ((p[k] as number | null) ?? 0), 0);
  return {
    vaziasAptasInicio: n("vaziasAptasInicio"), negativasAnteriores: n("negativasAnteriores"), anterioresSemDiagnostico: n("anterioresSemDiagnostico"),
    estimativaVaziasAnteriores: somaOuNulo(partes.map(p => p.estimativaVaziasAnteriores)), saidasPev: n("saidasPev"), contribuicaoPev: n("contribuicaoPev"),
    elegiveisConhecidas: n("elegiveisConhecidas"), elegiveis: somaOuNulo(partes.map(p => p.elegiveis)), matrizesServidas: n("matrizesServidas"),
    tentativas: n("tentativas"), positivas: n("positivas"), negativas: n("negativas"), abertas: n("abertas"), naoClassificaveis: n("naoClassificaveis"),
    denominadorConcepcao: n("denominadorConcepcao"), animaisComPendenciaElegibilidade: n("animaisComPendenciaElegibilidade"),
  };
}

/**
 * Indicadores em Consolidado: cada sítio é apurado com a própria política; as contagens são somadas
 * por período e as taxas recalculadas a partir da soma (nunca média das taxas dos sítios).
 * O acompanhamento por política fica por sítio.
 */
export function combinarIndicadores(partes: Array<{ sitio: { id: number; nome: string }; s: SnapshotIndicadoresReprodutivos }>) {
  const base = partes[0].s;
  const periodos = base.periodos.map(periodo => {
    const doPeriodo = partes.map(p => p.s.periodos.find(x => x.id === periodo.id)!).filter(Boolean);
    const contagens = somarContagens(doPeriodo.map(p => p.contagens));
    return { ...periodo, baseCalculo: undefined, contagens, taxas: calcularTaxasIndicadores(contagens),
      pendencias: [...new Set(doPeriodo.flatMap(p => p.pendencias))].sort(),
      maturidade: { ...periodo.maturidade, tentativasAbertas: doPeriodo.reduce((s, p) => s + p.maturidade.tentativasAbertas, 0) },
      detalhamento: doPeriodo.flatMap(p => p.detalhamento) };
  });
  const contagens = somarContagens(partes.map(p => p.s.totais.contagens));
  return {
    ...base, acompanhamento: undefined, escopoConsolidado: true as const,
    periodos,
    totais: { baseCalculo: undefined, contagens, taxas: calcularTaxasIndicadores(contagens),
      participacoesAnimalPeriodo: partes.reduce((s, p) => s + p.s.totais.participacoesAnimalPeriodo, 0),
      animaisUnicos: partes.reduce((s, p) => s + p.s.totais.animaisUnicos, 0) },
    pendencias: [...new Set(partes.flatMap(p => p.s.pendencias))].sort(),
    porSitio: partes.map(p => ({ propriedadeId: p.sitio.id, nome: p.sitio.nome, contagens: p.s.totais.contagens, taxas: p.s.totais.taxas })),
  };
}
export async function consultarIndicadoresConsolidado(query: Record<string, unknown>) {
  const filtros = filtrosIndicadoresSchema.parse(query);
  const sitios = await prisma.propriedade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: [{ principal: "desc" }, { nome: "asc" }] });
  const partes = [];
  for (const sitio of sitios) partes.push({ sitio, s: await consultarIndicadoresReprodutivos({ ...filtros, propriedadeId: sitio.id }) });
  return combinarIndicadores(partes);
}

/** Relatório de partos em Consolidado: partos de todos os sítios ativos, cada um com o nome do sítio. */
export async function emitirRelatorioPartosConsolidado(periodo: { inicio: string; fim: string }) {
  const sitios = await prisma.propriedade.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: [{ principal: "desc" }, { nome: "asc" }] });
  const partes = [];
  for (const sitio of sitios) partes.push({ sitio, r: await emitirRelatorioPartos({ ...periodo, propriedadeId: sitio.id }) });
  const partos = partes.flatMap(({ sitio, r }) => r.partos.map(p => ({ ...p, propriedadeId: sitio.id, sitio: sitio.nome })))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  return { ...partes[0].r, propriedadeId: null, escopoConsolidado: true as const, totalPartos: partos.length, partos };
}
