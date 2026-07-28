export interface LinhaReconciliacao {
  chave: string;
  observado: number;
  baseline: number;
  divergencia: number;
}

// Compara contagens observadas (o que o app importou/tem) com o baseline informado
// (contagens coladas do IDEAGRI). Uma linha por chave presente em qualquer lado;
// divergencia = observado - baseline; ordena por |divergencia| desc (as maiores
// divergências primeiro). Não embute números de fonte alguma.
export function reconciliarContagens(
  observado: Record<string, number>,
  baseline: Record<string, number>,
): LinhaReconciliacao[] {
  const chaves = new Set([...Object.keys(observado), ...Object.keys(baseline)]);
  const linhas: LinhaReconciliacao[] = [];
  for (const chave of chaves) {
    const obs = observado[chave] ?? 0;
    const base = baseline[chave] ?? 0;
    linhas.push({ chave, observado: obs, baseline: base, divergencia: obs - base });
  }
  return linhas.sort((a, b) => Math.abs(b.divergencia) - Math.abs(a.divergencia) || a.chave.localeCompare(b.chave));
}

export function haDivergencia(linhas: readonly LinhaReconciliacao[]): boolean {
  return linhas.some((l) => l.divergencia !== 0);
}
