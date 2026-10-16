export type PartoParaContagem = {
  data: Date;
  status?: string;
  incluidoSaldoAnterior?: boolean;
};

/** Também aceita a seleção histórica já filtrada dos leitores de categorias. */
export function partosContabilizaveis(
  partos: ReadonlyArray<PartoParaContagem>,
  referencia: Date,
): PartoParaContagem[] {
  return partos.filter((p) => p.data <= referencia &&
    (p.status === undefined || p.status === "VALIDO") && !p.incluidoSaldoAnterior);
}

export function contarPartos(
  saldoAnterior: number,
  partos: ReadonlyArray<PartoParaContagem>,
  referencia: Date,
): number {
  return saldoAnterior + partosContabilizaveis(partos, referencia).length;
}

export function totalPartosCategoria(
  animal: { partosAntesDaEntrada: number; partos?: ReadonlyArray<PartoParaContagem> },
  dataReferencia: Date,
): number {
  return contarPartos(animal.partosAntesDaEntrada, animal.partos ?? [], dataReferencia);
}
