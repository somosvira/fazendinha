import { dataCalendarioContexto, diasCalendarioContexto } from "./contexto-animal.calc.js";
import { calcularElegibilidadesDoConjunto, type DadosElegibilidade, type ElegibilidadeNaData } from "./elegibilidade.calc.js";
import { resolverPapelReprodutivo } from "../rebanho/papel-reprodutivo.calc.js";
import type { ConsultaIndicadoresInput } from "./indicadores.schemas.js";

export const VERSAO_METODOLOGIA_INDICADORES = "FAZENDINHA_IDEAGRI_IILB_V1";
export const FONTES_METODOLOGIA_INDICADORES = [
  "https://www.ideagri.com.br/siteideagridados/New/dicas/2028/PRENHEZ_DICA_2028.pdf",
  "https://centralderecursos.ideagri.com.br/posts/conheca-a-listagem-para-conferencia-e-ajuste-de-dados-da-taxa-de-prenhez",
  "https://centralderecursos.ideagri.com.br/posts/taxa-de-prenhez-emita-o-relatorio-considerando-saidas-proporcionais-do-pev-em-cada-intervalo",
  "https://centralderecursos.ideagri.com.br/posts/saiba-como-avaliar-a-taxa-de-prenhez-por-intervalos-ou-periodos-acumulados",
] as const;

export type EvidenciaResultadoIndicador = {
  id: string; animalId: string; tentativaId: string | null; gestacaoId: string | null;
  data: Date; resultado: string; status: string; fonte: "EXAME_INTERPRETADO";
};
export type DadosIndicadores = {
  elegibilidade: DadosElegibilidade;
  identificacoes: Array<{ id: string; brinco: string | null; nome: string | null }>;
  evidencias: EvidenciaResultadoIndicador[];
};
export type ResultadoTentativaIndicador = "POSITIVA" | "NEGATIVA" | "PENDENTE" | "NAO_CLASSIFICAVEL";
export type TentativaDetalheIndicador = {
  id: string; animalId: string; tipo: string; dataFactual: string; dataAnalitica: string;
  resultado: ResultadoTentativaIndicador; resultadoEm: string | null;
  evidencias: Array<{ id: string; tipo: "GESTACAO" | "EXAME_INTERPRETADO"; data: string }>;
  motivos: string[];
};
export type ContagensIndicadores = {
  vaziasAptasInicio: number; negativasAnteriores: number; anterioresSemDiagnostico: number;
  estimativaVaziasAnteriores: number | null; saidasPev: number; contribuicaoPev: number;
  elegiveisConhecidas: number; elegiveis: number | null; matrizesServidas: number;
  tentativas: number; positivas: number; negativas: number; abertas: number; naoClassificaveis: number;
  denominadorConcepcao: number; animaisComPendenciaElegibilidade: number;
};
export type TaxasIndicadores = { servico: number | null; concepcao: number | null; prenhez: number | null };
export type DetalheAnimalIndicador = {
  animalId: string; brinco: string | null; nome: string | null;
  origemElegibilidade: "VAZIA_APTA" | "NEGATIVA_ANTERIOR" | "SEM_DIAGNOSTICO_ANTERIOR" | "SAIDA_PEV" | "EXCLUIDA" | "PENDENTE";
  contribuicaoElegiveis: number | null; servida: boolean; motivos: string[];
  elegibilidadeInicio: ElegibilidadeNaData; elegibilidadeLiberacao: ElegibilidadeNaData | null;
  tentativaAnterior: TentativaDetalheIndicador | null; tentativas: TentativaDetalheIndicador[];
};
export type PeriodoIndicadores = {
  id: string; inicio: string; fim: string; contagens: ContagensIndicadores; taxas: TaxasIndicadores;
  pendencias: string[]; maturidade: { corte: string; diasAposFim: number; tentativasAbertas: number };
  detalhamento: DetalheAnimalIndicador[];
};
export type SnapshotIndicadoresReprodutivos = {
  versao: 1 | 2; acompanhamento?:ReturnType<typeof import("./acompanhamento-indicadores.js").calcularAcompanhamentoDoConjunto>; versaoMetodologia: typeof VERSAO_METODOLOGIA_INDICADORES;
  metodologia: { rotulo: string; fontes: string[]; regras: string[]; deslocamentoTeDias: number; concepcaoEstimada: number | null };
  filtros: ConsultaIndicadoresInput;
  politicas: DadosElegibilidade["politicas"];
  sobraInicial: { inicio: string; fim: string; dias: number } | null;
  periodos: PeriodoIndicadores[];
  totais: { contagens: ContagensIndicadores; taxas: TaxasIndicadores; participacoesAnimalPeriodo: number; animaisUnicos: number };
  pendencias: string[];
};

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const texto = (d: Date) => dataCalendarioContexto(d).toISOString().slice(0, 10);
const somar = (d: Date, n: number) => new Date(dataCalendarioContexto(d).getTime() + n * 86_400_000);
const entre = (d: Date, inicio: Date, fim: Date) => d >= inicio && d <= fim;
const tiposClassificaveis: readonly string[] = ["IA", "TE", "COBERTURA"];
const unicos = (valores: string[]) => [...new Set(valores)].sort();

