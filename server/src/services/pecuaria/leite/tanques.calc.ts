import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
/** Litros e régua são observações manuais independentes. Capacidade só existe no cadastro. */
export function conferirConversaoTanque(
  input: { litros: number; reguaMm?: number | null },
  tanque: { capacidadeLitros: Prisma.Decimal.Value; tabelaConversao?: { mm: number; litros: number }[] } | null,
) {
  if (tanque && new Prisma.Decimal(input.litros).gt(tanque.capacidadeLitros))
    throw new RebanhoError("VALIDACAO", "Os litros superam a capacidade desta aferição do tanque");
  return "LITROS_INFORMADOS";
}
export function proximaAfericaoIndividual(
  ultima: string,
  quantidade: number,
  unidade: "DIAS" | "MESES",
) {
  const data = new Date(`${ultima}T00:00:00Z`);
  if (unidade === "DIAS") data.setUTCDate(data.getUTCDate() + quantidade);
  else {
    const dia = data.getUTCDate();
    data.setUTCDate(1);
    data.setUTCMonth(data.getUTCMonth() + quantidade);
    const ultimo = new Date(
      Date.UTC(data.getUTCFullYear(), data.getUTCMonth() + 1, 0),
    ).getUTCDate();
    data.setUTCDate(Math.min(dia, ultimo));
  }
  return data.toISOString().slice(0, 10);
}
