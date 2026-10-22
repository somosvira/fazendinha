import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
export function repartirDestinoLeite(saldo: Prisma.Decimal.Value, parcelas: readonly { quantidadeLitros: number }[]) {
  const antes = new Prisma.Decimal(saldo);
  if (!antes.isFinite() || antes.lt(0) || parcelas.some(p => !Number.isFinite(p.quantidadeLitros) || p.quantidadeLitros <= 0 || new Prisma.Decimal(p.quantidadeLitros).decimalPlaces() > 3))
    throw new RebanhoError("VALIDACAO", "Informe saldo válido e parcelas positivas com até três casas decimais");
  const servido = parcelas.reduce((s, p) => s.plus(p.quantidadeLitros), new Prisma.Decimal(0));
  if (!servido.gt(0) || servido.gt(antes)) throw new RebanhoError("VALIDACAO", "As parcelas devem ser positivas e caber no saldo da origem");
  return { saldoOrigemAntes: antes, quantidadeLitros: servido, saldoOrigemDepois: antes.minus(servido) };
}
