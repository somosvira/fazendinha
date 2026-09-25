import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

// Tipos de operação (espelha TipoOperacao do schema.prisma) — reusado das tarefas.
const tipoOperacao = z.enum([
  "ADUBACAO_SOLO", "ADUBACAO_FOLIAR", "CALAGEM", "GESSAGEM",
  "APLICACAO_FUNGICIDA", "APLICACAO_INSETICIDA", "APLICACAO_HERBICIDA",
  "ROCAGEM_MECANICA", "CAPINA_MANUAL",
  "PODA_RECEPA", "PODA_DECOTE", "PODA_ESQUELETAMENTO", "PODA_DESPONTE",
  "DESBROTA", "IRRIGACAO", "REPLANTIO",
  "AMOSTRAGEM_SOLO", "AMOSTRAGEM_FOLIAR", "MONITORAMENTO_MIP",
]);

const statusTarefa = z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]);
const tipoApontamento = z.enum(["MAQUINA", "HOMEM"]);

// ── Safra ────────────────────────────────────────────────────────────────
export const criarSafraSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(80),
  dataInicio: isoDate,
  dataFim: isoDate,
  centroCustoId: z.string().uuid().optional(),
});

export const editarSafraSchema = criarSafraSchema.partial().extend({
  fechada: z.boolean().optional(),
});

// ── Tarefa ────────────────────────────────────────────────────────────────
export const criarTarefaSchema = z.object({
  safraId: z.number().int().positive(),
  talhaoId: z.number().int().positive().nullish(),
  lavouraId: z.number().int().positive().nullish(),
  tipo: tipoOperacao,
  descricao: z.string().min(1, "descrição é obrigatória").max(200),
  responsavel: z.string().max(80).nullish(),
  produto: z.string().max(200).nullish(),
  unidade: z.string().max(20).nullish(),
  qtdHaPrev: z.number().nonnegative().nullish(),
  qtdTotalPrev: z.number().nonnegative().nullish(),
  dataPrevista: isoDate.nullish(),
  custoPrev: z.number().nonnegative().nullish(),
  status: statusTarefa.nullish(),
});

// PATCH — também é como "marcar realizado" funciona (qtdReal/dataReal/custoReal/status).
export const editarTarefaSchema = criarTarefaSchema.partial().extend({
  qtdHaReal: z.number().nonnegative().nullish(),
  qtdTotalReal: z.number().nonnegative().nullish(),
  dataRealizada: isoDate.nullish(),
  custoReal: z.number().nonnegative().nullish(),
  observacao: z.string().max(400).nullish(),
});

// ── Apontamento (hora-máquina / hora-homem) ─────────────────────────────────
export const criarApontamentoSchema = z.object({
  safraId: z.number().int().positive().nullish(),
  talhaoId: z.number().int().positive().nullish(),
  data: isoDate,
  tipo: tipoApontamento,
  recurso: z.string().min(1, "recurso é obrigatório").max(120),
  operador: z.string().max(80).nullish(),
  implemento: z.string().max(120).nullish(),
  horas: z.number().nonnegative(),
  valorHora: z.number().nonnegative().nullish(),
  valorTotal: z.number().nonnegative().nullish(),
  observacao: z.string().max(400).nullish(),
});

export type CriarSafraInput = z.infer<typeof criarSafraSchema>;
export type EditarSafraInput = z.infer<typeof editarSafraSchema>;
export type CriarTarefaInput = z.infer<typeof criarTarefaSchema>;
export type EditarTarefaInput = z.infer<typeof editarTarefaSchema>;
export type CriarApontamentoInput = z.infer<typeof criarApontamentoSchema>;
