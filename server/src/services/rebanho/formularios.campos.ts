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
  eventoAlvo: TipoEventoRelatorio;
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
    ],
  },
  observacao: {
    chave: "observacao",
    rotulo: "Observação",
    tipoUi: "texto",
    obrigatorio: false,
    eventoAlvo: "DIAGNOSTICO",
  },
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
    eventoAlvo: templateId === "partos-previstos" ? "PARTO" : "DIAGNOSTICO",
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
  sexo_cria: z.enum(["F", "M", "FM", "MF"]).optional(),
  observacao: z.string().trim().max(200).optional(),
});

function respostasInvalidas(): never {
  throw new Error("respostas inválidas para o formulário");
}

export function mapearRespostasParaEvento(
  templateId: IdTemplateRelatorio,
  respostas: Record<string, unknown>,
): CriarEventoInput {
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
