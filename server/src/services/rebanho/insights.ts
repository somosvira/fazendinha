// Painel executivo do animal: agrega score, financeiro estimado, tendências,
// alertas, percentis, projeções e interpretação da timeline em um único response.
// Reusa cálculos puros existentes (custoVacaDia, ratearCustoSanidade).

import { prisma } from "../../db.js";
import type { Animal, ResumoAnimal } from "@prisma/client";
import { custoVacaDia as calcularCustoVacaDia } from "./estoque.calc.js";
import { getNumero, type ChaveParametro } from "./parametros.js";

const FALLBACK_PRECO_LEITE = 2.4; // R$/L quando Configuracao.precoLeite é NULL
// Que chave de ParametroManejo carrega a meta de produção pra cada categoria.
// Só VACA e CABRA produzem leite; as demais não têm meta.
const CHAVE_META_PRODUCAO: Record<string, ChaveParametro | null> = {
  VACA: "PROD_META_VACA", CABRA: "PROD_META_CABRA",
  BEZERRA: null, NOVILHA: null, BEZERRO: null, TOURO: null,
  CABRITA: null, CABRITO: null, BODE: null,
};
const ESPECIE_POR_CATEGORIA: Record<string, "BOVINO" | "CAPRINO"> = {
  BEZERRA: "BOVINO", NOVILHA: "BOVINO", VACA: "BOVINO", BEZERRO: "BOVINO", TOURO: "BOVINO",
  CABRITA: "CAPRINO", CABRA: "CAPRINO", CABRITO: "CAPRINO", BODE: "CAPRINO",
};
// Janela "prime" por espécie (anos). Valores default Embrapa; sobrescritos
// via ParametroManejo (PRIME_BOVINO_MIN/MAX, PRIME_CAPRINO_MIN/MAX).
const PRIME_BOVINO_DEFAULT = { min: 3, max: 7 };
const PRIME_CAPRINO_DEFAULT = { min: 2, max: 5 };

// ── DTOs ────────────────────────────────────────────────────────────────────

export type ScoreClassificacao = "ELITE" | "MUITO_BOA" | "BOA" | "ATENCAO" | "DESCARTE";
export interface ScoreFatorDTO { nome: string; pontos: number; peso: number }
export interface ScoreDTO {
  valor: number; // 0-100
  classificacao: ScoreClassificacao;
  estrelas: 1 | 2 | 3 | 4 | 5;
  fatores: ScoreFatorDTO[];
}

export interface FinanceiroDTO {
  precoLeite: number;
  fontePreco: "config" | "fallback";
  receitaLactacao: number;
  custoVacaDia: number | null;
  custoVacaDiaTotalLactacao: number;
  custoSanidadeAnimal: number;
  custosTotal: number;
  lucro: number;
  margem: number; // 0-1
  tom: "pos" | "warn" | "neg";
}

export interface TendenciaDTO {
  chave: string;
  label: string;
  direcao: "up" | "down" | "flat";
  delta?: string;
  sentido: "pos" | "neg" | "neutro";
}

export interface InsightDTO { tipo: "warn" | "ok"; titulo: string; detalhe?: string }

export interface PercentisDTO {
  producao: number | null;
  rentabilidade: number | null;
  fertilidade: number | null;
  ccs: number | null;
  ranking: { posicao: number; total: number } | null;
}

export interface ProducaoFinanceiraDTO {
  acumuladoLitros: number;
  valorRecebido: number;
  precoMedio: number;
  lucroPorLitro: number | null;
  receitaDiaria: number;
  receitaMensal: number;
}

export interface EficienciaDTO { meta: number | null; atual: number | null; percentual: number | null }

export interface ProjecoesDTO {
  producaoLactacao: number | null;
  receitaLactacao: number | null;
  lucroLactacao: number | null;
  dataSecagem: string | null;
  dataParto: string | null;
}

