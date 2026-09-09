import { labelAuxilioParto, labelTipoParto } from "./parto.dict.js";

export const IDS_TEMPLATE_RELATORIO = [
  "novilhas-aptas",
  "ia-periodo",
  "cobertura-periodo",
  "te-periodo",
  "dg-periodo",
  "gestantes-atual",
  "partos-previstos",
  "partos-periodo",
  "secagens-periodo",
  "controle-leiteiro-lote",
  "pesagem-corporal-lote",
  "vacinacao-lote",
] as const;

export type IdTemplateRelatorio = (typeof IDS_TEMPLATE_RELATORIO)[number];
export type GranularidadeRelatorio = "evento" | "animal";
export type TipoColunaRelatorio = "texto" | "numero" | "data";
export type ValorCelulaRelatorio = string | number | null;
export type TipoEventoRelatorio =
  | "CIO"
  | "INSEMINACAO"
  | "COBERTURA"
  | "DIAGNOSTICO"
  | "PARTO"
  | "SECAGEM"
  | "TRANSFERENCIA_EMBRIAO"
  | "EXAME_GINECOLOGICO"
  | "DESMAME";

export interface FonteRelatorio {
  data?: Date | null;
  reprodutor?: string | null;
  protocolo?: string | null;
  resultado?: string | null;
  dtPartoPrevista?: Date | null;
  tipoParto?: string | null;
  auxilioParto?: string | null;
  numCrias?: number | null;
  criasVivas?: number | null;
  criasNatimortas?: number | null;
  sexoCria?: string | null;
  motivoSecagem?: string | null;
  observacao?: string | null;
  doadoraNumero?: string | null;
  doadoraNome?: string | null;
  del?: number | null;
  diasGestacao?: number | null;
  previsaoSecagem?: Date | null;
  ultimaInseminacao?: Date | null;
}

export interface ColunaDefRelatorio {
  chave: string;
  rotulo: string;
  tipo: TipoColunaRelatorio;
  extrair: (fonte: FonteRelatorio) => ValorCelulaRelatorio;
}

export interface AcaoTemplateRelatorio {
  tipoEvento: TipoEventoRelatorio;
  rotulo: string;
}

export interface TemplateRelatorio {
  id: IdTemplateRelatorio;
  titulo: string;
  descricao: string;
  fase: "Serviços" | "Gestação" | "Parto e secagem" | "Manejo em lote";
  granularidade: GranularidadeRelatorio;
  tipoEvento?: TipoEventoRelatorio;
  statusReprodutivo?: "PRENHE";
  colunas: ColunaDefRelatorio[];
  acao: AcaoTemplateRelatorio | null;
  filtrosEspecificos: readonly ("reprodutor" | "protocolo" | "resultado")[];
}

const iso = (d?: Date | null) => d ? new Date(d).toISOString().slice(0, 10) : null;
const texto = (valor?: string | null) => valor?.trim() || null;
const resultadoLabel = (valor?: string | null) => valor ? valor.charAt(0).toUpperCase() + valor.slice(1).toLowerCase() : null;

