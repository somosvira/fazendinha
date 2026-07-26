export type Sexo = "F" | "M";
export type CategoriaAnimal = "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO" | "CABRITA" | "CABRA" | "CABRITO" | "BODE";
export type EspecieAnimal = "BOVINO" | "CAPRINO";

export const ESPECIE_POR_CATEGORIA: Record<CategoriaAnimal, EspecieAnimal> = {
  BEZERRA: "BOVINO", NOVILHA: "BOVINO", VACA: "BOVINO", BEZERRO: "BOVINO", TOURO: "BOVINO",
  CABRITA: "CAPRINO", CABRA: "CAPRINO", CABRITO: "CAPRINO", BODE: "CAPRINO",
};
export type StatusReprodutivo = "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
export type Dominio = "reproducao" | "sanidade" | "nutricao" | "producao";

export interface Animal {
  id: string;            // ex.: "1234"
  numero: string;        // identificação visível
  nome: string;
  sexo: Sexo;
  categoria: CategoriaAnimal;
  raca: string | null;   // "Girolando 5/8"
  grauSangue?: string | null;
  dataNascimento: string | null; // ISO "YYYY-MM-DD"
  dataEntrada: string;
  brincoEletronico?: string | null;
  sisbov?: string | null;
  maeId?: string | null;
  maeNome?: string | null;
  maeNumero?: string | null;
  paiNome?: string | null;
  grupoAtual?: string;   // lote
  grupoId?: number | null;
  grupoNome?: string | null;
  dietaNome?: string | null;
  setor?: string | null;
  ativo: boolean;
  dataBaixa?: string | null;
  motivoBaixa?: string | null;
  ultimoPesoKg?: number | null; // última pesagem corporal (kg) — vem do backend
  resumo?: ResumoAnimal | null;
}

// Read-model pré-computado por animal (espelha ANIMALINFO_* do Ideagri)
export interface ResumoAnimal {
  animalId: string;
  statusReprodutivo: StatusReprodutivo;
  del?: number;                 // dias em leite
  ordemLactacao?: number;
  producaoMediaDia?: number;    // L/d
  producao305?: number;
  producaoTendencia?: "subindo" | "estavel" | "descendo" | null;
  ccs?: number;                 // mil cél/mL
  ccsTendencia?: "subindo" | "estavel" | "caindo";
  ultimoDgData?: string;        // ISO
  ultimoDgResultado?: "positivo" | "negativo";
  iepProjetado?: number;        // dias
  diasGestacao?: number;
  previsaoSecagem?: string;     // ISO
  ultimaInseminacao?: string | null;   // ISO; cobertura mais recente, IA ou TE
  protocoloAtual?: string | null;
  // Enriquecimento feito pelas tabs a partir do Animal (não vem no read-model
  // do servidor) — usado pelas work-lists que dependem de idade/peso/categoria,
  // como "A desmamar".
  categoria?: CategoriaAnimal | null;
  dataNascimento?: string | null; // ISO "YYYY-MM-DD"
  ultimoPesoKg?: number | null;   // última pesagem corporal (kg)
}

// Evento normalizado — única forma consumida pela timeline no protótipo.
// Os 5 campos da timeline editorial: data, título, detalhe (quem),
// impacto (R$ ou produtivo) e próximo passo. interpretação automática vem
// separada via map `interpretacao[dominio:id]`.
export interface EventoTimeline {
  id: string;
  animalId: string;
  data: string;        // ISO
  dominio: Dominio;
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  marcador?: string;   // ex.: "início da 3ª lactação" (separador na timeline)
  responsavel?: string;   // quem realizou (operador / vet / sistema)
  impacto?: string;       // impacto financeiro ou produtivo
  proximoPasso?: string;  // próxima ação ("retorno em 14 dias")
}

export interface IaInsight {
  id: string;
  escopo: "rebanho" | "animal";
  dominio: Dominio;
  animalId?: string;
  texto: string;       // pode conter <b> simples
  acoes: { label: string; primaria?: boolean }[];
}
