/** Nome de apresentação do tipo de sistema; nomes de tipos próprios permanecem intactos. */
export function nomeExame(id: unknown, nome: unknown): string {
  return id === "b0841f3c-3f88-4c2d-9d0d-3ef33d49b841" ? "Escore de condição corporal (ECC)" : typeof nome === "string" ? nome : "Exame";
}

export function camposExameParaExibicao<T extends { codigo: string; rotulo?: string }>(id: unknown, campos: T[]): T[] {
  return id === "b0841f3c-3f88-4c2d-9d0d-3ef33d49b841" ? campos.map(c => c.codigo === "ESCORE" ? { ...c, rotulo: "Escore de condição corporal (ECC)" } : c) : campos;
}