/** Janelas inclusivas de 21 dias ancoradas no fim; sobra inicial incompleta é informada e descartada. */
export function periodosIndicadores(inicio: string, fim: string) {
  const primeiro = dia(inicio), ultimo = dia(fim);
  const periodos: Array<{ id: string; inicio: string; fim: string }> = [];
  let cursor = ultimo;
  while (diasCalendarioContexto(primeiro, cursor) >= 20) {
    const de = somar(cursor, -20);
    periodos.unshift({ id: texto(de), inicio: texto(de), fim: texto(cursor) });
    cursor = somar(de, -1);
  }
  return { periodos, sobraInicial: cursor >= primeiro ? { inicio, fim: texto(cursor), dias: diasCalendarioContexto(primeiro, cursor) + 1 } : null };
}

export function calcularTaxasIndicadores(c: Pick<ContagensIndicadores, "elegiveis" | "matrizesServidas" | "tentativas" | "abertas" | "positivas">): TaxasIndicadores {
  const servico = c.elegiveis !== null && c.elegiveis > 0 ? 100 * c.matrizesServidas / c.elegiveis : null;
  const concepcao = c.tentativas - c.abertas > 0 ? 100 * c.positivas / (c.tentativas - c.abertas) : null;
  return { servico, concepcao, prenhez: servico !== null && concepcao !== null ? servico * concepcao / 100 : null };
}
const contagensVazias = (): ContagensIndicadores => ({ vaziasAptasInicio: 0, negativasAnteriores: 0, anterioresSemDiagnostico: 0,
  estimativaVaziasAnteriores: 0, saidasPev: 0, contribuicaoPev: 0, elegiveisConhecidas: 0, elegiveis: 0,
  matrizesServidas: 0, tentativas: 0, positivas: 0, negativas: 0, abertas: 0, naoClassificaveis: 0,
  denominadorConcepcao: 0, animaisComPendenciaElegibilidade: 0 });

