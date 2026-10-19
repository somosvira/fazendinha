import { reqV4 } from "./api";
import type {
  ElegibilidadeNaData,
  PapelElegibilidade,
} from "./elegibilidade-api";
export type FiltrosIndicadores = {
  propriedadeId: number;
  inicio: string;
  fim: string;
  corte: string;
  janelaPerdaDias?:number;iepModo?:"VIVOS_NATIMORTOS"|"TODOS_PARTOS";
  concepcaoEstimada?: number;
  deslocamentoTeDias: number;
  loteId?: string;
  tiposTentativa?: Array<"IA" | "TE" | "COBERTURA">;
  papeis?: PapelElegibilidade[];
};
export type ResultadoTentativaIndicador =
  | "POSITIVA"
  | "NEGATIVA"
  | "PENDENTE"
  | "NAO_CLASSIFICAVEL";
export type TentativaDetalheIndicador = {
  id: string;
  animalId: string;
  tipo: string;
  dataFactual: string;
  dataAnalitica: string;
  resultado: ResultadoTentativaIndicador;
  resultadoEm: string | null;
  evidencias: Array<{
    id: string;
    tipo: "GESTACAO" | "EXAME_INTERPRETADO";
    data: string;
  }>;
  motivos: string[];
};
export type ContagensIndicadores = {
  vaziasAptasInicio: number;
  negativasAnteriores: number;
  anterioresSemDiagnostico: number;
  estimativaVaziasAnteriores: number | null;
  saidasPev: number;
  contribuicaoPev: number;
  elegiveisConhecidas: number;
  elegiveis: number | null;
  matrizesServidas: number;
  tentativas: number;
  positivas: number;
  negativas: number;
  abertas: number;
  naoClassificaveis: number;
  denominadorConcepcao: number;
  animaisComPendenciaElegibilidade: number;
};
export type TaxasIndicadores = {
  servico: number | null;
  concepcao: number | null;
  prenhez: number | null;
};
export type DetalheAnimalIndicador = {
  animalId: string;
  brinco: string | null;
  nome: string | null;
  origemElegibilidade:
    | "VAZIA_APTA"
    | "NEGATIVA_ANTERIOR"
    | "SEM_DIAGNOSTICO_ANTERIOR"
    | "SAIDA_PEV"
    | "EXCLUIDA"
    | "PENDENTE";
  contribuicaoElegiveis: number | null;
  servida: boolean;
  motivos: string[];
  elegibilidadeInicio: ElegibilidadeNaData;
  elegibilidadeLiberacao: ElegibilidadeNaData | null;
  tentativaAnterior: TentativaDetalheIndicador | null;
  tentativas: TentativaDetalheIndicador[];
};
export type PeriodoIndicadores = {
  id: string;
  inicio: string;
  fim: string;
  contagens: ContagensIndicadores;
  taxas: TaxasIndicadores;
  pendencias: string[];
  maturidade: { corte: string; diasAposFim: number; tentativasAbertas: number };
  detalhamento: DetalheAnimalIndicador[];
};
export type SnapshotIndicadoresReprodutivos = {
  versao: 1 | 2;
  acompanhamento?:import("./IndicadoresAcompanhamento").AcompanhamentoIndicadores;
  versaoMetodologia: string;
  metodologia: {
    rotulo: string;
    fontes: string[];
    regras: string[];
    deslocamentoTeDias: number;
    concepcaoEstimada: number | null;
  };
  filtros: FiltrosIndicadores;
  sobraInicial: { inicio: string; fim: string; dias: number } | null;
  periodos: PeriodoIndicadores[];
  totais: {
    contagens: ContagensIndicadores;
    taxas: TaxasIndicadores;
    participacoesAnimalPeriodo: number;
    animaisUnicos: number;
  };
  pendencias: string[];
};

