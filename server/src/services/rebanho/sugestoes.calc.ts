// Motor puro das Sugestões do "Hoje" preditivo (Prisma-free, testado por TDD).
// Recebe animais já materializados (score/margem da Carteira + campos do resumo +
// mastites12m) e produz um feed de decisões priorizadas por impacto R$/dia.
// Determinístico, sem ML. As fatias de aproximação são constantes nomeadas.

import { ehVaziaAtrasada } from "./regras-manejo.js";
import type { ScoreClassificacao } from "./score.calc.js";
import { mencaoAnimal } from "./identificacao.js";

export type TipoSugestao = "DESCARTE" | "REPRODUCAO" | "MASTITE" | "QUEDA_PRODUCAO";
export const TIPOS_SUGESTAO: TipoSugestao[] = ["DESCARTE", "REPRODUCAO", "MASTITE", "QUEDA_PRODUCAO"];

// Constantes de aproximação (calibráveis; a mensuração real de perda é fatia futura do V2).
export const CCS_LIMITE = 400;          // mil cél/mL — acima disso, CCS "alta"
export const DEL_FASE_QUEDA = 200;      // queda antes deste DEL é anômala (não é fim natural da lactação)
export const FRACAO_PERDA_CCS = 0.15;   // ~15% da receita/dia em risco quando mastite subclínica recorrente
export const FRACAO_QUEDA = 0.10;       // ~10% da receita/dia como perda projetada na queda acionável
export const META_IEP = 400;            // dias — meta de IEP p/ calcular a janela reprodutiva
export const PISO_IMPACTO = 1;          // R$/dia — abaixo disso é ruído, corta do feed

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// Animal materializado que o service entrega ao calc.
export interface AnimalSugestao {
  animalId: number;
  numero: string;
  nome: string | null;
  score: number;
  classificacao: ScoreClassificacao;
  producaoDia: number | null;       // L/dia
  ccs: number | null;
  ccsTendencia: string | null;      // "subindo" | "caindo" | "estavel"
  producaoTendencia: string | null; // "subindo" | "descendo" | "estavel"
  statusReprodutivo: string | null;
  del: number | null;
  margemDiaEstimada: number | null; // R$/dia (Carteira)
  mastites12m: number;
  quartoCronico?: { quarto: string } | null; // quarto reincidente (ExameQuarto); refina a sugestão de mastite
}

export interface SugestaoAcao { label: string; tab: string; worklistChave?: string }
export interface SugestaoDTO {
  tipo: TipoSugestao;
  animalId: number;
  numero: string;
  nome: string | null;
  titulo: string;
  motivo: string;
  impactoDiaEstimado: number; // R$/dia (>= 0) — chave de ordenação
  prazoDias: number | null;
  acao: SugestaoAcao;
}

export interface SugestoesConfig {
  pevDias: number;
  precoLeite: number;
  custoVacaDia: number | null;
}

export interface SugestoesDTO {
  sugestoes: SugestaoDTO[];
  totalPorTipo: Record<TipoSugestao, number>;
  impactoDiaTotal: number;
  precoLeite: number;
  custoVacaDia: number | null;
}

const receitaDia = (a: AnimalSugestao, precoLeite: number) => (a.producaoDia ?? 0) * precoLeite;

// ── Regras (cada uma → SugestaoDTO | null) ──────────────────────────────────

// DESCARTE: classificação DESCARTE, ou ATENCAO com margem/dia não-positiva.
// Impacto = quanto a vaca drena por dia (margem negativa vira positivo).
export function avaliarDescarte(a: AnimalSugestao): SugestaoDTO | null {
  const margem = a.margemDiaEstimada ?? 0;
  const gatilho = a.classificacao === "DESCARTE" || (a.classificacao === "ATENCAO" && margem <= 0);
  if (!gatilho) return null;
  const impacto = round(Math.max(0, -margem));
  const margemTxt = margem < 0 ? `−R$${Math.abs(margem).toFixed(2)}/dia` : `R$${margem.toFixed(2)}/dia`;
  return {
    tipo: "DESCARTE", animalId: a.animalId, numero: a.numero, nome: a.nome,
    titulo: `Cogite descarte de ${mencaoAnimal(a.numero, a.nome)}`,
    motivo: `Score ${a.score} (${a.classificacao}) + margem ${margemTxt}`,
    impactoDiaEstimado: impacto, prazoDias: null,
    acao: { label: "Revisar caso", tab: "carteira" },
  };
}

