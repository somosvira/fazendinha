import { z } from "zod";
import { AUXILIOS_PARTO, TIPOS_PARTO, normalizarAuxilioParto, normalizarTipoParto } from "./parto.dict.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD");
const comum = { data: isoDate, observacao: z.string().max(200).optional() };

// Achados de exame ginecológico (palpação/US). Condensa RESULTADOEXAMEGINECOLOGICO do IDEagri
// nos estados operacionais. Os que pedem ação viram alerta na timeline (ver eventos.mappers).
export const ACHADOS_GINECOLOGICOS = ["CICLANDO", "CIO", "CORPO_LUTEO", "GESTANTE", "ANESTRO", "CISTO_FOLICULAR", "CISTO_LUTEO", "ENDOMETRITE", "INDEFINIDO"] as const;
export type AchadoGinecologico = (typeof ACHADOS_GINECOLOGICOS)[number];
export const ACHADOS_ALERTA = new Set(["ANESTRO", "CISTO_FOLICULAR", "CISTO_LUTEO", "ENDOMETRITE"]);

const CODIGOS_TIPO_PARTO = TIPOS_PARTO.map((t) => t.codigo) as [string, ...string[]];
const CODIGOS_AUXILIO = AUXILIOS_PARTO.map((a) => a.codigo) as [string, ...string[]];

// Zod discriminatedUnion exige ZodObject puro (sem superRefine no membro).
// Validação de negócio do parto roda no refine do schema composto.
const partoObject = z.object({
  tipo: z.literal("PARTO"),
  ...comum,
  // Aborto (3) pode ter 0 crias a termo; demais tipos exigem ≥1 (refine abaixo).
  numCrias: z.number().int().min(0).max(3).optional(),
  criasVivas: z.number().int().min(0).max(3).optional(),
  criasNatimortas: z.number().int().min(0).max(3).optional(),
  sexoCria: z.enum(["F", "M", "FM", "MF"]).optional(),
  tipoParto: z.string().max(20).optional(),
  auxilioParto: z.string().max(20).optional(),
  criarCria: z.boolean().optional(),
  criaNumero: z.string().trim().min(1).max(20).optional(),
  criaId: z.number().int().positive().optional(),
});

const criarEventoBase = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("CIO"), ...comum }),
  z.object({ tipo: z.literal("INSEMINACAO"), ...comum, reprodutor: z.string().min(1, "reprodutor é obrigatório").max(60), protocolo: z.string().max(40).optional() }),
  // Monta natural (IDEAGRI=2). Reprodutor opcional — 40/61 na 777 vêm sem touro.
  z.object({ tipo: z.literal("COBERTURA"), ...comum, reprodutor: z.string().max(60).optional() }),
  // TE: embrião numa receptora. `doadoraId` = animal doador da genética (opcional);
  // `reprodutor` = touro/sêmen do embrião (opcional); `protocolo` = sincronização.
  z.object({ tipo: z.literal("TRANSFERENCIA_EMBRIAO"), ...comum, doadoraId: z.number().int().positive().optional(), reprodutor: z.string().max(60).optional(), protocolo: z.string().max(40).optional() }),
  z.object({ tipo: z.literal("DIAGNOSTICO"), ...comum, resultado: z.enum(["positivo", "negativo"]), dtPartoPrevista: isoDate.optional() }),
  partoObject,
  z.object({ tipo: z.literal("SECAGEM"), ...comum, motivoSecagem: z.string().max(40).optional() }),
  // Exame ginecológico: achado clínico do trato (→ campo `resultado`). `metodo` (palpação/US) → `protocolo`.
  z.object({ tipo: z.literal("EXAME_GINECOLOGICO"), ...comum, resultado: z.enum(ACHADOS_GINECOLOGICOS), resultadoGinecologicoId: z.number().int().positive().optional(), metodo: z.string().max(20).optional() }),
  // Desmame do bezerro: fato de ciclo com data; `pesoKg` opcional (peso ao desmame) → campo `resultado`.
  z.object({ tipo: z.literal("DESMAME"), ...comum, pesoKg: z.number().positive().max(1000).optional() }),
]);

export const criarEventoSchema = criarEventoBase.superRefine((v, ctx) => {
  if (v.tipo !== "PARTO") return;
  const tipo = normalizarTipoParto(v.tipoParto);
  if (tipo === "3") return; // aborto: 0 crias ok
  const n = v.numCrias ?? ((v.criasVivas ?? 0) + (v.criasNatimortas ?? 0));
  if (n < 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe ao menos 1 cria (ou marque aborto)", path: ["numCrias"] });
  }
  if (v.criasVivas != null && v.criasNatimortas != null && v.numCrias != null
    && v.criasVivas + v.criasNatimortas !== v.numCrias) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "crias vivas + natimortas deve somar numCrias", path: ["criasVivas"] });
  }
  if (v.criarCria && !v.criaNumero) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe o número da cria", path: ["criaNumero"] });
  }
  if (v.criarCria && !v.sexoCria) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "informe o sexo da cria", path: ["sexoCria"] });
  }
  if (v.criarCria && v.criaId != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "escolha criar ou vincular a cria", path: ["criaId"] });
  }
  if (v.criaId != null && (v.criasVivas ?? n) !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "vínculo por id exige exatamente uma cria viva", path: ["criaId"] });
  }
  // silencia unused-helper warnings em builds estritos
  void CODIGOS_TIPO_PARTO; void CODIGOS_AUXILIO; void normalizarAuxilioParto;
});
export type CriarEventoInput = z.infer<typeof criarEventoSchema>;
