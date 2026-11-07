import { z } from "zod";
import { temArea, temPermissao } from "../../auth/papeis.js";
export interface IndicadorMeta {
  id: string;
  versao: number;
  nome: string;
  unidade: string;
  dominio: "pecuaria" | "financeiro";
  formula: string;
  fonte: "manual" | "automatica";
  motivoManual: string;
}
const indicador = (
  id: string,
  nome: string,
  unidade: string,
  formula: string,
  dominio: "pecuaria" | "financeiro" = "pecuaria",
): IndicadorMeta => ({
  id,
  versao: 1,
  nome,
  unidade,
  dominio,
  formula,
  fonte: "manual",
  motivoManual:
    "Apuração manual: ainda não há adaptador automático com cobertura validada para esta meta.",
});
export const indicadores: IndicadorMeta[] = [
  indicador(
    "leite_volume",
    "Produção de leite",
    "L",
    "Volume produzido no período informado; informe somente o total do mesmo recorte.",
  ),
  indicador(
    "leite_por_vaca",
    "Produção por vaca",
    "L/vaca/dia",
    "Volume diário dividido pelo número de vacas efetivamente ordenhadas no mesmo dia.",
  ),
  indicador(
    "vacas_lactantes",
    "Vacas em lactação",
    "vacas",
    "Contagem de fêmeas em lactação na data de referência.",
  ),
  indicador(
    "ccs",
    "CCS",
    "células/mL",
    "Resultado de CCS do laudo para a mesma origem; não somar resultados de amostras.",
  ),
  indicador(
    "cpp",
    "CPP",
    "UFC/mL",
    "Resultado de CPP do laudo para a mesma origem; não somar resultados de amostras.",
  ),
  indicador(
    "taxa_prenhez",
    "Taxa de prenhez",
    "%",
    "Fêmeas que ficaram gestantes / fêmeas elegíveis × 100 no ciclo informado. Registre população e intervalo na observação.",
  ),
  indicador(
    "mortalidade",
    "Mortalidade",
    "%",
    "Óbitos / população exposta ao risco × 100. Informe população e intervalo; direção e período precisam ser escolhidos.",
  ),
  indicador(
    "marco_operacional",
    "Marco operacional",
    "marco",
    "Conclusão declarada com data e observação; não representa percentual de progresso.",
  ),
  indicador(
    "resultado_financeiro",
    "Resultado financeiro",
    "R$",
    "Entradas realizadas menos saídas realizadas no período, sem transferências próprias; estornos na data de caixa.",
    "financeiro",
  ),
];
indicadores[0] = {
  ...indicadores[0]!,
  fonte: "automatica",
  formula:
    "Soma das parcelas gerais de todas as naturezas, somente nos dias com produção geral e todas as ordenhas contendo parcelas confirmadas. Não soma o controle individual.",
  motivoManual:
    "Automática somente para período diário com cobertura completa das posições; manual disponível para outros recortes.",
};
export type UsuarioMeta = {
  dono: boolean;
  areas: string[];
  flags: string[];
  abas: string[];
};
export function indicadoresPermitidos(u: UsuarioMeta) {
  return indicadores.filter((i) =>
    i.dominio === "pecuaria"
      ? temArea(u, "pecuaria")
      : temArea(u, "financeiro") &&
        (u.dono || u.abas.includes("dashboard")) &&
        (["verValores", "verInvestimento", "verSalarios"] as const).every((f) =>
          temPermissao(u, f),
        ),
  );
}
export const podeEditarMetas = (u: UsuarioMeta) => temPermissao(u, "lancar");
export const definicaoSchema = z
  .object({
    etapas: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            titulo: z.string().trim().min(1).max(160),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    titulo: z.string().trim().min(2).max(160),
    indicadorId: z.string().max(80),
    indicadorVersao: z.literal(1),
    tipo: z.enum(["minimo", "maximo", "faixa", "marco"]),
    minimo: z.number().finite().min(-1e12).max(1e12).nullable(),
    maximo: z.number().finite().min(-1e12).max(1e12).nullable(),
    periodo: z.enum(["diario", "mensal", "anual", "ciclo"]),
    prazo: z.string().date().nullable(),
    fonte: z.enum(["manual", "automatica"]),
    observacao: z.string().trim().max(2000),
  })
  .strict()
  .superRefine((v, c) => {
    const erro = (message: string) =>
      c.addIssue({ code: z.ZodIssueCode.custom, message });
    if (
      v.fonte === "automatica" &&
      (v.indicadorId !== "leite_volume" ||
        v.periodo !== "diario" ||
        v.tipo === "marco")
    )
      erro("Fonte automática disponível apenas para volume geral diário.");
    if (!indicadores.some((i) => i.id === v.indicadorId))
      erro("Indicador inválido.");
    if (
      v.etapas &&
      new Set(v.etapas.map((e) => e.id.toLowerCase())).size !== v.etapas.length
    )
      erro("Cada etapa deve ter uma identificação única.");
    if (v.tipo !== "marco" && v.etapas !== undefined)
      erro("Etapas pertencem somente a marcos.");
    if (v.tipo === "marco") {
      if (
        !v.prazo ||
        v.minimo !== null ||
        v.maximo !== null ||
        v.indicadorId !== "marco_operacional"
      )
        erro("Marco exige prazo e indicador de marco, sem limites numéricos.");
    } else {
      if (v.indicadorId === "marco_operacional")
        erro("Escolha marco para o indicador operacional.");
      if ((v.tipo === "minimo" || v.tipo === "faixa") && v.minimo === null)
        erro("Informe o mínimo.");
      if ((v.tipo === "maximo" || v.tipo === "faixa") && v.maximo === null)
        erro("Informe o máximo.");
      if (
        (v.tipo === "minimo" && v.maximo !== null) ||
        (v.tipo === "maximo" && v.minimo !== null)
      )
        erro("Use somente o limite escolhido.");
      if (
        v.tipo === "faixa" &&
        v.minimo !== null &&
        v.maximo !== null &&
        v.minimo > v.maximo
      )
        erro("Mínimo deve ser menor ou igual ao máximo.");
    }
    if (
      v.indicadorId !== "resultado_financeiro" &&
      [v.minimo, v.maximo].some((n) => n !== null && n < 0)
    )
      erro("O limite deste indicador não pode ser negativo.");
    if (
      ["taxa_prenhez", "mortalidade"].includes(v.indicadorId) &&
      [v.minimo, v.maximo].some((n) => n !== null && n > 100)
    )
      erro("Taxas devem estar entre 0 e 100%.");
  });