export interface GenealogiaDTO {
  mae: { id: string; nome: string | null; numero: string; producaoMediaDia: number | null } | null;
  pai: string | null;
  avoMaterna: { id: string; nome: string | null; numero: string } | null;
  avoMaterno: string | null; // mae.paiNome (texto)
}

export interface AnimalInsightsDTO {
  score: ScoreDTO;
  financeiro: FinanceiroDTO;
  tendencias: TendenciaDTO[];
  insights: InsightDTO[];
  percentis: PercentisDTO;
  producaoFinanceira: ProducaoFinanceiraDTO;
  eficiencia: EficienciaDTO;
  projecoes: ProjecoesDTO;
  genealogia: GenealogiaDTO;
  timelineInterpretacao: Record<string, string>;
}

// ── Utils ──────────────────────────────────────────────────────────────────

const toNum = (v: any): number => (v == null ? 0 : Number(v));
const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

function idadeAnos(dataNascimento: Date | null, hoje: Date): number | null {
  if (!dataNascimento) return null;
  const ms = hoje.getTime() - dataNascimento.getTime();
  return ms / (365.25 * 24 * 3600 * 1000);
}

function percentil(valores: number[], alvo: number): number {
  if (valores.length === 0) return 50;
  const menores = valores.filter((v) => v < alvo).length;
  return Math.round((menores / valores.length) * 100);
}

// ── Score ──────────────────────────────────────────────────────────────────

function pontosProducao(produzido: number | null, meta: number | null): number {
  if (produzido == null || meta == null || meta === 0) return 50;
  return Math.min(120, Math.round((produzido / meta) * 100));
}

function pontosCCS(ccs: number | null): number {
  if (ccs == null) return 50;
  if (ccs <= 200) return 100;
  if (ccs <= 400) return 70;
  if (ccs <= 750) return 40;
  return 10;
}

function pontosFertilidade(statusReprod: string | null, iep: number | null): number {
  if (statusReprod === "PRENHE") return 90;
  if (iep == null) return 60;
  if (iep <= 380) return 100;
  if (iep <= 420) return 75;
  return 40;
}

function pontosIdade(idade: number | null, prime: { min: number; max: number }): number {
  if (idade == null) return 60;
  if (idade >= prime.min && idade <= prime.max) return 100;
  if (idade < prime.min) return 80;
  if (idade <= prime.max + 2) return 75;
  return 50;
}

function pontosSaude(ocorrenciasRecentes: number): number {
  if (ocorrenciasRecentes === 0) return 100;
  return Math.max(20, 80 - ocorrenciasRecentes * 15);
}

function pontosRentab(margem: number | null): number {
  if (margem == null) return 50;
  if (margem >= 0.30) return 100;
  if (margem >= 0.15) return 75;
  if (margem >= 0) return 50;
  return 20;
}

function classificar(valor: number): { classificacao: ScoreClassificacao; estrelas: 1 | 2 | 3 | 4 | 5 } {
  if (valor >= 85) return { classificacao: "ELITE", estrelas: 5 };
  if (valor >= 70) return { classificacao: "MUITO_BOA", estrelas: 4 };
  if (valor >= 55) return { classificacao: "BOA", estrelas: 3 };
  if (valor >= 40) return { classificacao: "ATENCAO", estrelas: 2 };
  return { classificacao: "DESCARTE", estrelas: 1 };
}

// ── Service ────────────────────────────────────────────────────────────────

