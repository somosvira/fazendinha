import { hashDados } from "../reproducao/operacoes.js";
import type { Prisma } from "@prisma/client";
type Formato = { id: string; tipoResultado: string; versaoFormato: number; campos: Prisma.JsonValue; unidade: string | null; opcoes: Prisma.JsonValue };
/** Nome e ativação podem mudar; o formato escolhido para a coleta precisa permanecer o mesmo. */
export function hashFormatoExame(tipo: Formato): string {
  const { id, tipoResultado, versaoFormato, campos, unidade, opcoes } = tipo;
  return hashDados({ id, tipoResultado, versaoFormato, campos, unidade, opcoes });
}
