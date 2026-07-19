// Cálculo puro do "Cockpit do Dia" — agrega os contadores de ação do dia (reprodução, sanidade,
// carência de leite, estoque) e os saldos financeiros num único DTO. Sem I/O: recebe os números já
// coletados pelo service e só soma/prioriza. Reusa os tipos canônicos de dashboard.types.
import type { ChaveWorklistRebanho, SeveridadeAlerta, TabRebanho } from "./dashboard.types.js";
import type { SugestaoDTO } from "./sugestoes.calc.js";

// Chaves reprodutivas cuja quantidade soma no contador "repro" — em ordem canônica (o desempate de
// severidade escolhe a primeira desta lista).
const CHAVES_REPRO: ChaveWorklistRebanho[] = ["secagem-atrasada", "vazia-pos-pev", "dg-pendente", "parto-proximo"];
const PESO_SEVERIDADE: Record<SeveridadeAlerta, number> = { alta: 3, media: 2, baixa: 1 };

export interface AlertaResumo {
  chave: ChaveWorklistRebanho;
  quantidade: number;
  severidade: SeveridadeAlerta;
}

// Totais financeiros do mês por atividade — recorte já agregado por buildDashboard({from,to}).
// Só os campos que o Cockpit precisa p/ quebrar o saldo do mês em leite/café/outros.
export interface MesPorAtividade {
  receitaLeite: number;
  custeioLeitePuro: number;
  investLeite: number;
  receitaCafe: number;
  custeioCafe: number;
  investCafe: number;
  totalGeral: number; // fluxo líquido do mês (== fluxoMes); outros = totalGeral − leite − café
}

export interface CockpitInput {
  alertas: AlertaResumo[];       // worklists canônicas do dashboard do rebanho
  estoqueAbaixoMinimo: number;   // nº de produtos abaixo do mínimo (já contado no service)
  carenciaAtivaCount: number;    // nº de vacas em lactação com carência de leite ativa
  vacinaPendenteCount: number;   // nº de vacinas agendadas pendentes (vencidas + próximas)
  fluxoDia: number;              // fluxo financeiro líquido de hoje (sinal preservado)
  fluxoMes: number;              // fluxo financeiro líquido do mês corrente
  mesPorAtividade?: MesPorAtividade; // quebra do mês por atividade (ausente = modo demo/sem backend)
}

export interface CockpitContador {
  categoria: "repro" | "sanidade" | "vacina" | "carencia" | "estoque";
  quantidade: number;
  chave: ChaveWorklistRebanho | null; // deep-link p/ worklist canônica; null p/ carência/estoque
  tab: TabRebanho;                     // fallback/alvo de navegação
}

export interface CockpitDTO {
  contadores: CockpitContador[];
  // Fechamento do dia: total de pendências (soma dos contadores) e se o dia está "fechado"
  // (nada pendente). Fecha o objetivo do ROADMAP §4.1 "fechamento com 0 itens pendentes".
  pendenciasTotal: number;
  diaFechado: boolean;
  saldoDia: number;
  saldoMes: number;
  // Quebra do saldo do mês por atividade — leite e café derivados dos totais; outros é o
  // residual (absorve aquisição de animal, RN-caminhão e arredondamento). Σ == saldoMes.
  saldoLeite: number;
  saldoCafe: number;
  saldoOutros: number;
  // Sugestões do "Hoje" preditivo (V2 §5.1): top-3 decisões por impacto R$/dia +
  // o impacto total em aberto. Preenchidas pelo service (cockpit.ts); ausentes no
  // modo demo/sem backend. O feed completo mora na aba reb-sugestoes.
  sugestoesTop3?: SugestaoDTO[];
  impactoDiaSugestoes?: number;
}

/** Escolhe a chave de deep-link do bloco repro: maior severidade entre as presentes com quantidade
 *  > 0; empate resolvido pela ordem canônica de CHAVES_REPRO. null quando nenhuma tem quantidade. */
function chaveReproPrioritaria(alertas: AlertaResumo[]): ChaveWorklistRebanho | null {
  const candidatas = alertas.filter((a) => CHAVES_REPRO.includes(a.chave) && a.quantidade > 0);
  if (candidatas.length === 0) return null;
  let melhor = candidatas[0];
  let melhorRank = CHAVES_REPRO.indexOf(melhor.chave);
  for (const a of candidatas) {
    const rank = CHAVES_REPRO.indexOf(a.chave);
    const sevA = PESO_SEVERIDADE[a.severidade];
    const sevMelhor = PESO_SEVERIDADE[melhor.severidade];
    if (sevA > sevMelhor || (sevA === sevMelhor && rank < melhorRank)) {
      melhor = a;
      melhorRank = rank;
    }
  }
  return melhor.chave;
}

export function resumirCockpit(input: CockpitInput): CockpitDTO {
  const qtd = (chave: ChaveWorklistRebanho) => input.alertas.find((a) => a.chave === chave)?.quantidade ?? 0;
  const qtdRepro = CHAVES_REPRO.reduce((s, c) => s + qtd(c), 0);

  const contadores: CockpitContador[] = [
    { categoria: "repro", quantidade: qtdRepro, chave: chaveReproPrioritaria(input.alertas), tab: "reproducao" },
    { categoria: "sanidade", quantidade: qtd("ccs-alta"), chave: qtd("ccs-alta") > 0 ? "ccs-alta" : null, tab: "sanidade" },
    { categoria: "vacina", quantidade: input.vacinaPendenteCount, chave: input.vacinaPendenteCount > 0 ? "vacina-pendente" : null, tab: "sanidade" },
    { categoria: "carencia", quantidade: input.carenciaAtivaCount, chave: null, tab: "producao" },
    { categoria: "estoque", quantidade: input.estoqueAbaixoMinimo, chave: null, tab: "nutricao" },
  ];
  const pendenciasTotal = contadores.reduce((s, c) => s + c.quantidade, 0);

  // Quebra do saldo do mês por atividade. Leite e café são saldos "puros" (receita − custeio −
  // investimento da atividade); outros = totalGeral − leite − café, absorvendo o residual
  // (aquisição de animal, RN-caminhão, arredondamento) para manter Σ == saldoMes por construção.
  const m = input.mesPorAtividade;
  const saldoLeite = m ? m.receitaLeite - m.custeioLeitePuro - m.investLeite : 0;
  const saldoCafe = m ? m.receitaCafe - m.custeioCafe - m.investCafe : 0;
  const saldoOutros = m ? m.totalGeral - saldoLeite - saldoCafe : 0;

  return { contadores, pendenciasTotal, diaFechado: pendenciasTotal === 0, saldoDia: input.fluxoDia, saldoMes: input.fluxoMes, saldoLeite, saldoCafe, saldoOutros };
}
