/** Formata a leitura; preserva texto e nunca altera o valor do laudo. */
export function valorResultadoQualidade(valor: unknown, tipo?: string): string {
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  const numero = typeof valor === 'number' ? valor : tipo === 'NUMERO' && typeof valor === 'string' && /^-?\d+(\.\d+)?$/.test(valor) ? Number(valor) : null;
  return numero !== null && Number.isFinite(numero) ? numero.toLocaleString('pt-BR', { maximumFractionDigits: 12 }) : String(valor);
}
