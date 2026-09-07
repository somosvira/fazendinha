import { z } from "zod";
import type { CriarEventoInput } from "./eventos.schemas.js";
import { AUXILIOS_PARTO, TIPOS_PARTO } from "./parto.dict.js";
import type { IdTemplateRelatorio, TipoEventoRelatorio } from "./relatorios.catalogo.js";

export const CHAVES_CAMPO_FORMULARIO = [
  "resultado_dg",
  "data_evento",
  "metodo_dg",
  "dt_parto_prevista",
  "tipo_parto",
  "auxilio_parto",
  "num_crias",
  "crias_vivas",
  "crias_natimortas",
  "sexo_cria",
  "observacao",
  "peso_1",
  "peso_2",
  "peso_3",
  "peso_total",
  "peso_corporal",
  "vacina",
] as const;

export type ChaveCampoFormulario = (typeof CHAVES_CAMPO_FORMULARIO)[number];
export type TipoUiCampoFormulario = "opcoes" | "data" | "texto" | "numero";

export interface OpcaoCampoFormulario {
  valor: string;
  rotulo: string;
}

export interface CampoFormularioDTO {
  chave: ChaveCampoFormulario;
  rotulo: string;
  tipoUi: TipoUiCampoFormulario;
  obrigatorio: boolean;
  eventoAlvo: TipoEventoRelatorio | "CONTROLE_LEITEIRO" | "PESAGEM_CORPORAL" | "VACINA";
  opcoes?: readonly OpcaoCampoFormulario[];
}

const CAMPO_POR_CHAVE: Record<ChaveCampoFormulario, CampoFormularioDTO> = {
  resultado_dg: {
    chave: "resultado_dg",
    rotulo: "Resultado do toque",
    tipoUi: "opcoes",
    obrigatorio: true,
    eventoAlvo: "DIAGNOSTICO",
    opcoes: [
      { valor: "positivo", rotulo: "Prenhe" },
      { valor: "negativo", rotulo: "Vazia" },
    ],
  },
  data_evento: {
    chave: "data_evento",
    rotulo: "Data do procedimento",
    tipoUi: "data",
    obrigatorio: true,
    eventoAlvo: "DIAGNOSTICO",
  },
  metodo_dg: {
    chave: "metodo_dg",
    rotulo: "Método",
    tipoUi: "opcoes",
    obrigatorio: false,
    eventoAlvo: "DIAGNOSTICO",
    opcoes: [
      { valor: "Palpação", rotulo: "Palpação" },
      { valor: "Ultrassom", rotulo: "Ultrassom" },
    ],
  },
  dt_parto_prevista: {
    chave: "dt_parto_prevista",
    rotulo: "Parto previsto",
    tipoUi: "data",
    obrigatorio: false,
    eventoAlvo: "DIAGNOSTICO",
  },
  tipo_parto: {
    chave: "tipo_parto",
    rotulo: "Tipo de parto",
    tipoUi: "opcoes",
    obrigatorio: true,
    eventoAlvo: "PARTO",
    opcoes: TIPOS_PARTO.map(({ codigo, label }) => ({ valor: codigo, rotulo: label })),
  },
  auxilio_parto: {
    chave: "auxilio_parto",
    rotulo: "Auxílio",
    tipoUi: "opcoes",
    obrigatorio: false,
    eventoAlvo: "PARTO",
    opcoes: AUXILIOS_PARTO.map(({ codigo, label }) => ({ valor: codigo, rotulo: label })),
  },
  num_crias: {
    chave: "num_crias",
    rotulo: "Número de crias",
    tipoUi: "numero",
    obrigatorio: true,
    eventoAlvo: "PARTO",
  },
  crias_vivas: {
    chave: "crias_vivas",
    rotulo: "Crias vivas",
    tipoUi: "numero",
    obrigatorio: true,
    eventoAlvo: "PARTO",
  },
  crias_natimortas: {
    chave: "crias_natimortas",
    rotulo: "Natimortas",
    tipoUi: "numero",
    obrigatorio: true,
    eventoAlvo: "PARTO",
  },
  sexo_cria: {
    chave: "sexo_cria",
    rotulo: "Sexo da cria",
    tipoUi: "opcoes",
    obrigatorio: false,
    eventoAlvo: "PARTO",
    opcoes: [
      { valor: "F", rotulo: "Fêmea" },
      { valor: "M", rotulo: "Macho" },
      { valor: "FM", rotulo: "Fêmea / macho" },
      { valor: "MF", rotulo: "Macho / fêmea" },
      { valor: "FFF", rotulo: "3 fêmeas" },
      { valor: "FFM", rotulo: "2 fêmeas / 1 macho" },
      { valor: "FMM", rotulo: "1 fêmea / 2 machos" },
      { valor: "MMM", rotulo: "3 machos" },
    ],
  },
  observacao: {
    chave: "observacao",
    rotulo: "Observação",
    tipoUi: "texto",
    obrigatorio: false,
    eventoAlvo: "DIAGNOSTICO",
  },
  peso_1: { chave: "peso_1", rotulo: "1ª ordenha (L)", tipoUi: "numero", obrigatorio: false, eventoAlvo: "CONTROLE_LEITEIRO" },
  peso_2: { chave: "peso_2", rotulo: "2ª ordenha (L)", tipoUi: "numero", obrigatorio: false, eventoAlvo: "CONTROLE_LEITEIRO" },
  peso_3: { chave: "peso_3", rotulo: "3ª ordenha (L)", tipoUi: "numero", obrigatorio: false, eventoAlvo: "CONTROLE_LEITEIRO" },
  peso_total: { chave: "peso_total", rotulo: "Total do dia (L)", tipoUi: "numero", obrigatorio: false, eventoAlvo: "CONTROLE_LEITEIRO" },
  peso_corporal: { chave: "peso_corporal", rotulo: "Peso corporal (kg)", tipoUi: "numero", obrigatorio: true, eventoAlvo: "PESAGEM_CORPORAL" },
  vacina: { chave: "vacina", rotulo: "Vacina", tipoUi: "texto", obrigatorio: true, eventoAlvo: "VACINA" },
};

