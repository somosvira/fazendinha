import { hoje } from "../../../financeiro/financeiro-ui";
import type { Lote } from "../types";
import { compartilhada, consultarVisaoNutricional, listarDietas, ultimosFechamentos, type ResumoNutricional } from "./api";
import { configuracoesMensais, processadosMensais, statusMensal, type ConfiguracaoMensal } from "./mensal-api";

export const MODELOS: Record<ConfiguracaoMensal["modelo"], { rotulo: string; texto: string }> = {
  AUTOMATICO: { rotulo: "Diário automático", texto: "Todo dia o estoque é descontado sozinho; na conferência mensal, ajuste as diferenças." },
  MANUAL: { rotulo: "Diário manual", texto: "Todo dia alguém confirma as quantidades, e o estoque é descontado na confirmação." },
  PROVISORIO: { rotulo: "Mensal", texto: "O consumo diário fica estimado; o estoque é descontado ao fechar o mês." },
};

export const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
export const diasEntre = (inicio: string, fim: string) => Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 864e5) + 1;

type LoteRef = Pick<Lote, "id" | "propriedadeId">;
/** Configuração mensal do lote na data: exceção do lote antes do padrão do sítio. */
export function configuracaoNaData(configuracoes: ConfiguracaoMensal[], lote: LoteRef, data: string) {
  const vigentes = configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && c.desde.slice(0, 10) <= data).sort((a, b) => b.desde.localeCompare(a.desde));
  return vigentes.find(c => c.loteId === lote.id) ?? vigentes.find(c => c.loteId === null);
}
/** Primeira data em que o lote passa a um tipo de fechamento (diário automático, diário manual ou mensal); antes dela, o consumo fecha por período. */
export function adocaoMensal(configuracoes: ConfiguracaoMensal[], lote: LoteRef) {
  return configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && (c.loteId === null || c.loteId === lote.id)).map(c => c.desde.slice(0, 10)).sort()[0];
}

export type SituacaoLote = {
  resumo: ResumoNutricional;
  /** Último dia já fechado por período. */
  ultimoFim: string | null;
  /** Intervalo que ainda falta fechar por período, até ontem e antes da adoção mensal. */
  inicio: string; fim: string; dias: number;
  /** Tipo de fechamento que vale hoje, quando houver. */
  mensal?: ConfiguracaoMensal;
  /** Tipo de fechamento que passa a valer na adoção. */
  configuracaoAdocao?: ConfiguracaoMensal;
  adocao?: string;
  /** Dias do tipo de fechamento (diário ou mensal) ainda não processados, da adoção até ontem. */
  diarios?: { processadoAte: string | null; inicio: string; fim: string; dias: number };
};

/** Para cada lote com dieta vigente: até onde foi fechado e o que falta, respeitando o modelo do lote. */
/** Com leite produzido na fazenda na dieta, o lote continua fechando por período: o tipo diário ou mensal não se aplica. */
export function situacaoDoLote(resumo: ResumoNutricional, ultimoFim: string | null, configuracoes: ConfiguracaoMensal[], dia = hoje(), processadoAte: string | null = null, usaLeiteProprio = false): SituacaoLote {
  if (usaLeiteProprio) configuracoes = [];
  const desde = resumo.vigente!.desde.slice(0, 10);
  const inicio = ultimoFim && ultimoFim >= desde ? somarDias(ultimoFim, 1) : desde;
  const adocao = adocaoMensal(configuracoes, resumo.lote);
  const ontem = somarDias(dia, -1);
  const fim = adocao && somarDias(adocao, -1) < ontem ? somarDias(adocao, -1) : ontem;
  // Depois da adoção, os dias são processados um a um; conta o que ainda não foi processado até ontem.
  const inicioDiario = [adocao, desde, processadoAte ? somarDias(processadoAte, 1) : undefined].filter((v): v is string => !!v).sort().at(-1);
  const diarios = adocao && adocao <= ontem && inicioDiario ? { processadoAte, inicio: inicioDiario, fim: ontem, dias: inicioDiario > ontem ? 0 : diasEntre(inicioDiario, ontem) } : undefined;
  return { resumo, ultimoFim, inicio, fim, dias: inicio > fim ? 0 : diasEntre(inicio, fim), mensal: configuracaoNaData(configuracoes, resumo.lote, dia), adocao, configuracaoAdocao: adocao ? configuracaoNaData(configuracoes, resumo.lote, adocao) : undefined, diarios };
}

export const consultarModelosFechamento = () => compartilhada("modelos", lerModelosFechamento);
async function lerModelosFechamento() {
  const status = await statusMensal();
  return { ...status, configuracoes: status.habilitada ? await configuracoesMensais() : [] as ConfiguracaoMensal[] };
}

export async function consultarSituacaoFechamentos(): Promise<SituacaoLote[]> {
  const [visao, modelos, dietas] = await Promise.all([consultarVisaoNutricional(), consultarModelosFechamento(), listarDietas().catch(() => [])]);
  const comLeite = new Set(dietas.filter(d => d.usaLeiteProprio).map(d => d.id));
  const comDieta = visao.lotes.filter(r => r.vigente && r.lote.ativo !== false);
  // Duas consultas para todos os lotes, em vez de uma por lote.
  const [ultimos, processados] = await Promise.all([ultimosFechamentos(), modelos.habilitada ? processadosMensais().catch(() => ({} as Record<string, string>)) : Promise.resolve({} as Record<string, string>)]);
  return comDieta.map(resumo => situacaoDoLote(resumo, ultimos[resumo.lote.id] ?? null, modelos.configuracoes, hoje(), comLeite.has(resumo.vigente!.dieta.id) || !adocaoMensal(modelos.configuracoes, resumo.lote) ? null : processados[resumo.lote.id] ?? null, comLeite.has(resumo.vigente!.dieta.id)))
    .sort((a, b) => b.dias + (b.diarios?.dias ?? 0) - a.dias - (a.diarios?.dias ?? 0) || a.resumo.lote.nome.localeCompare(b.resumo.lote.nome, "pt-BR"));
}
