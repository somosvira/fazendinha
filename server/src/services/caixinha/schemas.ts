import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");

export const tipoMovimentoCaixinha = z.enum(["ENTRADA", "SAIDA"]);

// Categoria do gasto (só faz sentido em SAIDA). Espelha o enum Prisma CategoriaCaixinha.
export const categoriaCaixinha = z.enum([
  "ALIMENTACAO",
  "COMBUSTIVEL",
  "MERCADO",
  "INSUMOS",
  "MANUTENCAO",
  "OUTROS",
]);

// ── Caixinha ─────────────────────────────────────────────────────────────
export const criarCaixinhaSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(80),
  responsavel: z.string().max(80).nullish(),
});

// Editar nome/responsável/ativo (desativar = ativo:false).
export const editarCaixinhaSchema = z.object({
  nome: z.string().min(1, "nome é obrigatório").max(80).optional(),
  responsavel: z.string().max(80).nullish(),
  ativo: z.boolean().optional(),
});

// ── MovimentoCaixinha ────────────────────────────────────────────────────
export const criarMovimentoCaixinhaSchema = z.object({
  data: isoDate,
  tipo: tipoMovimentoCaixinha,
  // categoria do gasto — só em SAIDA; ignorada (→ null) em ENTRADA. Ver caixinhas.ts.
  categoria: categoriaCaixinha.nullish(),
  // valor sempre POSITIVO — o sinal vem do tipo (convenção do projeto)
  valor: z.number().positive("valor deve ser positivo"),
  descricao: z.string().min(1, "descrição é obrigatória").max(200),
  observacao: z.string().max(400).nullish(),
});

export const listMovimentoCaixinhaFiltrosSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "mês deve ser YYYY-MM").optional(),
});

export type CriarCaixinhaInput = z.infer<typeof criarCaixinhaSchema>;
export type EditarCaixinhaInput = z.infer<typeof editarCaixinhaSchema>;
export type CriarMovimentoCaixinhaInput = z.infer<typeof criarMovimentoCaixinhaSchema>;
export type ListMovimentoCaixinhaFiltros = z.infer<typeof listMovimentoCaixinhaFiltrosSchema>;
