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
  centroCustoId: z.number().int().positive().optional(),
});

export const editarSafraSchema = criarSafraSchema.partial().extend({
  fechada: z.boolean().optional(),
});

// ── Tarefa ────────────────────────────────────────────────────────────────
export const criarTarefaSchema = z.object({
  safraId: z.number().int().positive(),
  talhaoId: z.number().int().positive().optional(),
  lavouraId: z.number().int().positive().optional(),
  tipo: tipoOperacao,
  descricao: z.string().min(1, "descrição é obrigatória").max(200),
  responsavel: z.string().max(80).optional(),
  produto: z.string().max(200).optional(),
  unidade: z.string().max(20).optional(),
  qtdHaPrev: z.number().nonnegative().optional(),
  qtdTotalPrev: z.number().nonnegative().optional(),
  dataPrevista: isoDate.optional(),
  custoPrev: z.number().nonnegative().optional(),
  status: statusTarefa.optional(),
});

// PATCH — também é como "marcar realizado" funciona (qtdReal/dataReal/custoReal/status).
export const editarTarefaSchema = criarTarefaSchema.partial().extend({
  qtdHaReal: z.number().nonnegative().optional(),
  qtdTotalReal: z.number().nonnegative().optional(),
  dataRealizada: isoDate.optional(),
  custoReal: z.number().nonnegative().optional(),
  observacao: z.string().max(400).optional(),
});

// ── Apontamento (hora-máquina / hora-homem) ─────────────────────────────────
export const criarApontamentoSchema = z.object({
  safraId: z.number().int().positive().optional(),
  talhaoId: z.number().int().positive().optional(),
  data: isoDate,
  tipo: tipoApontamento,
  recurso: z.string().min(1, "recurso é obrigatório").max(120),
  operador: z.string().max(80).optional(),
  implemento: z.string().max(120).optional(),
  horas: z.number().nonnegative(),
  valorHora: z.number().nonnegative().optional(),
  valorTotal: z.number().nonnegative().optional(),
  observacao: z.string().max(400).optional(),
});

export type CriarSafraInput = z.infer<typeof criarSafraSchema>;
export type EditarSafraInput = z.infer<typeof editarSafraSchema>;
export type CriarTarefaInput = z.infer<typeof criarTarefaSchema>;
export type EditarTarefaInput = z.infer<typeof editarTarefaSchema>;
export type CriarApontamentoInput = z.infer<typeof criarApontamentoSchema>;
