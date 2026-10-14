import { z } from "zod";
import { Prisma } from "@prisma/client";
import { RebanhoError } from "../rebanho/regras.js";

export const campoExameSchema = z.object({
  codigo: z.string().trim().regex(/^[A-Z][A-Z0-9_]{0,59}$/),
  rotulo: z.string().trim().min(1).max(120).optional(),
  tipo: z.enum(["TEXTO", "NUMERO", "OPCAO", "BOOLEANO"]),
  unidade: z.string().trim().max(30).nullish(),
  obrigatorio: z.boolean().default(false),
  opcoes: z.array(z.string().trim().min(1).max(100)).min(1).max(100).optional(),
}).strict().superRefine((campo, ctx) => {
  if (campo.tipo === "OPCAO" && !campo.opcoes?.length) ctx.addIssue({ code: "custom", message: "Informe as opções do campo", path: ["opcoes"] });
  if (campo.tipo !== "OPCAO" && campo.opcoes) ctx.addIssue({ code: "custom", message: "Opções são permitidas somente em campos de escolha", path: ["opcoes"] });
  if (campo.opcoes && new Set(campo.opcoes).size !== campo.opcoes.length) ctx.addIssue({ code: "custom", message: "Opções repetidas", path: ["opcoes"] });
});
export const camposExameSchema = z.array(campoExameSchema).min(1).max(40).superRefine((campos, ctx) => {
  if (new Set(campos.map(c => c.codigo)).size !== campos.length) ctx.addIssue({ code: "custom", message: "Cada campo precisa de um código diferente" });
});
export type CampoExame = z.infer<typeof campoExameSchema>;
export type ObservacaoExame = { campo: string; valor: string | number | boolean };
export const observacoesExameSchema = z.array(z.object({ campo: z.string().min(1), valor: z.union([z.string().max(4000), z.number().finite(), z.boolean()]) }).strict()).max(40);

/** Validar o formato não atribui efeitos clínicos a nomes ou opções cadastrados. */
export function validarObservacoesExame(formato: unknown, observacoes: ObservacaoExame[], completo = true) {
  const campos = camposExameSchema.parse(formato);
  if (new Set(observacoes.map(r => r.campo)).size !== observacoes.length) throw new RebanhoError("VALIDACAO", "Há resultados repetidos para o mesmo campo", "resultados");
  for (const resultado of observacoes) {
    const campo = campos.find(c => c.codigo === resultado.campo);
    if (!campo) throw new RebanhoError("VALIDACAO", "O resultado não pertence ao formato deste exame", "resultados");
    const v = resultado.valor;
    const valido = campo.tipo === "TEXTO" ? typeof v === "string" && !!v.trim()
      : campo.tipo === "OPCAO" ? typeof v === "string" && campo.opcoes!.includes(v)
      : campo.tipo === "BOOLEANO" ? typeof v === "boolean"
      : (typeof v === "number" || typeof v === "string") && v !== "" && (() => { try { return new Prisma.Decimal(v).isFinite(); } catch { return false; } })();
    if (!valido) throw new RebanhoError("VALIDACAO", `Resultado incompatível com ${campo.rotulo ?? campo.codigo}`, "resultados");
  }
  if (completo && campos.some(c => c.obrigatorio && !observacoes.some(r => r.campo === c.codigo))) throw new RebanhoError("VALIDACAO", "Preencha os resultados obrigatórios deste formato", "resultados");
  return observacoes.map(r => {
    const campo = campos.find(c => c.codigo === r.campo)!;
    return { campo: r.campo, valor: campo.tipo === "NUMERO" ? new Prisma.Decimal(String(r.valor)).toString() : typeof r.valor === "string" ? r.valor.trim() : r.valor, unidade: campo.unidade ?? null };
  });
}
