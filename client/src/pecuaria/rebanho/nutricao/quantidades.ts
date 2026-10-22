/** Apresentação de quantidades (não dinheiro), preservando até seis casas do DTO. */
export function quantidadeNutricional(valor: string): string {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString("pt-BR", { maximumFractionDigits: 6 }) : valor;
}
