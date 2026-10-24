import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";
/** Somente pontos documentados. Não extrapola a capacidade nem interpola sem regra aprovada. */
export function conferirConversaoTanque(
  input: { litros: number; reguaMm?: number | null },
  tanque: {
    capacidadeLitros: Prisma.Decimal.Value;
    tabelaConversao: { mm: number; litros: number }[];
  },
) {
  if (new Prisma.Decimal(input.litros).gt(tanque.capacidadeLitros))
    throw new RebanhoError(
      "VALIDACAO",
      "Os litros superam a capacidade desta aferição do tanque",
    );
  if (input.reguaMm == null) return "LITROS_INFORMADOS";
  const ponto = tanque.tabelaConversao.find((p) =>
    new Prisma.Decimal(p.mm).eq(input.reguaMm!),
  );
  if (!ponto)
    throw new RebanhoError(
      "VALIDACAO",
      "Esta leitura não consta na tabela cadastrada. Complete a tabela ou registre somente os litros aferidos, sem inferir conversão.",
    );
  if (!new Prisma.Decimal(ponto.litros).eq(input.litros))
    throw new RebanhoError(
      "VALIDACAO",
      `A tabela desta versão indica ${ponto.litros} L para ${input.reguaMm} mm`,
    );
  return "TABELA_TANQUE";
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