// REPRODUCAO: vazia após o PEV (reusa ehVaziaAtrasada). Impacto ≈ custo do dia em
// aberto (custoVacaDia). Prazo = dias até estourar a meta de IEP.
export function avaliarReproducao(a: AnimalSugestao, cfg: SugestoesConfig): SugestaoDTO | null {
  if (!ehVaziaAtrasada(a.statusReprodutivo, a.del, cfg.pevDias)) return null;
  const diasAcima = (a.del ?? 0) - cfg.pevDias;
  const impacto = round(cfg.custoVacaDia ?? 0);
  const prazoDias = a.del != null ? Math.max(0, META_IEP - a.del) : null;
  return {
    tipo: "REPRODUCAO", animalId: a.animalId, numero: a.numero, nome: a.nome,
    titulo: `Inseminar ${mencaoAnimal(a.numero, a.nome)}`,
    motivo: `Vazia há ${a.del} dias (${diasAcima} além do PEV ${cfg.pevDias})`,
    impactoDiaEstimado: impacto, prazoDias,
    acao: { label: "Registrar inseminação", tab: "reproducao", worklistChave: "vazia-pos-pev" },
  };
}

// MASTITE recorrente. Sinal fino preferido: um quarto crônico (ExameQuarto) — sugere secar/tratar
// aquele quarto. Fallback (sem dados por quarto): CCS alta E subindo E mastites12m >= 2.
// Impacto ≈ fração da receita/dia em risco.
export function avaliarMastite(a: AnimalSugestao, cfg: SugestoesConfig): SugestaoDTO | null {
  const impacto = round(receitaDia(a, cfg.precoLeite) * FRACAO_PERDA_CCS);
  if (a.quartoCronico) {
    return {
      tipo: "MASTITE", animalId: a.animalId, numero: a.numero, nome: a.nome,
      titulo: `Secar/tratar quarto ${a.quartoCronico.quarto} de ${mencaoAnimal(a.numero, a.nome)}`,
      motivo: `Quarto ${a.quartoCronico.quarto} crônico — mastite reincidente não sara`,
      impactoDiaEstimado: impacto, prazoDias: null,
      acao: { label: "Registrar exame do quarto", tab: "sanidade", worklistChave: "ccs-alta" },
    };
  }
  const gatilho = a.ccs != null && a.ccs > CCS_LIMITE && a.ccsTendencia === "subindo" && a.mastites12m >= 2;
  if (!gatilho) return null;
  return {
    tipo: "MASTITE", animalId: a.animalId, numero: a.numero, nome: a.nome,
    titulo: `Mastite recorrente em ${mencaoAnimal(a.numero, a.nome)}`,
    motivo: `CCS ${a.ccs}↑ + ${a.mastites12m} mastites/12m`,
    impactoDiaEstimado: impacto, prazoDias: null,
    acao: { label: "Registrar exame", tab: "sanidade", worklistChave: "ccs-alta" },
  };
}

// QUEDA de produção acionável: tendência descendo E DEL antes do fim natural.
// Impacto ≈ fração da receita/dia como perda projetada.
export function avaliarQueda(a: AnimalSugestao, cfg: SugestoesConfig): SugestaoDTO | null {
  const gatilho = a.producaoTendencia === "descendo" && a.del != null && a.del < DEL_FASE_QUEDA;
  if (!gatilho) return null;
  const impacto = round(receitaDia(a, cfg.precoLeite) * FRACAO_QUEDA);
  return {
    tipo: "QUEDA_PRODUCAO", animalId: a.animalId, numero: a.numero, nome: a.nome,
    titulo: `Produção caindo em ${mencaoAnimal(a.numero, a.nome)}`,
    motivo: `Produção em queda no DEL ${a.del} (fase de pico/platô)`,
    impactoDiaEstimado: impacto, prazoDias: null,
    acao: { label: "Investigar", tab: "producao", worklistChave: "producao-caindo" },
  };
}

// ── Agregador ────────────────────────────────────────────────────────────────

export function montarSugestoes(animais: AnimalSugestao[], cfg: SugestoesConfig): SugestoesDTO {
  const brutas: SugestaoDTO[] = [];
  for (const a of animais) {
    for (const s of [avaliarDescarte(a), avaliarReproducao(a, cfg), avaliarMastite(a, cfg), avaliarQueda(a, cfg)]) {
      if (s && s.impactoDiaEstimado >= PISO_IMPACTO) brutas.push(s);
    }
  }
  // Ordena por impacto R$/dia desc; empate: prazo mais curto primeiro (urgência), depois número.
  brutas.sort((x, y) =>
    y.impactoDiaEstimado - x.impactoDiaEstimado ||
    (x.prazoDias ?? Infinity) - (y.prazoDias ?? Infinity) ||
    x.numero.localeCompare(y.numero),
  );

  const totalPorTipo = Object.fromEntries(TIPOS_SUGESTAO.map((t) => [t, 0])) as Record<TipoSugestao, number>;
  for (const s of brutas) totalPorTipo[s.tipo]++;

  return {
    sugestoes: brutas,
    totalPorTipo,
    impactoDiaTotal: round(brutas.reduce((acc, s) => acc + s.impactoDiaEstimado, 0)),
    precoLeite: round(cfg.precoLeite, 4),
    custoVacaDia: cfg.custoVacaDia,
  };
}