const CAMPOS_DG: readonly ChaveCampoFormulario[] = [
  "resultado_dg",
  "data_evento",
  "metodo_dg",
  "dt_parto_prevista",
  "observacao",
];
const CAMPOS_PARTO: readonly ChaveCampoFormulario[] = [
  "data_evento",
  "tipo_parto",
  "auxilio_parto",
  "num_crias",
  "crias_vivas",
  "crias_natimortas",
  "sexo_cria",
  "observacao",
];

const CAMPOS_POR_TEMPLATE: Partial<Record<IdTemplateRelatorio, readonly ChaveCampoFormulario[]>> = {
  "ia-periodo": CAMPOS_DG,
  "cobertura-periodo": CAMPOS_DG,
  "te-periodo": CAMPOS_DG,
  "partos-previstos": CAMPOS_PARTO,
  "controle-leiteiro-lote": ["data_evento", "peso_1", "peso_2", "peso_3", "peso_total", "observacao"],
  "pesagem-corporal-lote": ["data_evento", "peso_corporal", "observacao"],
  "vacinacao-lote": ["data_evento", "vacina", "observacao"],
};

export function obterCampoFormulario(chave: string): CampoFormularioDTO {
  const campo = CAMPO_POR_CHAVE[chave as ChaveCampoFormulario];
  if (!campo) throw new Error("campo de formulário não encontrado");
  return campo;
}

export function validarCamposDoTemplate(templateId: IdTemplateRelatorio, chaves: readonly ChaveCampoFormulario[]): void {
  const permitidas = CAMPOS_POR_TEMPLATE[templateId] ?? [];
  for (const chave of chaves) {
    if (!permitidas.includes(chave)) throw new Error(`campo ${chave} não pertence ao formulário ${templateId}`);
  }
  const obrigatorias = permitidas.filter((chave) => CAMPO_POR_CHAVE[chave].obrigatorio);
  const faltantes = obrigatorias.filter((chave) => !chaves.includes(chave));
  if (faltantes.length) throw new Error(`campos obrigatórios ausentes: ${faltantes.join(", ")}`);
}

