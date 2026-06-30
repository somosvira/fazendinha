// Motor puro dos 24 indicadores zootécnicos Embrapa (gado de leite).
// Cada função recebe os dados crus já normalizados e devolve número ou null.
// Sem dependência do Prisma — o agregador (indicadores-embrapa.agg.ts) faz a ponte.

const MS = 86_400_000;
const DIAS_ANO = 365;
const DIAS_MES = 30;

const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / MS);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ─────────────────────────────────────────────────────────────────────────────
// Tipos compartilhados
// ─────────────────────────────────────────────────────────────────────────────

export type StatusReprodutivo = "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
export type CategoriaAnimal =
  | "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO"
  | "CABRITA" | "CABRA" | "CABRITO" | "BODE";

export interface AnimalIn {
  id: number;
  categoria: CategoriaAnimal;
  dataNascimento: string | null;
  dataEntrada: string;
  status: "ATIVO" | "BAIXADO";
  dataBaixa: string | null;
  motivoBaixa: string | null;
  resumo: { statusReprodutivo: StatusReprodutivo; del: number | null } | null;
}

export interface PartoIn {
  animalId: number;
  data: string;
  numCrias: number | null;
  criasVivas?: number | null;       // schema futuro (opcional)
  criasNatimortas?: number | null;  // schema futuro (opcional)
}

export interface InseminacaoIn {
  animalId: number;
  data: string;
}

export interface DiagnosticoIn {
  animalId: number;
  data: string;
  resultado: "positivo" | "negativo";
}

export interface AbortoIn {
  animalId: number;
  data: string;
}

export interface SecagemIn {
  animalId: number;
  data: string;
}

export interface LactacaoIn {
  animalId: number;
  numero: number;
  dtInicio: string;
  dtFim: string | null;
}

