import type {
  AnimalDashboardIn,
  ChaveWorklistRebanho,
  EventoConcepcaoDashboardIn,
  ParametrosDashboard,
  WorklistRebanhoDTO,
} from "./dashboard.types.js";

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

  const montar = (base: Omit<WorklistRebanhoDTO, "quantidade" | "itens">, itens: WorklistRebanhoDTO["itens"]): WorklistRebanhoDTO => ({ ...base, quantidade: itens.length, itens });
  return [
    montar({ chave: "secagem-atrasada", titulo: "Secagens atrasadas", explicacao: "Vacas prenhes cuja previsão de secagem já venceu.", severidade: "alta", tab: "reproducao", acao: { tipo: "SECAGEM", rotulo: "Registrar secagem" } }, secagem),
    montar({ chave: "vazia-pos-pev", titulo: "Vazias após o PEV", explicacao: `Vacas vazias com DEL acima do PEV configurado (${parametros.pevDias} dias).`, severidade: "alta", tab: "reproducao", acao: { tipo: "INSEMINACAO", rotulo: "Registrar inseminação" } }, vazias),
    montar({ chave: "ccs-alta", titulo: "CCS alta", explicacao: `Animais com CCS ≥ ${parametros.ccsAlto} mil/mL.`, severidade: "alta", tab: "sanidade", acao: { tipo: "EXAME", rotulo: "Registrar exame" } }, ccsAlta),
    montar({ chave: "dg-pendente", titulo: "Diagnóstico pendente", explicacao: `Fêmeas com cobertura há pelo menos ${ESPERA_DG_DIAS} dias e sem DG posterior.`, severidade: "media", tab: "reproducao", acao: { tipo: "DIAGNOSTICO", rotulo: "Registrar DG" } }, dg),
    montar({ chave: "parto-proximo", titulo: "Partos previstos em até 30 dias", explicacao: "Vacas prenhes no último mês esperado de gestação.", severidade: "baixa", tab: "reproducao", acao: { tipo: "PARTO", rotulo: "Registrar parto" } }, partos),
  ];
}

export function obterWorklist(worklists: WorklistRebanhoDTO[], chave: ChaveWorklistRebanho): WorklistRebanhoDTO {
  return worklists.find((worklist) => worklist.chave === chave)!;
}
