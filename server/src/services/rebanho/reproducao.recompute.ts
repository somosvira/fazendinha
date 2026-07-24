export type TipoEvt = "CIO" | "INSEMINACAO" | "COBERTURA" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO" | "EXAME_GINECOLOGICO" | "DESMAME";
export interface EvtRepro {
  id?: number;
  tipo: TipoEvt;
  data: string;
  resultado?: string | null;
  dtPartoPrevista?: string | null;
  reprodutor?: string | null;
  protocolo?: string | null;
  motivoSecagem?: string | null;
}

export interface LactacaoEstrutural {
  id: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
  motivoSecagem: string | null;
}

export type OperacaoLactacao =
  | { tipo: "CRIAR"; numero: number; dtInicio: string }
  | { tipo: "ENCERRAR"; lactacaoId: number; dtFim: string; motivoSecagem: string | null }
  | { tipo: "REABRIR"; lactacaoId: number };

export type MutacaoEvento =
  | { tipo: "CRIACAO"; evento: EvtRepro }
  | { tipo: "EXCLUSAO"; evento: EvtRepro };

export class ConflitoLactacaoError extends Error {
  constructor(public code: "AMBIGUIDADE" | "SEM_LACTACAO_ABERTA", message: string) {
    super(message);
  }
}
// IA e TE são ambas "coberturas": geram gestação e definem o status INSEMINADA/PRENHE.
const ehCobertura = (t: TipoEvt) => t === "INSEMINACAO" || t === "COBERTURA" || t === "TRANSFERENCIA_EMBRIAO";
export interface Lact { numero: number; dtInicio: string; dtFim: string | null; }
export interface ResumoRepro {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null; ultimaInseminacao: string | null;
  protocoloAtual: string | null;
  diasGestacao: number | null; iepProjetado: number | null; previsaoSecagem: string | null;
}

export interface ParamsReproducao {
  pevDias?: number;
  gestacaoDias?: number;
  secagemAntec?: number;
}

const DEFAULT_PARAMS = { pevDias: 60, gestacaoDias: 283, secagemAntec: 60 } as const;

const MS = 86_400_000;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS);
const addDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * MS).toISOString().slice(0, 10);

export function planejarSincronizacaoLactacoes(
  persistidas: readonly LactacaoEstrutural[],
  mutacao: MutacaoEvento,
  numPartosEntrada = 0,
): OperacaoLactacao[] {
  const porInicio = new Map<string, LactacaoEstrutural[]>();
  for (const l of persistidas) porInicio.set(l.dtInicio, [...(porInicio.get(l.dtInicio) ?? []), l]);
  const duplicada = [...porInicio.entries()].find(([, rows]) => rows.length > 1);
  if (duplicada) throw new ConflitoLactacaoError("AMBIGUIDADE", `Mais de uma lactação começa em ${duplicada[0]}.`);

  const { evento } = mutacao;
  if (mutacao.tipo === "CRIACAO" && evento.tipo === "PARTO") {
    if (porInicio.has(evento.data)) return [];
    const maior = Math.max(numPartosEntrada, 0, ...persistidas.map((l) => l.numero));
    return [{ tipo: "CRIAR", numero: maior + 1, dtInicio: evento.data }];
  }
  if (mutacao.tipo === "CRIACAO" && evento.tipo === "SECAGEM") {
    const abertas = persistidas.filter((l) => l.dtFim == null).sort((a, b) =>
      b.dtInicio.localeCompare(a.dtInicio) || b.numero - a.numero || b.id - a.id,
    );
    if (!abertas.length) throw new ConflitoLactacaoError("SEM_LACTACAO_ABERTA", "O animal não possui lactação aberta para secar.");
    return [{ tipo: "ENCERRAR", lactacaoId: abertas[0].id, dtFim: evento.data, motivoSecagem: evento.motivoSecagem ?? null }];
  }
  if (mutacao.tipo === "EXCLUSAO" && evento.tipo === "SECAGEM") {
    const candidatas = persistidas
      .filter((l) => l.dtFim === evento.data && l.dtInicio <= evento.data)
      .sort((a, b) => b.dtInicio.localeCompare(a.dtInicio) || b.numero - a.numero || b.id - a.id);
    return candidatas.length ? [{ tipo: "REABRIR", lactacaoId: candidatas[0].id }] : [];
  }
  return [];
}

