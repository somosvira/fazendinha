import { prisma } from "../../db.js";
import { recomputarSanidade } from "./eventos-sanidade.js";
import { recomputarQuartos, type EstadoQuarto, type Quarto } from "./quarto.recompute.js";
import type { RegistrarExameQuartoInput } from "./exames-quarto.schemas.js";

export class ExameQuartoError extends Error {
  constructor(public code: "NAO_ENCONTRADO", message: string) {
    super(message);
  }
}

const iso = (x: Date | null) => (x ? new Date(x).toISOString().slice(0, 10) : null);

export interface ExameQuartoDTO {
  id: number;
  data: string;
  quarto: Quarto;
  scoreCmt: string | null;
  ccs: number | null;
  clinica: boolean;
  severidade: string | null;
  resultadoCultivo: string | null;
  perdido: boolean;
  escoreTeto: number | null; // hiperqueratose da ponta do teto, 1–4
  observacao: string | null;
}

export interface SaudeUbereDTO {
  exames: ExameQuartoDTO[];
  porQuarto: ReturnType<typeof recomputarQuartos>["porQuarto"];
  quartosCronicos: number;
  quartosPerdidos: number;
}

function toDTO(e: {
  id: number; data: Date; quarto: Quarto; scoreCmt: string | null; ccs: number | null;
  clinica: boolean; severidade: string | null; resultadoCultivo: string | null; perdido: boolean; escoreTeto: number | null; observacao: string | null;
}): ExameQuartoDTO {
  return { id: e.id, data: iso(e.data)!, quarto: e.quarto, scoreCmt: e.scoreCmt, ccs: e.ccs, clinica: e.clinica, severidade: e.severidade, resultadoCultivo: e.resultadoCultivo, perdido: e.perdido, escoreTeto: e.escoreTeto, observacao: e.observacao };
}

// Grava uma passada como 1..4 linhas de ExameQuarto e recomputa a sanidade do animal.
export async function registrarExameQuarto(animalId: number, input: RegistrarExameQuartoInput): Promise<SaudeUbereDTO> {
  const animal = await prisma.animal.findUnique({ where: { id: animalId }, select: { id: true, propriedadeId: true } });
  if (!animal) throw new ExameQuartoError("NAO_ENCONTRADO", "animal não encontrado");
  const data = new Date(input.data);
  await prisma.exameQuarto.createMany({
    data: input.quartos.map((q) => ({
      animalId,
      data,
      quarto: q.quarto,
      scoreCmt: q.scoreCmt ?? null,
      ccs: q.ccs ?? null,
      clinica: q.clinica ?? false,
      severidade: q.severidade ?? null,
      resultadoCultivo: q.resultadoCultivo ?? null,
      perdido: q.perdido ?? false,
      escoreTeto: q.escoreTeto ?? null,
      observacao: q.observacao ?? null,
      propriedadeId: animal.propriedadeId,
    })),
  });
  await recomputarSanidade(animalId);
  return listarSaudeUbere(animalId);
}

// Série + estado por quarto para a ficha do animal.
export async function listarSaudeUbere(animalId: number): Promise<SaudeUbereDTO> {
  const exs = await prisma.exameQuarto.findMany({ where: { animalId }, orderBy: { data: "desc" } });
  const q = recomputarQuartos(
    exs.map((e) => ({ quarto: e.quarto as Quarto, data: iso(e.data)!, scoreCmt: e.scoreCmt as any, ccs: e.ccs, clinica: e.clinica, perdido: e.perdido })),
    iso(new Date())!,
  );
  return { exames: exs.map((e) => toDTO(e as any)), porQuarto: q.porQuarto, quartosCronicos: q.quartosCronicos, quartosPerdidos: q.quartosPerdidos };
}

// Nome do quarto crônico "mais grave" (mais positivos) de um animal, para a sugestão. null se nenhum.
export function quartoCronicoMaisGrave(porQuarto: SaudeUbereDTO["porQuarto"]): { quarto: Quarto } | null {
  let melhor: { quarto: Quarto; positivos: number } | null = null;
  for (const [quarto, est] of Object.entries(porQuarto) as [Quarto, { estado: EstadoQuarto; positivos12m: number }][]) {
    if (est.estado === "CRONICO" && (!melhor || est.positivos12m > melhor.positivos)) melhor = { quarto, positivos: est.positivos12m };
  }
  return melhor ? { quarto: melhor.quarto } : null;
}
