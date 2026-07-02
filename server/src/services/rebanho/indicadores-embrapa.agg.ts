// Agregador dos indicadores Embrapa: lê o estado real do banco e monta o DTO
// completo dos 24 indicadores com valor + semáforo + meta + observação.

import { prisma } from "../../db.js";
import * as ind from "./indicadores-embrapa.js";
import { getParametros, type ChaveParametro, type ParametroDTO } from "./parametros.js";

const isoOrNull = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);
const isoDate = (x: Date) => x.toISOString().slice(0, 10);
const toNum = (x: any) => (x != null ? Number(x) : 0);

export interface IndicadorDTO {
  id: string;
  numero: number;
  nome: string;
  categoria: "produtivo" | "reprodutivo" | "produtivo_reprodutivo" | "gestao" | "sanitario";
  valor: number | null;
  unidade: string;
  metaIdeal: number;
  metaAceitavel: number;
  direcao: "maior_melhor" | "menor_melhor";
  semaforo: ind.Semaforo | null;
  observacao?: string;
}

export interface RelatorioEmbrapaDTO {
  geradoEm: string;
  resumo: { verde: number; amarelo: number; vermelho: number; semDado: number };
  indicadores: IndicadorDTO[];
}

function mk(
  id: string,
  numero: number,
  nome: string,
  categoria: IndicadorDTO["categoria"],
  valor: number | null,
  unidade: string,
  meta: ind.MetaConfig,
  observacao?: string
): IndicadorDTO {
  return {
    id, numero, nome, categoria, valor, unidade,
    metaIdeal: meta.ideal, metaAceitavel: meta.aceitavel, direcao: meta.direcao,
    semaforo: ind.semaforo(valor, meta), observacao,
  };
}

// Resolve os parâmetros configuráveis (metas + pesos UA) — se o banco tiver
// override, usa; caso contrário cai no default Embrapa hardcoded no motor.
function resolveMeta(params: Map<ChaveParametro, ParametroDTO>, chave: ChaveParametro, fallback: ind.MetaConfig): ind.MetaConfig {
  const p = params.get(chave);
  if (!p || p.valorNumero == null || p.valorNumeroAceitavel == null || !p.direcao) return fallback;
  return { ideal: p.valorNumero, aceitavel: p.valorNumeroAceitavel, direcao: p.direcao };
}

function resolvePesos(params: Map<ChaveParametro, ParametroDTO>): Partial<Record<ind.CategoriaAnimal, number>> {
  const map: [ChaveParametro, ind.CategoriaAnimal][] = [
    ["PESO_REF_VACA", "VACA"], ["PESO_REF_TOURO", "TOURO"], ["PESO_REF_NOVILHA", "NOVILHA"],
    ["PESO_REF_BEZERRA", "BEZERRA"], ["PESO_REF_BEZERRO", "BEZERRO"],
    ["PESO_REF_CABRA", "CABRA"], ["PESO_REF_BODE", "BODE"],
    ["PESO_REF_CABRITA", "CABRITA"], ["PESO_REF_CABRITO", "CABRITO"],
  ];
  const out: Partial<Record<ind.CategoriaAnimal, number>> = {};
  for (const [chave, cat] of map) {
    const v = params.get(chave)?.valorNumero;
    if (v != null) out[cat] = v;
  }
  return out;
}

