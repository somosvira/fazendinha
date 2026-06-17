// Canonical DTO shapes — espelham client/src/rebanho/types.ts.
// `id` é o inteiro do banco serializado como string.

export interface AnimalDTO {
  id: string; numero: string; nome: string;
  sexo: "F" | "M";
  categoria: "BEZERRA" | "NOVILHA" | "VACA" | "BEZERRO" | "TOURO";
  raca: string | null; grauSangue: string | null;
  dataNascimento: string | null; dataEntrada: string;   // ISO "YYYY-MM-DD"
  brincoEletronico: string | null; sisbov: string | null;
  maeId: string | null; maeNome: string | null; maeNumero: string | null;
  paiNome: string | null;
  grupoId: number | null; grupoNome: string | null; setor: string | null;
  ativo: boolean; dataBaixa: string | null; motivoBaixa: string | null;
  resumo: ResumoDTO | null;
}

export interface ResumoDTO {
  statusReprodutivo: "PEV" | "VAZIA" | "INSEMINADA" | "PRENHE";
  del: number | null; ordemLactacao: number | null;
  producaoMediaDia: number | null; producao305: number | null;
  ccs: number | null; ccsTendencia: string | null;
  ultimoDgData: string | null; ultimoDgResultado: string | null;
  iepProjetado: number | null; diasGestacao: number | null; previsaoSecagem: string | null;
}

export interface RacaDTO { id: number; nome: string }
export interface GrupoDTO { id: number; nome: string }
