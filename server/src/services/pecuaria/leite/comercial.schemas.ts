import { z } from "zod";
import { dataLeiteSchema } from "./schemas.js";
import { vendaLeiteSchema } from "./estoque.js";
const uuid = z.string().uuid();
const texto = (max: number) => z.string().trim().min(5).max(max);
const litros = z.number().finite().nonnegative().max(999999999.999).multipleOf(0.001);
const dinheiro = z.number().finite().nonnegative().max(999999999999.99).multipleOf(0.01);
const conferencia = {
  volumeAceito: litros.nullable(), situacao: z.enum(["PENDENTE", "ACEITE_INFORMADO", "DIVERGENCIA", "REJEITADA", "DESTINACAO_POSTERIOR"]),
  motivo: texto(1000), destinacaoInformada: texto(1000).nullable().optional(),
};
function conferir(v: { volumeAceito: number | null; situacao: string; destinacaoInformada?: string | null }, c: z.RefinementCtx) {
  if (v.situacao === "PENDENTE" && v.volumeAceito !== null) c.addIssue({ code: "custom", path: ["volumeAceito"], message: "Pendência de aceite exige volume desconhecido" });
  if (["ACEITE_INFORMADO", "REJEITADA"].includes(v.situacao) && v.volumeAceito === null) c.addIssue({ code: "custom", path: ["volumeAceito"], message: "Informe o volume aceito, inclusive zero explícito" });
  if (v.situacao === "REJEITADA" && v.volumeAceito !== 0) c.addIssue({ code: "custom", path: ["volumeAceito"], message: "Rejeição integral exige aceite zero" });
  if (v.situacao === "DESTINACAO_POSTERIOR" && !v.destinacaoInformada) c.addIssue({ code: "custom", path: ["destinacaoInformada"], message: "Descreva a destinação realmente informada; não há retorno automático ao estoque" });
}
export const registrarEntregaLeiteSchema = z.object({ chave: uuid,
  vinculo: z.discriminatedUnion("tipo", [z.object({ tipo: z.literal("VENDA_EXISTENTE"), operacaoId: uuid }).strict(), z.object({ tipo: z.literal("NOVA_VENDA"), venda: vendaLeiteSchema.omit({ chave: true }) }).strict()]),
  pontoColeta: z.string().trim().min(1).max(200).nullable().optional(), horarioColeta: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(), referencia: texto(200), ...conferencia,
}).strict().superRefine(conferir);
export const conferirEntregaLeiteSchema = z.object({ chave: uuid, versaoEsperada: z.number().int().positive(), ...conferencia }).strict().superRefine(conferir);
export const demonstrativoLeiteSchema = z.object({ chave: uuid, parceiroId: uuid, inicio: dataLeiteSchema, fim: dataLeiteSchema, referencia: texto(200),
  precoBase: z.number().finite().nonnegative().max(9999999999.9999).multipleOf(0.0001), volumeReconhecido: litros.positive(), valorComercial: dinheiro.positive(), valorPagamentoInformado: dinheiro.nullable(),
  componentes: z.array(z.object({ natureza: z.enum(["BONUS", "DESCONTO", "RETENCAO", "ADIANTAMENTO"]), valor: dinheiro.positive(), referencia: texto(500) }).strict()).max(100),
  alocacoes: z.array(z.object({ entregaId: uuid, versaoEsperadaEntrega: z.number().int().positive(), versaoVendaId: uuid, quantidadeLitros: litros.positive(), valor: dinheiro.positive(), motivoAceitePendente: texto(1000).optional() }).strict()).min(1).max(200),
}).strict().superRefine((v,c) => { if(v.inicio>v.fim) c.addIssue({code:"custom",path:["fim"],message:"Fim anterior ao início"}); if(new Set(v.alocacoes.map(a=>a.entregaId)).size!==v.alocacoes.length) c.addIssue({code:"custom",path:["alocacoes"],message:"Uma parcela por entrega em cada demonstrativo"}); });
export const anularDemonstrativoLeiteSchema = z.object({ chave: uuid, versaoEsperada: z.number().int().positive(), motivo: texto(1000) }).strict();
export const consultaComercialLeiteSchema = z.object({ de: dataLeiteSchema.optional(), ate: dataLeiteSchema.optional(), parceiroId: uuid.optional(), pagina: z.coerce.number().int().min(1).max(100000).default(1), porPagina: z.coerce.number().int().min(1).max(100).default(20) }).strict().refine(v=>!v.de||!v.ate||v.de<=v.ate,{message:"Fim anterior ao início",path:["ate"]});
export type RegistrarEntregaLeiteInput = z.infer<typeof registrarEntregaLeiteSchema>;
export type ConferirEntregaLeiteInput = z.infer<typeof conferirEntregaLeiteSchema>;
export type DemonstrativoLeiteInput = z.infer<typeof demonstrativoLeiteSchema>;

// Upload privado usa os mesmos limites/intent do contrato de qualidade, sem duplicar validador.
export { solicitarLaudoQualidadeSchema as solicitarComprovanteEntregaLeiteSchema, confirmarLaudoQualidadeSchema as confirmarComprovanteEntregaLeiteSchema } from "./qualidade.schemas.js";
