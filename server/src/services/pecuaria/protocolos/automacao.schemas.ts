import { z } from "zod";
/** IDs de ações do modelo; IDs de tarefas são gerados dentro da adesão. */
export const automacoesAdesaoSchema = z.array(z.object({
  animalId: z.string().uuid(), etapaId: z.string().uuid(), dados: z.record(z.unknown()),
}).strict()).max(3000);
export const revisaoRetroativaSchema = z.array(z.object({
  animalId: z.string().uuid(), etapaId: z.string().uuid(), decisao: z.enum(["REGISTRAR_MANUALMENTE", "DISPENSAR"]), motivo: z.string().trim().min(5).max(1000),
}).strict()).max(3000);
