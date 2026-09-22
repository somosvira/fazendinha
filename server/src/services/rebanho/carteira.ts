// Carteira do rebanho: o único arquivo do módulo com I/O. Faz UMA varredura do
// pool de vacas em lactação, resolve custo vaca/dia e sanidade/dia rateada EM LOTE
// (uma query por dimensão, não N), materializa score + margem por animal via os
// calc puros (score.calc + insights de custo) e delega a agregação/simulação para
// carteira.calc. Determinístico, sem ML, sem migration.

import { prisma } from "../../db.js";
import { getNumero, type ChaveParametro } from "./parametros.js";
import { calcularCustoVacaDia } from "../estoque/estoque.js";
import { scoreDoResumo } from "./score.calc.js";
import {
  agregarCarteira, simularDescarte as simularDescartePuro,
  type AnimalCarteira, type AgregadoCarteira, type SimulacaoDescarte,
} from "./carteira.calc.js";

const FALLBACK_PRECO_LEITE = 2.4; // R$/L quando Configuracao.precoLeite é NULL (idem insights.ts)

// Só VACA e CABRA produzem leite → têm meta de produção; as demais nunca entram
// no pool (filtramos por producaoMediaDia not null), mas o map cobre p/ segurança.
const CHAVE_META_PRODUCAO: Record<string, ChaveParametro | null> = {
  VACA: "PROD_META_VACA", CABRA: "PROD_META_CABRA",
  BEZERRA: null, NOVILHA: null, BEZERRO: null, TOURO: null,
  CABRITA: null, CABRITO: null, BODE: null,
};
const ESPECIE_POR_CATEGORIA: Record<string, "BOVINO" | "CAPRINO"> = {
  BEZERRA: "BOVINO", NOVILHA: "BOVINO", VACA: "BOVINO", BEZERRO: "BOVINO", TOURO: "BOVINO",
  CABRITA: "CAPRINO", CABRA: "CAPRINO", CABRITO: "CAPRINO", BODE: "CAPRINO",
};
const PRIME_BOVINO_DEFAULT = { min: 3, max: 7 };
const PRIME_CAPRINO_DEFAULT = { min: 2, max: 5 };

const toNum = (v: unknown): number => (v == null ? 0 : Number(v));
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

function idadeAnos(dataNascimento: Date | null, hoje: Date): number | null {
  if (!dataNascimento) return null;
  return (hoje.getTime() - dataNascimento.getTime()) / (365.25 * 24 * 3600 * 1000);
}

export interface CarteiraDTO extends AgregadoCarteira {
  animais: AnimalCarteira[];        // pool completo (a UI monta ranking/simulação a partir daqui se quiser)
  precoLeite: number;               // preço usado (config do rebanho), p/ transparência
  fontePreco: "config" | "fallback";
  custoVacaDia: number | null;      // custo médio usado (R$/dia)
}

export type { AnimalCarteira } from "./carteira.calc.js";
export type SimulacaoDescarteDTO = SimulacaoDescarte;

