import { z } from "zod";
// upsertRegistroSchema é compartilhado com o client (validação antes de
// enfileirar offline) — fonte real em packages/shared, aqui é só re-export
// pra quem já importa daqui não precisar mudar (ver routes/ponto/index.ts).
export { upsertRegistroSchema, type UpsertRegistroSchemaInput } from "@rionovo/shared";

const mes = z.string().regex(/^\d{4}-\d{2}$/, "mês deve ser YYYY-MM");

export const listRegistrosSchema = z.object({
  funcionarioId: z.coerce.number().int().positive(),
  mes,
});

export const folhaMesSchema = z.object({ mes });

// Body de POST /ponto/funcionarios/:id/preencher-grade — mês (ano + 1..12).
export const preencherGradeSchema = z.object({
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1, "mês deve ser 1-12").max(12, "mês deve ser 1-12"),
});

export type ListRegistrosFiltros = z.infer<typeof listRegistrosSchema>;
export type PreencherGradeInput = z.infer<typeof preencherGradeSchema>;