/** Resultados são ligados por ID, nunca por proximidade de datas ou pela última tentativa. */
export function classificarTentativaIndicador(t: DadosElegibilidade["tentativas"][number], dados: DadosIndicadores, corte: Date, deslocamentoTeDias: number): TentativaDetalheIndicador {
  const base: TentativaDetalheIndicador = { id: t.id, animalId: t.animalId, tipo: t.tipo, dataFactual: texto(t.data),
    dataAnalitica: texto(t.tipo === "TE" ? somar(t.data, -deslocamentoTeDias) : t.data), resultado: "PENDENTE", resultadoEm: null, evidencias: [], motivos: [] };
  if (!tiposClassificaveis.includes(t.tipo)) return { ...base, resultado: "NAO_CLASSIFICAVEL", motivos: ["TIPO_OU_DATA_EXATA_NAO_CLASSIFICAVEL"] };
  const gestacoes = dados.elegibilidade.gestacoes.filter(g => g.status === "VALIDO" && g.animalId === t.animalId && g.tentativaId === t.id && g.confirmadaEm <= corte);
  const negativas = dados.evidencias.filter(e => e.status === "VALIDO" && e.animalId === t.animalId && e.tentativaId === t.id && e.resultado === "NEGATIVO" && e.data <= corte);
  const anteriores = gestacoes.some(g => g.confirmadaEm < t.data) || negativas.some(e => e.data < t.data);
  if (anteriores) base.motivos.push("RESULTADO_ANTERIOR_A_TENTATIVA");
  const positivasValidas = gestacoes.filter(g => g.confirmadaEm >= t.data).sort((a, b) => a.confirmadaEm.getTime() - b.confirmadaEm.getTime() || a.id.localeCompare(b.id));
  const negativasValidas = negativas.filter(e => e.data >= t.data).sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
  base.evidencias = [...positivasValidas.map(g => ({ id: g.id, tipo: "GESTACAO" as const, data: texto(g.confirmadaEm) })),
    ...negativasValidas.map(e => ({ id: e.id, tipo: "EXAME_INTERPRETADO" as const, data: texto(e.data) }))];
  // A perda/reconfirmação posterior conserva o sucesso daquela concepção.
  if (positivasValidas.length) return { ...base, resultado: "POSITIVA", resultadoEm: texto(positivasValidas[0].confirmadaEm) };
  if (negativasValidas.length) return { ...base, resultado: "NEGATIVA", resultadoEm: texto(negativasValidas[0].data) };
  return { ...base, motivos: [...base.motivos, "DIAGNOSTICO_PENDENTE"] };
}

