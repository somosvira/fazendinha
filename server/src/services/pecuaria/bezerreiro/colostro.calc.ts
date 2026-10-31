import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

const D = (valor: Prisma.Decimal.Value) => new Prisma.Decimal(valor);
export const VOLUME_UNIDADE_COLOSTRO = new Prisma.Decimal(2);

/** Retirar a embalagem não comprova consumo; a sobra continua vinculada a ela. */
export function saldoUnidadeColostro(volume: Prisma.Decimal.Value, fornecido: Prisma.Decimal.Value, enriquecido: Prisma.Decimal.Value) {
  const restante = D(volume).minus(fornecido).minus(enriquecido);
  if (!restante.isFinite() || restante.lt(0) || restante.gt(volume))
    throw new RebanhoError("CONFLITO", "O consumo diverge do volume da unidade de colostro");
  return restante;
}

/** Unidades congeladas reservam litros da origem; não criam litros novos. */
export function saldoColostro(input: {
  volume: Prisma.Decimal.Value;
  fornecido: Prisma.Decimal.Value;
  enriquecido: Prisma.Decimal.Value;
  congelado: Prisma.Decimal.Value;
}) {
  const total = D(input.volume), consumido = D(input.fornecido).plus(input.enriquecido);
  const reservado = D(input.congelado), disponivel = total.minus(consumido);
  if ([total, consumido, reservado].some(v => !v.isFinite() || v.lt(0)) || disponivel.lt(reservado))
    throw new RebanhoError("CONFLITO", "As alocações de colostro divergem do volume da origem; concilie o histórico");
  return { total, consumido, reservado, disponivel, livre: disponivel.minus(reservado) };
}

export function conciliarDestinacaoColostro(livre: Prisma.Decimal.Value, volumesCrias: Prisma.Decimal.Value[], unidades: number) {
  if (!Number.isSafeInteger(unidades) || unidades < 0) throw new RebanhoError("VALIDACAO", "Informe quantidade inteira de unidades");
  const crias = volumesCrias.map(D);
  if (crias.some(v => !v.isFinite() || !v.gt(0) || v.decimalPlaces() > 3))
    throw new RebanhoError("VALIDACAO", "Informe volume positivo com precisão de até 1 mL para cada cria");
  const fornecido = crias.reduce((s, v) => s.plus(v), D(0));
  const congelado = VOLUME_UNIDADE_COLOSTRO.mul(unidades);
  const destinado = fornecido.plus(congelado);
  if (!destinado.gt(0)) throw new RebanhoError("VALIDACAO", "Informe pelo menos um destino para o colostro");
  if (destinado.gt(livre)) throw new RebanhoError("CONFLITO", "O volume destinado excede o saldo livre da origem");
  return { fornecido, congelado, destinado, sobra: D(livre).minus(destinado) };
}

export function avaliarBrixColostro(resultado: Prisma.Decimal.Value | null, limiteInclusivo: Prisma.Decimal.Value) {
  const limite = D(limiteInclusivo);
  if (!limite.isFinite() || limite.lt(0) || limite.gt(100)) throw new RebanhoError("VALIDACAO", "Limite Brix inválido");
  if (resultado == null) return "PENDENTE" as const;
  const valor = D(resultado);
  if (!valor.isFinite() || valor.lt(0) || valor.gt(100)) throw new RebanhoError("VALIDACAO", "Brix deve estar entre 0 e 100%");
  return valor.gte(limite) ? "ADEQUADO" as const : "ABAIXO_REFERENCIA" as const;
}

/** Ausência de hora não cria uma ordem intradiária. */
export function conferirCronologiaColostro(origem: { data: Date; ocorridoEm?: Date | null; horarioEstimado?: boolean }, fato: { data: Date; ocorridoEm?: Date | null; horarioEstimado?: boolean }) {
  if (fato.data < origem.data || (origem.ocorridoEm && fato.ocorridoEm && !origem.horarioEstimado && !fato.horarioEstimado && fato.ocorridoEm < origem.ocorridoEm))
    throw new RebanhoError("VALIDACAO", "O fato não pode anteceder a origem conhecida do colostro", "data");
}