export type DefinicaoMeta = z.infer<typeof definicaoSchema>;
export const salvarMetaSchema = z
  .object({
    operacaoId: z
      .string()
      .uuid()
      .transform((v) => v.toLowerCase()),
    versaoBase: z.number().int().min(0).max(2147483646),
    definicao: definicaoSchema,
  })
  .strict();
export const medicaoSchema = z
  .object({
    operacaoId: z
      .string()
      .uuid()
      .transform((v) => v.toLowerCase()),
    versaoBase: z.number().int().positive().max(2147483646),
    etapasConcluidas: z.array(z.string().uuid()).max(20).optional(),
    data: z.string().date(),
    valor: z.number().finite().min(-1e12).max(1e12).nullable(),
    concluido: z.boolean().nullable(),
    observacao: z.string().trim().min(3).max(2000),
  })
  .strict();
export function avaliarMeta(
  d: Pick<DefinicaoMeta, "tipo" | "minimo" | "maximo">,
  m: { valor: number | null; concluido: boolean | null } | null,
): "sem_medicao" | "no_alvo" | "fora_do_alvo" | "concluido" | "em_aberto" {
  if (!m) return "sem_medicao";
  if (d.tipo === "marco") return m.concluido ? "concluido" : "em_aberto";
  if (m.valor === null) return "sem_medicao";
  return (d.minimo === null || m.valor >= d.minimo) &&
    (d.maximo === null || m.valor <= d.maximo)
    ? "no_alvo"
    : "fora_do_alvo";
}

export function conferirEtapasMedicao(
  d: Pick<DefinicaoMeta, "tipo" | "etapas">,
  m: { concluido: boolean | null; etapasConcluidas?: string[] },
) {
  const ids = m.etapasConcluidas ?? [];
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length)
    throw new Error("Uma etapa não pode ser repetida na medição.");
  if (d.tipo !== "marco" && m.etapasConcluidas !== undefined)
    throw new Error("Indicadores numéricos não aceitam etapas.");
  const etapas = d.etapas ?? [];
  if (ids.some((id) => !etapas.some((e) => e.id === id)))
    throw new Error(
      "A medição contém uma etapa que não pertence à definição vigente.",
    );
  if (etapas.length && m.concluido !== (ids.length === etapas.length))
    throw new Error(
      "A conclusão do marco deve corresponder à conclusão de todas as etapas.",
    );
}
