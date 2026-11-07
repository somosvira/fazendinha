import { z } from "zod";

const codigo = z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,59}$/);
const data = z.string().date();
export const itemCatalogoAvaliacaoSchema = z.object({
  codigo, rotulo: z.string().trim().min(1).max(120),
  tipo: z.enum(["UTERO", "OVARIO", "DIAGNOSTICO", "APTIDAO", "RECONFIRMACAO", "SEXAGEM", "CONDICAO"]),
  campo: codigo.optional(),
  contextos: z.array(z.enum(["NOVILHA", "APOS_TENTATIVA", "GESTACAO_CONHECIDA", "OUTRO"])).max(4),
}).strict().superRefine((item, ctx) => {
  if (["UTERO", "OVARIO", "CONDICAO"].includes(item.tipo) && !item.campo)
    ctx.addIssue({ code: "custom", path: ["campo"], message: "Vincule o item a um campo do formato de exame" });
  if (["DIAGNOSTICO", "APTIDAO", "RECONFIRMACAO", "SEXAGEM"].includes(item.tipo) && item.campo)
    ctx.addIssue({ code: "custom", path: ["campo"], message: "Esta conclusão usa seu campo clínico próprio" });
});
export const condutaCatalogoAvaliacaoSchema = z.object({
  codigo, rotulo: z.string().trim().min(1).max(120),
  tipo: z.enum(["RETORNO", "INDICAR_TENTATIVA", "INDICAR_PROTOCOLO", "NAO_PROSSEGUIR", "OUTRO"]),
  exigeRevisao: z.boolean().default(false),
}).strict();
export const criarCatalogoAvaliacaoSchema = z.object({
  chave: z.string().uuid(), propriedadeId: z.number().int().positive(), tipoExameId: z.string().uuid(),
  versaoEsperada: z.number().int().nonnegative(),
  itens: z.array(itemCatalogoAvaliacaoSchema).min(1).max(40), condutas: z.array(condutaCatalogoAvaliacaoSchema).max(30),
}).strict().superRefine((v, ctx) => {
  for (const [campo, codigos] of [["itens", v.itens.map(i => i.codigo)], ["condutas", v.condutas.map(c => c.codigo)]] as const)
    if (new Set(codigos).size !== codigos.length) ctx.addIssue({ code: "custom", path: [campo], message: "Códigos devem ser únicos" });
  const campos = v.itens.flatMap(i => i.campo ? [i.campo] : []);
  if (new Set(campos).size !== campos.length) ctx.addIssue({ code: "custom", path: ["itens"], message: "Cada campo pertence a um único item" });
  const clinicos = v.itens.filter(i => ["DIAGNOSTICO", "APTIDAO", "RECONFIRMACAO", "SEXAGEM"].includes(i.tipo)).map(i => i.tipo);
  if (new Set(clinicos).size !== clinicos.length) ctx.addIssue({ code: "custom", path: ["itens"], message: "Cada tipo de conclusão clínica aparece uma vez" });
});
export const avaliacaoContextualSchema = z.object({
  catalogoId: z.string().uuid(),
  itens: z.array(z.object({ codigo, estado: z.enum(["NAO_AVALIADO", "INCONCLUSIVO", "CONCLUSIVO"]), observacao: z.string().trim().max(1000).nullish() }).strict()).max(40),
  condutas: z.array(z.object({ codigo, retornoEm: data.nullish(), destino: z.string().trim().min(1).max(300).nullish(), revisaoEm: data.nullish(), observacao: z.string().trim().max(1000).nullish() }).strict()).max(30),
}).strict().superRefine((v, ctx) => {
  if (new Set(v.itens.map(i => i.codigo)).size !== v.itens.length) ctx.addIssue({ code: "custom", path: ["itens"], message: "Item repetido" });
  if (new Set(v.condutas.map(c => c.codigo)).size !== v.condutas.length) ctx.addIssue({ code: "custom", path: ["condutas"], message: "Conduta repetida" });
});
export type CriarCatalogoAvaliacaoInput = z.infer<typeof criarCatalogoAvaliacaoSchema>;
export type AvaliacaoContextualInput = z.infer<typeof avaliacaoContextualSchema>;
