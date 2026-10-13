/** Os eventos recebidos já devem excluir anulados e os cobertos pelo saldo de entrada. */
export function totalPartosCategoria(
  animal: { partosAntesDaEntrada: number; partos?: ReadonlyArray<{ data: Date }> },
  dataReferencia: Date,
): number {
  return animal.partosAntesDaEntrada + (animal.partos ?? []).filter((parto) => parto.data <= dataReferencia).length;
}
