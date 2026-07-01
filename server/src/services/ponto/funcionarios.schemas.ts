import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const criarFuncionarioSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(120),
  cargo: z.string().max(80).nullish(),
  salarioMensal: z.number().positive("salário deve ser > 0"),
  cargaMensalHoras: z.number().positive("carga mensal deve ser > 0").default(220),
  jornadaDiariaHoras: z.number().positive("jornada diária deve ser > 0").default(8),
  dataAdmissao: isoDate.nullish(),
  cpf: z.string().max(20).nullish(),
  chavePix: z.string().max(140).nullish(),
  ativo: z.boolean().default(true),
});

export const editarFuncionarioSchema = criarFuncionarioSchema.partial();

export const listFuncionariosSchema = z.object({
  // ?ativo=true|false; ausente = todos.
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v == null ? undefined : v === "true")),
});

export type CriarFuncionarioInput = z.infer<typeof criarFuncionarioSchema>;
export type EditarFuncionarioInput = z.infer<typeof editarFuncionarioSchema>;
export type ListFuncionariosFiltros = z.infer<typeof listFuncionariosSchema>;
