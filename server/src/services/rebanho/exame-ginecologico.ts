import { prisma } from "../../db.js";
import type { PrismaClient } from "@prisma/client";
import type { AchadoGinecologico } from "./eventos.schemas.js";

export interface ResultadoGinecologicoSeed {
  codigo: number;
  nomeResumido: string;
  nomeCompleto: string | null;
  tipo: string | null;
  padrao: boolean;
}

export interface ResultadoGinecologicoDTO extends ResultadoGinecologicoSeed {
  id: number;
}

// Códigos negativos são reservados ao conjunto-semente local. Os códigos oficiais
// positivos do IDEAGRI substituem este catálogo quando a fonte for reextraída.
export const RESULTADOS_GINECOLOGICOS_SEMENTE: readonly ResultadoGinecologicoSeed[] = [
  { codigo: -1, nomeResumido: "Ciclando", nomeCompleto: "Atividade ovariana cíclica", tipo: "OVARIO", padrao: true },
  { codigo: -2, nomeResumido: "Cio", nomeCompleto: "Animal em cio", tipo: "OVARIO", padrao: false },
  { codigo: -3, nomeResumido: "Corpo lúteo", nomeCompleto: "Corpo lúteo presente", tipo: "OVARIO", padrao: false },
  { codigo: -4, nomeResumido: "Gestante", nomeCompleto: "Gestação identificada no exame", tipo: "UTERO", padrao: false },
  { codigo: -5, nomeResumido: "Anestro", nomeCompleto: "Ausência de atividade ovariana", tipo: "OVARIO", padrao: false },
  { codigo: -6, nomeResumido: "Cisto folicular", nomeCompleto: "Cisto ovariano folicular", tipo: "OVARIO", padrao: false },
  { codigo: -7, nomeResumido: "Cisto lúteo", nomeCompleto: "Cisto ovariano luteinizado", tipo: "OVARIO", padrao: false },
  { codigo: -8, nomeResumido: "Endometrite", nomeCompleto: "Sinais compatíveis com endometrite", tipo: "UTERO", padrao: false },
  { codigo: -9, nomeResumido: "Indefinido", nomeCompleto: "Resultado inconclusivo", tipo: null, padrao: false },
];

const SEMENTE_POR_ACHADO: Record<AchadoGinecologico, ResultadoGinecologicoSeed> = {
  CICLANDO: RESULTADOS_GINECOLOGICOS_SEMENTE[0],
  CIO: RESULTADOS_GINECOLOGICOS_SEMENTE[1],
  CORPO_LUTEO: RESULTADOS_GINECOLOGICOS_SEMENTE[2],
  GESTANTE: RESULTADOS_GINECOLOGICOS_SEMENTE[3],
  ANESTRO: RESULTADOS_GINECOLOGICOS_SEMENTE[4],
  CISTO_FOLICULAR: RESULTADOS_GINECOLOGICOS_SEMENTE[5],
  CISTO_LUTEO: RESULTADOS_GINECOLOGICOS_SEMENTE[6],
  ENDOMETRITE: RESULTADOS_GINECOLOGICOS_SEMENTE[7],
  INDEFINIDO: RESULTADOS_GINECOLOGICOS_SEMENTE[8],
};

export function mapaAchadoParaResultado(achado: AchadoGinecologico): ResultadoGinecologicoSeed {
  return SEMENTE_POR_ACHADO[achado];
}

type DbResultadoGinecologico = Pick<PrismaClient, "resultadoExameGinecologico">;

export async function semearResultadosGinecologicos(
  db: DbResultadoGinecologico,
  lista: readonly ResultadoGinecologicoSeed[],
): Promise<void> {
  for (const item of lista) {
    await db.resultadoExameGinecologico.upsert({
      where: { codigo: item.codigo },
      create: { ...item },
      update: {
        nomeResumido: item.nomeResumido,
        nomeCompleto: item.nomeCompleto,
        tipo: item.tipo,
        padrao: item.padrao,
      },
    });
  }
}

export async function listarResultadosGinecologicos(
  db: DbResultadoGinecologico = prisma,
): Promise<ResultadoGinecologicoDTO[]> {
  const resultados = await db.resultadoExameGinecologico.findMany({
    orderBy: [{ padrao: "desc" }, { nomeResumido: "asc" }],
  });
  return resultados.some((item) => item.codigo > 0)
    ? resultados.filter((item) => item.codigo > 0)
    : resultados;
}

export async function garantirResultadosGinecologicosSemente(): Promise<void> {
  await semearResultadosGinecologicos(prisma, RESULTADOS_GINECOLOGICOS_SEMENTE);
}
