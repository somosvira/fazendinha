import { z } from "zod";
export const tiposAtencaoReprodutiva = [
  "DISPOSITIVO_SEM_RETIRADA",
  "ETAPA_VENCIDA",
  "TENTATIVA_APOS_PREPARO",
  "AGENDAMENTO_INCOMPLETO",
  "DG_VENCIDO",
  "RECONFIRMACAO_VENCIDA",
  "RETORNO_VENCIDO",
  "APTA_SEM_ENCAMINHAMENTO",
  "AVALIACAO_NECESSARIA",
  "AVALIACAO_DESATUALIZADA",
] as const;
export type TipoAtencaoReprodutiva = (typeof tiposAtencaoReprodutiva)[number];
const regra = z
  .object({
    tipo: z.enum([
      "TENTATIVA_APOS_PREPARO",
      "APTA_SEM_ENCAMINHAMENTO",
      "AVALIACAO_NECESSARIA",
      "AVALIACAO_DESATUALIZADA",
    ]),
    publico: z.literal("FEMEAS"),
    referencia: z.enum([
      "PREPARO_CONCLUIDO",
      "EXAME_APTIDAO",
      "INICIO_CICLO",
      "ULTIMA_AVALIACAO",
    ]),
    intervalo: z.number().int().min(0).max(1000),
    unidade: z.literal("DIAS"),
    antecedencia: z.number().int().min(0).max(1000),
    tolerancia: z.number().int().min(0).max(1000),
    resolucao: z.enum([
      "TENTATIVA_REALIZADA",
      "ENCAMINHAMENTO_EXPLICITO",
      "AVALIACAO_REALIZADA",
    ]),
  })
  .strict()
  .superRefine((r, c) => {
    const contratos = {
      TENTATIVA_APOS_PREPARO: ["PREPARO_CONCLUIDO", "TENTATIVA_REALIZADA"],
      APTA_SEM_ENCAMINHAMENTO: ["EXAME_APTIDAO", "ENCAMINHAMENTO_EXPLICITO"],
      AVALIACAO_NECESSARIA: ["INICIO_CICLO", "AVALIACAO_REALIZADA"],
      AVALIACAO_DESATUALIZADA: ["ULTIMA_AVALIACAO", "AVALIACAO_REALIZADA"],
    };
    const [referencia, resolucao] = contratos[r.tipo];
    if (r.referencia !== referencia || r.resolucao !== resolucao)
      c.addIssue({
        code: "custom",
        message: "Evento de referência ou resolução incompatível com o tipo",
      });
  });
export const parametrosAtencaoSchema = z
  .object({ versao: z.literal(1), regras: z.array(regra).max(4) })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.regras.map((r) => r.tipo)).size !== v.regras.length)
      c.addIssue({ code: "custom", message: "Não repita tipos de atenção" });
  });
export const politicaAtencaoSchema = z
  .object({
    chave: z.string().uuid(),
    propriedadeId: z.number().int().positive(),
    vigenteDesde: z.string().date(),
    parametros: parametrosAtencaoSchema,
  })
  .strict();
export const decisaoAtencaoSchema = z
  .object({
    chave: z.string().uuid(),
    propriedadeId: z.number().int().positive(),
    revisao: z.number().int().positive(),
    tipo: z.enum(["REAGENDAR", "DISPENSAR", "RETIRAR", "SUSPENDER"]),
    motivo: z.string().trim().min(5).max(1000),
    data: z.string().date().optional(),
    destino: z.string().trim().min(2).max(500).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (["REAGENDAR", "SUSPENDER"].includes(v.tipo) && (!v.data || !v.destino))
      c.addIssue({
        code: "custom",
        message:
          "Reagendar ou suspender exige data de revisão e destino explícito",
      });
    if (["DISPENSAR", "RETIRAR"].includes(v.tipo) && (v.data || v.destino))
      c.addIssue({
        code: "custom",
        message: "Decisão terminal não admite revisão ou destino",
      });
  });
export type RegraAtencao = z.infer<typeof regra>;
export const titulosAtencao: Record<TipoAtencaoReprodutiva, string> = {
  DISPOSITIVO_SEM_RETIRADA: "Dispositivo com retirada pendente",
  ETAPA_VENCIDA: "Etapa de protocolo",
  TENTATIVA_APOS_PREPARO: "Tentativa após preparo",
  AGENDAMENTO_INCOMPLETO: "Agendamento incompleto",
  DG_VENCIDO: "Diagnóstico gestacional",
  RECONFIRMACAO_VENCIDA: "Reconfirmação gestacional",
  RETORNO_VENCIDO: "Retorno reprodutivo",
  APTA_SEM_ENCAMINHAMENTO: "Apta sem encaminhamento",
  AVALIACAO_NECESSARIA: "Avaliação reprodutiva necessária",
  AVALIACAO_DESATUALIZADA: "Avaliação reprodutiva desatualizada",
};
export const dia = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00Z`);
export const somarDias = (data: Date, n: number) =>
  new Date(data.getTime() + n * 86400000);
/** Só o prazo adotado define atraso; ausência de regra/data é planejamento pendente. */
export function janelaAtencao(
  prevista: Date | null,
  regra: unknown,
  hoje: Date,
) {
  const r =
    regra && typeof regra === "object"
      ? (regra as Record<string, unknown>)
      : {};
  const antecedencia = typeof r.antecedencia === "number" ? r.antecedencia : 0;
  const tolerancia = typeof r.tolerancia === "number" ? r.tolerancia : 0;
  if (!prevista)
    return {
      situacao: "PLANEJAMENTO_PENDENTE",
      visivelDesde: null,
      prazo: null,
    };
  const visivelDesde = somarDias(prevista, -antecedencia),
    prazo = somarDias(prevista, tolerancia);
  return {
    situacao:
      hoje > prazo ? "ATRASADO" : hoje < prevista ? "PROXIMO" : "PENDENTE",
    visivelDesde,
    prazo,
  };
}