export async function obterInsights(animalId: number): Promise<AnimalInsightsDTO | null> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, include: { resumo: true, mae: { select: { id: true, nome: true, numero: true, maeId: true, paiNome: true } }, raca: true } });
  if (!animal) return null;

  const hoje = new Date();
  const especie = ESPECIE_POR_CATEGORIA[animal.categoria] ?? "BOVINO";
  const idade = idadeAnos(animal.dataNascimento, hoje);
  const chaveMeta = CHAVE_META_PRODUCAO[animal.categoria];
  const [meta, primeMin, primeMax] = await Promise.all([
    chaveMeta ? getNumero(chaveMeta) : Promise.resolve(null),
    getNumero(especie === "BOVINO" ? "PRIME_BOVINO_MIN" : "PRIME_CAPRINO_MIN"),
    getNumero(especie === "BOVINO" ? "PRIME_BOVINO_MAX" : "PRIME_CAPRINO_MAX"),
  ]);
  const primeDefault = especie === "BOVINO" ? PRIME_BOVINO_DEFAULT : PRIME_CAPRINO_DEFAULT;
  const prime = { min: primeMin ?? primeDefault.min, max: primeMax ?? primeDefault.max };
  const resumo: ResumoAnimal | null = animal.resumo;

  // ── Lactação atual (acumulado de litros) ───────────────────────────────
  const lactacaoAtual = await prisma.lactacao.findFirst({
    where: { animalId, dtFim: null },
    orderBy: { dtInicio: "desc" },
  });
  const controlesLact = lactacaoAtual
    ? await prisma.controleLeiteiro.findMany({
        where: { animalId, data: { gte: lactacaoAtual.dtInicio } },
        select: { data: true, pesoTotal: true },
        orderBy: { data: "asc" },
      })
    : [];
  const acumuladoLitros = controlesLact.reduce((s, c) => s + toNum(c.pesoTotal), 0);

  // ── Configuração (preço do leite) ──────────────────────────────────────
  const cfg = await prisma.configuracao.findUnique({ where: { id: 1 } });
  const precoLeite = cfg?.precoLeite != null ? toNum(cfg.precoLeite) : FALLBACK_PRECO_LEITE;
  const fontePreco: FinanceiroDTO["fontePreco"] = cfg?.precoLeite != null ? "config" : "fallback";

  // ── Custos do rebanho (vaca/dia) — 30 dias ─────────────────────────────
  const limite30 = new Date(hoje); limite30.setDate(hoje.getDate() - 30);
  const saidas30 = await prisma.movimentoEstoque.findMany({
    where: { tipo: "SAIDA", data: { gte: limite30 } },
    select: { valorTotal: true, data: true },
  });
  const vacasEmLactacao = await prisma.animal.count({ where: { status: "ATIVO", resumo: { del: { not: null } } } });
  const cVacaDia = calcularCustoVacaDia(
    saidas30.map((s) => ({ valorTotal: toNum(s.valorTotal), data: s.data.toISOString().slice(0, 10) })),
    vacasEmLactacao,
    hoje.toISOString().slice(0, 10),
    30,
  );
  const delDias = resumo?.del ?? 0;
  const custoVacaDiaTotalLactacao = cVacaDia != null ? round(cVacaDia * delDias) : 0;

  // ── Custo de sanidade desse animal (12 meses) ──────────────────────────
  const desde12m = new Date(hoje); desde12m.setMonth(hoje.getMonth() - 12);
  const aplics12m = await prisma.eventoSanitario.findMany({
    where: { animalId, tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde12m } },
    select: { produto: true, data: true },
  });
  const precos = new Map<string, number | null>();
  for (const p of await prisma.produto.findMany({ select: { nome: true, custoUnitario: true } })) {
    precos.set(p.nome, p.custoUnitario != null ? toNum(p.custoUnitario) : null);
  }
  let custoSanidadeExato = 0;
  for (const a of aplics12m) if (a.produto) {
    const cu = precos.get(a.produto);
    if (cu != null) custoSanidadeExato += cu;
  }
  // Rateio do gasto real "Medicamento Animal" / aplicações no rebanho
  const lancsMedic = await prisma.lancamento.findMany({
    where: { situacao: "LIQUIDADO", natureza: "DEBITO", dataLiquidacao: { not: null, gte: desde12m }, categoria: { nome: "Medicamento Animal" } },
    select: { valor: true },
  });
  const totalMedic = lancsMedic.reduce((s, l) => s + toNum(l.valor), 0);
  const todasAplicsGlob = await prisma.eventoSanitario.count({ where: { tipo: { in: ["APLICACAO", "VACINA"] }, data: { gte: desde12m } } });
  const custoPorAplic = todasAplicsGlob > 0 ? totalMedic / todasAplicsGlob : 0;
  const custoSanidadeRateio = round(custoPorAplic * aplics12m.length);
  const custoSanidadeAnimal = round(custoSanidadeExato > 0 ? custoSanidadeExato : custoSanidadeRateio);

  // ── Ocorrências e mastites recentes (6m) ───────────────────────────────
  const desde6m = new Date(hoje); desde6m.setMonth(hoje.getMonth() - 6);
  const ocorrencias6m = await prisma.eventoSanitario.count({
    where: { animalId, tipo: { in: ["OCORRENCIA", "MASTITE"] }, data: { gte: desde6m } },
  });
  const mastites12m = await prisma.eventoSanitario.count({
    where: { animalId, tipo: "MASTITE", data: { gte: desde12m } },
  });

  // ── Financeiro ─────────────────────────────────────────────────────────
  const receitaLactacao = round(acumuladoLitros * precoLeite);
  const custosTotal = round(custoVacaDiaTotalLactacao + custoSanidadeAnimal);
  const lucro = round(receitaLactacao - custosTotal);
  const margem = receitaLactacao > 0 ? round(lucro / receitaLactacao, 4) : 0;
  const tomFinanceiro: FinanceiroDTO["tom"] = margem >= 0.2 ? "pos" : margem >= 0 ? "warn" : "neg";

  const financeiro: FinanceiroDTO = {
    precoLeite: round(precoLeite, 4),
    fontePreco,
    receitaLactacao,
    custoVacaDia: cVacaDia,
    custoVacaDiaTotalLactacao,
    custoSanidadeAnimal,
    custosTotal,
    lucro,
    margem,
    tom: tomFinanceiro,
  };

  // ── Score ──────────────────────────────────────────────────────────────
  const fatores: ScoreFatorDTO[] = [
    { nome: "Produção",     pontos: pontosProducao(toNum(resumo?.producaoMediaDia), meta), peso: 30 },
    { nome: "CCS",          pontos: pontosCCS(resumo?.ccs ?? null), peso: 20 },
    { nome: "Fertilidade",  pontos: pontosFertilidade(resumo?.statusReprodutivo ?? null, resumo?.iepProjetado ?? null), peso: 20 },
    { nome: "Idade",        pontos: pontosIdade(idade, prime), peso: 10 },
    { nome: "Saúde",        pontos: pontosSaude(ocorrencias6m), peso: 10 },
    { nome: "Rentabilidade", pontos: pontosRentab(receitaLactacao > 0 ? margem : null), peso: 10 },
  ];
  const valorScore = round(fatores.reduce((s, f) => s + (f.pontos * f.peso) / 100, 0), 0);
  const cls = classificar(valorScore);
  const score: ScoreDTO = { valor: Math.min(100, valorScore), ...cls, fatores };

  // ── Percentis (apenas animais em lactação ativa, da mesma espécie) ─────
  const pool = await prisma.animal.findMany({
    where: { status: "ATIVO", categoria: animal.categoria, resumo: { producaoMediaDia: { not: null } } },
    select: { id: true, resumo: { select: { producaoMediaDia: true, ccs: true, iepProjetado: true } } },
  });
  const prods = pool.map((p) => toNum(p.resumo?.producaoMediaDia)).filter((v) => v > 0);
  const ccss  = pool.map((p) => p.resumo?.ccs).filter((v): v is number => v != null);
  const ieps  = pool.map((p) => p.resumo?.iepProjetado).filter((v): v is number => v != null);
  const minhaProd = toNum(resumo?.producaoMediaDia);
  const minhaCCS = resumo?.ccs ?? null;
  const minhaIEP = resumo?.iepProjetado ?? null;
  const percentis: PercentisDTO = {
    producao: prods.length > 0 && minhaProd > 0 ? percentil(prods, minhaProd) : null,
    // Rentabilidade: usa a margem como proxy (sem comparação cross-animal real)
    rentabilidade: receitaLactacao > 0 ? Math.min(99, Math.max(1, Math.round((margem + 0.3) * 100))) : null,
    // Fertilidade: IEP menor = melhor → percentil invertido
    fertilidade: ieps.length > 0 && minhaIEP != null ? 100 - percentil(ieps, minhaIEP) : null,
    // CCS: menor = melhor → invertido
    ccs: ccss.length > 0 && minhaCCS != null ? 100 - percentil(ccss, minhaCCS) : null,
    ranking: prods.length > 0 && minhaProd > 0 ? { posicao: 1 + prods.filter((p) => p > minhaProd).length, total: prods.length } : null,
  };

  // ── Tendências ────────────────────────────────────────────────────────
  const tendencias: TendenciaDTO[] = [];
  if (resumo?.producaoTendencia) {
    const dir = resumo.producaoTendencia === "subindo" ? "up" : resumo.producaoTendencia === "descendo" ? "down" : "flat";
    tendencias.push({ chave: "producao", label: "Produção", direcao: dir, sentido: dir === "up" ? "pos" : dir === "down" ? "neg" : "neutro" });
  }
  if (resumo?.ccsTendencia) {
    const dir = resumo.ccsTendencia === "subindo" ? "up" : resumo.ccsTendencia === "caindo" ? "down" : "flat";
    tendencias.push({ chave: "ccs", label: "CCS", direcao: dir, sentido: dir === "up" ? "neg" : dir === "down" ? "pos" : "neutro" });
  }
  if (resumo?.statusReprodutivo === "PRENHE") {
    tendencias.push({ chave: "prenhez", label: "Prenhez", direcao: "flat", sentido: "pos", delta: "confirmada" });
  } else if (resumo?.del != null && resumo.del > 150 && resumo.statusReprodutivo !== "INSEMINADA") {
    tendencias.push({ chave: "prenhez", label: "Prenhez", direcao: "down", sentido: "neg", delta: "fora da meta" });
  }
  if (resumo?.producaoMediaDia != null && meta != null) {
    const ef = resumo.producaoMediaDia.toNumber() / meta;
    if (ef >= 0.9) tendencias.push({ chave: "eficiencia", label: "Eficiência produtiva", direcao: "up", sentido: "pos", delta: `${Math.round(ef * 100)}% da meta` });
    else if (ef < 0.6) tendencias.push({ chave: "eficiencia", label: "Eficiência produtiva", direcao: "down", sentido: "neg", delta: `${Math.round(ef * 100)}% da meta` });
  }

  // ── Insights (regras simples) ─────────────────────────────────────────
  const insights: InsightDTO[] = [];
  if (resumo?.del != null && resumo.del > 280 && resumo.previsaoSecagem == null) {
    insights.push({ tipo: "warn", titulo: `DEL elevado (${resumo.del}d). Planejar secagem.` });
  }
  if (resumo?.producaoTendencia === "descendo") {
    insights.push({ tipo: "warn", titulo: "Produção em queda nas últimas semanas." });
  }
  if (resumo?.ccs != null && resumo.ccs > 400) {
    insights.push({ tipo: "warn", titulo: `CCS elevada (${resumo.ccs} mil cél/mL). Reforçar manejo de ordenha.` });
  }
  if (mastites12m >= 2) {
    insights.push({ tipo: "warn", titulo: `Histórico recorrente de mastite (${mastites12m} em 12m).` });
  }
  if (resumo?.del != null && resumo.del > 150 && resumo.statusReprodutivo === "VAZIA") {
    insights.push({ tipo: "warn", titulo: `Vazia há ${resumo.del} dias. Revisar protocolo reprodutivo.` });
  }
  // Próxima carência → próxima vacina/dose esperada
  const ultimaAplic = await prisma.eventoSanitario.findFirst({
    where: { animalId, tipo: { in: ["APLICACAO", "VACINA"] }, carencia: { not: null } },
    orderBy: { data: "desc" },
  });
  if (ultimaAplic && ultimaAplic.carencia != null) {
    const fim = new Date(ultimaAplic.data); fim.setDate(fim.getDate() + ultimaAplic.carencia);
    const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (24 * 3600 * 1000));
    if (diasRestantes > 0 && diasRestantes <= 14) {
      insights.push({ tipo: "warn", titulo: `Carência termina em ${diasRestantes} dias.` });
    }
  }
  if (resumo?.producaoTendencia === "subindo" && meta != null && minhaProd >= meta) {
    insights.push({ tipo: "ok", titulo: "Excelente persistência de lactação." });
  }
  if (percentis.producao != null && percentis.producao >= 80) {
    insights.push({ tipo: "ok", titulo: `Animal no top ${100 - percentis.producao}% do lote em produção.` });
  }

  // ── Produção financeira ───────────────────────────────────────────────
  const receitaDiaria = round(toNum(resumo?.producaoMediaDia) * precoLeite);
  const producaoFinanceira: ProducaoFinanceiraDTO = {
    acumuladoLitros: round(acumuladoLitros),
    valorRecebido: receitaLactacao,
    precoMedio: round(precoLeite, 4),
    lucroPorLitro: acumuladoLitros > 0 ? round(lucro / acumuladoLitros, 4) : null,
    receitaDiaria,
    receitaMensal: round(receitaDiaria * 30),
  };

  // ── Eficiência ────────────────────────────────────────────────────────
  const eficiencia: EficienciaDTO = {
    meta,
    atual: resumo?.producaoMediaDia != null ? toNum(resumo.producaoMediaDia) : null,
    percentual: meta != null && resumo?.producaoMediaDia != null ? Math.round((toNum(resumo.producaoMediaDia) / meta) * 100) : null,
  };

  // ── Projeções ─────────────────────────────────────────────────────────
  const producaoLactacao = resumo?.producao305 ?? null;
  const projecoes: ProjecoesDTO = {
    producaoLactacao,
    receitaLactacao: producaoLactacao != null ? round(producaoLactacao * precoLeite) : null,
    lucroLactacao: producaoLactacao != null && cVacaDia != null
      ? round(producaoLactacao * precoLeite - 305 * cVacaDia - custoSanidadeAnimal)
      : null,
    dataSecagem: resumo?.previsaoSecagem ? resumo.previsaoSecagem.toISOString().slice(0, 10) : null,
    dataParto: resumo?.statusReprodutivo === "PRENHE" && resumo.diasGestacao != null
      ? (() => { const d = new Date(hoje); d.setDate(d.getDate() + (285 - resumo.diasGestacao!)); return d.toISOString().slice(0, 10); })()
      : null,
  };

  // ── Genealogia ────────────────────────────────────────────────────────
  let avoMaterna: GenealogiaDTO["avoMaterna"] = null;
  let avoMaternoTexto: string | null = animal.mae?.paiNome ?? null;
  if (animal.mae?.maeId) {
    const av = await prisma.animal.findUnique({ where: { id: animal.mae.maeId }, select: { id: true, nome: true, numero: true } });
    if (av) avoMaterna = { id: String(av.id), nome: av.nome, numero: av.numero };
  }
  // Produção média da mãe (se em lactação)
  let producaoMae: number | null = null;
  if (animal.mae?.id) {
    const r = await prisma.resumoAnimal.findUnique({ where: { animalId: animal.mae.id }, select: { producaoMediaDia: true } });
    producaoMae = r?.producaoMediaDia != null ? toNum(r.producaoMediaDia) : null;
  }
  const genealogia: GenealogiaDTO = {
    mae: animal.mae ? { id: String(animal.mae.id), nome: animal.mae.nome, numero: animal.mae.numero, producaoMediaDia: producaoMae } : null,
    pai: animal.paiNome,
    avoMaterna,
    avoMaterno: avoMaternoTexto,
  };

  // ── Interpretação da timeline ─────────────────────────────────────────
  const timelineInterpretacao = await interpretarTimeline(animalId);

  return { score, financeiro, tendencias, insights, percentis, producaoFinanceira, eficiencia, projecoes, genealogia, timelineInterpretacao };
}

