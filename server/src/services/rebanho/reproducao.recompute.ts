export type TipoEvt = "CIO" | "INSEMINACAO" | "DIAGNOSTICO" | "PARTO" | "SECAGEM" | "TRANSFERENCIA_EMBRIAO";
export interface EvtRepro { tipo: TipoEvt; data: string; resultado?: string | null; dtPartoPrevista?: string | null; reprodutor?: string | null; }
// IA e TE são ambas "coberturas": geram gestação e definem o status INSEMINADA/PRENHE.
const ehCobertura = (t: TipoEvt) => t === "INSEMINACAO" || t === "TRANSFERENCIA_EMBRIAO";
export interface Lact { numero: number; dtInicio: string; dtFim: string | null; }
export interface ResumoRepro {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null; ultimaInseminacao: string | null;
  diasGestacao: number | null; iepProjetado: number | null; previsaoSecagem: string | null;
}

const PEV_DIAS = 60, GESTACAO_DIAS = 283, SECAGEM_ANTEC = 60, MS = 86_400_000;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS);
const addDias = (iso: string, n: number) => new Date(Date.parse(iso) + n * MS).toISOString().slice(0, 10);

export function reconstruirLactacoes(eventos: EvtRepro[], numPartosEntrada: number): Lact[] {
  const ps = eventos.filter((e) => e.tipo === "PARTO" || e.tipo === "SECAGEM").slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  const lacts: Lact[] = [];
  for (const e of ps) {
    if (e.tipo === "PARTO") lacts.push({ numero: numPartosEntrada + lacts.length + 1, dtInicio: e.data, dtFim: null });
    else { const aberta = [...lacts].reverse().find((l) => l.dtFim === null); if (aberta) aberta.dtFim = e.data; }
  }
  return lacts;
}

export function recomputarResumoReproducao(eventos: EvtRepro[], lactacoes: Lact[], numPartosEntrada: number, hoje: string): ResumoRepro {
  const evs = eventos.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  const ultimo = (t: TipoEvt) => [...evs].reverse().find((e) => e.tipo === t) ?? null;
  const partos = evs.filter((e) => e.tipo === "PARTO");
  const ultimoParto = partos[partos.length - 1] ?? null;
  const lactAberta = lactacoes.find((l) => l.dtFim === null) ?? null;
  const ordemLactacao = lactacoes.length ? Math.max(...lactacoes.map((l) => l.numero)) : (numPartosEntrada || null);
  const del = lactAberta ? diff(lactAberta.dtInicio, hoje) : null;

  const ultimoDg = ultimo("DIAGNOSTICO");
  const ultimaIa = ultimo("INSEMINACAO"); // usado só no campo ultimaInseminacao do read-model
  const ultimaCobertura = [...evs].reverse().find((e) => ehCobertura(e.tipo)) ?? null; // IA ou TE
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
    ultimaInseminacao: ultimaIa?.data ?? null, diasGestacao, iepProjetado, previsaoSecagem,
  };
}