export function reconstruirLactacoes(eventos: EvtRepro[], numPartosEntrada: number): Lact[] {
  const ps = eventos.filter((e) => e.tipo === "PARTO" || e.tipo === "SECAGEM").slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data) || (a.id ?? 0) - (b.id ?? 0));
  const lacts: Lact[] = [];
  for (const e of ps) {
    if (e.tipo === "PARTO") lacts.push({ numero: numPartosEntrada + lacts.length + 1, dtInicio: e.data, dtFim: null });
    else { const aberta = [...lacts].reverse().find((l) => l.dtFim === null); if (aberta) aberta.dtFim = e.data; }
  }
  return lacts;
}

export function recomputarResumoReproducao(eventos: EvtRepro[], lactacoes: Lact[], numPartosEntrada: number, hoje: string, params: ParamsReproducao = {}): ResumoRepro {
  const PEV_DIAS      = params.pevDias      ?? DEFAULT_PARAMS.pevDias;
  const GESTACAO_DIAS = params.gestacaoDias ?? DEFAULT_PARAMS.gestacaoDias;
  const SECAGEM_ANTEC = params.secagemAntec ?? DEFAULT_PARAMS.secagemAntec;
  const evs = eventos.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data) || (a.id ?? 0) - (b.id ?? 0));
  const ultimo = (t: TipoEvt) => [...evs].reverse().find((e) => e.tipo === t) ?? null;
  const partos = evs.filter((e) => e.tipo === "PARTO");
  const ultimoParto = partos[partos.length - 1] ?? null;
  const lactAberta = lactacoes.find((l) => l.dtFim === null) ?? null;
  const ordemLactacao = lactacoes.length ? Math.max(...lactacoes.map((l) => l.numero)) : (numPartosEntrada || null);
  const del = lactAberta ? diff(lactAberta.dtInicio, hoje) : null;

  const ultimoDg = ultimo("DIAGNOSTICO");
  // A tabela de reprodução chama o campo de "última tentativa", portanto a data
  // canônica é a cobertura mais recente, seja inseminação artificial ou TE.
  const ultimaCobertura = [...evs].reverse().find((e) => ehCobertura(e.tipo)) ?? null;
  const partoAposDg = !!(ultimoDg && ultimoParto && Date.parse(ultimoParto.data) > Date.parse(ultimoDg.data));

  let status: ResumoRepro["statusReprodutivo"];
  if (ultimoDg && ultimoDg.resultado === "positivo" && !partoAposDg) status = "PRENHE";
  else if (ultimaCobertura && (!ultimoDg || Date.parse(ultimaCobertura.data) > Date.parse(ultimoDg.data))) status = "INSEMINADA";
  else if (del !== null && del < PEV_DIAS) status = "PEV";
  else status = "VAZIA";

  let diasGestacao: number | null = null, previsaoSecagem: string | null = null, iepProjetado: number | null = null;
  if (status === "PRENHE") {
    const iaConcep = [...evs].reverse().find((e) => ehCobertura(e.tipo) && Date.parse(e.data) <= Date.parse(ultimoDg!.data));
    const dtConcepcao = iaConcep?.data ?? addDias(ultimoDg!.data, -30);
    diasGestacao = diff(dtConcepcao, hoje);
    const dtPartoPrev = ultimoDg!.dtPartoPrevista ?? addDias(dtConcepcao, GESTACAO_DIAS);
    previsaoSecagem = addDias(dtPartoPrev, -SECAGEM_ANTEC);
    iepProjetado = ultimoParto ? diff(ultimoParto.data, dtPartoPrev) : null;
  } else if (partos.length >= 2) {
    const intervals = partos.slice(1).map((p, i) => diff(partos[i].data, p.data));
    iepProjetado = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
  }

  return {
    statusReprodutivo: status, del, ordemLactacao,
    ultimoDgData: ultimoDg?.data ?? null, ultimoDgResultado: ultimoDg?.resultado ?? null,
    ultimaInseminacao: ultimaCobertura?.data ?? null,
    protocoloAtual: ultimaCobertura?.protocolo ?? null,
    diasGestacao, iepProjetado, previsaoSecagem,
  };
}