// Gera string por evento usando regras simples comparativas.
// Chaves no formato `${dominio}:${id}` — alinhado com EventoTimeline.dominio + EventoTimeline.id no client.
async function interpretarTimeline(animalId: number): Promise<Record<string, string>> {
  const out: Record<string, string> = {};

  // Eventos reprodutivos (dominio = "reproducao")
  const repros = await prisma.eventoReprodutivo.findMany({ where: { animalId }, orderBy: { data: "asc" } });
  let iaCount = 0;
  for (const e of repros) {
    const k = `reproducao:${e.id}`;
    if (e.tipo === "INSEMINACAO") iaCount++;
    if (e.tipo === "DIAGNOSTICO" && e.resultado === "POSITIVO") {
      out[k] = iaCount <= 1
        ? "Prenhez confirmada na primeira IA. Excelente eficiência reprodutiva."
        : `Prenhez confirmada após ${iaCount} IAs.`;
      iaCount = 0;
    }
    if (e.tipo === "PARTO") { out[k] = "Início de nova lactação."; iaCount = 0; }
    if (e.tipo === "SECAGEM") out[k] = "Lactação encerrada.";
  }

  // Controles leiteiros (dominio = "producao")
  const controles = await prisma.controleLeiteiro.findMany({ where: { animalId }, orderBy: { data: "asc" }, select: { id: true, pesoTotal: true } });
  for (let i = 1; i < controles.length; i++) {
    const atual = toNum(controles[i].pesoTotal);
    const ant = toNum(controles[i - 1].pesoTotal);
    if (ant === 0) continue;
    const delta = ((atual - ant) / ant) * 100;
    const k = `producao:${controles[i].id}`;
    if (Math.abs(delta) < 5) out[k] = "Produção manteve estabilidade.";
    else if (delta < -10) out[k] = `Queda de ${Math.abs(Math.round(delta))}% em relação ao controle anterior.`;
    else if (delta > 10) out[k] = `Aumento de ${Math.round(delta)}% em relação ao controle anterior.`;
  }

  // Eventos sanitários (dominio = "sanidade")
  const sanits = await prisma.eventoSanitario.findMany({ where: { animalId }, orderBy: { data: "asc" }, select: { id: true, tipo: true, ccs: true, doenca: true } });
  let ccsAnt: number | null = null;
  for (const e of sanits) {
    const k = `sanidade:${e.id}`;
    if (e.tipo === "EXAME" && e.ccs != null) {
      if (ccsAnt == null) {
        out[k] = e.ccs <= 200 ? "Dentro da faixa ideal." : e.ccs <= 400 ? "Faixa de atenção." : "Acima do recomendado.";
      } else {
        const delta = ((e.ccs - ccsAnt) / ccsAnt) * 100;
        out[k] = delta > 20 ? `Aumento de ${Math.round(delta)}% em relação ao exame anterior.`
          : delta < -20 ? `Queda de ${Math.abs(Math.round(delta))}% em relação ao exame anterior.`
          : "Estável em relação ao exame anterior.";
      }
      ccsAnt = e.ccs;
    }
    if (e.tipo === "MASTITE") out[k] = "Episódio de mastite registrado.";
    if (e.tipo === "VACINA") out[k] = "Vacina aplicada conforme calendário.";
  }

  return out;
}
