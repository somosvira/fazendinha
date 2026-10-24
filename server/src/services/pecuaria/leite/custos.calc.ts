import { Prisma } from "@prisma/client";
import { resolverFinalidadeLeite, type FinalidadeContextoLeite, type BaixaFinalidadeContextoLeite } from "./finalidade.calc.js";
import { consolidarCustos, type ComponenteCusto } from "../custos/custos.calc.js";
import type { ResumoProducaoLeite } from "./producao.calc.js";

export interface PeriodoCustosLeite { inicio: string; fim: string }
interface RecorteCustosLeite { periodo: PeriodoCustosLeite; animalIds: string[] }
export interface EntradaCustosLeite extends RecorteCustosLeite {
  finalidades: (FinalidadeContextoLeite & { animalId: string })[];
  baixas?: (BaixaFinalidadeContextoLeite & { animalId: string })[];
  animaisFinalidadePendente?: string[];
  /** Componentes originais completos, antes da paginação e sem somar resumos de outras visões. */
  custos: RecorteCustosLeite & { componentes: ComponenteCusto[] };
  producao: RecorteCustosLeite & {
    animais: { animalId: string; producao: ResumoProducaoLeite }[];
    /** Filtro de uma ordenha impede custo/L até existir regra explícita de rateio. */
    posicaoId?: string;
  };
  verValores: boolean;
}
export type MotivoCustoLeite = "DIAS_SEM_FOLHA" | "PRODUCAO_INDIVIDUAL_PERIODICA" | "POPULACAO_GERAL_NAO_CONCILIADA" | "CUSTO_PENDENTE" | "PERIODO_CUSTO_PENDENTE" | "PRODUCAO_PARCIAL" | "SEM_VOLUME_POSITIVO" | "ORDENHA_SEM_RATEIO" | "FINALIDADE_CUSTO_PENDENTE" | "PERIODO_FINALIDADE_SEM_RATEIO" | "FINALIDADE_PRODUCAO_PENDENTE";
export interface ResumoCustosLeite {
  custos: ReturnType<typeof consolidarCustos>;
  producao: ResumoProducaoLeite;
  animaisSemComponentes: string[];
  custoPorLitro: string | null;
  situacao: "APURADO" | "NAO_APURADO" | "OCULTO";
  motivos: MotivoCustoLeite[];
}

function conferirPeriodo(periodo: PeriodoCustosLeite): void {
  for (const data of [periodo.inicio, periodo.fim]) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(data) ? new Date(`${data}T00:00:00.000Z`) : null;
    if (!d || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== data)
      throw new Error("Período de custo/produção inválido");
  }
  if (periodo.inicio > periodo.fim) throw new Error("Período de custo/produção invertido");
}
function conferirPopulacao(ids: string[], esperados: Set<string>): void {
  if (ids.length !== esperados.size || new Set(ids).size !== ids.length || ids.some(id => !esperados.has(id)))
    throw new Error("A população de custos e produção deve coincidir, sem duplicações");
}
function conferirProducao(producao: ResumoProducaoLeite): void {
  if (producao.litros !== null && (!Number.isFinite(producao.litros) || producao.litros < 0))
    throw new Error("Volume de produção inválido");
  const contadores = [producao.esperadas, producao.medidas, producao.naoOrdenhadas, producao.pendentes, producao.resolvidas];
  if (contadores.some(v => !Number.isSafeInteger(v) || v < 0) ||
    producao.resolvidas !== producao.medidas + producao.naoOrdenhadas ||
    producao.esperadas !== producao.resolvidas + producao.pendentes ||
    producao.completa !== (producao.esperadas > 0 && producao.pendentes === 0) ||
    (producao.medidas === 0) !== (producao.litros === null))
    throw new Error("Cobertura de produção inconsistente");
}
function somarProducao(animais: EntradaCustosLeite["producao"]["animais"]): ResumoProducaoLeite {
  const volumes = animais.flatMap(a => a.producao.litros === null ? [] : [a.producao.litros]);
  const somar = (campo: "esperadas" | "medidas" | "naoOrdenhadas" | "pendentes" | "resolvidas") => animais.reduce((s, a) => s + a.producao[campo], 0);
  return { litros: volumes.length ? volumes.reduce((s, v) => s.plus(v), new Prisma.Decimal(0)).toNumber() : null,
    esperadas: somar("esperadas"), medidas: somar("medidas"), naoOrdenhadas: somar("naoOrdenhadas"),
    pendentes: somar("pendentes"), resolvidas: somar("resolvidas"), completa: animais.length > 0 && animais.every(a => a.producao.completa) };
}

