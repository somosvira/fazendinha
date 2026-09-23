// Brinco: único entre animais ATIVOS do mesmo sítio; reuso permitido após saída.

export interface AnimalAtivoNoSitio {
  brinco: string;
  propriedadeId: number;
  animalId: string;
}

export function normalizarBrinco(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, " ");
}

export function brincoDisponivel(input: {
  brinco: string;
  propriedadeId: number;
  ativosNoSitio: AnimalAtivoNoSitio[];
  ignorarAnimalId?: string;
}): boolean {
  const alvo = normalizarBrinco(input.brinco);

  return !input.ativosNoSitio.some(
    (a) =>
      a.propriedadeId === input.propriedadeId &&
      normalizarBrinco(a.brinco) === alvo &&
      a.animalId !== input.ignorarAnimalId,
  );
}