export const consultarIndicadores = (f: FiltrosIndicadores) => {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(f))
    if (v !== undefined)
      query.set(k, Array.isArray(v) ? v.join(",") : String(v));
  return reqV4<SnapshotIndicadoresReprodutivos>(
    `/reproducao/indicadores?${query}`,
    undefined,
    "GET",
    f.propriedadeId,
  );
};
export type EmissaoIndicadores = {
  id: string;
  criadoEm: string;
  snapshot: SnapshotIndicadoresReprodutivos;
};
export const listarEmissoesIndicadores = (p: number) =>
  reqV4<EmissaoIndicadores[]>(
    `/reproducao/relatorios/emissoes?tipo=INDICADORES&propriedadeId=${p}`,
    undefined,
    "GET",
    p,
  );
export const emitirIndicadores = (filtros: FiltrosIndicadores, chave: string) =>
  reqV4<EmissaoIndicadores>(
    "/reproducao/relatorios/emissoes",
    {
      chave,
      propriedadeId: filtros.propriedadeId,
      tipo: "INDICADORES",
      filtros,
    },
    "POST",
    filtros.propriedadeId,
  );
export const abrirEmissaoIndicadores = (id: string, p: number) =>
  reqV4<EmissaoIndicadores>(
    `/reproducao/relatorios/emissoes/${id}?propriedadeId=${p}`,
    undefined,
    "GET",
    p,
  );
