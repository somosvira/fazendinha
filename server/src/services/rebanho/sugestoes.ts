// Sugestões do "Hoje" preditivo: único arquivo com I/O desta fatia. Reusa a
// varredura da Carteira (score + margem/dia por animal) e complementa com os
// campos de tendência/repro do ResumoAnimal e a contagem de mastites 12m EM LOTE.
// Delega a detecção/priorização ao calc puro (sugestoes.calc). Sem migration.

import { prisma } from "../../db.js";
import { getNumero } from "./parametros.js";
import { obterCarteira } from "./carteira.js";
import { recomputarQuartos, type Quarto } from "./quarto.recompute.js";
import { quartoCronicoMaisGrave } from "./exames-quarto.js";
import { montarSugestoes, type AnimalSugestao, type SugestoesDTO, type SugestaoDTO } from "./sugestoes.calc.js";

const PEV_DIAS_DEFAULT = 60; // idem ParametroManejo PEV_DIAS (fallback)
const toNum = (v: unknown): number => (v == null ? 0 : Number(v));

export type { SugestoesDTO, SugestaoDTO } from "./sugestoes.calc.js";

// Varre o pool e devolve o feed completo já ordenado. Reusável pelo Cockpit.
export async function obterSugestoes(propriedadeId: number | null): Promise<SugestoesDTO> {
  // 1) Base da Carteira: score + classificação + margem/dia + ccs + produção por animal.
  const carteira = await obterCarteira(propriedadeId);
  if (carteira.animais.length === 0) {
    return { sugestoes: [], totalPorTipo: { DESCARTE: 0, REPRODUCAO: 0, MASTITE: 0, QUEDA_PRODUCAO: 0 }, impactoDiaTotal: 0, precoLeite: carteira.precoLeite, custoVacaDia: carteira.custoVacaDia };
  }
  const ids = carteira.animais.map((a) => a.animalId);

  // 2) Campos extras do resumo (tendências, status repro, del) — uma query no pool.
  const resumos = await prisma.resumoAnimal.findMany({
    where: { animalId: { in: ids } },
    select: { animalId: true, ccsTendencia: true, producaoTendencia: true, statusReprodutivo: true, del: true, quartosCronicos: true },
  });
  const resumoPorId = new Map(resumos.map((r) => [r.animalId, r]));

  // 2b) Quarto crônico (sinal fino): só p/ animais com quartosCronicos>=1. Deriva qual quarto
  // via o mesmo calc puro, em lote (uma query de ExameQuarto). Sem cronicidade → mapa vazio.
  const idsCronicos = resumos.filter((r) => (r.quartosCronicos ?? 0) >= 1).map((r) => r.animalId);
  const quartoCronicoPorId = new Map<number, { quarto: string }>();
  if (idsCronicos.length) {
    const hoje = new Date().toISOString().slice(0, 10);
    const exs = await prisma.exameQuarto.findMany({ where: { animalId: { in: idsCronicos } } });
    const porAnimal = new Map<number, { quarto: Quarto; data: string; scoreCmt: any; ccs: number | null; clinica: boolean; perdido: boolean }[]>();
    for (const e of exs) {
      const arr = porAnimal.get(e.animalId) ?? [];
      arr.push({ quarto: e.quarto as Quarto, data: e.data.toISOString().slice(0, 10), scoreCmt: e.scoreCmt, ccs: e.ccs, clinica: e.clinica, perdido: e.perdido });
      porAnimal.set(e.animalId, arr);
    }
    for (const [animalId, lista] of porAnimal) {
      const cron = quartoCronicoMaisGrave(recomputarQuartos(lista, hoje).porQuarto);
      if (cron) quartoCronicoPorId.set(animalId, cron);
    }
  }

  // 3) Mastites 12m EM LOTE (uma query agregada; escopo transitivo via animal).
  const desde12m = new Date(); desde12m.setMonth(desde12m.getMonth() - 12);
  const mastitesRaw = await prisma.eventoSanitario.groupBy({
    by: ["animalId"],
    where: { tipo: "MASTITE", data: { gte: desde12m }, animalId: { in: ids } },
    _count: { _all: true },
  });
  const mastitesPorId = new Map<number, number>();
  for (const m of mastitesRaw) if (m.animalId != null) mastitesPorId.set(m.animalId, m._count._all);

  // 4) PEV configurado (parâmetro global).
  const pevDias = (await getNumero("PEV_DIAS")) ?? PEV_DIAS_DEFAULT;

  // 5) Materializa a entrada do calc e delega detecção/priorização.
  const animais: AnimalSugestao[] = carteira.animais.map((a) => {
    const r = resumoPorId.get(a.animalId);
    return {
      animalId: a.animalId, numero: a.numero, nome: a.nome,
      score: a.score, classificacao: a.classificacao,
      producaoDia: a.producaoDia, ccs: a.ccs,
      ccsTendencia: r?.ccsTendencia ?? null,
      producaoTendencia: r?.producaoTendencia ?? null,
      statusReprodutivo: r?.statusReprodutivo ?? null,
      del: r?.del ?? null,
      margemDiaEstimada: a.margemDiaEstimada,
      mastites12m: mastitesPorId.get(a.animalId) ?? 0,
      quartoCronico: quartoCronicoPorId.get(a.animalId) ?? null,
    };
  });

  return montarSugestoes(animais, { pevDias, precoLeite: toNum(carteira.precoLeite), custoVacaDia: carteira.custoVacaDia });
}
