import { prisma } from "../../db.js";
import type { ModoProducao } from "@prisma/client";

export async function obterConfig(): Promise<{ producaoModo: ModoProducao }> {
  const c = await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  return { producaoModo: c.producaoModo };
}

export async function salvarConfig(producaoModo: ModoProducao): Promise<{ producaoModo: ModoProducao }> {
  const c = await prisma.configuracao.upsert({ where: { id: 1 }, create: { id: 1, producaoModo }, update: { producaoModo } });
  return { producaoModo: c.producaoModo };
}