export async function montarRelatorioEmbrapa(): Promise<RelatorioEmbrapaDTO> {
  // ── Parâmetros configuráveis ──────────────────────────────────────────────
  const paramsMap = new Map((await getParametros()).map((p) => [p.chave, p]));
  const meta = (chave: ChaveParametro, fallback: ind.MetaConfig) => resolveMeta(paramsMap, chave, fallback);
  const pesosOverride = resolvePesos(paramsMap);
  const uaRefKg = paramsMap.get("PESO_UA_REF_KG")?.valorNumero ?? ind.UA_REF_KG_DEFAULT;

  // ── Carga única do banco ──────────────────────────────────────────────────
  const [animaisRaw, eventosRepro, lactacoesRaw, controlesRaw, movRacao] = await Promise.all([
    prisma.animal.findMany({ include: { resumo: true } }),
    prisma.eventoReprodutivo.findMany({}),
    prisma.lactacao.findMany({}),
    prisma.controleLeiteiro.findMany({}),
    prisma.movimentoEstoque.findMany({
      where: { tipo: "SAIDA", produto: { tipo: "RACAO" }, data: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    }),
  ]);

  // ── Normalização para os tipos puros ──────────────────────────────────────
  const animais: ind.AnimalIn[] = animaisRaw.map((a) => ({
    id: a.id,
    categoria: a.categoria as ind.CategoriaAnimal,
    dataNascimento: isoOrNull(a.dataNascimento),
    dataEntrada: isoDate(a.dataEntrada),
    status: a.status as "ATIVO" | "BAIXADO",
    dataBaixa: isoOrNull(a.dataBaixa),
    motivoBaixa: a.motivoBaixa,
    resumo: a.resumo
      ? {
          statusReprodutivo: a.resumo.statusReprodutivo as ind.StatusReprodutivo,
          del: a.resumo.del,
        }
      : null,
  }));

  const partos: ind.PartoIn[] = eventosRepro
    .filter((e) => e.tipo === "PARTO")
    .map((e) => ({
      animalId: e.animalId,
      data: isoDate(e.data),
      numCrias: e.numCrias,
      // Campos schema-futuro (criasVivas/criasNatimortas) — quando existirem,
      // ler de e.criasVivas. Por ora, assume numCrias = nascidos vivos (limite superior).
      criasVivas: e.numCrias,
      criasNatimortas: 0,
    }));

  const inseminacoes: ind.InseminacaoIn[] = eventosRepro
    .filter((e) => e.tipo === "INSEMINACAO")
    .map((e) => ({ animalId: e.animalId, data: isoDate(e.data) }));

  const diagnosticos: ind.DiagnosticoIn[] = eventosRepro
    .filter((e) => e.tipo === "DIAGNOSTICO" && (e.resultado === "positivo" || e.resultado === "negativo"))
    .map((e) => ({
      animalId: e.animalId,
      data: isoDate(e.data),
      resultado: e.resultado as "positivo" | "negativo",
    }));

  // Aborto ainda não existe no enum — array vazio até schema ser estendido.
  const abortos: ind.AbortoIn[] = [];

  const lactacoes: ind.LactacaoIn[] = lactacoesRaw.map((l) => ({
    animalId: l.animalId,
    numero: l.numero,
    dtInicio: isoDate(l.dtInicio),
    dtFim: isoOrNull(l.dtFim),
  }));

  const controles: ind.ControleIn[] = controlesRaw.map((c) => ({
    animalId: c.animalId,
    data: isoDate(c.data),
    pesoTotal: toNum(c.pesoTotal),
  }));

  // Produção média/vaca/dia já calculada em ResumoAnimal
  const produtos = new Map<number, number>(
    animaisRaw
      .filter((a) => a.resumo?.producaoMediaDia != null)
      .map((a) => [a.id, toNum(a.resumo!.producaoMediaDia)])
  );
  const ccsPorAnimal = animaisRaw.map((a) => a.resumo?.ccs ?? null);

  // ── Métricas auxiliares ───────────────────────────────────────────────────
  const vacasAtivas = animais.filter((a) => a.categoria === "VACA" && a.status === "ATIVO").length;
  const litrosDiaFazenda = [...produtos.values()].reduce((s, v) => s + v, 0);
  const litrosAnoEstimado = Math.round(litrosDiaFazenda * 365);
  const kgRacaoAno = movRacao.reduce((s, m) => s + toNum(m.quantidade), 0); // assume unidade kg
  const uaTotal = ind.calcularUA(animais.filter((a) => a.status === "ATIVO"), pesosOverride, uaRefKg);

  // Média da produção por lactação: itera lactações e tira a média dos kg reais.
  const prodsPorLact = lactacoes
    .map((l) => ind.producaoPorLactacao(controles.filter((c) => c.animalId === l.animalId), l))
    .filter((x): x is { kg: number; modo: "real" | "projetada" } => x != null);
  const producaoLactacaoMediaKg =
    prodsPorLact.length > 0
      ? Math.round(prodsPorLact.reduce((s, p) => s + p.kg, 0) / prodsPorLact.length)
      : null;

  // Persistência média do rebanho
  const persistencias = lactacoes
    .map((l) => ind.persistenciaLactacao(controles.filter((c) => c.animalId === l.animalId), l.dtInicio))
    .filter((x): x is number => x != null);
  const persistenciaMedia =
    persistencias.length > 0
      ? Math.round((persistencias.reduce((s, p) => s + p, 0) / persistencias.length) * 10) / 10
      : null;

  const ipReal = ind.intervaloPartosMedio(partos);

  const ccsAgg = ind.ccsRebanho(ccsPorAnimal);

  // ── Indicadores ───────────────────────────────────────────────────────────
  const indicadores: IndicadorDTO[] = [
    mk("VL", 1, "% Vacas em Lactação", "produtivo",
       ind.pctVacasEmLactacao(animais), "%", meta("META_VL", ind.METAS_EMBRAPA.pctVacasEmLactacao)),

    mk("DL", 2, "Duração da Lactação", "produtivo",
       ind.duracaoLactacaoMedia(lactacoes), "dias", meta("META_DL", ind.METAS_EMBRAPA.duracaoLactacao)),

    mk("PERS", 3, "Persistência da Lactação", "produtivo",
       persistenciaMedia, "%", meta("META_PERS", ind.METAS_EMBRAPA.persistencia),
       persistenciaMedia == null ? "Requer ≥4 controles por lactação com pico identificado." : undefined),

    mk("PVO", 4, "Produção por Vaca Ordenhada", "produtivo",
       ind.producaoPorVacaOrdenhada(animais, produtos), "L/vaca/dia", meta("META_PVO", ind.METAS_EMBRAPA.pvo)),

    mk("PL", 5, "Produção por Lactação", "produtivo",
       producaoLactacaoMediaKg, "kg/lactação", meta("META_PL", ind.METAS_EMBRAPA.producaoLactacao)),

    mk("PS_DRY", 6, "Período Seco", "produtivo",
       ind.periodoSecoMedio(lactacoes, partos), "dias", meta("META_PS_DRY", ind.METAS_EMBRAPA.periodoSeco)),

    mk("IP", 7, "Intervalo de Partos (real)", "reprodutivo",
       ipReal, "dias", meta("META_IP", ind.METAS_EMBRAPA.ip),
       ipReal == null ? "Requer ≥2 partos por vaca registrados no sistema." : undefined),

    mk("PS", 8, "Período de Serviço", "reprodutivo",
       ind.periodoServicoMedio(partos, inseminacoes, diagnosticos), "dias", meta("META_PS", ind.METAS_EMBRAPA.ps)),

    mk("PRENH", 9, "% Prenhez do Rebanho", "reprodutivo",
       ind.pctPrenhez(animais), "%", meta("META_PRENH", ind.METAS_EMBRAPA.pctPrenhez)),

    mk("PR1S", 10, "% Prenhez ao 1º Serviço", "reprodutivo",
       ind.pctPrenhezPrimeiroServico(partos, inseminacoes, diagnosticos), "%", meta("META_PR1S", ind.METAS_EMBRAPA.pctPrenhez1Serv)),

    mk("TG", 11, "Taxa de Gestação", "reprodutivo",
       ind.taxaGestacao(inseminacoes, diagnosticos), "%", meta("META_TG", ind.METAS_EMBRAPA.taxaGestacao)),

    mk("IPP", 12, "Idade ao 1º Parto", "reprodutivo",
       ind.idadePrimeiroPartoMedia(
         animaisRaw.map((a) => ({ id: a.id, dataNascimento: isoOrNull(a.dataNascimento), numPartosEntrada: a.numPartosEntrada })),
         partos
       ), "meses", meta("META_IPP", ind.METAS_EMBRAPA.ipp)),

    mk("NAT", 13, "Taxa de Natalidade", "reprodutivo",
       ind.taxaNatalidade(partos, vacasAtivas, 365), "%", meta("META_NAT", ind.METAS_EMBRAPA.natalidade)),

    mk("AB", 14, "Taxa de Abortos e Natimortos", "reprodutivo",
       ind.taxaAbortosNatimortos(partos, abortos)?.combinada ?? null,
       "%", meta("META_AB", ind.METAS_EMBRAPA.abortos),
       "Schema ainda não tem evento ABORTO nem campo criasNatimortas em PARTO — valor parcial."),

    mk("PDIP", 15, "PDIP — Produção / dia de IEP", "produtivo_reprodutivo",
       ind.pdip(producaoLactacaoMediaKg, ipReal), "kg/dia", meta("META_PDIP", ind.METAS_EMBRAPA.pdip)),

    mk("PLVA", 16, "PLVA — Produção por Vaca/Ano", "produtivo_reprodutivo",
       ind.plva(producaoLactacaoMediaKg, ipReal), "kg/vaca/ano", meta("META_PLVA", ind.METAS_EMBRAPA.plva)),

    mk("LOT", 17, "Taxa de Lotação", "gestao",
       null, "UA/ha", meta("META_LOT", ind.METAS_EMBRAPA.lotacao),
       `Schema não tem areaPastagemHa. UA do rebanho ativo = ${uaTotal} (referência: 1 UA = 450 kg).`),

    mk("PT", 18, "Produtividade da Terra", "gestao",
       null, "L/ha/ano", meta("META_PT", ind.METAS_EMBRAPA.produtividadeTerra),
       `Schema não tem areaPastagemHa. Produção anual estimada = ${litrosAnoEstimado} L/ano.`),

    mk("PMO", 19, "Produtividade da Mão de Obra", "gestao",
       null, "L/funcionário/dia", meta("META_PMO", ind.METAS_EMBRAPA.produtividadeMO),
       `Schema não tem modelo Funcionario. Produção diária estimada = ${Math.round(litrosDiaFazenda)} L/d.`),

    mk("LC", 20, "Relação Leite / Concentrado", "gestao",
       ind.relacaoLeiteConcentrado(litrosAnoEstimado, kgRacaoAno), "L/kg",
       meta("META_LC", ind.METAS_EMBRAPA.leiteConcentrado),
       kgRacaoAno === 0 ? "Sem movimento de estoque de ração nos últimos 365d." : undefined),

    mk("DESC", 21, "Taxa de Descarte", "gestao",
       ind.taxaDescarte(animais, 365), "%/ano", meta("META_DESC", ind.METAS_EMBRAPA.taxaDescarte),
       "Heurística sobre motivoBaixa textual — categorização exata exige enum MotivoBaixa."),

    mk("MORT_AD", 22, "Mortalidade de Adultos", "sanitario",
       ind.mortalidadeAdultos(animais, 365), "%/ano", meta("META_MORT_AD", ind.METAS_EMBRAPA.mortAdultos),
       "Heurística sobre motivoBaixa textual."),

    mk("MORT_BEZ", 23, "Mortalidade de Bezerros (até 1 ano)", "sanitario",
       ind.mortalidadeBezerros(animais, 365), "%/ano", meta("META_MORT_BEZ", ind.METAS_EMBRAPA.mortBezerros),
       "Heurística sobre motivoBaixa textual."),

    mk("CCS", 24, "CCS — Contagem de Células Somáticas", "sanitario",
       ccsAgg.media, "mil/mL", meta("META_CCS", ind.METAS_EMBRAPA.ccs),
       ccsAgg.pctAlto != null ? `${ccsAgg.pctAlto}% com CCS ≥ 400 mil/mL; ${ccsAgg.pctCritico}% ≥ 750.` : undefined),
  ];

  const resumo = indicadores.reduce(
    (acc, i) => {
      if (i.semaforo === "verde") acc.verde++;
      else if (i.semaforo === "amarelo") acc.amarelo++;
      else if (i.semaforo === "vermelho") acc.vermelho++;
      else acc.semDado++;
      return acc;
    },
    { verde: 0, amarelo: 0, vermelho: 0, semDado: 0 }
  );

  return {
    geradoEm: new Date().toISOString(),
    resumo,
    indicadores,
  };
}
