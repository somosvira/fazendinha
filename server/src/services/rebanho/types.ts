// Canonical DTO shapes — espelham client/src/rebanho/types.ts.
// `id` é o inteiro do banco serializado como string.

export interface AnimalDTO {
  id: string; numero: string; nome: string;
  sexo: "F" | "M";
  categoria: "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO" | "CABRITA" | "CABRA" | "CABRITO" | "BODE";
  finalidade: "LEITE" | "CORTE" | "DUPLA_APTIDAO" | "NAO_INFORMADA";
  raca: string | null; grauSangue: string | null;
  dataNascimento: string | null; dataEntrada: string;   // ISO "YYYY-MM-DD"
  brincoEletronico: string | null; sisbov: string | null;
  maeId: string | null; maeNome: string | null; maeNumero: string | null;
  paiNome: string | null;
  grupoId: number | null; grupoNome: string | null; dietaNome: string | null; setor: string | null;
  ativo: boolean; dataBaixa: string | null; motivoBaixa: string | null;
  ultimoPesoKg: number | null; // última pesagem corporal (kg) — alimenta o desmame por peso
  resumo: ResumoDTO | null;
}

export interface ResumoDTO {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  producaoMediaDia: number | null; producao305: number | null;
  ccs: number | null; ccsTendencia: string | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null;
  iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null;
  ultimaInseminacao: string | null; protocoloAtual: string | null;
}

export interface RacaDTO { id: number; nome: string; codigo: string | null; especie: "BOVINO" | "CAPRINO" }
export interface GrupoDTO { id: number; nome: string }
