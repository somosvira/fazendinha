/* DTOs do módulo Equipe & Ponto — espelham exatamente o que o backend
 * (server/.../routes/ponto/*) devolve. Decimals já chegam como number,
 * datas como "YYYY-MM-DD", horários como "HH:MM". Enums em UPPERCASE.
 */

// GET /api/ponto/funcionarios[/:id] · POST · PATCH /:id · POST /:id/baixa
export interface FuncionarioDTO {
  id: string;
  nome: string;
  cargo: string | null;
  setor: string | null;       // setor operacional; null = sem setor (exibido "Geral")
  salarioMensal: number;
  cargaMensalHoras: number;    // divisor do valor-hora (default 220)
  jornadaDiariaHoras: number;  // jornada normal por dia útil (default 8)
  horaEntradaPadrao: string | null;  // "HH:MM" — pré-preenche a grade (dias úteis)
  horaSaidaPadrao: string | null;    // "HH:MM"
  intervaloPadraoMin: number | null; // almoço padrão, minutos
  dataAdmissao: string | null; // YYYY-MM-DD
  cpf: string | null;
  chavePix: string | null;
  ativo: boolean;
}

// GET /api/ponto/custo-mo-setor — custo de MO agregado por setor (só ativos;
// sem setor → "Geral"; ordenado por totalMensal desc).
export interface CustoMOSetorDTO {
  setor: string;
  totalMensal: number; // soma dos salários mensais dos ativos do setor
  qtd: number;         // nº de funcionários ativos no setor
}

// tipoDia ∈ UTIL | DOMINGO | FERIADO | FOLGA | FALTA
export type TipoDiaPonto = "UTIL" | "DOMINGO" | "FERIADO" | "FOLGA" | "FALTA";

// GET /api/ponto/registros?funcionarioId=&mes=YYYY-MM · POST (upsert) · DELETE /:id
// horas/extra50/extra100 já vêm computados pelo motor de apuração.
export interface RegistroDTO {
  id: string;
  funcionarioId: string;
  data: string;              // YYYY-MM-DD
  entrada: string | null;    // HH:MM
  saida: string | null;      // HH:MM
  intervaloMin: number;
  tipoDia: string;           // TipoDiaPonto
  observacao: string | null;
  horas: number;
  extra50: number;
  extra100: number;
}

// GET /api/ponto/folha?mes=YYYY-MM — uma linha por funcionário + totais da fazenda
export interface FolhaLinhaDTO {
  funcionarioId: string;
  nome: string;
  cargo: string | null;
  salarioMensal: number;
  valorHora: number;
  diasTrabalhados: number;
  totalHoras: number;
  horasNormais: number;
  extra50: number;
  extra100: number;
  valorExtra: number;
  totalPagar: number;
}

export interface FolhaDTO {
  mes: string;               // YYYY-MM
  linhas: FolhaLinhaDTO[];
  totais: {
    salarios: number;
    valorExtra: number;
    totalPagar: number;
    totalHoras: number;
  };
}
