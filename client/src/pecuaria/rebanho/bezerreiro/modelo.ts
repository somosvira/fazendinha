import { hojeOperacional } from "../leite/modelo";
import type { AcompanhamentoAnimal, Coleira, Configuracao, Fase, OfertaProgramada, Participacao, Previsao, UnidadeColostro } from './types';
export const numero = (n: string | number | null | undefined) => n == null ? 'Não informado' : Number(n).toLocaleString('pt-BR', {maximumFractionDigits: 3});
export const litros = (n: string | number | null | undefined) => n == null ? 'Não informado' : `${numero(n)} L`;
export const dinheiro = (n: string | number | null | undefined) => n == null ? 'A apurar' : Number(n).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
export function coleiraHistoricaFase(fase: Fase): Coleira | null {
  return fase.coleiraSnapshot ?? fase.coleira;
}
export function faseParticipacao(participacao: Participacao, data = hojeOperacional()): Fase | undefined {
  const saida = participacao.ate?.slice(0, 10);
  const referencia = saida && saida <= data ? new Date(new Date(`${saida}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0,10) : data;
  const periodo = participacao.fases.filter(fase => fase.desde.slice(0,10) <= referencia && (!fase.ate || fase.ate.slice(0,10) > referencia)).sort((a,b) => b.desde.localeCompare(a.desde))[0];
  return periodo ? {...periodo.faseVersao, coleira: coleiraHistoricaFase(periodo.faseVersao)} : undefined;
}
export const ofertasConfiguracao = (c: Configuracao): OfertaProgramada[] => [...new Map(c.fases.flatMap(f => f.ofertas).map(o => [o.identidadeId, o])).values()].sort((a,b) => a.ordem-b.ordem);
export function volumePrevisto(grupo: Previsao['grupos'][number], identidade: string): number {
  if (!identidade) return Number(grupo.litrosDia);
  return Math.round(grupo.participantes.reduce((total, p) => total + Number(p.litrosDia) * Number(p.ofertas.find(o => o.identidadeId === identidade)?.percentual ?? 0) / 100, 0) * 1000) / 1000;
}
export function validarOfertas(ofertas: OfertaProgramada[], litrosDia: number): string | null {
  if (new Set(ofertas.map(o => o.identidadeId)).size !== ofertas.length) return 'Cada oferta precisa ter identidade própria.';
  if (ofertas.some(o => !Number.isFinite(Number(o.percentual)) || Number(o.percentual) < 0 || Number(o.percentual) > 100)) return 'Informe percentuais entre 0 e 100.';
  if (litrosDia > 0 && (!ofertas.length || Math.abs(ofertas.reduce((n,o) => n+Number(o.percentual),0)-100) > .00001)) return 'Distribua exatamente 100% entre as ofertas de leite.';
  return null;
}
export function horarioRealizado(data: string, horario: string): string | null {
  return horario ? new Date(`${data}T${horario}:00`).toISOString() : null;
}
export const textoFisico = (valor: unknown): string => {
  if (!valor || typeof valor !== 'object') return 'Não informado';
  const v = valor as Record<string, unknown>;
  return [v.tanqueNome ?? v.nome ?? v.recipiente, v.versao ? `v${String(v.versao)}` : null].filter(Boolean).join(' · ') || 'Registrado na produção';
};

export function saldoUnidadeColostro(unidade: Pick<UnidadeColostro, 'saldoRestanteLitros'>): number {
  const saldo = Number(unidade.saldoRestanteLitros);
  return Number.isFinite(saldo) ? Math.max(0, saldo) : 0;
}
/** Brix do fornecimento mantém a evidência aplicada na destinação, inclusive após estorno. */
export function brixFornecimentoColostro(fornecimento: Pick<AcompanhamentoAnimal['colostro'][number], 'qualidadeBrix' | 'origens'>): string {
  const resultados = fornecimento.qualidadeBrix != null ? [fornecimento.qualidadeBrix] : (fornecimento.origens ?? []).flatMap(origem => origem.brixAplicado?.resultado != null ? [origem.brixAplicado.resultado] : []);
  const distintos = [...new Set(resultados.map(resultado => numero(resultado)))];
  return distintos.length ? distintos.map(resultado => `${resultado}%`).join(' / ') : 'Não aferido';
}
export function ofertasDaPrevisao(previsao: Previsao): OfertaProgramada[] {
  return [...new Map(previsao.grupos.flatMap(grupo => grupo.participantes.flatMap(participante => participante.ofertas)).map(oferta => [oferta.identidadeId, oferta])).values()].sort((a,b) => a.ordem - b.ordem);
}
export function idOfertaDaPrevisao(previsao: Previsao, identidade: string): string | null {
  return previsao.grupos.flatMap(grupo => grupo.participantes.flatMap(participante => participante.ofertas)).find(oferta => oferta.identidadeId === identidade && oferta.id)?.id ?? null;
}
export function ofertaJaRealizada(previsao: Previsao, identidade: string): boolean {
  const ids = new Set(previsao.grupos.flatMap(grupo => grupo.participantes.flatMap(participante => participante.ofertas)).filter(oferta => oferta.identidadeId === identidade).map(oferta => oferta.id));
  return previsao.ofertasRealizadas.some(realizada => realizada.ofertaProgramadaId != null && ids.has(realizada.ofertaProgramadaId));
}
