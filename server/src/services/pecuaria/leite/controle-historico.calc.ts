import { z } from "zod";
import { Prisma } from "@prisma/client";
import { dataLeiteSchema } from "./schemas.js";
const quantidade = z.number().finite().nonnegative().max(99999999999.999).refine(n => new Prisma.Decimal(n).decimalPlaces() <= 3, "Use até três casas decimais");
export const controleHistoricoLeiteSchema = z.object({
    tipo: z.enum(["CONTROLE_PERIODICO", "AGREGADO_MENSAL"]),
    inicio: dataLeiteSchema, fim: dataLeiteSchema,
    animalId: z.string().uuid().nullable(), propriedadeId: z.number().int().positive().nullable(),
    contexto: z.enum(["INTERNO", "EXTERNO"]), lactacaoId: z.string().uuid().nullish(), origemColetiva: z.string().trim().min(3).max(300).nullish(),
    total: quantidade.nullable(), unidade: z.enum(["L", "KG"]), referenciaUnidade: z.string().trim().min(5).max(1000),
    parcelas: z.array(z.object({ rotulo: z.string().trim().min(1).max(100).nullable(), hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(), quantidade: quantidade.nullable() }).strict()).max(100),
    evidencia: z.string().trim().min(5).max(2000), snapshotOrigem: z.record(z.unknown()),
}).strict().superRefine((v, c) => {
    const erro = (campo: string, mensagem: string) => c.addIssue({ code: "custom", path: [campo], message: mensagem });
    if (v.inicio > v.fim)
        erro("fim", "Fim anterior ao início");
    if (v.contexto === "INTERNO" && v.propriedadeId === null || v.contexto === "EXTERNO" && v.propriedadeId !== null)
        erro("propriedadeId", "O sítio deve corresponder à origem comprovada do fato");
    if (v.contexto === "EXTERNO" && v.lactacaoId)
        erro("lactacaoId", "Histórico externo não recebe lactação interna");
    if (v.tipo === "CONTROLE_PERIODICO" && (!v.animalId || v.inicio !== v.fim))
        erro("animalId", "Controle periódico exige animal e data única da aferição");
    if (v.tipo === "AGREGADO_MENSAL") {
        const ultimo = new Date(`${v.inicio}T00:00:00Z`);
        ultimo.setUTCMonth(ultimo.getUTCMonth() + 1, 0);
        if (v.inicio.slice(8) !== "01" || ultimo.toISOString().slice(0, 10) !== v.fim)
            erro("fim", "Informe o mês inteiro comprovado, sem fabricar dias intermediários");
        if (v.animalId || !v.origemColetiva || v.lactacaoId)
            erro("origemColetiva", "Agregado mensal exige origem coletiva, sem atribuição individual presumida");
    }
});
export type ControleHistoricoLeiteInput = z.infer<typeof controleHistoricoLeiteSchema>;
export function resumirControleHistorico(v: ControleHistoricoLeiteInput) {
    const conhecidas = v.parcelas.filter(p => p.quantidade !== null);
    const soma = conhecidas.length ? conhecidas.reduce((s, p) => s.plus(p.quantidade!), new Prisma.Decimal(0)) : null;
    const total = v.total === null ? null : new Prisma.Decimal(v.total);
    return { totalDeclarado: total?.toString() ?? null, somaParcelas: soma?.toString() ?? null,
        diferenca: total !== null && soma !== null ? total.minus(soma).toString() : null,
        parcelasConhecidas: conhecidas.length, parcelasAusentes: v.parcelas.length - conhecidas.length, unidade: v.unidade };
}