/** Cálculo puro do relatório; todas as datas compartilham o mesmo conjunto de fatos carregado. */
export function calcularIndicadoresReprodutivos(dados: DadosIndicadores, filtros: ConsultaIndicadoresInput): SnapshotIndicadoresReprodutivos {
  const janela = periodosIndicadores(filtros.inicio, filtros.fim), corte = dia(filtros.corte), base = dados.elegibilidade;
  const cache = new Map<string, Map<string, ElegibilidadeNaData>>();
  const elegibilidades = (data: Date) => {
    const chave = texto(data);
    let valores = cache.get(chave);
    if (!valores) { valores = calcularElegibilidadesDoConjunto(base, filtros.propriedadeId, data); cache.set(chave, valores); }
    return valores;
  };
  const identidade = new Map(dados.identificacoes.map(a => [a.id, a]));
  const tentativas = base.tentativas.filter(t => t.status === "VALIDO" && t.data <= corte);
  const resultados = new Map(tentativas.map(t => [t.id, classificarTentativaIndicador(t, dados, corte, filtros.deslocamentoTeDias)]));
  const localNaData = (id: string, data: Date) => base.localizacoes.filter(l => l.animalId === id && l.desde <= data && (!l.ate || l.ate > data));
  const filtroNaData = (id: string, data: Date): { incluido: boolean; pendencias: string[] } => {
    if (base.animais.find(a => a.id === id)!.dataEntrada > data) return { incluido: false, pendencias: [] };
    const locais = localNaData(id, data);
    if (!locais.length) return { incluido: false, pendencias: ["LOCALIZACAO_DESCONHECIDA_NO_FILTRO"] };
    if (locais.length !== 1) return { incluido: false, pendencias: locais.some(l => l.propriedadeId === filtros.propriedadeId) ? ["LOCALIZACAO_CONFLITANTE_NO_FILTRO"] : [] };
    if (locais[0].propriedadeId !== filtros.propriedadeId || (filtros.loteId && locais[0].loteId !== filtros.loteId)) return { incluido: false, pendencias: [] };
    if (filtros.papeis) {
      const papel = resolverPapelReprodutivo(base.papeis.filter(p => p.animalId === id), data);
      if (!papel.papel) return { incluido: false, pendencias: ["PAPEL_DESCONHECIDO_NO_FILTRO"] };
      if (!filtros.papeis.includes(papel.papel)) return { incluido: false, pendencias: [] };
    }
    return { incluido: true, pendencias: [] };
  };
  const periodos = janela.periodos.map(janelaPeriodo => {
    const inicio = dia(janelaPeriodo.inicio), fim = dia(janelaPeriodo.fim), noInicio = elegibilidades(inicio);
    const contagens = contagensVazias(), pendencias: string[] = [], detalhamento: DetalheAnimalIndicador[] = [];
    for (const animal of base.animais) {
      if (animal.sexo !== "F") continue;
      const e = noInicio.get(animal.id)!;
      const filtroInicio = filtroNaData(animal.id, inicio);
      const baixada = base.baixas.some(b => b.animalId === animal.id && !b.estornadaEm && b.data <= fim);
      const tentativasAnimal = tentativas.filter(t => t.animalId === animal.id);
      const tentativasNoPeriodo = tentativasAnimal.filter(t => {
        const r = resultados.get(t.id)!;
        return entre(dia(r.dataAnalitica), inicio, fim) && (!filtros.tiposTentativa || filtros.tiposTentativa.some(tipo => tipo === t.tipo));
      });
      const tentativasIncluidas: TentativaDetalheIndicador[] = [];
      const motivos = [...filtroInicio.pendencias];
      if (base.gestacoes.some(g => g.animalId === animal.id && g.status === "VALIDO" && !g.tentativaId && g.confirmadaEm <= corte
        && (!g.encerradaEm || g.encerradaEm >= inicio))) motivos.push("GESTACAO_SEM_TENTATIVA_COMPROVADA");
      for (const t of tentativasNoPeriodo) {
        const filtroTentativa = filtroNaData(animal.id, t.data);
        motivos.push(...filtroTentativa.pendencias);
        if (!baixada && filtroTentativa.incluido) {
          const r = resultados.get(t.id)!;
          // O sítio factual desconhecido/conflitante nunca é atribuído pelo cadastro atual.
          if (t.propriedadeId !== filtros.propriedadeId) motivos.push("SITIO_DA_TENTATIVA_DIVERGENTE");
          else tentativasIncluidas.push(r);
        }
      }
      const anterior = tentativasAnimal.filter(t => dia(resultados.get(t.id)!.dataAnalitica) < inicio && (!e.ciclo || texto(t.data) > e.ciclo.inicioCiclo))
        .sort((a, b) => b.data.getTime() - a.data.getTime() || b.criadoEm.getTime() - a.criadoEm.getTime() || b.id.localeCompare(a.id))[0];
      const tentativaAnterior = anterior ? resultados.get(anterior.id)! : null;
      const identificacao = identidade.get(animal.id);
      const detalhe: DetalheAnimalIndicador = { animalId: animal.id, brinco: identificacao?.brinco ?? null, nome: identificacao?.nome ?? null,
        origemElegibilidade: "EXCLUIDA", contribuicaoElegiveis: 0, servida: tentativasIncluidas.some(t => t.resultado !== "NAO_CLASSIFICAVEL"),
        motivos, elegibilidadeInicio: e, elegibilidadeLiberacao: null, tentativaAnterior, tentativas: tentativasIncluidas };
      if (baixada) motivos.push("BAIXA_EXCLUI_TODO_PERIODO");
      else if (filtroInicio.incluido) {
        // A exclusão comprovada independe de conhecer a política de liberação do ciclo.
        const gestacaoConfirmada = e.motivos.includes("GESTACAO_CONFIRMADA") || base.gestacoes.some(g => g.animalId === animal.id
          && g.status === "VALIDO" && g.confirmadaEm <= inicio && (!g.encerradaEm || g.encerradaEm > inicio));
        if (gestacaoConfirmada) motivos.push(...e.motivos, "GESTACAO_CONFIRMADA_NO_INICIO");
        else if (e.baseElegivel) {
          const anteriorEncerrada = anterior && base.gestacoes.some(g => g.tentativaId === anterior.id && g.status === "VALIDO" && g.encerradaEm && g.encerradaEm <= inicio);
          if (tentativaAnterior && !anteriorEncerrada) {
            if (tentativaAnterior.resultado === "NEGATIVA") { detalhe.origemElegibilidade = "NEGATIVA_ANTERIOR"; detalhe.contribuicaoElegiveis = 1; contagens.negativasAnteriores++; }
            else if (tentativaAnterior.resultado === "PENDENTE") {
              detalhe.origemElegibilidade = "SEM_DIAGNOSTICO_ANTERIOR"; contagens.anterioresSemDiagnostico++;
              detalhe.contribuicaoElegiveis = filtros.concepcaoEstimada === undefined ? null : 1 - filtros.concepcaoEstimada / 100;
              motivos.push(filtros.concepcaoEstimada === undefined ? "CONCEPCAO_ESTIMADA_NAO_INFORMADA" : "ESTIMATIVA_EXPLICITA_DE_VAZIAS");
            } else if (tentativaAnterior.resultado === "NAO_CLASSIFICAVEL") { detalhe.origemElegibilidade = "PENDENTE"; detalhe.contribuicaoElegiveis = null; motivos.push("TENTATIVA_ANTERIOR_NAO_CLASSIFICAVEL"); }
            else motivos.push("CONCEPCAO_ANTERIOR_COMPROVADA_NO_CORTE");
          } else if (e.elegivel === true) { detalhe.origemElegibilidade = "VAZIA_APTA"; detalhe.contribuicaoElegiveis = 1; contagens.vaziasAptasInicio++; }
          else if (e.elegivel === null) { detalhe.origemElegibilidade = "PENDENTE"; detalhe.contribuicaoElegiveis = null; motivos.push(...e.motivos); }
          else motivos.push(...e.motivos);
        } else {
          // A data pode vir do PEV previsto no início ou de uma decisão tomada durante a janela.
          const datasLiberacao = unicos([
            ...(e.aptaDesde && e.motivos.includes("EM_ESPERA_PARA_LIBERACAO") ? [e.aptaDesde] : []),
            ...base.decisoes.filter(d => d.vinculoCicloId === e.vinculoCicloId && d.status === "VALIDO"
              && d.tipo === "LIBERAR" && d.aptaDesde && d.data <= d.aptaDesde && d.data <= corte)
              .map(d => texto(d.aptaDesde!)),
          ]).filter(data => entre(dia(data), somar(inicio, 1), fim));
          let pendenciaLiberacao = false;
          for (const data of datasLiberacao) {
            const liberacao = dia(data), liberada = elegibilidades(liberacao).get(animal.id)!;
            const filtroLiberacao = filtroNaData(animal.id, liberacao);
            detalhe.elegibilidadeLiberacao = liberada;
            motivos.push(...filtroLiberacao.pendencias);
            // Serviço no dia da liberação pode aguardar DG; outras incertezas clínicas permanecem pendentes.
            const situacaoConhecida = liberada.elegivel === true || (liberada.elegivel === null
              && liberada.motivos.every(m => m === "DIAGNOSTICO_PENDENTE"));
            // Reavalia decisões posteriores, restrições, sítio e ciclo; a decisão isolada não prova aptidão.
            if (liberada.baseElegivel === true && liberada.ciclo?.chaveCiclo === e.ciclo?.chaveCiclo
              && filtroLiberacao.incluido && situacaoConhecida) {
              detalhe.origemElegibilidade = "SAIDA_PEV";
              detalhe.contribuicaoElegiveis = (21 - diasCalendarioContexto(inicio, liberacao)) / 21;
              contagens.saidasPev++; contagens.contribuicaoPev += detalhe.contribuicaoElegiveis;
              break;
            }
            pendenciaLiberacao ||= liberada.baseElegivel === null || (liberada.elegivel === null && !situacaoConhecida)
              || filtroLiberacao.pendencias.length > 0;
            motivos.push(...liberada.motivos);
          }
          if (detalhe.origemElegibilidade !== "SAIDA_PEV") {
            if (e.baseElegivel === null || pendenciaLiberacao) {
              detalhe.origemElegibilidade = "PENDENTE"; detalhe.contribuicaoElegiveis = null;
            }
            motivos.push(...e.motivos);
          }
        }
      } else if (filtroInicio.pendencias.length) { detalhe.origemElegibilidade = "PENDENTE"; detalhe.contribuicaoElegiveis = null; }
      else motivos.push("FORA_DO_FILTRO_NO_INICIO");
      if (detalhe.contribuicaoElegiveis === null && detalhe.origemElegibilidade === "PENDENTE") contagens.animaisComPendenciaElegibilidade++;
      if (detalhe.servida) contagens.matrizesServidas++;
      for (const t of tentativasIncluidas) {
        if (t.resultado === "NAO_CLASSIFICAVEL") { contagens.naoClassificaveis++; motivos.push(...t.motivos); }
        else { contagens.tentativas++; if (t.resultado === "POSITIVA") contagens.positivas++; else if (t.resultado === "NEGATIVA") contagens.negativas++; else contagens.abertas++; }
      }
      detalhe.motivos = unicos(motivos);
      if (filtroInicio.incluido || filtroInicio.pendencias.length || tentativasIncluidas.length) detalhamento.push(detalhe);
    }
    contagens.estimativaVaziasAnteriores = contagens.anterioresSemDiagnostico && filtros.concepcaoEstimada === undefined ? null : contagens.anterioresSemDiagnostico * (1 - (filtros.concepcaoEstimada ?? 0) / 100);
    contagens.elegiveisConhecidas = contagens.vaziasAptasInicio + contagens.negativasAnteriores + contagens.contribuicaoPev;
    contagens.elegiveis = contagens.estimativaVaziasAnteriores === null || contagens.animaisComPendenciaElegibilidade > 0 ? null : contagens.elegiveisConhecidas + contagens.estimativaVaziasAnteriores;
    contagens.denominadorConcepcao = contagens.tentativas - contagens.abertas;
    if (contagens.estimativaVaziasAnteriores === null) pendencias.push("CONCEPCAO_ESTIMADA_NAO_INFORMADA");
    if (contagens.animaisComPendenciaElegibilidade) pendencias.push("ELEGIBILIDADE_PENDENTE");
    if (contagens.naoClassificaveis) pendencias.push("TENTATIVAS_NAO_CLASSIFICAVEIS");
    if (contagens.abertas) pendencias.push("TENTATIVAS_SEM_DIAGNOSTICO");
    if (contagens.elegiveis === 0) pendencias.push("SEM_DENOMINADOR_ELEGIVEIS");
    if (!contagens.denominadorConcepcao) pendencias.push("SEM_DENOMINADOR_CONCEPCAO");
    pendencias.push(...detalhamento.flatMap(d => d.motivos.filter(m => m.includes("NO_FILTRO") || m === "SITIO_DA_TENTATIVA_DIVERGENTE" || m === "GESTACAO_SEM_TENTATIVA_COMPROVADA")));
    return { ...janelaPeriodo, contagens, taxas: calcularTaxasIndicadores(contagens), pendencias: unicos(pendencias),
      maturidade: { corte: filtros.corte, diasAposFim: diasCalendarioContexto(fim, corte), tentativasAbertas: contagens.abertas }, detalhamento };
  });
  const contagens = contagensVazias();
  const camposSomaveis = ["vaziasAptasInicio", "negativasAnteriores", "anterioresSemDiagnostico", "saidasPev", "contribuicaoPev", "elegiveisConhecidas",
    "matrizesServidas", "tentativas", "positivas", "negativas", "abertas", "naoClassificaveis", "denominadorConcepcao", "animaisComPendenciaElegibilidade"] as const;
  for (const p of periodos) {
    for (const chave of camposSomaveis) contagens[chave] += p.contagens[chave];
    for (const chave of ["elegiveis", "estimativaVaziasAnteriores"] as const) {
      const a = contagens[chave], b = p.contagens[chave];
      contagens[chave] = a === null || b === null ? null : a + b;
    }
  }
  return { versao: 1, versaoMetodologia: VERSAO_METODOLOGIA_INDICADORES,
    metodologia: { rotulo: "Base IDEAGRI/IILB — metodologia Fazendinha v1", fontes: [...FONTES_METODOLOGIA_INDICADORES],
      deslocamentoTeDias: filtros.deslocamentoTeDias, concepcaoEstimada: filtros.concepcaoEstimada ?? null,
      regras: ["Janelas inclusivas de 21 dias ancoradas no fim; sobra inicial descartada.",
        "E = V + N + U × (1 − q) + C; q é a concepção estimada explicitamente informada.",
        "Saída do PEV no dia d usa (22 − d) / 21, sem arredondamento intermediário.",
        "TS = 100 × matrizes únicas servidas / E; serviço de recém-liberadas também conta.",
        "TC = 100 × tentativas positivas / (tentativas − abertas); independe da aptidão inicial.",
        "TP = TS × TC / 100; totais recalculados das somas, sem média das taxas.",
        "Baixa até o fim exclui a matriz de todo o período; períodos anteriores são preservados.",
        "Filtros de lote e papel usam o início para E e a data factual da tentativa para serviço/concepção.",
        "Tipos de tentativa filtram serviço/concepção; o histórico clínico completo determina E.",
        "TE desloca somente a data analítica; resultados exigem vínculo comprovado e data até o corte.",
        "São fatos atualmente válidos até o corte; reimpressões dependem do snapshot da emissão.",
        "A precisão interna e bordas não comprovadas da fonte não permitem alegar equivalência integral ao IDEAGRI."] },
    filtros, politicas: base.politicas.filter(p => periodos.some(periodo => periodo.detalhamento.some(d => d.elegibilidadeInicio.politicaId === p.id || d.elegibilidadeLiberacao?.politicaId === p.id))),
    sobraInicial: janela.sobraInicial, periodos,
    totais: { contagens, taxas: calcularTaxasIndicadores(contagens), participacoesAnimalPeriodo: periodos.reduce((s, p) => s + p.detalhamento.filter(d => d.contribuicaoElegiveis !== 0).length, 0),
      animaisUnicos: new Set(periodos.flatMap(p => p.detalhamento.filter(d => d.contribuicaoElegiveis !== 0 || d.servida).map(d => d.animalId))).size },
    pendencias: unicos([...(!periodos.length ? ["JANELA_SEM_PERIODO_COMPLETO"] : []), ...periodos.flatMap(p => p.pendencias)]) };
}

