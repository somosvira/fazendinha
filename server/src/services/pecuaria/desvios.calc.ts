export type DiferencaExecucao<Valor = unknown> = { campo: string; planejado: Valor; realizado: Valor };
export type ComparacaoExecucao<Valor = unknown> = { aferido: boolean; diferencas: DiferencaExecucao<Valor>[] };

/** Os executores normalizam os valores conforme a ação; ausência de plano não é conformidade. */
export function compararParametros<Valor>(
  planejado: Record<string, Valor>,
  realizado: Record<string, Valor>,
  aferido: boolean,
): ComparacaoExecucao<Valor> {
  return { aferido, diferencas: Object.keys(planejado)
    .filter((campo) => JSON.stringify(planejado[campo]) !== JSON.stringify(realizado[campo]))
    .map((campo) => ({ campo, planejado: planejado[campo], realizado: realizado[campo] })) };
}

export function exigeMotivoExecucao(comparacao: ComparacaoExecucao): boolean {
  return !comparacao.aferido || comparacao.diferencas.length > 0;
}
