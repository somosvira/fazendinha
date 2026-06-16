export type Sexo = "F" | "M";
export type CategoriaAnimal = "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO";
export type StatusReprodutivo = "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
export type Dominio = "reproducao" | "sanidade" | "nutricao" | "producao";

export interface Animal {
  id: string;            // ex.: "1234"
  numero: string;        // identificação visível
  nome: string;
  sexo: Sexo;
  categoria: CategoriaAnimal;
  raca: string;          // "Girolando 5/8"
  dataNascimento: string; // ISO "YYYY-MM-DD"
  dataEntrada: string;
  brincoEletronico?: string;
  sisbov?: string;
  maeId?: string;
  paiNome?: string;
  grupoAtual?: string;   // lote
  setor?: string;
  ativo: boolean;
}

// Read-model pré-computado por animal (espelha ANIMALINFO_* do Ideagri)
export interface ResumoAnimal {
  animalId: string;
  statusReprodutivo: StatusReprodutivo;
  del?: number;                 // dias em leite
  ordemLactacao?: number;
  producaoMediaDia?: number;    // L/d
  producao305?: number;
  ccs?: number;                 // mil cél/mL
  ccsTendencia?: "subindo" | "estavel" | "caindo";
  ultimoDgData?: string;        // ISO
  ultimoDgResultado?: "positivo" | "negativo";
  iepProjetado?: number;        // dias
  diasGestacao?: number;
  previsaoSecagem?: string;     // ISO
  ultimaInseminacao?: string;   // ISO
  protocoloAtual?: string;
}

// Evento normalizado — única forma consumida pela timeline no protótipo.
export interface EventoTimeline {
  id: string;
  animalId: string;
  data: string;        // ISO
  dominio: Dominio;
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  marcador?: string;   // ex.: "início da 3ª lactação" (separador na timeline)
}

export interface IaInsight {
  id: string;
  escopo: "rebanho" | "animal";
  dominio: Dominio;
  animalId?: string;
  texto: string;       // pode conter <b> simples
  acoes: { label: string; primaria?: boolean }[];
}
