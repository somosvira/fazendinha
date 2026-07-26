export interface EtapaResumoLote {
  dia: number;
  ordem: number;
  concluidas: number;
  puladas: number;
  pendentes: number;
  atrasadas: number;
}

export function alternarExcecaoAnimal(
  atuais: readonly number[],
  animalId: number,
  marcada: boolean,
): number[] {
  const ids = new Set(atuais);
  if (marcada) ids.add(animalId);
  else ids.delete(animalId);
  return [...ids].sort((a, b) => a - b);
}

const parte = (n: number, singular: string, plural: string) =>
  n > 0 ? `${n} ${n === 1 ? singular : plural}` : null;

export function rotuloResumoEtapa(etapa: EtapaResumoLote): string {
  return [
    parte(etapa.concluidas, "feita", "feitas"),
    parte(etapa.puladas, "pulada", "puladas"),
    parte(etapa.pendentes, "pendente", "pendentes"),
    parte(etapa.atrasadas, "atrasada", "atrasadas"),
  ].filter(Boolean).join(" · ");
}
