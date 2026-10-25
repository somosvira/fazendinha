import { Prisma } from "@prisma/client";
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
/** Litros expedidos são imutáveis; reconhecimento e ajuste só compõem o acordo. */
export function calcularFechamentoLeite(
  origens: { id: string; quantidade: Prisma.Decimal.Value }[],
  parcelas: {
    retiradaId: string;
    quantidadeReconhecida: Prisma.Decimal.Value;
    motivoDiferenca?: string | null;
  }[],
  preco: Prisma.Decimal.Value,
  ajuste: Prisma.Decimal.Value = 0,
) {
  if (
    !origens.length ||
    parcelas.length !== origens.length ||
    new Set(parcelas.map((p) => p.retiradaId)).size !== origens.length
  )
    throw new Error(
      "O fechamento deve detalhar todas as retiradas uma única vez",
    );
  let volume = D(0);
  for (const origem of origens) {
    const parcela = parcelas.find((p) => p.retiradaId === origem.id);
    if (!parcela)
      throw new Error("Há retirada sem reconhecimento no fechamento");
    const q = D(parcela.quantidadeReconhecida);
    if (!q.isFinite() || q.lt(0) || q.gt("999999999.999"))
      throw new Error("Quantidade reconhecida inválida");
    if (
      !q.eq(origem.quantidade) &&
      (parcela.motivoDiferenca?.trim().length ?? 0) < 5
    )
      throw new Error(
        "Justifique a diferença entre litros retirados e reconhecidos em cada retirada",
      );
    volume = volume.plus(q);
  }
  const p = D(preco),
    a = D(ajuste);
  if (!p.isFinite() || !p.gt(0) || !a.isFinite())
    throw new Error("Preço ou ajuste inválido");
  const bruto = volume
      .times(p)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    total = bruto.plus(a);
  if (
    !volume.gt(0) ||
    volume.gt("999999999.999") ||
    !total.gt(0) ||
    total.gt("999999999999.99")
  )
    throw new Error(
      "O fechamento precisa de volume e valor positivos dentro dos limites permitidos",
    );
  return { volume, bruto, total };
}
