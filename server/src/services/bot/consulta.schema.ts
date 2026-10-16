import { z } from "zod";

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Data inválida");

// Todos os campos são explícitos para o schema estrito da ferramenta OpenAI.
export const consultaFinanceiraSchema = z.object({
  assunto: z.enum(["resumo", "saidas", "entradas", "categorias", "pagar", "receber", "saldos", "fora_escopo"]),
  inicio: data.nullable(),
  fim: data.nullable(),
  compararInicio: data.nullable(),
  compararFim: data.nullable(),
  categoria: z.string().trim().min(1).max(100).nullable(),
}).strict();
export type ConsultaFinanceira = z.infer<typeof consultaFinanceiraSchema>;

export const contextoAnteriorSchema = z.object({
  propriedadeId: z.number().int().positive().nullable(),
  consulta: consultaFinanceiraSchema,
}).strict();
export type ContextoAnterior = z.infer<typeof contextoAnteriorSchema>;

export const perguntaSchema = z.object({
  pergunta: z.string().trim().min(1).max(2000),
  contexto: contextoAnteriorSchema.nullish(),
}).strict();

export function hojeBrasil(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

export class ConsultaAssistenteError extends Error {}

export function normalizarConsulta(input: unknown, hoje = hojeBrasil()): ConsultaFinanceira {
  const parsed = consultaFinanceiraSchema.safeParse(input);
  if (!parsed.success) throw new ConsultaAssistenteError("Não consegui entender esse recorte. Informe o período e o que deseja consultar.");
  const c = parsed.data;
  if (c.assunto === "fora_escopo") return c;
  const validarPeriodo = (inicio: string | null, fim: string | null) => {
    if (!!inicio !== !!fim || (inicio && fim && inicio > fim)) throw new ConsultaAssistenteError("Informe as duas datas, com o início antes do fim.");
    if (inicio && fim && Date.parse(fim) - Date.parse(inicio) > 731 * 86400000) throw new ConsultaAssistenteError("Consulte até dois anos por vez.");
  };
  validarPeriodo(c.inicio, c.fim);
  validarPeriodo(c.compararInicio, c.compararFim);
  if (c.categoria && !["saidas", "categorias"].includes(c.assunto)) throw new ConsultaAssistenteError("Nesta versão, o filtro de categoria está disponível para as saídas de caixa.");
  if (c.assunto === "saldos" && (c.inicio || c.compararInicio)) throw new ConsultaAssistenteError("Por enquanto consulto o saldo atual das contas. Para um período, pergunte quanto entrou ou saiu.");
  if (["pagar", "receber"].includes(c.assunto) && c.compararInicio) throw new ConsultaAssistenteError("As pendências mostram o que falta pagar ou receber hoje. Ainda não comparo saldos pendentes históricos.");
  if (!c.inicio && !["saldos", "pagar", "receber"].includes(c.assunto)) {
    c.inicio = `${hoje.slice(0, 7)}-01`;
    c.fim = hoje;
  }
  return c;
}
