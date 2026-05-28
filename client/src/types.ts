export interface CentroCusto {
  id: number;
  nome: string;
  ehInvestimento: boolean;
  ordem: number;
}
export interface Categoria {
  id: number;
  nome: string;
  grupoCategoria: { id: number; nome: string };
}
export interface Conta {
  id: number;
  nome: string;
}
export interface Fornecedor {
  id: number;
  nome: string;
}

export interface MesCol {
  ano: number;
  mes: number;
  label: string;
  key: string;
}
export interface LinhaCategoria {
  categoria: string;
  valores: Record<string, number>;
  total: number;
}
export interface BlocoGrupo {
  grupo: string;
  categorias: LinhaCategoria[];
  subtotais: Record<string, number>;
  total: number;
}
export interface BlocoNatureza {
  natureza: "CREDITO" | "DEBITO";
  grupos: BlocoGrupo[];
  totais: Record<string, number>;
  total: number;
}
export interface BlocoCentro {
  centro: string;
  naturezas: BlocoNatureza[];
  totais: Record<string, number>;
  total: number;
}
export interface Relatorio {
  titulo: string;
  tipo: "REALIZADO" | "PROJECAO";
  meses: MesCol[];
  centros: BlocoCentro[];
  totalGeral: Record<string, number>;
  totalGeralAcumulado: number;
}

export interface MensalCategoria {
  categoria: string;
  porCentro: Record<string, number>;
  total: number;
}
export interface MensalGrupo {
  grupo: string;
  categorias: MensalCategoria[];
  subtotais: Record<string, number>;
  total: number;
}
export interface MensalNatureza {
  natureza: "CREDITO" | "DEBITO";
  grupos: MensalGrupo[];
  totais: Record<string, number>;
  total: number;
}
export interface RelatorioMensal {
  titulo: string;
  mesKey: string;
  label: string;
  tipo: "REALIZADO" | "PROJECAO";
  centros: string[];
  naturezas: MensalNatureza[];
  totalGeral: Record<string, number>;
  totalGeralAcumulado: number;
}

export interface LinhaDiaria {
  natureza: "CREDITO" | "DEBITO";
  grupo: string;
  categoria: string;
  fornecedor: string | null;
  centro: string;
  documento: string | null;
  valor: number;
}
export interface Dia {
  data: string;
  label: string;
  linhas: LinhaDiaria[];
  total: number;
}
export interface RelatorioDiario {
  titulo: string;
  mesKey: string;
  label: string;
  dias: Dia[];
  total: number;
}

export type AtividadeNome = "Leite" | "Café" | "Outros";

export interface Serie {
  receita: Record<string, number>;
  despesa: Record<string, number>;
  investimento: Record<string, number>;
  despesaPorGrupo: Record<string, Record<string, number>>;
  receitaPorGrupo: Record<string, Record<string, number>>;
}

export interface Dashboard {
  titulo: string;
  tipo: "REALIZADO" | "PROJECAO";
  meses: { key: string; label: string }[];
  anos: number[];
  atividades: Record<AtividadeNome, Serie>;
  consolidado: Serie;
}

export interface Lancamento {
  id: number;
  natureza: "CREDITO" | "DEBITO";
  valor: string;
  dataVencimento: string;
  dataLiquidacao: string | null;
  situacao: string;
  descricao: string | null;
  categoria: { nome: string; grupoCategoria: { nome: string } };
  centroCusto: { nome: string };
  clienteFornecedor: { nome: string } | null;
}
