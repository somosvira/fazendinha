import type {
  AnimalDashboardIn,
  CarenciaWorklistIn,
  ChaveWorklistRebanho,
  EventoConcepcaoDashboardIn,
  ParametrosDashboard,
  VacinaWorklistIn,
  WorklistRebanhoDTO,
} from "./dashboard.types.js";
import { LIMIAR_QUEDA_PCT } from "./producao.recompute.js";

export const ESTADOS_ELEGIVEIS_PRENHEZ = new Set(["PEV", "VAZIA", "INSEMINADA", "PRENHE"]);
export const ESPERA_DG_DIAS = 28;

export interface LimiaresManejo {
  pevDias: number;
  gestacaoDias: number;
  secagemAntec: number;
  ccsAlto: number;
}

export function ehElegivelPrenhez(status: string | null | undefined): boolean {
  return status != null && ESTADOS_ELEGIVEIS_PRENHEZ.has(status);
}

export function ehVaziaAtrasada(status: string | null | undefined, del: number | null | undefined, pevDias: number): boolean {
  return status === "VAZIA" && del != null && del > pevDias;
}

export function ehCcsAlto(ccs: number | null | undefined, limite: number): boolean {
  return ccs != null && ccs >= limite;
}

export function ehSecagemAtrasada(status: string | null | undefined, previsaoSecagem: string | null | undefined, hoje: string): boolean {
  return status === "PRENHE" && previsaoSecagem != null && previsaoSecagem < hoje;
}

export function ehPartoProximo(status: string | null | undefined, diasGestacao: number | null | undefined, gestacaoDias: number, janelaDias = 30): boolean {
  return status === "PRENHE" && diasGestacao != null && diasGestacao >= gestacaoDias - janelaDias;
}

export function ehDgPendente(status: string | null | undefined, ultimaCoberturaData: string | null, ultimoDgPosterior: boolean, hoje: string): boolean {
  return status === "INSEMINADA"
    && ultimaCoberturaData != null
    && !ultimoDgPosterior
    && diferencaDias(ultimaCoberturaData, hoje) >= ESPERA_DG_DIAS;
}

