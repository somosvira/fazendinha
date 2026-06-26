import { prisma } from "../../db.js";
import type { ModoProducao } from "@prisma/client";

export interface ConfigDTO { producaoModo: ModoProducao; precoLeite: number | null }
export interface ConfigInput { producaoModo?: ModoProducao; precoLeite?: number | null }

const toNum = (v: any): number | null => (v == null ? null : Number(v));

export async function obterConfig(): Promise<ConfigDTO> {
  const c = await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  return { producaoModo: c.producaoModo, precoLeite: toNum(c.precoLeite) };
}

export async function salvarConfig(input: ConfigInput): Promise<ConfigDTO> {
  const data: Record<string, unknown> = {};
  if (input.producaoModo !== undefined) data.producaoModo = input.producaoModo;
  if (input.precoLeite !== undefined) data.precoLeite = input.precoLeite;
  const c = await prisma.configuracao.upsert({
    where: { id: 1 },
    create: { id: 1, producaoModo: input.producaoModo ?? "ORDENHA", precoLeite: input.precoLeite ?? null },
    update: data,
  });
  return { producaoModo: c.producaoModo, precoLeite: toNum(c.precoLeite) };
}