/**
 * Custo gerencial no período; nunca cria ou valoriza estoque.
 * O chamador garante autorização/sítio histórico e carrega todas as fontes pertinentes.
 * Nutrição exige o intervalo persistido: atravessar o recorte gera pendência, sem rateio.
 */
export function calcularCustosLeite(entrada: EntradaCustosLeite) {
  conferirPeriodo(entrada.periodo);
  const populacao = new Set(entrada.animalIds);
  conferirPopulacao(entrada.animalIds, populacao);
  for (const recorte of [entrada.custos, entrada.producao]) {
    conferirPeriodo(recorte.periodo);
    if (recorte.periodo.inicio !== entrada.periodo.inicio || recorte.periodo.fim !== entrada.periodo.fim)
      throw new Error("O período de custos e produção deve coincidir");
    conferirPopulacao(recorte.animalIds, populacao);
  }
  conferirPopulacao(entrada.producao.animais.map(a => a.animalId), populacao);
  entrada.producao.animais.forEach(a => conferirProducao(a.producao));
  // Uma periodização pendente não pode esconder preços divergentes na mesma origem.
  consolidarCustos(entrada.custos.componentes, false);
  const { inicio, fim } = entrada.periodo;
  const periodoPendente = new Set<string>();
  const finalidadePendente = new Set<string>();
  const finalidadeSemRateio = new Set<string>();
  const porAnimal = (animalId: string) => entrada.finalidades.filter(f => f.animalId === animalId);
  const proprietarios = new Map<string, string>();
  const componentes = entrada.custos.componentes.flatMap(c => {
    if (!populacao.has(c.animalId)) throw new Error("Componente fora da população consultada");
    const anterior = proprietarios.get(c.chave);
    if (anterior && anterior !== c.animalId) throw new Error("Mesma origem de custo atribuída a animais distintos");
    proprietarios.set(c.chave, c.animalId);
    conferirPeriodo({ inicio: c.data, fim: c.data });
    if (c.estado === "CONHECIDO" && (c.valor === null || !c.valor.isFinite() || c.valor.isNegative() || c.valor.decimalPlaces() > 2 || c.valor.gt("999999999999.99")))
      throw new Error("Componente monetário conhecido inválido");
    if (c.estado !== "CONHECIDO" && c.valor !== null) throw new Error("Componente monetário pendente com valor inconsistente");
    const vigencias = porAnimal(c.animalId);
    if (c.periodoConsumo) {
      const p = c.periodoConsumo;
      conferirPeriodo(p);
      if (p.fim < inicio || p.inicio > fim) return [];
      // Apenas interseções comprovadas são aproveitadas. Não distribui custo agregado por dias.
      let diasLeite = 0, diasOutros = 0, diasPendentes = 0;
      for (let t = Date.parse(p.inicio > inicio ? p.inicio : inicio); t <= Date.parse(p.fim < fim ? p.fim : fim); t += 86400000) {
        const f = resolverFinalidadeLeite(vigencias, new Date(t), entrada.baixas?.filter(b => b.animalId === c.animalId));
        if (f.elegivel) diasLeite++;
        else if (["FINALIDADE_AUSENTE", "FINALIDADE_CONFLITANTE"].includes(f.codigo)) diasPendentes++;
        else diasOutros++;
      }
      if (!diasLeite && !diasPendentes) return [];
      if (diasPendentes) finalidadePendente.add(c.animalId);
      if (diasOutros || diasPendentes) {
        finalidadeSemRateio.add(c.animalId);
        return [{ ...c, valor: null, estado: "DESCONHECIDO" as const }];
      }
    } else {
      if (c.data < inicio || c.data > fim) return [];
      const f = resolverFinalidadeLeite(vigencias, new Date(c.data), entrada.baixas?.filter(b => b.animalId === c.animalId));
      if (!f.elegivel) {
        if (!["FINALIDADE_AUSENTE", "FINALIDADE_CONFLITANTE"].includes(f.codigo)) return [];
        finalidadePendente.add(c.animalId);
        return [{ ...c, valor: null, estado: "DESCONHECIDO" as const }];
      }
    }
    if (c.tipoFonte === "NUTRICAO" || c.periodoConsumo) {
      const p = c.periodoConsumo;
      if (p) {
        conferirPeriodo(p);
        if (p.fim < inicio || p.inicio > fim) return [];
        if (p.inicio >= inicio && p.fim <= fim) return [c];
      }
      periodoPendente.add(c.animalId);
      return [{ ...c, valor: null, estado: "DESCONHECIDO" as const }];
    }
    return c.data >= inicio && c.data <= fim ? [c] : [];
  });

  function resumir(ids: string[], linhas: ComponenteCusto[], producao: ResumoProducaoLeite): ResumoCustosLeite {
    const base = consolidarCustos(linhas, entrada.verValores);
    const animaisComComponentes = new Set(linhas.map(c => c.animalId));
    const animaisSemComponentes = ids.filter(id => !animaisComComponentes.has(id));
    const cobertura = animaisSemComponentes.length && base.cobertura === "COMPLETO" ? "PARCIAL" : base.cobertura;
    const custos = { ...base, cobertura, situacao: entrada.verValores ? cobertura : "OCULTO" };
    const motivos: MotivoCustoLeite[] = [];
    if (cobertura !== "COMPLETO") motivos.push("CUSTO_PENDENTE");
    if (ids.some(id => periodoPendente.has(id))) motivos.push("PERIODO_CUSTO_PENDENTE");
    if (!producao.completa) motivos.push("PRODUCAO_PARCIAL");
    if (producao.litros === null || producao.litros <= 0) motivos.push("SEM_VOLUME_POSITIVO");
    if (entrada.producao.posicaoId) motivos.push("ORDENHA_SEM_RATEIO");
    if (ids.some(id => finalidadePendente.has(id))) motivos.push("FINALIDADE_CUSTO_PENDENTE");
    if (ids.some(id => finalidadeSemRateio.has(id))) motivos.push("PERIODO_FINALIDADE_SEM_RATEIO");
    if (ids.some(id => entrada.animaisFinalidadePendente?.includes(id))) motivos.push("FINALIDADE_PRODUCAO_PENDENTE");
    return { custos, producao, animaisSemComponentes,
      custoPorLitro: entrada.verValores && !motivos.length && custos.totalConhecido !== null && producao.litros !== null
        ? new Prisma.Decimal(custos.totalConhecido).div(producao.litros).toFixed(2) : null,
      situacao: !entrada.verValores ? "OCULTO" : motivos.length ? "NAO_APURADO" : "APURADO", motivos };
  }
  return { periodo: { ...entrada.periodo }, animalIds: [...entrada.animalIds], posicaoId: entrada.producao.posicaoId ?? null,
    animais: entrada.producao.animais.map(a => ({ animalId: a.animalId, ...resumir([a.animalId], componentes.filter(c => c.animalId === a.animalId), a.producao) })),
    consolidado: resumir(entrada.animalIds, componentes, somarProducao(entrada.producao.animais)) };
}
