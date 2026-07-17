import { calcularTaxaConcepcao } from "./reproducao.concepcao.js";
import {
  ehCcsAlto,
  ehDgPendente,
  ehElegivelPrenhez,
  ehPartoProximo,
  ehSecagemAtrasada,
  ehVaziaAtrasada,
} from "./regras-manejo.js";
import type {
  AnimalDashboardIn,
  DashboardDTO,
  DashboardRebanhoInput,
  HeroDTO,
  IndicadorDashboardDTO,
  PeriodoDashboard,
  ProducaoLoteDashboardIn,
  SerieDiariaDTO,
} from "./dashboard.types.js";

export type {
  AnimalDashboardIn,
  DashboardDTO,
  DashboardRebanhoInput,
  PeriodoDashboard,
} from "./dashboard.types.js";

const round1 = (n: number) => Math.round(n * 10) / 10;
const media = (xs: number[]): number | null => xs.length ? round1(xs.reduce((s, n) => s + n, 0) / xs.length) : null;

function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasEntre(inicio: string, fim: string): string[] {
  const out: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) out.push(d);
  return out;
}

function tamanhoPeriodo(periodo: PeriodoDashboard): number {
  return periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
}

function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual == null || anterior == null || anterior === 0) return null;
  return round1(((atual - anterior) / Math.abs(anterior)) * 100);
}

function snapshotLactacao(input: DashboardRebanhoInput, data: string): number {
  const ativos = new Set(input.animais.map((a) => a.id));
  const ids = new Set(
    input.lactacoes
      .filter((l) => ativos.has(l.animalId) && l.dtInicio <= data && (l.dtFim == null || l.dtFim >= data))
      .map((l) => l.animalId),
  );
  return ids.size;
}

function producaoOrdenhaPorDia(input: DashboardRebanhoInput): Map<string, { total: number; vacas: number }> {
  const ultimo = new Map<string, (typeof input.controles)[number]>();
  for (const c of input.controles) {
    const chave = `${c.animalId}:${c.data}`;
    const anterior = ultimo.get(chave);
    if (!anterior || anterior.atualizadoEm < c.atualizadoEm || (anterior.atualizadoEm === c.atualizadoEm && anterior.id < c.id)) ultimo.set(chave, c);
  }
  const porDia = new Map<string, { total: number; animais: Set<number> }>();
  for (const c of ultimo.values()) {
    const dia = porDia.get(c.data) ?? { total: 0, animais: new Set<number>() };
    dia.total += c.pesoTotal;
    dia.animais.add(c.animalId);
    porDia.set(c.data, dia);
  }
  return new Map([...porDia].map(([data, x]) => [data, { total: round1(x.total), vacas: x.animais.size }]));
}

function escolherProducoesLote(registros: ProducaoLoteDashboardIn[], scoped: boolean): Map<string, number> {
  const ultimo = new Map<string, ProducaoLoteDashboardIn>();
  for (const p of registros) {
    const chave = `${p.data}:${p.grupoId ?? "global"}`;
    const anterior = ultimo.get(chave);
    if (!anterior || anterior.atualizadoEm < p.atualizadoEm || (anterior.atualizadoEm === p.atualizadoEm && anterior.id < p.id)) ultimo.set(chave, p);
  }
  const porDia = new Map<string, ProducaoLoteDashboardIn[]>();
  for (const p of ultimo.values()) (porDia.get(p.data) ?? porDia.set(p.data, []).get(p.data)!).push(p);
  const out = new Map<string, number>();
  for (const [data, ps] of porDia) {
    const global = ps.find((p) => p.grupoId == null);
    if (!scoped && global) out.set(data, round1(global.litros));
    else {
      const grupos = ps.filter((p) => p.grupoId != null);
      if (grupos.length) out.set(data, round1(grupos.reduce((s, p) => s + p.litros, 0)));
    }
  }
  return out;
}

function indicador(chave: string, titulo: string, valor: number | null, unidade: string, amostra: number, motivo: string): IndicadorDashboardDTO {
  return { chave, titulo, valor, unidade, amostra, indisponivelMotivo: valor == null ? motivo : null };
}