export interface ControleIn {
  animalId: number;
  data: string;
  pesoTotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. % Vacas em Lactação (%VL)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: vacas em lactação ÷ (vacas em lactação + vacas secas) × 100
// Meta Embrapa: ≥ 83% (alto desempenho); 75-83% (médio).

export function pctVacasEmLactacao(animais: AnimalIn[]): number | null {
  const vacas = animais.filter((a) => a.categoria === "VACA" && a.status === "ATIVO");
  if (vacas.length === 0) return null;
  const emLact = vacas.filter((a) => a.resumo?.del != null).length;
  return round1((emLact / vacas.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Duração da Lactação (DL)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: média (dtFim − dtInicio) em dias para lactações fechadas.
// Meta Embrapa: ~305 dias (padrão); aceitável 270-310.

export function duracaoLactacaoMedia(lactacoes: LactacaoIn[]): number | null {
  const fechadas = lactacoes.filter((l) => l.dtFim);
  if (fechadas.length === 0) return null;
  const dias = fechadas.map((l) => diff(l.dtInicio, l.dtFim!));
  return Math.round(avg(dias));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Persistência da Lactação
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: (produção média entre dias 60-90 ÷ produção do pico) × 100
// Pico costuma cair entre dias 30-60 do parto. Meta Embrapa: ≥ 90% mensal
// (queda ≤10% mês a mês após o pico).
// Recebe os controles leiteiros JÁ FILTRADOS para uma única lactação.

export function persistenciaLactacao(
  controles: ControleIn[],
  dtInicioLactacao: string
): number | null {
  if (controles.length < 4) return null;
  const comDel = controles.map((c) => ({
    del: diff(dtInicioLactacao, c.data),
    peso: c.pesoTotal,
  }));
  const pico = Math.max(...comDel.filter((c) => c.del >= 15 && c.del <= 90).map((c) => c.peso));
  const pos = comDel.filter((c) => c.del >= 60 && c.del <= 120).map((c) => c.peso);
  if (!isFinite(pico) || pico === 0 || pos.length === 0) return null;
  return round1((avg(pos) / pico) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Produção por Vaca Ordenhada (PVO)
// ─────────────────────────────────────────────────────────────────────────────
// Já existe em ResumoAnimal.producaoMediaDia (média móvel últimos 3 controles).
// Aqui devolvemos a média de fazenda (L/vaca em lactação/dia).
// Meta Embrapa: ≥ 18 L/d (intensivo); 10-18 L/d (médio).

export function producaoPorVacaOrdenhada(animais: AnimalIn[], producoesMediaDia: Map<number, number>): number | null {
  const emLact = animais.filter((a) => a.categoria === "VACA" && a.resumo?.del != null);
  if (emLact.length === 0) return null;
  const valores = emLact
    .map((a) => producoesMediaDia.get(a.id))
    .filter((x): x is number => x != null && x > 0);
  if (valores.length === 0) return null;
  return round1(avg(valores));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Produção por Lactação (real)
// ─────────────────────────────────────────────────────────────────────────────
// Soma dos controles leiteiros de uma lactação fechada.
// Para lactação aberta: extrapola (média × dias previstos até 305).
// Meta Embrapa: ≥ 5.500 kg/lactação (intensivo); 3.000-5.500 kg (médio).

export function producaoPorLactacao(
  controles: ControleIn[],
  lactacao: LactacaoIn
): { kg: number; modo: "real" | "projetada" } | null {
  if (controles.length === 0) return null;
  const dela = controles.filter(
    (c) =>
      Date.parse(c.data) >= Date.parse(lactacao.dtInicio) &&
      (!lactacao.dtFim || Date.parse(c.data) <= Date.parse(lactacao.dtFim))
  );
  if (dela.length === 0) return null;

  // Cada controle é pesoTotal do DIA. Para a soma da lactação, multiplicamos
  // pelo intervalo até o próximo controle (regra do trapézio simplificada).
  const ord = dela.slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
  let acumulado = 0;
  for (let i = 0; i < ord.length; i++) {
    const proximo = ord[i + 1]?.data ?? lactacao.dtFim ?? null;
    const intervalo = proximo ? diff(ord[i].data, proximo) : 1;
    acumulado += ord[i].pesoTotal * Math.max(1, intervalo);
  }
  return {
    kg: Math.round(acumulado),
    modo: lactacao.dtFim ? "real" : "projetada",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Período Seco
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: data do próximo parto − data da secagem (em dias).
// Meta Embrapa: 60 dias (ideal); aceitável 45-70.

export function periodoSecoMedio(
  lactacoes: LactacaoIn[],
  partos: PartoIn[]
): number | null {
  const fechadas = lactacoes.filter((l) => l.dtFim).slice().sort((a, b) => Date.parse(a.dtFim!) - Date.parse(b.dtFim!));
  if (fechadas.length === 0) return null;
  const intervalos: number[] = [];
  for (const lact of fechadas) {
    const proxParto = partos
      .filter((p) => p.animalId === lact.animalId && Date.parse(p.data) > Date.parse(lact.dtFim!))
      .sort((a, b) => Date.parse(a.data) - Date.parse(b.data))[0];
    if (proxParto) intervalos.push(diff(lact.dtFim!, proxParto.data));
  }
  if (intervalos.length === 0) return null;
  return Math.round(avg(intervalos));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Intervalo de Partos (IP) — REAL (não projetado)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: média de (parto[n+1].data − parto[n].data) por vaca, em dias.
// Considera apenas vacas com ≥ 2 partos. Meta Embrapa: ≤ 395 dias (~13 meses).

export function intervaloPartosMedio(partos: PartoIn[]): number | null {
  const porAnimal = new Map<number, string[]>();
  for (const p of partos) {
    if (!porAnimal.has(p.animalId)) porAnimal.set(p.animalId, []);
    porAnimal.get(p.animalId)!.push(p.data);
  }
  const todos: number[] = [];
  for (const datas of porAnimal.values()) {
    if (datas.length < 2) continue;
    const ord = datas.slice().sort();
    for (let i = 1; i < ord.length; i++) todos.push(diff(ord[i - 1], ord[i]));
  }
  if (todos.length === 0) return null;
  return Math.round(avg(todos));
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Período de Serviço (PS) / Dias em Aberto
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: data da concepção (= IA do DG+) − data do parto anterior, em dias.
// Para vacas vazias: dias desde o parto até hoje (parcialmente conhecido).
// Meta Embrapa: ≤ 120 dias.

export function periodoServicoMedio(
  partos: PartoIn[],
  inseminacoes: InseminacaoIn[],
  diagnosticos: DiagnosticoIn[]
): number | null {
  const intervalos: number[] = [];
  // Por animal, parear: PARTO → próxima IA que tem DG positivo seguido.
  const porAnimal = new Set<number>([
    ...partos.map((p) => p.animalId),
    ...inseminacoes.map((i) => i.animalId),
    ...diagnosticos.map((d) => d.animalId),
  ]);
  for (const animalId of porAnimal) {
    const ps = partos.filter((p) => p.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    const ias = inseminacoes.filter((i) => i.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    const dgs = diagnosticos.filter((d) => d.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    for (const parto of ps) {
      const iasDepois = ias.filter((i) => Date.parse(i.data) > Date.parse(parto.data));
      for (const ia of iasDepois) {
        // pega o DG mais próximo (em ordem cronológica) dentro de 90d da IA
        const dgDela = dgs.find(
          (d) =>
            Date.parse(d.data) > Date.parse(ia.data) &&
            Date.parse(d.data) <= Date.parse(ia.data) + 90 * MS
        );
        if (dgDela?.resultado === "positivo") {
          intervalos.push(diff(parto.data, ia.data));
          break;
        }
      }
    }
  }
  if (intervalos.length === 0) return null;
  return Math.round(avg(intervalos));
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. % Prenhez do rebanho
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: vacas PRENHE ÷ vacas (excluindo machos/bezerros) × 100
// Meta Embrapa: ≥ 85% das vacas aptas; rebanho geral ≥ 60%.

export function pctPrenhez(animais: AnimalIn[]): number | null {
  const elegiveis = animais.filter(
    (a) => a.status === "ATIVO" && (a.categoria === "VACA" || a.categoria === "NOVILHA" || a.categoria === "CABRA")
  );
  if (elegiveis.length === 0) return null;
  const prenhes = elegiveis.filter((a) => a.resumo?.statusReprodutivo === "PRENHE").length;
  return round1((prenhes / elegiveis.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. % Prenhez ao 1º Serviço (Taxa de Concepção ao 1º Serviço)
// ─────────────────────────────────────────────────────────────────────────────
// Por animal: identificar a 1ª IA pós-parto e ver se gerou DG+.
// Meta Embrapa: ≥ 40%; ideal ≥ 50%.

export function pctPrenhezPrimeiroServico(
  partos: PartoIn[],
  inseminacoes: InseminacaoIn[],
  diagnosticos: DiagnosticoIn[]
): number | null {
  const todos = new Set<number>([
    ...partos.map((p) => p.animalId),
    ...inseminacoes.map((i) => i.animalId),
  ]);
  let totalCiclos = 0;
  let prenhesPrimeira = 0;
  for (const animalId of todos) {
    const ps = partos.filter((p) => p.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    const ias = inseminacoes.filter((i) => i.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    const dgs = diagnosticos.filter((d) => d.animalId === animalId).slice().sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
    for (let i = 0; i < ps.length; i++) {
      const parto = ps[i];
      const proxParto = ps[i + 1];
      const primeiraIa = ias.find(
        (ia) =>
          Date.parse(ia.data) > Date.parse(parto.data) &&
          (!proxParto || Date.parse(ia.data) < Date.parse(proxParto.data))
      );
      if (!primeiraIa) continue;
      totalCiclos++;
      const dgDela = dgs.find(
        (d) =>
          Date.parse(d.data) > Date.parse(primeiraIa.data) &&
          Date.parse(d.data) <= Date.parse(primeiraIa.data) + 90 * MS
      );
      if (dgDela?.resultado === "positivo") prenhesPrimeira++;
    }
  }
  if (totalCiclos === 0) return null;
  return round1((prenhesPrimeira / totalCiclos) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. Taxa de Gestação (% de IAs que resultaram em prenhez)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: DG+ ÷ total de IAs com DG no período × 100
// Meta Embrapa: ≥ 40%.

export function taxaGestacao(
  inseminacoes: InseminacaoIn[],
  diagnosticos: DiagnosticoIn[]
): number | null {
  let iaComDg = 0;
  let iaComDgPos = 0;
  for (const ia of inseminacoes) {
    const dg = diagnosticos.find(
      (d) =>
        d.animalId === ia.animalId &&
        Date.parse(d.data) > Date.parse(ia.data) &&
        Date.parse(d.data) <= Date.parse(ia.data) + 90 * MS
    );
    if (!dg) continue;
    iaComDg++;
    if (dg.resultado === "positivo") iaComDgPos++;
  }
  if (iaComDg === 0) return null;
  return round1((iaComDgPos / iaComDg) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. Idade ao 1º Parto (IPP)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: data do 1º parto − data de nascimento, em meses.
// IGNORA animais com numPartosEntrada > 0 (parto anterior à fazenda).
// Meta Embrapa: 22-26 meses.

export function idadePrimeiroPartoMedia(
  animais: { id: number; dataNascimento: string | null; numPartosEntrada: number }[],
  partos: PartoIn[]
): number | null {
  const meses: number[] = [];
  for (const a of animais) {
    if (!a.dataNascimento || a.numPartosEntrada > 0) continue;
    const ps = partos.filter((p) => p.animalId === a.id).slice().sort((x, y) => Date.parse(x.data) - Date.parse(y.data));
    if (ps.length === 0) continue;
    meses.push(diff(a.dataNascimento, ps[0].data) / DIAS_MES);
  }
  if (meses.length === 0) return null;
  return round1(avg(meses));
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. Taxa de Natalidade
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: bezerros nascidos vivos no período ÷ média de vacas × 100
// Meta Embrapa: ≥ 80%.
// Se criasVivas não estiver preenchido, cai para numCrias (limite superior).

export function taxaNatalidade(
  partos: PartoIn[],
  mediaVacas: number,
  diasPeriodo: number = DIAS_ANO
): number | null {
  if (mediaVacas <= 0) return null;
  const partosPeriodo = partos.filter(
    (p) => Date.parse(p.data) >= Date.now() - diasPeriodo * MS
  );
  const nascidos = partosPeriodo.reduce(
    (s, p) => s + (p.criasVivas ?? p.numCrias ?? 1),
    0
  );
  const fator = DIAS_ANO / diasPeriodo;
  return round1(((nascidos * fator) / mediaVacas) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. Taxa de Abortos e Natimortos
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: (abortos + natimortos) ÷ total de gestações concluídas × 100
// Meta Embrapa: ≤ 5% (abortos isolados); natimortos ≤ 8%.
// REQUER: eventos do tipo ABORTO no schema + criasNatimortas em PARTO.

export function taxaAbortosNatimortos(
  partos: PartoIn[],
  abortos: AbortoIn[]
): { aborto: number; natimorto: number; combinada: number } | null {
  const partosCount = partos.length;
  const abortosCount = abortos.length;
  const gestacoes = partosCount + abortosCount;
  if (gestacoes === 0) return null;
  const natimortos = partos.reduce((s, p) => s + (p.criasNatimortas ?? 0), 0);
  const criasTotal = partos.reduce((s, p) => s + (p.numCrias ?? (p.criasVivas ?? 0) + (p.criasNatimortas ?? 0)), 0);
  const aborto = round1((abortosCount / gestacoes) * 100);
  const natimorto = criasTotal > 0 ? round1((natimortos / criasTotal) * 100) : 0;
  const combinada = round1(((abortosCount + natimortos) / Math.max(1, gestacoes + natimortos)) * 100);
  return { aborto, natimorto, combinada };
}

// ─────────────────────────────────────────────────────────────────────────────
// 15. PDIP — Produção por Dia de Intervalo de Partos
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: produção total da lactação ÷ IP em dias.
// Combina eficiência produtiva (kg) com reprodutiva (IP). Meta Embrapa: ≥ 14 kg/d.

export function pdip(producaoLactacaoKg: number | null, ipDias: number | null): number | null {
  if (producaoLactacaoKg == null || ipDias == null || ipDias <= 0) return null;
  return round1(producaoLactacaoKg / ipDias);
}

// ─────────────────────────────────────────────────────────────────────────────
// 16. PLVA — Produção de Leite por Vaca por Ano
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: produção total da lactação × (365 ÷ IP em dias).
// Meta Embrapa: ≥ 5.000 kg/vaca/ano (intensivo); 2.500-5.000 (médio).

export function plva(producaoLactacaoKg: number | null, ipDias: number | null): number | null {
  if (producaoLactacaoKg == null || ipDias == null || ipDias <= 0) return null;
  return Math.round(producaoLactacaoKg * (DIAS_ANO / ipDias));
}

// ─────────────────────────────────────────────────────────────────────────────
// 17. Taxa de Lotação (UA / ha)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: total de Unidades Animais ÷ área de pastagem em ha
// 1 UA = 450 kg de peso vivo (referência Embrapa). Vaca leiteira ~1,0-1,2 UA.
// Meta Embrapa: 1,5-3,0 UA/ha (pastagem manejada).
// REQUER: areaPastagemHa no schema (Grupo ou Fazenda).

export function taxaLotacao(uaTotal: number, areaPastagemHa: number): number | null {
  if (areaPastagemHa <= 0) return null;
  return round2(uaTotal / areaPastagemHa);
}

// Converte um animal em UA conforme categoria + peso estimado.
const PESO_REF_KG: Record<CategoriaAnimal, number> = {
  BEZERRA: 120, BEZERRO: 120, NOVILHA: 280, VACA: 500, TOURO: 800,
  CABRITA: 25, CABRITO: 25, CABRA: 55, BODE: 75,
};
export function calcularUA(animais: AnimalIn[]): number {
  return round2(animais.reduce((s, a) => s + (PESO_REF_KG[a.categoria] ?? 0) / 450, 0));
}

// ─────────────────────────────────────────────────────────────────────────────
// 18. Produtividade da Terra (L/ha/ano)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: produção total anual ÷ área de pastagem em ha
// Meta Embrapa: ≥ 5.000 L/ha/ano (intensivo); 1.500-5.000 (médio).

export function produtividadeTerra(litrosAno: number, areaPastagemHa: number): number | null {
  if (areaPastagemHa <= 0) return null;
  return Math.round(litrosAno / areaPastagemHa);
}

// ─────────────────────────────────────────────────────────────────────────────
// 19. Produtividade da Mão de Obra (L/funcionário/dia)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: produção diária total ÷ nº de funcionários (equivalente integral)
// Meta Embrapa: ≥ 250 L/funcionário/dia (intensivo).
// REQUER: modelo Funcionario no schema.

export function produtividadeMaoObra(litrosDia: number, numFuncionarios: number): number | null {
  if (numFuncionarios <= 0) return null;
  return Math.round(litrosDia / numFuncionarios);
}

// ─────────────────────────────────────────────────────────────────────────────
// 20. Relação Leite / Concentrado (kg leite por kg ração)
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: litros de leite produzidos ÷ kg de ração consumida (período)
// Meta Embrapa: ≥ 2,0 kg leite / kg concentrado (eficiência ok); ≥ 3,0 (alta).

export function relacaoLeiteConcentrado(litros: number, kgRacao: number): number | null {
  if (kgRacao <= 0) return null;
  return round2(litros / kgRacao);
}

// ─────────────────────────────────────────────────────────────────────────────
// 21. Taxa de Descarte
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: vacas descartadas no período ÷ média de vacas × 100
// Embrapa recomenda 18-22% ao ano (renovação saudável); >30% indica problema.

const DESCARTE_KEYWORDS = ["descart", "venda", "vendi", "abat", "leil"];
const MORTE_KEYWORDS = ["morte", "morr", "obito", "óbito", "falec"];

export function classificarMotivoBaixa(motivo: string | null): "DESCARTE" | "MORTE" | "OUTRO" {
  if (!motivo) return "OUTRO";
  const m = motivo.toLowerCase();
  if (MORTE_KEYWORDS.some((k) => m.includes(k))) return "MORTE";
  if (DESCARTE_KEYWORDS.some((k) => m.includes(k))) return "DESCARTE";
  return "OUTRO";
}

export function taxaDescarte(
  animais: AnimalIn[],
  diasPeriodo: number = DIAS_ANO
): number | null {
  const vacas = animais.filter((a) => a.categoria === "VACA");
  if (vacas.length === 0) return null;
  const desde = Date.now() - diasPeriodo * MS;
  const descartadas = vacas.filter(
    (a) =>
      a.status === "BAIXADO" &&
      a.dataBaixa &&
      Date.parse(a.dataBaixa) >= desde &&
      classificarMotivoBaixa(a.motivoBaixa) === "DESCARTE"
  ).length;
  const fator = DIAS_ANO / diasPeriodo;
  return round1(((descartadas * fator) / vacas.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 22. Mortalidade de Adultos
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: vacas + novilhas mortas no período ÷ total de adultos × 100
// Meta Embrapa: ≤ 2% ao ano.

export function mortalidadeAdultos(
  animais: AnimalIn[],
  diasPeriodo: number = DIAS_ANO
): number | null {
  const adultos = animais.filter((a) => a.categoria === "VACA" || a.categoria === "NOVILHA" || a.categoria === "TOURO");
  if (adultos.length === 0) return null;
  const desde = Date.now() - diasPeriodo * MS;
  const mortos = adultos.filter(
    (a) =>
      a.status === "BAIXADO" &&
      a.dataBaixa &&
      Date.parse(a.dataBaixa) >= desde &&
      classificarMotivoBaixa(a.motivoBaixa) === "MORTE"
  ).length;
  const fator = DIAS_ANO / diasPeriodo;
  return round1(((mortos * fator) / adultos.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 23. Mortalidade de Bezerros até 1 ano
// ─────────────────────────────────────────────────────────────────────────────
// Fórmula: bezerros mortos (idade<365d ou categoria BEZERRA/BEZERRO) ÷ total
// Meta Embrapa: ≤ 8% (até 1 ano); ≤ 3% no aleitamento.

export function mortalidadeBezerros(
  animais: AnimalIn[],
  diasPeriodo: number = DIAS_ANO
): number | null {
  const bezerros = animais.filter((a) => a.categoria === "BEZERRA" || a.categoria === "BEZERRO");
  if (bezerros.length === 0) return null;
  const desde = Date.now() - diasPeriodo * MS;
  const mortos = bezerros.filter(
    (a) =>
      a.status === "BAIXADO" &&
      a.dataBaixa &&
      Date.parse(a.dataBaixa) >= desde &&
      classificarMotivoBaixa(a.motivoBaixa) === "MORTE"
  ).length;
  const fator = DIAS_ANO / diasPeriodo;
  return round1(((mortos * fator) / bezerros.length) * 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// 24. CCS (Contagem de Células Somáticas) — média do rebanho
// ─────────────────────────────────────────────────────────────────────────────
// Já implementado em ResumoAnimal.ccs; aqui devolvemos média + % alto.
// Meta Embrapa: ≤ 200 mil/mL (excelente); ≤ 400 mil/mL (aceitável legal BR).

export function ccsRebanho(ccsPorAnimal: (number | null)[]): {
  media: number | null;
  pctAlto: number | null;
  pctCritico: number | null;
} {
  const valores = ccsPorAnimal.filter((x): x is number => x != null);
  if (valores.length === 0) return { media: null, pctAlto: null, pctCritico: null };
  const media = Math.round(avg(valores));
  const alto = valores.filter((v) => v >= 400).length;
  const critico = valores.filter((v) => v >= 750).length;
  return {
    media,
    pctAlto: round1((alto / valores.length) * 100),
    pctCritico: round1((critico / valores.length) * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Avaliação de meta (semáforo)
// ─────────────────────────────────────────────────────────────────────────────

export type Semaforo = "verde" | "amarelo" | "vermelho";

export interface MetaConfig {
  ideal: number;
  aceitavel: number;
  direcao: "maior_melhor" | "menor_melhor";
}

export function semaforo(valor: number | null, meta: MetaConfig): Semaforo | null {
  if (valor == null) return null;
  if (meta.direcao === "maior_melhor") {
    if (valor >= meta.ideal) return "verde";
    if (valor >= meta.aceitavel) return "amarelo";
    return "vermelho";
  }
  if (valor <= meta.ideal) return "verde";
  if (valor <= meta.aceitavel) return "amarelo";
  return "vermelho";
}

export const METAS_EMBRAPA = {
  pctVacasEmLactacao: { ideal: 83, aceitavel: 75, direcao: "maior_melhor" } as MetaConfig,
  duracaoLactacao:    { ideal: 305, aceitavel: 270, direcao: "maior_melhor" } as MetaConfig,
  persistencia:       { ideal: 90, aceitavel: 80, direcao: "maior_melhor" } as MetaConfig,
  pvo:                { ideal: 18, aceitavel: 10, direcao: "maior_melhor" } as MetaConfig,
  producaoLactacao:   { ideal: 5500, aceitavel: 3000, direcao: "maior_melhor" } as MetaConfig,
  periodoSeco:        { ideal: 60, aceitavel: 70, direcao: "menor_melhor" } as MetaConfig,
  ip:                 { ideal: 395, aceitavel: 425, direcao: "menor_melhor" } as MetaConfig,
  ps:                 { ideal: 120, aceitavel: 150, direcao: "menor_melhor" } as MetaConfig,
  pctPrenhez:         { ideal: 60, aceitavel: 45, direcao: "maior_melhor" } as MetaConfig,
  pctPrenhez1Serv:    { ideal: 50, aceitavel: 40, direcao: "maior_melhor" } as MetaConfig,
  taxaGestacao:       { ideal: 40, aceitavel: 30, direcao: "maior_melhor" } as MetaConfig,
  ipp:                { ideal: 26, aceitavel: 30, direcao: "menor_melhor" } as MetaConfig,
  natalidade:         { ideal: 80, aceitavel: 70, direcao: "maior_melhor" } as MetaConfig,
  abortos:            { ideal: 5, aceitavel: 8, direcao: "menor_melhor" } as MetaConfig,
  pdip:               { ideal: 14, aceitavel: 10, direcao: "maior_melhor" } as MetaConfig,
  plva:               { ideal: 5000, aceitavel: 2500, direcao: "maior_melhor" } as MetaConfig,
  lotacao:            { ideal: 3.0, aceitavel: 1.5, direcao: "maior_melhor" } as MetaConfig,
  produtividadeTerra: { ideal: 5000, aceitavel: 1500, direcao: "maior_melhor" } as MetaConfig,
  produtividadeMO:    { ideal: 250, aceitavel: 150, direcao: "maior_melhor" } as MetaConfig,
  leiteConcentrado:   { ideal: 2.0, aceitavel: 1.5, direcao: "maior_melhor" } as MetaConfig,
  taxaDescarte:       { ideal: 22, aceitavel: 30, direcao: "menor_melhor" } as MetaConfig,
  mortAdultos:        { ideal: 2, aceitavel: 4, direcao: "menor_melhor" } as MetaConfig,
  mortBezerros:       { ideal: 8, aceitavel: 12, direcao: "menor_melhor" } as MetaConfig,
  ccs:                { ideal: 200, aceitavel: 400, direcao: "menor_melhor" } as MetaConfig,
} as const;
