/** Intervalo de permanência [desde, ate), com `ate = null` ainda aberto. */
export type PermanenciaLote = { animalId: string; desde: Date; ate: Date | null };
export type Participacao = { animalId: string; dias: number };

const DIA_MS = 86_400_000;
const tempo = (data: Date) => Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());

/** O fechamento recebe início/fim inclusivos; o dia da transferência conta só no destino. */
export function calcularAnimalDias(permanencias: PermanenciaLote[], inicio: Date, fim: Date): { animalDias: number; participacoes: Participacao[] } {
  const inicioMs = tempo(inicio);
  const fimExclusivo = tempo(fim) + DIA_MS;
  if (fimExclusivo <= inicioMs) throw new Error("Período inválido");
  const porAnimal = new Map<string, Array<[number, number]>>();
  for (const p of permanencias) {
    const de = Math.max(tempo(p.desde), inicioMs);
    const ate = Math.min(p.ate ? tempo(p.ate) : fimExclusivo, fimExclusivo);
    if (ate <= de) continue;
    const lista = porAnimal.get(p.animalId) ?? [];
    lista.push([de, ate]);
    porAnimal.set(p.animalId, lista);
  }
  const participacoes: Participacao[] = [];
  for (const [animalId, intervalos] of porAnimal) {
    intervalos.sort((a, b) => a[0] - b[0]);
    let dias = 0;
    let [aberto, fechado] = intervalos[0];
    for (const [de, ate] of intervalos.slice(1)) {
      if (de <= fechado) fechado = Math.max(fechado, ate);
      else { dias += (fechado - aberto) / DIA_MS; [aberto, fechado] = [de, ate]; }
    }
    dias += (fechado - aberto) / DIA_MS;
    participacoes.push({ animalId, dias });
  }
  participacoes.sort((a, b) => a.animalId.localeCompare(b.animalId));
  return { animalDias: participacoes.reduce((n, p) => n + p.dias, 0), participacoes };
}
