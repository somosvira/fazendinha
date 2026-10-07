import { getHojeISO } from "../../../lib/hoje";

/** Subtrai um dia civil, sem atravessar o fuso local com toISOString(). */
export function ontemConsumo(hoje = getHojeISO()): string {
  const [ano, mes, dia] = hoje.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia - 1)).toISOString().slice(0, 10);
}