const TEMPLATES: readonly TemplateRelatorio[] = [
  {
    id: "novilhas-aptas",
    titulo: "Novilhas aptas à reprodução",
    descricao: "Novilhas que atingiram simultaneamente a idade e o peso mínimos definidos no manejo.",
    fase: "Serviços",
    granularidade: "animal",
    colunas: [
      { chave: "idadeMeses", rotulo: "Idade (meses)", tipo: "numero", extrair: () => null },
      { chave: "ultimoPeso", rotulo: "Último peso (kg)", tipo: "numero", extrair: () => null },
      { chave: "criterioAptidao", rotulo: "Critério atendido", tipo: "texto", extrair: () => null },
    ],
    acao: null,
    filtrosEspecificos: [],
  },
  {
    id: "ia-periodo",
    titulo: "Inseminações no período",
    descricao: "Uma linha por tentativa de inseminação artificial.",
    fase: "Serviços",
    granularidade: "evento",
    tipoEvento: "INSEMINACAO",
    colunas: [
      { chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto", extrair: (f) => texto(f.reprodutor) },
      { chave: "protocolo", rotulo: "Protocolo", tipo: "texto", extrair: (f) => texto(f.protocolo) },
    ],
    acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
    filtrosEspecificos: ["reprodutor", "protocolo"],
  },
  {
    id: "cobertura-periodo",
    titulo: "Coberturas no período",
    descricao: "Uma linha por cobertura em monta natural.",
    fase: "Serviços",
    granularidade: "evento",
    tipoEvento: "COBERTURA",
    colunas: [
      { chave: "reprodutor", rotulo: "Touro", tipo: "texto", extrair: (f) => texto(f.reprodutor) },
      { chave: "observacao", rotulo: "Observação", tipo: "texto", extrair: (f) => texto(f.observacao) },
    ],
    acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
    filtrosEspecificos: ["reprodutor"],
  },
  {
    id: "te-periodo",
    titulo: "Transferências de embrião no período",
    descricao: "Uma linha por transferência em receptora.",
    fase: "Serviços",
    granularidade: "evento",
    tipoEvento: "TRANSFERENCIA_EMBRIAO",
    colunas: [
      { chave: "doadora", rotulo: "Doadora", tipo: "texto", extrair: (f) => texto(f.doadoraNome) ?? texto(f.doadoraNumero) },
      { chave: "reprodutor", rotulo: "Touro / sêmen", tipo: "texto", extrair: (f) => texto(f.reprodutor) },
      { chave: "protocolo", rotulo: "Protocolo", tipo: "texto", extrair: (f) => texto(f.protocolo) },
    ],
    acao: { tipoEvento: "DIAGNOSTICO", rotulo: "Registrar DG" },
    filtrosEspecificos: ["reprodutor", "protocolo"],
  },
  {
    id: "dg-periodo",
    titulo: "Diagnósticos de gestação no período",
    descricao: "Diagnósticos positivos e negativos realizados no período.",
    fase: "Gestação",
    granularidade: "evento",
    tipoEvento: "DIAGNOSTICO",
    colunas: [
      { chave: "resultado", rotulo: "Resultado", tipo: "texto", extrair: (f) => resultadoLabel(f.resultado) },
      { chave: "partoPrevisto", rotulo: "Parto previsto", tipo: "data", extrair: (f) => iso(f.dtPartoPrevista) },
    ],
    acao: null,
    filtrosEspecificos: ["resultado"],
  },
  {
    id: "gestantes-atual",
    titulo: "Gestantes atualmente",
    descricao: "Foto atual das fêmeas com prenhez confirmada.",
    fase: "Gestação",
    granularidade: "animal",
    statusReprodutivo: "PRENHE",
    colunas: [
      { chave: "diasGestacao", rotulo: "Dias de gestação", tipo: "numero", extrair: (f) => f.diasGestacao ?? null },
      { chave: "ultimaTentativa", rotulo: "Última tentativa", tipo: "data", extrair: (f) => iso(f.ultimaInseminacao) },
      { chave: "previsaoSecagem", rotulo: "Previsão de secagem", tipo: "data", extrair: (f) => iso(f.previsaoSecagem) },
    ],
    acao: null,
    filtrosEspecificos: [],
  },
  {
    id: "partos-previstos",
    titulo: "Partos previstos",
    descricao: "Gestantes cuja previsão de parto está dentro do período escolhido.",
    fase: "Parto e secagem",
    granularidade: "animal",
    statusReprodutivo: "PRENHE",
    colunas: [
      { chave: "partoPrevisto", rotulo: "Parto previsto", tipo: "data", extrair: (f) => iso(f.dtPartoPrevista) },
      { chave: "diasGestacao", rotulo: "Dias de gestação", tipo: "numero", extrair: (f) => f.diasGestacao ?? null },
    ],
    acao: { tipoEvento: "PARTO", rotulo: "Registrar parto" },
    filtrosEspecificos: [],
  },
  {
    id: "partos-periodo",
    titulo: "Partos no período",
    descricao: "Uma linha por parto, aborto ou nascimento registrado.",
    fase: "Parto e secagem",
    granularidade: "evento",
    tipoEvento: "PARTO",
    colunas: [
      { chave: "tipoParto", rotulo: "Tipo", tipo: "texto", extrair: (f) => labelTipoParto(f.tipoParto) },
      { chave: "auxilio", rotulo: "Auxílio", tipo: "texto", extrair: (f) => labelAuxilioParto(f.auxilioParto) },
      { chave: "crias", rotulo: "Crias", tipo: "numero", extrair: (f) => f.numCrias ?? null },
      { chave: "vivas", rotulo: "Vivas", tipo: "numero", extrair: (f) => f.criasVivas ?? null },
      { chave: "natimortas", rotulo: "Natimortas", tipo: "numero", extrair: (f) => f.criasNatimortas ?? null },
      { chave: "sexo", rotulo: "Sexo", tipo: "texto", extrair: (f) => texto(f.sexoCria) },
    ],
    acao: null,
    filtrosEspecificos: [],
  },
  {
    id: "secagens-periodo",
    titulo: "Secagens no período",
    descricao: "Uma linha por secagem registrada.",
    fase: "Parto e secagem",
    granularidade: "evento",
    tipoEvento: "SECAGEM",
    colunas: [
      { chave: "motivo", rotulo: "Motivo", tipo: "texto", extrair: (f) => texto(f.motivoSecagem) },
      { chave: "observacao", rotulo: "Observação", tipo: "texto", extrair: (f) => texto(f.observacao) },
    ],
    acao: null,
    filtrosEspecificos: [],
  },
  {
    id: "controle-leiteiro-lote",
    titulo: "Controle leiteiro em lote",
    descricao: "Folha dos animais ativos para coleta das ordenhas ou do total diário.",
    fase: "Manejo em lote", granularidade: "animal", colunas: [], acao: null, filtrosEspecificos: [],
  },
  {
    id: "pesagem-corporal-lote",
    titulo: "Pesagem corporal em lote",
    descricao: "Folha dos animais ativos para registrar peso corporal em campo.",
    fase: "Manejo em lote", granularidade: "animal",
    colunas: [{ chave: "ultimoPeso", rotulo: "Último peso (kg)", tipo: "numero", extrair: () => null }],
    acao: null, filtrosEspecificos: [],
  },
  {
    id: "vacinacao-lote",
    titulo: "Vacinação em lote",
    descricao: "Folha dos animais ativos para registrar uma campanha de vacinação.",
    fase: "Manejo em lote", granularidade: "animal", colunas: [], acao: null, filtrosEspecificos: [],
  },
];

export interface TemplateRelatorioDTO {
  id: IdTemplateRelatorio;
  titulo: string;
  descricao: string;
  fase: TemplateRelatorio["fase"];
  granularidade: GranularidadeRelatorio;
  filtrosEspecificos: TemplateRelatorio["filtrosEspecificos"];
  colunas: { chave: string; rotulo: string; tipo: TipoColunaRelatorio }[];
}

export function listarTemplatesRelatorio(): TemplateRelatorioDTO[] {
  return TEMPLATES.map(({ id, titulo, descricao, fase, granularidade, filtrosEspecificos, colunas }) => ({
    id, titulo, descricao, fase, granularidade, filtrosEspecificos,
    colunas: colunas.map(({ chave, rotulo, tipo }) => ({ chave, rotulo, tipo })),
  }));
}

export function obterTemplateRelatorio(id: string): TemplateRelatorio {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error("template de relatório não encontrado");
  return template;
}

export function extrairCelulas(template: TemplateRelatorio, fonte: FonteRelatorio): ValorCelulaRelatorio[] {
  return template.colunas.map((coluna) => coluna.extrair(fonte));
}