export function camposParaTemplate(templateId: IdTemplateRelatorio): CampoFormularioDTO[] {
  return (CAMPOS_POR_TEMPLATE[templateId] ?? []).map(obterCampoFormulario).map((campo) => ({
    ...campo,
    // Campos compartilhados assumem o alvo operacional do template.
    eventoAlvo: templateId === "partos-previstos" ? "PARTO"
      : templateId === "controle-leiteiro-lote" ? "CONTROLE_LEITEIRO"
      : templateId === "pesagem-corporal-lote" ? "PESAGEM_CORPORAL"
      : templateId === "vacinacao-lote" ? "VACINA" : "DIAGNOSTICO",
  }));
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const respostasDgSchema = z.object({
  resultado_dg: z.enum(["positivo", "negativo"]),
  data_evento: isoDate,
  metodo_dg: z.enum(["Palpação", "Ultrassom"]).optional(),
  dt_parto_prevista: isoDate.optional(),
  observacao: z.string().trim().max(200).optional(),
});
const respostasPartoSchema = z.object({
  data_evento: isoDate,
  tipo_parto: z.string().min(1).max(20),
  auxilio_parto: z.string().min(1).max(20).optional(),
  num_crias: z.coerce.number().int().min(0).max(3),
  crias_vivas: z.coerce.number().int().min(0).max(3),
  crias_natimortas: z.coerce.number().int().min(0).max(3),
  sexo_cria: z.string().regex(/^[FM]{1,3}$/).optional(),
  observacao: z.string().trim().max(200).optional(),
});

function respostasInvalidas(): never {
  throw new Error("respostas inválidas para o formulário");
}

export type ResultadoOperacionalFormulario =
  | { tipo: "CONTROLE_LEITEIRO"; data: string; peso1?: number; peso2?: number; peso3?: number; pesoTotal?: number; observacao?: string }
  | { tipo: "PESAGEM_CORPORAL"; data: string; peso: number }
  | { tipo: "VACINA"; data: string; produto: string; observacao?: string };

const numeroPositivo = z.coerce.number().positive().max(9999.99);
export function mapearRespostasOperacionais(templateId: IdTemplateRelatorio, respostas: Record<string, unknown>): ResultadoOperacionalFormulario | null {
  if (templateId === "controle-leiteiro-lote") {
    const parse = z.object({ data_evento: isoDate, peso_1: numeroPositivo.optional(), peso_2: numeroPositivo.optional(), peso_3: numeroPositivo.optional(), peso_total: numeroPositivo.optional(), observacao: z.string().trim().max(200).optional() })
      .refine((v) => [v.peso_1, v.peso_2, v.peso_3, v.peso_total].some((v) => v != null), "informe ao menos uma ordenha ou o total")
      .safeParse(respostas);
    if (!parse.success) return respostasInvalidas();
    const v = parse.data;
    return { tipo: "CONTROLE_LEITEIRO", data: v.data_evento, ...(v.peso_1 ? { peso1: v.peso_1 } : {}), ...(v.peso_2 ? { peso2: v.peso_2 } : {}), ...(v.peso_3 ? { peso3: v.peso_3 } : {}), ...(v.peso_total ? { pesoTotal: v.peso_total } : {}), ...(v.observacao ? { observacao: v.observacao } : {}) };
  }
  if (templateId === "pesagem-corporal-lote") {
    const parse = z.object({ data_evento: isoDate, peso_corporal: numeroPositivo }).safeParse(respostas);
    if (!parse.success) return respostasInvalidas();
    return { tipo: "PESAGEM_CORPORAL", data: parse.data.data_evento, peso: parse.data.peso_corporal };
  }
  if (templateId === "vacinacao-lote") {
    const parse = z.object({ data_evento: isoDate, vacina: z.string().trim().min(1).max(60), observacao: z.string().trim().max(200).optional() }).safeParse(respostas);
    if (!parse.success) return respostasInvalidas();
    return { tipo: "VACINA", data: parse.data.data_evento, produto: parse.data.vacina, ...(parse.data.observacao ? { observacao: parse.data.observacao } : {}) };
  }
  return null;
}

export function mapearRespostasParaEvento(
  templateId: IdTemplateRelatorio,
  respostas: Record<string, unknown>,
): CriarEventoInput {
  if (mapearRespostasOperacionais(templateId, respostas)) return respostasInvalidas();
  if (templateId === "partos-previstos") {
    const parse = respostasPartoSchema.safeParse(respostas);
    if (!parse.success) return respostasInvalidas();
    const v = parse.data;
    return {
      tipo: "PARTO",
      data: v.data_evento,
      tipoParto: v.tipo_parto,
      ...(v.auxilio_parto ? { auxilioParto: v.auxilio_parto } : {}),
      numCrias: v.num_crias,
      criasVivas: v.crias_vivas,
      criasNatimortas: v.crias_natimortas,
      ...(v.sexo_cria ? { sexoCria: v.sexo_cria } : {}),
      ...(v.observacao ? { observacao: v.observacao } : {}),
    };
  }
  if (!CAMPOS_POR_TEMPLATE[templateId]) return respostasInvalidas();
  const parse = respostasDgSchema.safeParse(respostas);
  if (!parse.success) return respostasInvalidas();
  const v = parse.data;
  return {
    tipo: "DIAGNOSTICO",
    data: v.data_evento,
    resultado: v.resultado_dg,
    ...(v.dt_parto_prevista ? { dtPartoPrevista: v.dt_parto_prevista } : {}),
    ...(v.metodo_dg ? { metodo: v.metodo_dg } : {}),
    ...(v.observacao ? { observacao: v.observacao } : {}),
  };
}