function diferencaDias(inicio: string, fim: string): number {
  return Math.floor((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

function compararAnimal(a: AnimalDashboardIn, b: AnimalDashboardIn): number {
  return a.numero.localeCompare(b.numero, "pt-BR", { numeric: true }) || a.id - b.id;
}

function contextoEventos(eventos: EventoConcepcaoDashboardIn[]) {
  const coberturas = eventos.filter((e) => e.tipo === "INSEMINACAO" || e.tipo === "TRANSFERENCIA_EMBRIAO");
  const ultimaCobertura = coberturas.sort((a, b) => b.data.localeCompare(a.data) || b.tipo.localeCompare(a.tipo))[0] ?? null;
  const dgPosterior = ultimaCobertura != null && eventos.some((e) => e.tipo === "DIAGNOSTICO" && e.data > ultimaCobertura.data);
  return { ultimaCobertura, dgPosterior };
}

export function construirWorklists(
  animais: AnimalDashboardIn[],
  eventos: EventoConcepcaoDashboardIn[],
  hoje: string,
  parametros: ParametrosDashboard,
  carencias: CarenciaWorklistIn[] = [],
  vacinasPendentes: VacinaWorklistIn[] = [],
): WorklistRebanhoDTO[] {
  const eventosPorAnimal = new Map<number, EventoConcepcaoDashboardIn[]>();
  for (const evento of eventos) {
    const lista = eventosPorAnimal.get(evento.animalId) ?? [];
    lista.push(evento);
    eventosPorAnimal.set(evento.animalId, lista);
  }

  const item = (animal: AnimalDashboardIn, motivo: string, valor: number | null, unidade: string | null, dataReferencia: string | null) => {
    const eventosAnimal = eventosPorAnimal.get(animal.id) ?? [];
    const { ultimaCobertura } = contextoEventos(eventosAnimal);
    return {
      animalId: animal.id,
      numero: animal.numero,
      nome: animal.nome,
      categoria: animal.categoria,
      grupo: animal.grupoNome,
      setor: animal.setor,
      motivo,
      valor,
      unidade,
      dataReferencia,
      ccs: animal.resumo?.ccs ?? null,
      ccsTendencia: animal.resumo?.ccsTendencia ?? null,
      del: animal.resumo?.del ?? null,
      diasGestacao: animal.resumo?.diasGestacao ?? null,
      previsaoSecagem: animal.resumo?.previsaoSecagem ?? null,
      ultimaCoberturaData: ultimaCobertura?.data ?? null,
      ultimaCoberturaTipo: (ultimaCobertura?.tipo as "INSEMINACAO" | "TRANSFERENCIA_EMBRIAO" | undefined) ?? null,
    };
  };

  const secagem = animais
    .filter((a) => ehSecagemAtrasada(a.resumo?.statusReprodutivo, a.resumo?.previsaoSecagem, hoje))
    .sort((a, b) => a.resumo!.previsaoSecagem!.localeCompare(b.resumo!.previsaoSecagem!) || compararAnimal(a, b))
    .map((a) => item(a, `Secagem prevista para ${a.resumo!.previsaoSecagem}.`, diferencaDias(a.resumo!.previsaoSecagem!, hoje), "dias de atraso", a.resumo!.previsaoSecagem));

  const vazias = animais
    .filter((a) => ehVaziaAtrasada(a.resumo?.statusReprodutivo, a.resumo?.del, parametros.pevDias))
    .sort((a, b) => (b.resumo!.del! - parametros.pevDias) - (a.resumo!.del! - parametros.pevDias) || compararAnimal(a, b))
    .map((a) => item(a, `DEL ${a.resumo!.del}: ${a.resumo!.del! - parametros.pevDias} dias acima do PEV.`, a.resumo!.del! - parametros.pevDias, "dias após PEV", null));

  const ccsAlta = animais
    .filter((a) => ehCcsAlto(a.resumo?.ccs, parametros.ccsAlto))
    .sort((a, b) => b.resumo!.ccs! - a.resumo!.ccs! || compararAnimal(a, b))
    .map((a) => item(a, `CCS ${a.resumo!.ccs} mil/mL, limite aceitável ${parametros.ccsAlto}.`, a.resumo!.ccs!, "mil/mL", null));

  const dg = animais
    .map((animal) => ({ animal, contexto: contextoEventos(eventosPorAnimal.get(animal.id) ?? []) }))
    .filter(({ animal, contexto }) => ehDgPendente(animal.resumo?.statusReprodutivo, contexto.ultimaCobertura?.data ?? null, contexto.dgPosterior, hoje))
    .sort((a, b) => a.contexto.ultimaCobertura!.data.localeCompare(b.contexto.ultimaCobertura!.data) || compararAnimal(a.animal, b.animal))
    .map(({ animal, contexto }) => {
      const dias = diferencaDias(contexto.ultimaCobertura!.data, hoje);
      const tipo = contexto.ultimaCobertura!.tipo === "TRANSFERENCIA_EMBRIAO" ? "TE" : "IA";
      return item(animal, `${tipo} em ${contexto.ultimaCobertura!.data}, há ${dias} dias, sem DG posterior.`, dias, "dias desde cobertura", contexto.ultimaCobertura!.data);
    });

  const partos = animais
    .filter((a) => ehPartoProximo(a.resumo?.statusReprodutivo, a.resumo?.diasGestacao, parametros.gestacaoDias))
    .sort((a, b) => b.resumo!.diasGestacao! - a.resumo!.diasGestacao! || compararAnimal(a, b))
    .map((a) => {
      const restantes = Math.max(0, parametros.gestacaoDias - a.resumo!.diasGestacao!);
      return item(a, `Gestação com ${a.resumo!.diasGestacao} dias; parto esperado em ${restantes} dias.`, restantes, "dias até parto", null);
    });

  // Carência de leite: uma linha por vaca com carência ativa. É worklist de VISUALIZAÇÃO
  // ("não vender o leite" / "abrir ficha") — sem ação de registrar evento. Ordena da que
  // termina mais tarde para a mais cedo (a mais restritiva primeiro). O item é animal-cêntrico:
  // produto → motivo, fim da carência → dataReferencia, restante → valor + unidade.
  const animalPorId = new Map(animais.map((a) => [a.id, a]));
  const carenciaItens = carencias
    .filter((c) => animalPorId.has(c.animalId))
    .sort((a, b) => b.fim.localeCompare(a.fim))
    .map((c) => {
      const a = animalPorId.get(c.animalId)!;
      const emDias = c.horasRestantes >= 24;
      const restante = emDias ? c.diasRestantes : c.horasRestantes;
      const unidade = emDias ? "dias restantes" : "h restantes";
      const oQue = c.produto ? c.produto : "medicamento";
      return item(a, `Leite em carência (${oQue}) — não vender até ${c.fim.slice(0, 10)}.`, restante, unidade, c.fim);
    });

  // Produção caindo: vacas em lactação (del != null) cuja tendência é "descendo" — a materialidade
  // da queda já foi aplicada no recompute (LIMIAR_QUEDA_PCT). Visualização (sem ação de registrar):
  // o produtor abre a ficha para investigar (dieta/sanidade/cio). Ordena da maior produção para a
  // menor (quem ainda rende mais é mais urgente segurar). Valor = produção média do dia.
  const producaoCaindo = animais
    .filter((a) => a.resumo?.del != null && a.resumo?.producaoTendencia === "descendo")
    .sort((a, b) => (b.resumo?.producaoMediaDia ?? 0) - (a.resumo?.producaoMediaDia ?? 0) || compararAnimal(a, b))
    .map((a) => item(a, `Produção em queda (DEL ${a.resumo!.del}). Investigar dieta, cio ou sanidade.`, a.resumo?.producaoMediaDia ?? null, "L/dia", null));

  // Vacinas agendadas pendentes (vencidas + próximas), já resolvidas no I/O via statusVacina.
  // Ordena vencidas antes de próximas; dentro de cada grupo, pela data prevista (mais antiga antes).
  // Ação leve = marcar aplicada (tratada no client); aqui é worklist de visualização.
  const rankStatus = (s: "vencida" | "proxima") => (s === "vencida" ? 0 : 1);
  const vacinaItens = vacinasPendentes
    .filter((v) => animalPorId.has(v.animalId))
    .slice()
    .sort((a, b) => rankStatus(a.status) - rankStatus(b.status) || a.dataPrevista.localeCompare(b.dataPrevista))
    .map((v) => {
      const a = animalPorId.get(v.animalId)!;
      const motivo = v.status === "vencida"
        ? `Vacina ${v.vacina} vencida (prevista ${v.dataPrevista}, ${Math.abs(v.diasParaData)} dias de atraso).`
        : `Vacina ${v.vacina} prevista para ${v.dataPrevista} (em ${v.diasParaData} dias).`;
      return item(a, motivo, v.diasParaData, "dias", v.dataPrevista);
    });

  const montar = (base: Omit<WorklistRebanhoDTO, "quantidade" | "itens">, itens: WorklistRebanhoDTO["itens"]): WorklistRebanhoDTO => ({ ...base, quantidade: itens.length, itens });
  return [
    montar({ chave: "secagem-atrasada", titulo: "Secagens atrasadas", explicacao: "Vacas prenhes cuja previsão de secagem já venceu.", severidade: "alta", tab: "reproducao", acao: { tipo: "SECAGEM", rotulo: "Registrar secagem" } }, secagem),
    montar({ chave: "vazia-pos-pev", titulo: "Vazias após o PEV", explicacao: `Vacas vazias com DEL acima do PEV configurado (${parametros.pevDias} dias).`, severidade: "alta", tab: "reproducao", acao: { tipo: "INSEMINACAO", rotulo: "Registrar inseminação" } }, vazias),
    montar({ chave: "ccs-alta", titulo: "CCS alta", explicacao: `Animais com CCS ≥ ${parametros.ccsAlto} mil/mL.`, severidade: "alta", tab: "sanidade", acao: { tipo: "EXAME", rotulo: "Registrar exame" } }, ccsAlta),
    montar({ chave: "dg-pendente", titulo: "Diagnóstico pendente", explicacao: `Fêmeas com cobertura há pelo menos ${ESPERA_DG_DIAS} dias e sem DG posterior.`, severidade: "media", tab: "reproducao", acao: { tipo: "DIAGNOSTICO", rotulo: "Registrar DG" } }, dg),
    montar({ chave: "parto-proximo", titulo: "Partos previstos em até 30 dias", explicacao: "Vacas prenhes no último mês esperado de gestação.", severidade: "baixa", tab: "reproducao", acao: { tipo: "PARTO", rotulo: "Registrar parto" } }, partos),
    montar({ chave: "carencia", titulo: "Leite em carência", explicacao: "Vacas cujo leite não deve ser vendido enquanto durar a carência do medicamento.", severidade: "alta", tab: "sanidade" }, carenciaItens),
    montar({ chave: "producao-caindo", titulo: "Produção em queda", explicacao: `Vacas em lactação com queda de produção acima de ${LIMIAR_QUEDA_PCT}% entre os controles recentes.`, severidade: "media", tab: "producao" }, producaoCaindo),
    montar({ chave: "vacina-pendente", titulo: "Vacinas pendentes", explicacao: "Vacinas agendadas vencidas ou a vencer nos próximos dias.", severidade: "media", tab: "sanidade" }, vacinaItens),
  ];
}

export function obterWorklist(worklists: WorklistRebanhoDTO[], chave: ChaveWorklistRebanho): WorklistRebanhoDTO {
  return worklists.find((worklist) => worklist.chave === chave)!;
}
