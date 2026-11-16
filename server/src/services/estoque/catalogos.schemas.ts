import { z } from "zod";

// Fabricantes, classificações técnicas e princípios ativos são dados do catálogo do sistema:
// a aplicação só os consulta (docs/produtos.md).
export const consultaCatalogoSchema = z.object({
  busca: z.string().trim().max(160).default(""),
  ativo: z.enum(["true", "false"]).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(10),
  selecionadoId: z.string().uuid().optional(),
}).strict();
export type ConsultaCatalogo = z.infer<typeof consultaCatalogoSchema>;
