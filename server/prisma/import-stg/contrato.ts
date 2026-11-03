import { z } from "zod";
import { fatoHistoricoSchema } from "../../src/services/pecuaria/importacao/historico.js";

const chaveOrigemSchema = z.string().trim().min(3).max(200).regex(/^[^:\s]+:.+$/, "Use uma chave de origem TABELA:id.");
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/, "Informe um hash SHA256 válido.");
const itemEntradaSchema = z.object({
  chave: chaveOrigemSchema,
  dependencias: z.array(chaveOrigemSchema).max(1000).default([]),
  operacao: z.enum(["CRIAR", "VINCULAR", "CORRIGIR"]),
  destinoId: z.string().trim().min(1).max(200).optional(),
  motivo: z.string().trim().min(5).max(2000).optional(),
  versaoEsperada: z.number().int().positive().optional(),
  hashOrigemEsperado: hashSchema.optional(),
  duplicidadesRevisadas: z.array(z.string().trim().min(1).max(200)).max(1000).default([]),
  fato: z.unknown(),
}).strict().superRefine((item, ctx) => {
  if (item.operacao !== "CRIAR") {
    if (!item.destinoId) ctx.addIssue({ code: "custom", path: ["destinoId"], message: "Vínculo e correção exigem destino explícito." });
    if (!item.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Justifique a decisão de vínculo ou correção." });
  } else if (item.destinoId) ctx.addIssue({ code: "custom", path: ["destinoId"], message: "Para escolher um fato existente use VINCULAR." });
  if (item.operacao === "CORRIGIR") {
    if (!item.versaoEsperada) ctx.addIssue({ code: "custom", path: ["versaoEsperada"], message: "Correção exige a versão conferida do fato." });
    if (!item.hashOrigemEsperado) ctx.addIssue({ code: "custom", path: ["hashOrigemEsperado"], message: "Correção exige o hash anterior da origem." });
  } else if (item.hashOrigemEsperado) ctx.addIssue({ code: "custom", path: ["hashOrigemEsperado"], message: "Hash anterior é exclusivo de CORRIGIR." });
  for (const campo of ["dependencias", "duplicidadesRevisadas"] as const) {
    if (new Set(item[campo]).size !== item[campo].length) ctx.addIssue({ code: "custom", path: [campo], message: "Não repita identificadores na mesma decisão." });
  }
  if (item.dependencias.includes(item.chave)) ctx.addIssue({ code: "custom", path: ["dependencias"], message: "Um item não pode depender de si mesmo." });
  if (item.duplicidadesRevisadas.length && !item.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Justifique a revisão dos candidatos a duplicidade." });
});

function registro(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}
export const cargaStgSchema = z.object({
  bancoOrigem: z.string().trim().min(1).max(120), autorId: z.number().int().positive(),
  itens: z.array(itemEntradaSchema).min(1).max(10000),
}).strict().transform((carga, ctx) => {
  const chaves = new Set<string>();
  const itens = carga.itens.map((item, indice) => {
    if (chaves.has(item.chave)) ctx.addIssue({ code: "custom", path: ["itens", indice, "chave"], message: "Chave de origem duplicada no lote." });
    chaves.add(item.chave);
    const fato = registro(item.fato), dados = registro(fato.dados);
    for (const [campo, esperado] of [["bancoOrigem", carga.bancoOrigem], ["chaveOrigem", item.chave]] as const) {
      if (dados[campo] !== undefined && dados[campo] !== esperado) ctx.addIssue({ code: "custom", path: ["itens", indice, "fato", "dados", campo], message: "A origem do fato diverge da chave canônica do lote." });
    }
    const resultado = fatoHistoricoSchema.safeParse({ ...fato, dados: { ...dados, bancoOrigem: carga.bancoOrigem, chaveOrigem: item.chave } });
    if (!resultado.success) {
      resultado.error.issues.forEach(issue => ctx.addIssue({ ...issue, path: ["itens", indice, "fato", ...issue.path] }));
      return { ...item, fato: z.NEVER };
    }
    const referenciaPeso = resultado.data.tipo === "ASSOCIACAO_PESO_SECAGEM" ? registro(registro(resultado.data.dados).pesagem).chaveOrigem : undefined;
    if (referenciaPeso === item.chave) ctx.addIssue({ code: "custom", path: ["itens", indice, "fato", "dados", "pesagem"], message: "A associação precisa de chave própria, diferente da origem da pesagem." });
    const dependencias = typeof referenciaPeso === "string" ? [...new Set([...item.dependencias, referenciaPeso])] : item.dependencias;
    return { ...item, dependencias, fato: resultado.data };
  });
  return { ...carga, itens };
});
export type CargaStg = z.infer<typeof cargaStgSchema>;
export type ItemStg = CargaStg["itens"][number];
