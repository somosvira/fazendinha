import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "hora deve ser HH:MM");

const funcionarioBase = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(120),
  cargo: z.string().max(80).nullish(),
  // Setor operacional (Curral/Ordenha/…); livre e opcional. Sem setor → "Geral" na borda.
  setor: z.string().max(80).nullish(),
  salarioMensal: z.number().positive("salário deve ser > 0"),
  cargaMensalHoras: z.number().positive("carga mensal deve ser > 0").default(220),
  jornadaDiariaHoras: z.number().positive("jornada diária deve ser > 0").default(8),
  // Horário padrão (opcional): pré-preenche a grade. null limpa; ausente mantém.
  horaEntradaPadrao: hhmm.nullish(),
  horaSaidaPadrao: hhmm.nullish(),
  intervaloPadraoMin: z.number().int().nonnegative("intervalo deve ser ≥ 0").nullish(),
  dataAdmissao: isoDate.nullish(),
  cpf: z.string().max(20).nullish(),
  chavePix: z.string().max(140).nullish(),
  ativo: z.boolean().default(true),
});

// Se entrada E saída padrão vierem, entrada deve ser antes da saída (compara
// "HH:MM" lexicograficamente — funciona por serem zero-padded). Turno que
// atravessa a meia-noite não é caso deste cadastro (jornada de dia útil).
const validarHorarioPadrao = (
  v: { horaEntradaPadrao?: string | null; horaSaidaPadrao?: string | null },
  ctx: z.RefinementCtx
) => {
  if (v.horaEntradaPadrao && v.horaSaidaPadrao && v.horaEntradaPadrao >= v.horaSaidaPadrao) {
    ctx.addIssue({
      code: "custom",
      path: ["horaSaidaPadrao"],
      message: "saída padrão deve ser depois da entrada",
    });
  }
};

export const criarFuncionarioSchema = funcionarioBase.superRefine(validarHorarioPadrao);
export const editarFuncionarioSchema = funcionarioBase.partial().superRefine(validarHorarioPadrao);

export const listFuncionariosSchema = z.object({
  // ?ativo=true|false; ausente = todos.
  ativo: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v == null ? undefined : v === "true")),
  // ?setor=Curral — filtro exato opcional; ausente/"" = todos os setores.
  setor: z
    .string()
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : v)),
});

export type CriarFuncionarioInput = z.infer<typeof criarFuncionarioSchema>;
export type EditarFuncionarioInput = z.infer<typeof editarFuncionarioSchema>;
export type ListFuncionariosFiltros = z.infer<typeof listFuncionariosSchema>;