export function exportarIndicadoresCsv(
  snapshot: SnapshotIndicadoresReprodutivos,
): string {
  const celula = (valor: string | number | null) => {
    const conteudo=typeof valor==="string"&&/^[=+\-@\t\r]/.test(valor)?`'${valor}`:String(valor??"");
    return `"${conteudo.replaceAll('"','""')}"`;
  };
  const linhas: Array<Array<string | number | null>> = [
    ["Metodologia", snapshot.metodologia.rotulo],
    ["Versão", snapshot.versaoMetodologia],
    ["Corte", snapshot.filtros.corte],
    ["Concepção estimada (%)", snapshot.metodologia.concepcaoEstimada],
    ["Deslocamento TE (dias)", snapshot.metodologia.deslocamentoTeDias],
    [
      "Início",
      "Fim",
      "Elegíveis",
      "Matrizes servidas",
      "Tentativas",
      "Positivas",
      "Negativas",
      "Abertas",
      "TS (%)",
      "TC (%)",
      "TP (%)",
      "Pendências",
    ],
  ];
  for (const p of snapshot.periodos)
    linhas.push([
      p.inicio,
      p.fim,
      p.contagens.elegiveis,
      p.contagens.matrizesServidas,
      p.contagens.tentativas,
      p.contagens.positivas,
      p.contagens.negativas,
      p.contagens.abertas,
      p.taxas.servico,
      p.taxas.concepcao,
      p.taxas.prenhez,
      p.pendencias.join(" | "),
    ]);
  const { contagens: c, taxas: t } = snapshot.totais;
  linhas.push([
    "TOTAL",
    "",
    c.elegiveis,
    c.matrizesServidas,
    c.tentativas,
    c.positivas,
    c.negativas,
    c.abertas,
    t.servico,
    t.concepcao,
    t.prenhez,
    snapshot.pendencias.join(" | "),
  ]);
  linhas.push(
    [],
    ["Sítio", snapshot.filtros.propriedadeId],
    ["Filtros preservados", JSON.stringify(snapshot.filtros)],
    [
      "Componentes do denominador",
      "Início",
      "Vazias aptas",
      "Negativas anteriores",
      "Anteriores sem diagnóstico",
      "Estimativa vazias",
      "Saídas PEV",
      "Contribuição PEV",
      "Elegíveis conhecidas",
      "Pendências elegibilidade",
      "Denominador concepção",
    ],
  );
  for (const p of snapshot.periodos)
    linhas.push([
      "PERÍODO",
      p.inicio,
      p.contagens.vaziasAptasInicio,
      p.contagens.negativasAnteriores,
      p.contagens.anterioresSemDiagnostico,
      p.contagens.estimativaVaziasAnteriores,
      p.contagens.saidasPev,
      p.contagens.contribuicaoPev,
      p.contagens.elegiveisConhecidas,
      p.contagens.animaisComPendenciaElegibilidade,
      p.contagens.denominadorConcepcao,
    ]);
  linhas.push(
    [],
    [
      "Conferência por animal",
      "Início",
      "Fim",
      "Animal ID",
      "Brinco",
      "Nome",
      "Origem elegibilidade",
      "Contribuição",
      "Política versão",
      "Apta desde",
      "Motivos",
      "Elegibilidade na data",
      "Tentativa anterior",
      "Tentativas e evidências",
    ],
  );
  for (const p of snapshot.periodos)
    for (const a of p.detalhamento)
      linhas.push([
        "ANIMAL",
        p.inicio,
        p.fim,
        a.animalId,
        a.brinco,
        a.nome,
        a.origemElegibilidade,
        a.contribuicaoElegiveis,
        a.elegibilidadeInicio.politicaVersao,
        a.elegibilidadeInicio.aptaDesde,
        a.motivos.join(" | "),
        JSON.stringify(a.elegibilidadeInicio),
        JSON.stringify(a.tentativaAnterior),
        JSON.stringify(a.tentativas),
      ]);
  const a=snapshot.acompanhamento;
  if(a){
    linhas.push([], ["Acompanhamento gerencial",a.versaoMetodologia],["Unidade","Dias corridos"],["Referência coorte de espera","Início do ciclo"],["Referência perdas","Primeiro DG positivo"],["Referência IEP","Segundo parto qualificante"],["Referência tentativas por concepção","Serviço conceptivo; acumulada no ciclo"],["Janela de perdas (dias)",a.perdas.janelaDias],["Perdas numerador",a.perdas.numerador],["Perdas denominador demonstrável",a.perdas.denominador],["Perdas (%)",a.perdas.percentual]);
    linhas.push(["Exclusões por escopo histórico não comprovado",(a.exclusoesEscopo??[]).length]);
    for(const e of a.exclusoesEscopo??[])linhas.push([e.populacao,e.animalId,e.referenciaId,e.motivos.join(" | ")]);
    linhas.push(["Espera: população","Animal","Ciclo","Início","Liberação válida","Primeiro serviço","Dias liberação-serviço","Dias parto-serviço","Dias fimPEV-serviço","Repetições","Saída","Pendências"]);
    for(const [populacao,lista] of [["COORTE",a.espera.coorte],["FILA_ATUAL",a.espera.filaAtual]] as const)for(const c of lista)linhas.push([populacao,c.animalId,c.cicloId,c.inicio,c.primeiraLiberacao?.data??null,c.primeiroServico?.data??null,c.diasLiberacaoServico,c.diasPartoServico,c.diasFimPevServico,c.repeticoes,c.saidaEm,c.pendencias.join(" | ")]);
    linhas.push(["Perdas: gestação","Animal","Primeiro DG","Fim janela","Estado","Subtipo","Fato desfecho","Data desfecho","Explicação","Lacunas","Pendências","Provas"]);
    for(const g of a.perdas.coorte)linhas.push([g.gestacaoId,g.animalId,g.primeiroDgPositivo?.data??null,g.fimJanela,g.estado,g.encerramento?.subtipo??g.encerramento?.tipo??null,g.encerramento?.fatoId??null,g.encerramento?.data??null,g.encerramento?.explicacao??null,g.lacunas.join(" | "),g.motivos.join(" | "),g.evidenciaIds.join(" | ")]);
    linhas.push(["IEP: animal","Parto anterior","Parto atual","Data anterior","Data atual","Dias","Abortos intermediários"]);
    for(const p of a.iep.pares)linhas.push([p.animalId,p.anteriorId,p.atualId,p.anteriorEm,p.atualEm,p.dias,p.abortosIntermediarios.map(b=>`${b.id}:${b.data}`).join(" | ")]);
    linhas.push(["Concepção","Animal","Serviço factual","Tentativa conceptiva","N tentativas acumuladas","IDs das tentativas","Tipos","Provas","Pendências"]);
    if(a.tentativasPorConcepcao.estado==="CALCULADO")for(const c of a.tentativasPorConcepcao.linhas??[])linhas.push([c.concepcaoId,c.animalId,c.servicoEm,c.tentativaId,c.numeroTentativas,c.tentativaIds.join(" | "),c.tipos.join(" | "),c.evidenciaIds.join(" | "),c.pendencias.join(" | ")]);
  }
  return "\uFEFF" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}
