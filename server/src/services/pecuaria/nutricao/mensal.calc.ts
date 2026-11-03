import { Prisma } from "@prisma/client";
import { z } from "zod";

export const dataCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return Number.isFinite(+d) && d.toISOString().slice(0, 10) === v;
  }, "Data inválida");
export const modeloSchema = z.enum(["AUTOMATICO", "MANUAL", "PROVISORIO"]);
export const configuracaoSchema = z
  .object({
    propriedadeId: z.number().int().positive(),
    loteId: z.string().uuid().nullable(),
    modelo: modeloSchema,
    diaConferencia: z.number().int().min(1).max(31),
    autorizaValidade: z.boolean(),
    desde: dataCivil,
  })
  .strict();
export type ConfiguracaoInput = z.infer<typeof configuracaoSchema>;
export const quantidadeSchema = z
  .string()
  .regex(
    /^\d{1,9}(\.\d{1,3})?$/,
    "Informe uma quantidade não negativa com até três casas decimais",
  );
export const competenciaSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
export const comoData = (v: string) => new Date(v + "T00:00:00Z");
export const textoData = (v: Date) => v.toISOString().slice(0, 10);
export function somarDias(v: string, dias: number) {
  return textoData(new Date(+comoData(v) + dias * 86400000));
}
export function proximoMes(v: string) {
  const d = comoData(v.slice(0, 7) + "-01");
  return textoData(
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)),
  );
}
export function prazoMes(mes: string, dia: number) {
  if (
    !Number.isInteger(dia) ||
    dia < 1 ||
    dia > 31 ||
    !competenciaSchema.safeParse(mes).success
  )
    throw new Error("Calendário inválido");
  const inicio = comoData(proximoMes(mes + "-01"));
  const ultimo = new Date(
    Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return textoData(
    new Date(
      Date.UTC(
        inicio.getUTCFullYear(),
        inicio.getUTCMonth(),
        Math.min(dia, ultimo),
      ),
    ),
  );
}
/** Conserva unidades mínimas. A ordem dos registros precisa ser estável. */
export function repartirQuantidade(
  total: Prisma.Decimal.Value,
  pesos: Prisma.Decimal.Value[],
  casas = 3,
): Prisma.Decimal[] {
  const n = new Prisma.Decimal(total),
    fator = new Prisma.Decimal(10).pow(casas);
  const ps = pesos.map((p) => new Prisma.Decimal(p));
  if (
    !n.isFinite() ||
    n.lt(0) ||
    n.decimalPlaces() > casas ||
    ps.some((p) => !p.isFinite() || p.lt(0))
  )
    throw new Error("Distribuição inválida");
  if (n.isZero()) return ps.map(() => new Prisma.Decimal(0));
  const soma = ps.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
  if (soma.isZero()) throw new Error("Quantidade sem participantes elegíveis");
  const partes = ps.map((p, i) => {
    const q = n.mul(fator).mul(p).div(soma);
    const inteiro = q.floor();
    return { i, inteiro, resto: q.minus(inteiro) };
  });
  const resto = n
    .mul(fator)
    .minus(partes.reduce((a, b) => a.plus(b.inteiro), new Prisma.Decimal(0)))
    .toNumber();
  [...partes]
    .sort((a, b) => b.resto.comparedTo(a.resto) || a.i - b.i)
    .slice(0, resto)
    .forEach((p) => {
      p.inteiro = p.inteiro.plus(1);
    });
  return partes.map((p) => p.inteiro.div(fator));
}

/** Consome uma seleção mensal em ordem, conservando exatamente cada partida. */
export function distribuirPartidas<T extends { quantidade: string | number }>(
  selecoes: T[],
  complementos: Prisma.Decimal[],
): T[][] {
  const saldos = selecoes.map((p) => new Prisma.Decimal(p.quantidade));
  if (
    saldos.some((q) => !q.isFinite() || q.lte(0) || q.decimalPlaces() > 3) ||
    !saldos
      .reduce((a, b) => a.plus(b), new Prisma.Decimal(0))
      .eq(complementos.reduce((a, b) => a.plus(b), new Prisma.Decimal(0)))
  )
    throw new Error(
      "A seleção de partidas deve corresponder à saída complementar",
    );
  let indice = 0;
  return complementos.map((quantidade) => {
    let falta = quantidade;
    const partes: T[] = [];
    while (falta.gt(0)) {
      const q = Prisma.Decimal.min(falta, saldos[indice]);
      partes.push({ ...selecoes[indice], quantidade: q.toFixed(3) });
      falta = falta.minus(q);
      saldos[indice] = saldos[indice].minus(q);
      if (saldos[indice].isZero()) indice++;
    }
    return partes;
  });
}