// Varre o pool e materializa score + margem/dia por animal. Reusável pela leitura
// da carteira e pela simulação (que recomputa a mesma base, mantendo consistência).
async function montarPool(propriedadeId: number | null): Promise<{
  animais: AnimalCarteira[];
  precoLeite: number;
  fontePreco: "config" | "fallback";
  custoVacaDia: number | null;
}> {
  const hoje = new Date();
  const escopoAnimal = propriedadeId == null ? {} : { propriedadeId };

  // 1) Pool: ATIVO com produção (vacas em lactação), escopado por propriedade.
  const animaisRaw = await prisma.animal.findMany({
    where: { status: "ATIVO", ...escopoAnimal, resumo: { producaoMediaDia: { not: null } } },
    select: {
      id: true, numero: true, nome: true, categoria: true, dataNascimento: true,
      resumo: {
        select: { producaoMediaDia: true, ccs: true, iepProjetado: true, statusReprodutivo: true, del: true },
      },
    },
  });

  // 2) Preço do leite (config global singleton, compartilhada entre sítios).
  const cfg = await prisma.configuracao.findUnique({ where: { id: 1 } });
  const precoLeite = cfg?.precoLeite != null ? toNum(cfg.precoLeite) : FALLBACK_PRECO_LEITE;
  const fontePreco: "config" | "fallback" = cfg?.precoLeite != null ? "config" : "fallback";

  // 3) custoVacaDia UMA vez (escopado). Wrapper já filtra saídas e vacas por sítio.
  const { custoVacaDia } = await calcularCustoVacaDia(30, propriedadeId);

  // 4) Metas/prime por espécie presente no pool — parâmetros globais, buscados uma vez.
  const especies = new Set(animaisRaw.map((a) => ESPECIE_POR_CATEGORIA[a.categoria] ?? "BOVINO"));
  const metaCache = new Map<string, number | null>();
  const primeCache = new Map<"BOVINO" | "CAPRINO", { min: number; max: number }>();
  for (const esp of especies) {
    const [primeMin, primeMax] = await Promise.all([
      getNumero(esp === "BOVINO" ? "PRIME_BOVINO_MIN" : "PRIME_CAPRINO_MIN"),
      getNumero(esp === "BOVINO" ? "PRIME_BOVINO_MAX" : "PRIME_CAPRINO_MAX"),
    ]);
    const def = esp === "BOVINO" ? PRIME_BOVINO_DEFAULT : PRIME_CAPRINO_DEFAULT;
    primeCache.set(esp, { min: primeMin ?? def.min, max: primeMax ?? def.max });
  }
  for (const chave of new Set(animaisRaw.map((a) => CHAVE_META_PRODUCAO[a.categoria]).filter(Boolean) as ChaveParametro[])) {
    metaCache.set(chave, await getNumero(chave));
  }

  // 5) Sanidade/dia rateada EM LOTE: total "Medicamento Animal" 12m ÷ aplicações globais
  //    12m = custo por aplicação; por animal = custoPorAplic × nº aplicações ÷ 365.
  const desde12m = new Date(hoje); desde12m.setMonth(hoje.getMonth() - 12);
  const escopoSanidade = propriedadeId == null ? {} : { animal: { propriedadeId } };
  const [lancsMedic, totalAplicsGlob, aplicsPorAnimal] = await Promise.all([
    prisma.transacaoFinanceira.findMany({
      where: { status: "CONFIRMADA", tipo: "PAGAMENTO", data: { gte: desde12m }, operacao: { categoria: { nome: "Medicamento Animal" } }, ...(propriedadeId != null ? { propriedadeId } : {}) },
      select: { valorTotal: true },
    }),
    prisma.eventoSanitario.count({ where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde12m }, ...escopoSanidade } }),
    prisma.eventoSanitario.groupBy({
      by: ["animalId"],
      where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde12m }, ...escopoSanidade },
      _count: { _all: true },
    }),
  ]);
  const totalMedic = lancsMedic.reduce((s, l) => s + toNum(l.valorTotal), 0);
  const custoPorAplic = totalAplicsGlob > 0 ? totalMedic / totalAplicsGlob : 0;
  const aplicsMap = new Map<number, number>();
  for (const g of aplicsPorAnimal) if (g.animalId != null) aplicsMap.set(g.animalId, g._count._all);

  // 6) Materializa score + margem/dia por animal.
  const animais: AnimalCarteira[] = animaisRaw.map((a) => {
    const resumo = a.resumo;
    const especie = ESPECIE_POR_CATEGORIA[a.categoria] ?? "BOVINO";
    const prime = primeCache.get(especie) ?? (especie === "BOVINO" ? PRIME_BOVINO_DEFAULT : PRIME_CAPRINO_DEFAULT);
    const chaveMeta = CHAVE_META_PRODUCAO[a.categoria];
    const meta = chaveMeta ? metaCache.get(chaveMeta) ?? null : null;

    const producaoDia = resumo?.producaoMediaDia != null ? toNum(resumo.producaoMediaDia) : null;
    const ccs = resumo?.ccs ?? null;

    // Margem/dia estimada (aproximação, rotulada): receita − custo vaca/dia − sanidade/dia.
    const sanidadeDia = round((custoPorAplic * (aplicsMap.get(a.id) ?? 0)) / 365);
    const receitaDia = (producaoDia ?? 0) * precoLeite;
    const margemDiaEstimada = round(receitaDia - (custoVacaDia ?? 0) - sanidadeDia);

    // Margem 0-1 p/ o fator Rentabilidade do score (proxy diário; null sem receita).
    const margemFrac = receitaDia > 0 ? round(margemDiaEstimada / receitaDia, 4) : null;

    const score = scoreDoResumo({
      producaoMediaDia: producaoDia ?? 0,
      metaProducao: meta,
      ccs,
      statusReprodutivo: resumo?.statusReprodutivo ?? null,
      iepProjetado: resumo?.iepProjetado ?? null,
      idadeAnos: idadeAnos(a.dataNascimento, hoje),
      prime,
      ocorrenciasRecentes: 0, // a carteira não puxa ocorrências por animal (varredura enxuta); a ficha traz isso
      margem: margemFrac,
    });

    return {
      animalId: a.id,
      numero: a.numero,
      nome: a.nome,
      score: score.valor,
      classificacao: score.classificacao,
      producaoDia,
      ccs,
      margemDiaEstimada,
    };
  });

  return { animais, precoLeite: round(precoLeite, 4), fontePreco, custoVacaDia };
}

export async function obterCarteira(propriedadeId: number | null): Promise<CarteiraDTO> {
  const { animais, precoLeite, fontePreco, custoVacaDia } = await montarPool(propriedadeId);
  const agregado = agregarCarteira(animais);
  return { ...agregado, animais, precoLeite, fontePreco, custoVacaDia };
}

// Stateless: recomputa a mesma base do pool internamente (não recebe a lista do
// cliente), garantindo consistência com obterCarteira.
export async function simularDescarteCarteira(propriedadeId: number | null, n: number): Promise<SimulacaoDescarteDTO> {
  const { animais } = await montarPool(propriedadeId);
  return simularDescartePuro(animais, n);
}
