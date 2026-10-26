import type { ConsultaOrdenhasGerais, MedicaoGeral } from "./tanques-types";

export type NaturezaParcela = "COMERCIAL" | "NAO_COMERCIAL" | "COLOSTRO";
export type CriterioColostro = { tipo: "PRIMEIRA_ORDENHA" } | { tipo: "JANELA_DIAS"; dias: number; incluiD0: true };
export interface ParcelaOrdenha extends Omit<MedicaoGeral, "tanque" | "natureza"> {
  tanque: ConsultaOrdenhasGerais["tanques"][number] | null;
  recipiente: string | null;
  natureza: NaturezaParcela | null;
  declaracaoDireta: { justificativa: string } | null;
  primeiraOrdenhaColostro: boolean | null;
  criterioColostroSnapshot: unknown | null;
}
export interface ContextoParcelas extends Omit<ConsultaOrdenhasGerais, "medicoes"> {
  medicoes: ParcelaOrdenha[];
  contexto: {
    carencias: { posicaoId: string; horario: string | null; animais: { animalId: string; estado: string; evidencias: unknown[] }[] }[];
    partos: { id: string; versao: number; animalId: string; data: string }[];
    origensColostro: { animalId: string; brinco: string; nome: string | null; del: number; partoId: string }[];
    criterioColostro: CriterioColostro | null;
  };
}
export interface ParcelaInput {
  id?: string;
  tanqueId: string | null;
  recipiente: string | null;
  versaoEsperada: number;
  litros: number;
  reguaMm: number | null;
  natureza: NaturezaParcela;
  animaisOrigem: string[];
  responsavel: string;
  motivoCorrecao?: string;
  declaracaoDireta?: { justificativa: string };
  primeiraOrdenhaColostro?: boolean;
}
export interface RegistroOrdenhaConsulta {
  id: string;
  diaId: string;
  dataOperacional: string;
  posicaoId: string;
  nome: string;
  ordem: number;
  fonteProducao: "GERAL" | "INDIVIDUAL";
  litros: number | null;
  situacao: string;
  porNatureza: { natureza: NaturezaParcela | "A_CLASSIFICAR"; litros: number | null }[];
  parcelas: { medicaoGeralId: string | null; tanqueId: string | null; recipiente: string | null; natureza: string | null; litros: number | null; confirmada: boolean }[];
}
export interface ConsultaParcelas {
  propriedadeId: number;
  periodo: { inicio: string; fim: string };
  itens: RegistroOrdenhaConsulta[];
  total: number;
  pagina: number;
  porPagina: number;
  resumo: { totalLitros: number | null; sessoes: number; semAfericao: number; pendentesEstoque: number; porNatureza: RegistroOrdenhaConsulta["porNatureza"] };
}