/** CSV usa valores completos; aspas protegem também nomes com separador/quebra de linha. */
export function exportarIndicadoresCsv(snapshot: SnapshotIndicadoresReprodutivos): string {
  const celula = (valor: string | number | null) => {
    const conteudo = typeof valor === "string" && /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : String(valor ?? "");
    return `"${conteudo.replaceAll('"', '""')}"`;
  };
  const linhas: Array<Array<string | number | null>> = [["Metodologia", snapshot.metodologia.rotulo], ["Versão", snapshot.versaoMetodologia], ["Corte", snapshot.filtros.corte],
    ["Concepção estimada (%)", snapshot.metodologia.concepcaoEstimada], ["Deslocamento TE (dias)", snapshot.metodologia.deslocamentoTeDias],
    ["Início", "Fim", "Elegíveis", "Matrizes servidas", "Tentativas", "Positivas", "Negativas", "Abertas", "TS (%)", "TC (%)", "TP (%)", "Pendências"]];
  for (const p of snapshot.periodos) linhas.push([p.inicio, p.fim, p.contagens.elegiveis, p.contagens.matrizesServidas, p.contagens.tentativas,
    p.contagens.positivas, p.contagens.negativas, p.contagens.abertas, p.taxas.servico, p.taxas.concepcao, p.taxas.prenhez, p.pendencias.join(" | ")]);
  const { contagens: c, taxas: t } = snapshot.totais;
  linhas.push(["TOTAL", "", c.elegiveis, c.matrizesServidas, c.tentativas, c.positivas, c.negativas, c.abertas, t.servico, t.concepcao, t.prenhez, snapshot.pendencias.join(" | ")]);
  linhas.push([], ["DETALHAMENTO POR MATRIZ"], ["Início", "Fim", "Animal ID", "Brinco", "Nome", "Origem elegibilidade", "Contribuição E", "Servida", "Política ID", "Política versão", "Apta desde", "Tentativa anterior", "Resultado anterior", "Motivos"]);
  for (const p of snapshot.periodos) for (const d of p.detalhamento) linhas.push([p.inicio, p.fim, d.animalId, d.brinco, d.nome, d.origemElegibilidade,
    d.contribuicaoElegiveis, d.servida ? "SIM" : "NAO", d.elegibilidadeInicio.politicaId, d.elegibilidadeInicio.politicaVersao,
    d.elegibilidadeInicio.aptaDesde, d.tentativaAnterior?.id ?? null, d.tentativaAnterior?.resultado ?? null, d.motivos.join(" | ")]);
  linhas.push([], ["TENTATIVAS E EVIDÊNCIAS"], ["Início", "Fim", "Animal ID", "Tentativa ID", "Tipo", "Data factual", "Data analítica", "Resultado", "Resultado em", "Evidências", "Motivos"]);
  for (const p of snapshot.periodos) for (const d of p.detalhamento) for (const tentativa of d.tentativas) linhas.push([p.inicio, p.fim, d.animalId,
    tentativa.id, tentativa.tipo, tentativa.dataFactual, tentativa.dataAnalitica, tentativa.resultado, tentativa.resultadoEm,
    tentativa.evidencias.map(e => `${e.tipo}:${e.id}@${e.data}`).join(" | "), tentativa.motivos.join(" | ")]);
  const a=snapshot.acompanhamento;
  if(a){
    linhas.push([], ["Acompanhamento gerencial",a.versaoMetodologia],["Unidade","Dias corridos"],["Referência coorte de espera","Início do ciclo"],["Referência perdas","Primeiro DG positivo"],["Referência IEP","Segundo parto qualificante"],["Referência tentativas por concepção","Serviço conceptivo; acumulada no ciclo"],["Janela de perdas (dias)",a.perdas.janelaDias],["Perdas numerador",a.perdas.numerador],["Perdas denominador demonstrável",a.perdas.denominador],["Perdas (%)",a.perdas.percentual]);
    linhas.push(["Exclusões por escopo histórico não comprovado",a.exclusoesEscopo.length]);
    for(const e of a.exclusoesEscopo)linhas.push([e.populacao,e.animalId,e.referenciaId,e.motivos.join(" | ")]);
    linhas.push(["Espera: população","Animal","Ciclo","Início","Liberação válida","Primeiro serviço","Dias liberação-serviço","Dias parto-serviço","Dias fimPEV-serviço","Repetições","Saída","Pendências"]);
    for(const [populacao,lista] of [["COORTE",a.espera.coorte],["FILA_ATUAL",a.espera.filaAtual]] as const)for(const c of lista)linhas.push([populacao,c.animalId,c.cicloId,c.inicio,c.primeiraLiberacao?.data??null,c.primeiroServico?.data??null,c.diasLiberacaoServico,c.diasPartoServico,c.diasFimPevServico,c.repeticoes,c.saidaEm,c.pendencias.join(" | ")]);
    linhas.push(["Perdas: gestação","Animal","Primeiro DG","Fim janela","Estado","Subtipo","Fato desfecho","Data desfecho","Explicação","Lacunas","Pendências","Provas"]);
    for(const g of a.perdas.coorte)linhas.push([g.gestacaoId,g.animalId,g.primeiroDgPositivo?.data??null,g.fimJanela,g.estado,g.encerramento?.subtipo??g.encerramento?.tipo??null,g.encerramento?.fatoId??null,g.encerramento?.data??null,g.encerramento?.explicacao??null,g.lacunas.join(" | "),g.motivos.join(" | "),g.evidenciaIds.join(" | ")]);
    linhas.push(["IEP: animal","Parto anterior","Parto atual","Data anterior","Data atual","Dias","Abortos intermediários"]);
    for(const p of a.iep.pares)linhas.push([p.animalId,p.anteriorId,p.atualId,p.anteriorEm,p.atualEm,p.dias,p.abortosIntermediarios.map(b=>`${b.id}:${b.data}`).join(" | ")]);
    linhas.push(["Concepção","Animal","Serviço factual","Tentativa conceptiva","N tentativas acumuladas","IDs das tentativas","Tipos","Provas","Pendências"]);
    if(a.tentativasPorConcepcao.estado==="CALCULADO")for(const c of a.tentativasPorConcepcao.linhas)linhas.push([c.concepcaoId,c.animalId,c.servicoEm,c.tentativaId,c.numeroTentativas,c.tentativaIds.join(" | "),c.tipos.join(" | "),c.evidenciaIds.join(" | "),c.pendencias.join(" | ")]);
  }
  return "\uFEFF" + linhas.map(l => l.map(celula).join(";")).join("\r\n");
}
