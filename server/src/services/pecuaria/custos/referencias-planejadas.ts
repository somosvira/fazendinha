import { UnidadeMedida } from "@prisma/client";
import { z } from "zod";
import { mesmaBase } from "../../estoque/unidades.js";
import { RebanhoError } from "../rebanho/regras.js";
const base = {
  valorUnitario: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Informe valor não negativo com até dois decimais"),
  origem: z.string().trim().min(2).max(200), data: z.string().date(),
};
export const referenciasCustoSchema = z.object({
  material: z.object({ ...base, unidade: z.nativeEnum(UnidadeMedida) }).strict().optional(),
  servico: z.object({ ...base, unidade: z.literal("POR_ATENDIMENTO") }).strict().optional(),
}).strict();
export type ReferenciasCusto = z.infer<typeof referenciasCustoSchema>;
/** Validação repetida na fronteira do serviço, inclusive para chamadas sem HTTP. */
export function validarReferenciasCusto(entrada: unknown, unidadeMaterial: string | null, permiteMaterial: boolean): ReferenciasCusto | undefined {
  if (entrada === undefined) return undefined;
  const r = referenciasCustoSchema.parse(entrada);
  if (r.material && (!permiteMaterial || !unidadeMaterial || !(unidadeMaterial in UnidadeMedida) || !mesmaBase(r.material.unidade, unidadeMaterial as UnidadeMedida)))
    throw new RebanhoError("VALIDACAO", "Referência material exige unidade compatível com o material planejado", "referenciasCusto.material");
  return r;
}