function hero(chave: HeroDTO["chave"], titulo: string, unidade: string, atual: number | null, anterior: number | null, serie: SerieDiariaDTO[], motivo: string | null): HeroDTO {
  return { chave, titulo, valor: atual, unidade, valorAnterior: anterior, variacaoPct: variacao(atual, anterior), indisponivelMotivo: atual == null ? motivo : null, serie };
}

export function agregarDashboard(input: DashboardRebanhoInput): DashboardDTO {
  const nDias = tamanhoPeriodo(input.periodo);
  const inicio = somarDias(input.hoje, -(nDias - 1));
  const comparacaoFim = somarDias(inicio, -1);
  const comparacaoInicio = somarDias(comparacaoFim, -(nDias - 1));
  const diasAtuais = diasEntre(inicio, input.hoje);
  const diasAnteriores = diasEntre(comparacaoInicio, comparacaoFim);
  const diasSerie = input.periodo === "hoje" ? diasEntre(somarDias(input.hoje, -6), input.hoje) : diasAtuais;
  const vacasAtivas = input.animais.filter((a) => a.categoria === "VACA");

  const temHistoricoLactacao = input.lactacoes.length > 0;
  const lactacaoDia = (dias: string[]) => dias.map((data) => ({ data, valor: temHistoricoLactacao ? snapshotLactacao(input, data) : null }));
  const lactAtualSerie = lactacaoDia(diasSerie);
  const lactAtual = media(lactacaoDia(diasAtuais).map((x) => x.valor).filter((x): x is number => x != null));
  const lactAnterior = media(lactacaoDia(diasAnteriores).map((x) => x.valor).filter((x): x is number => x != null));

  const scoped = input.escopoPropriedadeId != null;
  const ordenha = producaoOrdenhaPorDia(input);
  const lote = escolherProducoesLote(input.producoesLote, scoped);
  const producaoDia = new Map<string, { total: number; vacas: number | null }>();
  if (input.modoProducao === "TANQUE_LOTE") {
    for (const [data, total] of lote) producaoDia.set(data, { total, vacas: snapshotLactacao(input, data) || null });
  } else {
    for (const [data, x] of ordenha) producaoDia.set(data, x);
  }
  const totalNoPeriodo = (dias: string[]) => dias.map((d) => producaoDia.get(d)?.total).filter((x): x is number => x != null);
  const mediaVacaNoPeriodo = (dias: string[]) => dias
    .map((d) => {
      const p = producaoDia.get(d);
      return p && p.vacas ? p.total / p.vacas : null;
    })
    .filter((x): x is number => x != null);
  const totalAtual = media(totalNoPeriodo(diasAtuais));
  const totalAnterior = media(totalNoPeriodo(diasAnteriores));
  const mediaVacaAtual = media(mediaVacaNoPeriodo(diasAtuais));
  const mediaVacaAnterior = media(mediaVacaNoPeriodo(diasAnteriores));
  const serieTotal = diasSerie.map((data) => ({ data, valor: producaoDia.get(data)?.total ?? null }));
  const serieMediaVaca = diasSerie.map((data) => {
    const p = producaoDia.get(data);
    return { data, valor: p && p.vacas ? round1(p.total / p.vacas) : null };
  });

  const globaisNoIntervalo = input.producoesLote.some((p) => p.grupoId == null && p.data >= comparacaoInicio && p.data <= input.hoje);
  const producaoParcial = input.modoProducao === "TANQUE_LOTE" && scoped && globaisNoIntervalo;
  const motivoProducao = producaoParcial
    ? "Tanque global não pode ser atribuído a uma propriedade; somente lotes vinculados foram considerados."
    : "Sem produção observada no período.";
  const diasComProducao = diasAtuais.filter((d) => producaoDia.has(d)).length;
  const pctLactAtual = vacasAtivas.length && lactAtual != null ? round1((lactAtual / vacasAtivas.length) * 100) : null;
  const pctLactAnterior = vacasAtivas.length && lactAnterior != null ? round1((lactAnterior / vacasAtivas.length) * 100) : null;

  const herois: HeroDTO[] = [
    hero("vacasLactacao", "Vacas em lactação", "vacas", lactAtual, lactAnterior, lactAtualSerie, input.lactacoes.length ? null : "Sem histórico de lactações."),
    hero("mediaVacaDia", "Média por vaca/dia", "L/vaca/dia", mediaVacaAtual, mediaVacaAnterior, serieMediaVaca, motivoProducao),
    hero("producaoTotalDia", "Produção média total/dia", "L/dia", totalAtual, totalAnterior, serieTotal, motivoProducao),
    hero("pctVacasLactacao", "Vacas ativas em lactação", "%", pctLactAtual, pctLactAnterior, lactAtualSerie.map((x) => ({ data: x.data, valor: vacasAtivas.length && x.valor != null ? round1((x.valor / vacasAtivas.length) * 100) : null })), !vacasAtivas.length ? "Sem vacas ativas." : !temHistoricoLactacao ? "Sem histórico de lactações." : null),
  ];

  const estados = ["PEV", "VAZIA", "INSEMINADA", "PRENHE"] as const;
  const elegiveis = input.animais.filter((a) => ehElegivelPrenhez(a.resumo?.statusReprodutivo)).length;
  const estadosReprodutivos = estados.map((estado) => {
    const quantidade = input.animais.filter((a) => a.resumo?.statusReprodutivo === estado).length;
    return { estado, quantidade, percentual: elegiveis ? round1((quantidade / elegiveis) * 100) : null };
  });
  const gestantes = estadosReprodutivos.find((x) => x.estado === "PRENHE")!.quantidade;
  const prenhez = elegiveis ? round1((gestantes / elegiveis) * 100) : null;
  const ccs = input.animais.map((a) => a.resumo?.ccs).filter((x): x is number => x != null);
  const ieps = input.animais.map((a) => a.resumo?.iepProjetado).filter((x): x is number => x != null);
  const taxas = calcularTaxaConcepcao(input.eventosConcepcao);
  const coberturas = taxas.reduce((s, x) => s + x.coberturas, 0);
  const prenhesConcepcao = taxas.reduce((s, x) => s + x.prenhes, 0);
  const taxaConcepcao = coberturas ? round1((prenhesConcepcao / coberturas) * 100) : null;
  const secas = vacasAtivas.filter((a) => !input.lactacoes.some((l) => l.animalId === a.id && l.dtInicio <= input.hoje && (l.dtFim == null || l.dtFim >= input.hoje))).length;

  const indicadores = [
    { grupo: "producao" as const, titulo: "Produção", itens: [
      indicador("mediaVacaDia", "Média por vaca ordenhada", mediaVacaAtual, "L/vaca/dia", mediaVacaNoPeriodo(diasAtuais).length, motivoProducao),
      indicador("ccsMedia", "CCS média", media(ccs), "mil/mL", ccs.length, "Sem controles de CCS."),
      indicador("diasLactacao", "Vacas em lactação", lactAtual, "vacas", input.lactacoes.length, "Sem histórico de lactações."),
    ] },
    { grupo: "reproducao" as const, titulo: "Reprodução", itens: [
      indicador("prenhez", "Prenhez das elegíveis", prenhez, "%", elegiveis, "Sem fêmeas reprodutivamente elegíveis."),
      indicador("taxaConcepcao", "Taxa de concepção", taxaConcepcao, "%", coberturas, "Sem coberturas com base suficiente."),
      indicador("iep", "IEP projetado médio", media(ieps), "dias", ieps.length, "Sem IEP projetado calculado."),
    ] },
    { grupo: "rebanho" as const, titulo: "Rebanho", itens: [
      indicador("ativos", "Animais ativos", input.animais.length, "animais", input.animais.length, ""),
      indicador("vacas", "Vacas ativas", vacasAtivas.length, "vacas", vacasAtivas.length, ""),
      indicador("secas", "Vacas secas", secas, "vacas", vacasAtivas.length, "Sem vacas ativas."),
    ] },
  ];

  const { pevDias, gestacaoDias, ccsAlto } = input.parametros;
  const conta = (fn: (a: AnimalDashboardIn) => boolean) => input.animais.filter(fn).length;
  const alertas: DashboardDTO["alertas"] = [
    { chave: "secagem-atrasada", titulo: "Secagens atrasadas", quantidade: conta((a) => ehSecagemAtrasada(a.resumo?.statusReprodutivo, a.resumo?.previsaoSecagem, input.hoje)), explicacao: "Vacas prenhes cuja previsão de secagem já venceu.", severidade: "alta", tab: "reproducao" },
    { chave: "vazia-pos-pev", titulo: "Vazias após o PEV", quantidade: conta((a) => ehVaziaAtrasada(a.resumo?.statusReprodutivo, a.resumo?.del, pevDias)), explicacao: `Vacas vazias com DEL acima do PEV configurado (${pevDias} dias).`, severidade: "alta", tab: "reproducao" },
    { chave: "ccs-alta", titulo: "CCS alta", quantidade: conta((a) => ehCcsAlto(a.resumo?.ccs, ccsAlto)), explicacao: `Animais com CCS ≥ ${ccsAlto} mil/mL.`, severidade: "alta", tab: "sanidade" },
    { chave: "dg-pendente", titulo: "Diagnóstico pendente", quantidade: conta((a) => ehDgPendente(a.resumo?.statusReprodutivo, a.resumo?.ultimoDgData)), explicacao: "Fêmeas inseminadas sem diagnóstico registrado.", severidade: "media", tab: "reproducao" },
    { chave: "parto-proximo", titulo: "Partos previstos em até 30 dias", quantidade: conta((a) => ehPartoProximo(a.resumo?.statusReprodutivo, a.resumo?.diasGestacao, gestacaoDias)), explicacao: "Vacas prenhes no último mês esperado de gestação.", severidade: "baixa", tab: "reproducao" },
  ];

  const gruposMap = new Map<number | null, { nome: string; quantidade: number }>();
  for (const a of input.animais) {
    const atual = gruposMap.get(a.grupoId) ?? { nome: a.grupoNome ?? "Sem grupo", quantidade: 0 };
    atual.quantidade++;
    gruposMap.set(a.grupoId, atual);
  }
  const grupos = [...gruposMap].map(([id, g]) => ({ id, nome: g.nome, quantidade: g.quantidade, percentual: input.animais.length ? round1((g.quantidade / input.animais.length) * 100) : null }))
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));

  const semResumo = input.animais.filter((a) => a.resumo == null).length;
  const semGrupo = input.animais.filter((a) => a.grupoId == null).length;
  const qualidadeDados = [
    { chave: "sem-resumo", titulo: "Animais sem resumo zootécnico", quantidade: semResumo, explicacao: "Não entram nos indicadores que dependem de resumo." },
    { chave: "sem-grupo", titulo: "Animais sem grupo", quantidade: semGrupo, explicacao: "Aparecem na composição como “Sem grupo”." },
    { chave: "dias-sem-producao", titulo: "Dias sem produção observada", quantidade: nDias - diasComProducao, explicacao: "Dias sem registro permanecem como lacunas, não zero." },
  ];

  const datas = [
    ...input.controles.map((x) => x.data),
    ...input.producoesLote.map((x) => x.data),
    ...input.lactacoes.map((x) => x.dtFim ?? x.dtInicio),
  ].filter((x) => x <= input.hoje).sort();

  return {
    meta: {
      periodo: input.periodo, inicio, fim: input.hoje, comparacaoInicio, comparacaoFim,
      geradoEm: input.geradoEm, dadoMaisRecente: datas.at(-1) ?? null,
      cobertura: { diasEsperados: nDias, diasComProducao, percentual: round1((diasComProducao / nDias) * 100), producaoParcial, motivo: producaoParcial ? motivoProducao : null },
      escopo: { propriedadeId: input.escopoPropriedadeId, consolidado: input.escopoPropriedadeId == null },
    },
    totais: { rebanhoAtivo: input.animais.length, vacasAtivas: vacasAtivas.length },
    herois, estadosReprodutivos, indicadores, alertas, grupos, qualidadeDados,
  };
}
