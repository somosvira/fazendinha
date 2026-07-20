import { z } from "zod";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

// Programação de IATF por lote: um protocolo + um D0 comum + o conjunto de animais.
// `grupoId` é a origem do lote (opcional — pode ser seleção manual); `animalIds` é a
// lista efetiva de animais que recebem a aplicação (o front resolve o grupo → ids).
export const criarProgramacaoSchema = z.object({
  protocoloId: z.number().int().positive(),
  dataInicio: dataISO,
  grupoId: z.number().int().positive().nullable().optional(),
  nome: z.string().max(120).optional(),
  observacao: z.string().max(500).optional(),
  animalIds: z.array(z.number().int().positive()).min(1, "selecione ao menos um animal").max(500),
});
export type CriarProgramacaoInput = z.infer<typeof criarProgramacaoSchema>;
