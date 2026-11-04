import { hoje } from "../../../financeiro/financeiro-ui";
import type { Lote } from "../types";
import { consultarVisaoNutricional, ultimoFechamentoConfirmado, type ResumoNutricional } from "./api";
import { configuracoesMensais, statusMensal, type ConfiguracaoMensal } from "./mensal-api";

export const MODELOS: Record<ConfiguracaoMensal["modelo"], { rotulo: string; texto: string }> = {
  AUTOMATICO: { rotulo: "Baixa automática diária", texto: "O processamento diário efetua as baixas; a conferência mensal permite ajustes." },
  MANUAL: { rotulo: "Confirmar antes de baixar", texto: "O estoque é baixado depois da confirmação dos dias." },
  PROVISORIO: { rotulo: "Estimar e baixar no fechamento", texto: "O consumo diário é virtual; o estoque é baixado na confirmação mensal." },
};

export const somarDias = (iso: string, dias: number) => { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
export const diasEntre = (inicio: string, fim: string) => Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 864e5) + 1;

type LoteRef = Pick<Lote, "id" | "propriedadeId">;
/** Configuração mensal do lote na data: exceção do lote antes do padrão do sítio. */
export function configuracaoNaData(configuracoes: ConfiguracaoMensal[], lote: LoteRef, data: string) {
  const vigentes = configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && c.desde.slice(0, 10) <= data).sort((a, b) => b.desde.localeCompare(a.desde));
  return vigentes.find(c => c.loteId === lote.id) ?? vigentes.find(c => c.loteId === null);
}
/** Primeira data em que o lote passa ao fechamento mensal; antes dela, o consumo fecha por período. */
export function adocaoMensal(configuracoes: ConfiguracaoMensal[], lote: LoteRef) {
  return configuracoes.filter(c => c.propriedadeId === lote.propriedadeId && (c.loteId === null || c.loteId === lote.id)).map(c => c.desde.slice(0, 10)).sort()[0];
}

export type SituacaoLote = {
  resumo: ResumoNutricional;
  /** Último dia já fechado por período. */
  ultimoFim: string | null;
  /** Intervalo que ainda falta fechar por período, até ontem e antes da adoção mensal. */
  inicio: string; fim: string; dias: number;
  /** Fechamento mensal que vale hoje, quando houver. */
  mensal?: ConfiguracaoMensal;
  adocao?: string;
};

/** Para cada lote com dieta vigente: até onde foi fechado e o que falta, respeitando o modelo do lote. */
export function situacaoDoLote(resumo: ResumoNutricional, ultimoFim: string | null, configuracoes: ConfiguracaoMensal[], dia = hoje()): SituacaoLote {
  const desde = resumo.vigente!.desde.slice(0, 10);
  const inicio = ultimoFim && ultimoFim >= desde ? somarDias(ultimoFim, 1) : desde;
  const adocao = adocaoMensal(configuracoes, resumo.lote);
  const ontem = somarDias(dia, -1);
  const fim = adocao && somarDias(adocao, -1) < ontem ? somarDias(adocao, -1) : ontem;
  return { resumo, ultimoFim, inicio, fim, dias: inicio > fim ? 0 : diasEntre(inicio, fim), mensal: configuracaoNaData(configuracoes, resumo.lote, dia), adocao };
}

export async function consultarModelosFechamento() {
  const status = await statusMensal();
  return { ...status, configuracoes: status.habilitada ? await configuracoesMensais() : [] as ConfiguracaoMensal[] };
}

export async function consultarSituacaoFechamentos(): Promise<SituacaoLote[]> {
  const [visao, modelos] = await Promise.all([consultarVisaoNutricional(), consultarModelosFechamento()]);
  const comDieta = visao.lotes.filter(r => r.vigente && r.lote.ativo !== false);
  const ultimos = await Promise.all(comDieta.map(r => ultimoFechamentoConfirmado(r.lote.id)));
  return comDieta.map((resumo, i) => situacaoDoLote(resumo, ultimos[i]?.fim.slice(0, 10) ?? null, modelos.configuracoes))
    .sort((a, b) => b.dias - a.dias || a.resumo.lote.nome.localeCompare(b.resumo.lote.nome, "pt-BR"));
}
