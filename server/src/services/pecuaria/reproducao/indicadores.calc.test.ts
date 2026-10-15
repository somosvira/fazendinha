import { describe, expect, it } from "vitest";
import { calcularIndicadoresReprodutivos, calcularTaxasIndicadores, classificarTentativaIndicador, exportarIndicadoresCsv, periodosIndicadores, type DadosIndicadores } from "./indicadores.calc.js";
import { consultaIndicadoresSchema } from "./indicadores.schemas.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const filtros = (patch: Record<string, unknown> = {}) => consultaIndicadoresSchema.parse({ propriedadeId: 1, inicio: "2026-01-01", fim: "2026-01-21", corte: "2026-03-01", ...patch });
function dados(): DadosIndicadores {
  return { identificacoes: [], evidencias: [], elegibilidade: { animais: [], partos: [], tentativas: [], lactacoes: [], gestacoes: [], localizacoes: [], avaliacoes: [],
    iniciais: [], vinculos: [], politicas: [{ id: "politica", versao: 1, parametros: { versao: 1, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 40, pevMultiparasDias: 60,
      aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "EXCLUIR", perdaGestacional: "RETOMAR_CICLO", papeisIncluidos: ["NENHUM", "DOADORA", "RECEPTORA"] } }],
    decisoes: [], restricoes: [], papeis: [], baixas: [] } };
}
function matriz(d: DadosIndicadores, id: string, apta = "2025-12-01") {
  const b = d.elegibilidade;
  b.animais.push({ id, sexo: "F", dataEntrada: dia("2025-12-01"), partosAntesDaEntrada: 0 });
  d.identificacoes.push({ id, brinco: `B${id}`, nome: null });
  b.localizacoes.push({ id: `local${id}`, animalId: id, propriedadeId: 1, loteId: null, desde: dia("2025-12-01"), ate: null });
  b.iniciais.push({ id: `inicial${id}`, animalId: id, data: dia("2025-12-01"), situacao: "APTA", status: "VALIDO", aptaDesde: dia(apta), criadoEm: dia("2025-12-01") });
  b.vinculos.push({ id: `v${id}`, animalId: id, inicioCiclo: dia("2025-12-01"), chaveCiclo: "INICIAL", politicaId: "politica", situacaoInicialId: `inicial${id}` });
  b.papeis.push({ id: `p${id}`, animalId: id, tipo: "NENHUM", inicio: dia("2025-12-01"), fim: null });
}
function tentativa(d: DadosIndicadores, id: string, animalId: string, data = "2026-01-05", tipo = "IA") {
  const t = { id, animalId, propriedadeId: 1, data: dia(data), tipo, status: "VALIDO", ciclo: 1, ordem: 1, criadoEm: dia(data) };
  d.elegibilidade.tentativas.push(t); return t;
}
function positiva(d: DadosIndicadores, id: string, tentativaId: string | null, animalId: string, data = "2026-02-05") {
  d.elegibilidade.gestacoes.push({ id, animalId, propriedadeId: 1, tentativaId, confirmadaEm: dia(data), encerradaEm: null, status: "VALIDO", motivoEncerramento: null });
}
function negativa(d: DadosIndicadores, id: string, tentativaId: string | null, animalId: string, data = "2026-02-05") {
  d.evidencias.push({ id, animalId, tentativaId, gestacaoId: null, data: dia(data), resultado: "NEGATIVO", status: "VALIDO", fonte: "EXAME_INTERPRETADO" });
  d.elegibilidade.avaliacoes.push({ animalId, data: dia(data), resultado: "NEGATIVO", status: "VALIDO" });
}
const periodo = (d: DadosIndicadores, patch: Record<string, unknown> = {}) => calcularIndicadoresReprodutivos(d, filtros(patch)).periodos[0];

describe("aritmética e períodos de indicadores", () => {
  it("reproduz o exemplo oficial com TC baseada nas 457 tentativas menos 17 abertas", () => {
    const r = calcularTaxasIndicadores({ elegiveis: 945, matrizesServidas: 457, tentativas: 457, abertas: 17, positivas: 122 });
    expect(r.servico).toBeCloseTo(48.36, 2); expect(r.concepcao).toBeCloseTo(27.73, 2); expect(r.prenhez).toBeCloseTo(13.41, 2);
  });
  it("ancora os períodos no fim e revela a sobra inicial e janelas menores que 21", () => {
    expect(periodosIndicadores("2026-01-01", "2026-02-15")).toEqual({ periodos: [
      { id: "2026-01-05", inicio: "2026-01-05", fim: "2026-01-25" }, { id: "2026-01-26", inicio: "2026-01-26", fim: "2026-02-15" }],
      sobraInicial: { inicio: "2026-01-01", fim: "2026-01-04", dias: 4 } });
    const r = calcularIndicadoresReprodutivos(dados(), filtros({ fim: "2026-01-20" }));
    expect(r.periodos).toEqual([]); expect(r.pendencias).toContain("JANELA_SEM_PERIODO_COMPLETO");
  });
  it("não converte denominador zero em uma taxa zero", () => {
    expect(periodo(dados()).taxas).toEqual({ servico: null, concepcao: null, prenhez: null });
  });
  it("valida corte, estimativa, deslocamento e listas sem repetição", () => {
    expect(() => filtros({ corte: "2026-01-20" })).toThrow();
    expect(() => filtros({ concepcaoEstimada: 101 })).toThrow();
    expect(() => filtros({ deslocamentoTeDias: 31 })).toThrow();
    expect(() => filtros({ tiposTentativa: "IA,IA" })).toThrow();
    expect(filtros({ papeis: "NENHUM,RECEPTORA", tiposTentativa: "IA,TE" }).tiposTentativa).toEqual(["IA", "TE"]);
    expect(filtros({ concepcaoEstimada: "", deslocamentoTeDias: "" })).toMatchObject({ concepcaoEstimada: undefined, deslocamentoTeDias: 7 });
    expect(() => filtros({ concepcaoEstimada: false })).toThrow();
  });
});

describe("serviço, concepção e diagnóstico comprovado", () => {
  it("conta matriz única em S e cada tentativa em T; abertas saem apenas do denominador TC", () => {
    const d = dados(); matriz(d, "a"); matriz(d, "b");
    tentativa(d, "t1", "a"); tentativa(d, "t2", "a", "2026-01-12"); tentativa(d, "t3", "b");
    negativa(d, "n1", "t1", "a"); positiva(d, "g2", "t2", "a");
    expect(periodo(d)).toMatchObject({ contagens: { elegiveis: 2, matrizesServidas: 2, tentativas: 3, positivas: 1, negativas: 1, abertas: 1 }, taxas: { servico: 100, concepcao: 50, prenhez: 50 } });
  });
  it("inclui tentativa na TC independentemente da aptidão inicial", () => {
    const d = dados(); matriz(d, "a", "2026-02-01"); tentativa(d, "t", "a"); positiva(d, "g", "t", "a");
    expect(periodo(d)).toMatchObject({ contagens: { elegiveis: 0, matrizesServidas: 1, tentativas: 1, positivas: 1 }, taxas: { servico: null, concepcao: 100, prenhez: null } });
  });
  it("diagnóstico tardio retorna ao período da tentativa e obedece o corte factual", () => {
    const d = dados(); matriz(d, "a"); tentativa(d, "t", "a"); positiva(d, "g", "t", "a", "2026-02-10");
    expect(periodo(d, { corte: "2026-02-09" }).contagens).toMatchObject({ positivas: 0, abertas: 1 });
    expect(periodo(d, { corte: "2026-02-10" }).contagens).toMatchObject({ positivas: 1, abertas: 0 });
  });
  it("reconfirmação, sexagem e origem desconhecida não geram outra concepção nem associação presumida", () => {
    const d = dados(); matriz(d, "a"); const t = tentativa(d, "t", "a"); positiva(d, "desconhecida", null, "a");
    d.evidencias.push({ id: "sexo", animalId: "a", tentativaId: "t", gestacaoId: "desconhecida", data: dia("2026-02-10"), resultado: "SEXAGEM", status: "VALIDO", fonte: "EXAME_INTERPRETADO" });
    expect(classificarTentativaIndicador(t, d, dia("2026-03-01"), 7).resultado).toBe("PENDENTE");
    positiva(d, "g", "t", "a");
    expect(periodo(d).contagens).toMatchObject({ positivas: 1, tentativas: 1 });
  });
  it("perda posterior conserva o sucesso da concepção e negativo sem vínculo não é prova", () => {
    const d = dados(); matriz(d, "a"); const t = tentativa(d, "t", "a"); negativa(d, "semVinculo", null, "a");
    expect(classificarTentativaIndicador(t, d, dia("2026-03-01"), 7).resultado).toBe("PENDENTE");
    positiva(d, "g", "t", "a"); d.elegibilidade.gestacoes[0].encerradaEm = dia("2026-02-20"); d.elegibilidade.gestacoes[0].motivoEncerramento = "PERDA";
    negativa(d, "depoisPerda", "t", "a", "2026-02-20");
    expect(periodo(d).contagens.positivas).toBe(1);
  });
  it("resultado anterior à tentativa e exposição sem data exata permanecem identificados", () => {
    const d = dados(); matriz(d, "a"); const t = tentativa(d, "t", "a"); negativa(d, "n", "t", "a", "2026-01-02");
    expect(classificarTentativaIndicador(t, d, dia("2026-03-01"), 7)).toMatchObject({ resultado: "PENDENTE", motivos: ["RESULTADO_ANTERIOR_A_TENTATIVA", "DIAGNOSTICO_PENDENTE"] });
    tentativa(d, "exposicao", "a", "2026-01-10", "EXPOSICAO_TOURO");
    expect(periodo(d).contagens).toMatchObject({ tentativas: 1, naoClassificaveis: 1 });
  });
  it("desloca TE só para análise, preservando data factual e opção de deslocamento zero", () => {
    const d = dados(); matriz(d, "a"); tentativa(d, "te", "a", "2026-01-25", "TE"); positiva(d, "g", "te", "a");
    expect(periodo(d).detalhamento[0].tentativas[0]).toMatchObject({ dataFactual: "2026-01-25", dataAnalitica: "2026-01-18", resultado: "POSITIVA" });
    expect(periodo(d, { deslocamentoTeDias: 0 }).contagens.tentativas).toBe(0);
    expect(periodo(d, { corte: "2026-01-21" }).contagens.tentativas).toBe(0);
    expect(d.elegibilidade.tentativas[0].data).toEqual(dia("2026-01-25"));
  });
});

describe("denominador histórico e proporcionalidade", () => {
  it("decompõe V, N, U e torna E/TS/TP pendentes sem estimativa explícita", () => {
    const d = dados(); for (const id of ["v", "n", "u"]) matriz(d, id);
    tentativa(d, "anteriorN", "n", "2025-12-15"); negativa(d, "n", "anteriorN", "n", "2026-02-01");
    tentativa(d, "anteriorU", "u", "2025-12-15"); tentativa(d, "atual", "v"); positiva(d, "g", "atual", "v");
    expect(periodo(d)).toMatchObject({ contagens: { vaziasAptasInicio: 1, negativasAnteriores: 1, anterioresSemDiagnostico: 1, elegiveisConhecidas: 2, elegiveis: null }, taxas: { servico: null, concepcao: 100, prenhez: null } });
    const r = periodo(d, { concepcaoEstimada: 25 });
    expect(r.contagens.elegiveis).toBe(2.75); expect(r.taxas.servico).toBeCloseTo(100 / 2.75, 10);
    expect(r.detalhamento.find(a => a.animalId === "u")).toMatchObject({ origemElegibilidade: "SEM_DIAGNOSTICO_ANTERIOR", contribuicaoElegiveis: 0.75 });
  });
  it("saídas D2 e D21 usam 20/21 e 1/21 sem arredondamento e contam serviço das recém-liberadas", () => {
    const d = dados(); matriz(d, "d2", "2026-01-02"); matriz(d, "d21", "2026-01-21");
    tentativa(d, "td2", "d2", "2026-01-02"); positiva(d, "g", "td2", "d2");
    const r = periodo(d);
    expect(r.contagens).toMatchObject({ saidasPev: 2, contribuicaoPev: 1, elegiveis: 1, matrizesServidas: 1 });
    expect(r.detalhamento.map(a => a.contribuicaoElegiveis)).toEqual([20 / 21, 1 / 21]);
  });
  it("política ausente gera pendência, sem adotar outra ou assumir zero", () => {
    const d = dados(); matriz(d, "a"); d.elegibilidade.vinculos[0].politicaId = null;
    expect(periodo(d)).toMatchObject({ contagens: { elegiveis: null, animaisComPendenciaElegibilidade: 1 }, taxas: { servico: null } });
  });
  it("gestação confirmada exclui a matriz mesmo sem política ou ciclo, conservando as pendências no detalhe", () => {
    const d = dados(); for (const id of ["apta", "semPolitica", "semCiclo"]) matriz(d, id);
    d.elegibilidade.vinculos[1].politicaId = null;
    d.elegibilidade.iniciais = d.elegibilidade.iniciais.filter(i => i.animalId !== "semCiclo");
    d.elegibilidade.vinculos = d.elegibilidade.vinculos.filter(v => v.animalId !== "semCiclo");
    positiva(d, "g1", null, "semPolitica", "2025-12-20"); positiva(d, "g2", null, "semCiclo", "2025-12-20");
    tentativa(d, "t", "apta"); positiva(d, "g3", "t", "apta");
    const r = periodo(d);
    expect(r.contagens).toMatchObject({ elegiveis: 1, animaisComPendenciaElegibilidade: 0, matrizesServidas: 1 });
    expect(r.taxas).toEqual({ servico: 100, concepcao: 100, prenhez: 100 });
    expect(r.detalhamento.find(a => a.animalId === "semPolitica")).toMatchObject({ origemElegibilidade: "EXCLUIDA", contribuicaoElegiveis: 0,
      motivos: expect.arrayContaining(["GESTACAO_CONFIRMADA_NO_INICIO", "POLITICA_AUSENTE_NO_INICIO_CICLO"]) });
    expect(r.detalhamento.find(a => a.animalId === "semCiclo")?.motivos).toContain("CICLO_DESCONHECIDO");
    // A confirmação posterior ao início não pode resolver retroativamente a base desconhecida.
    d.elegibilidade.gestacoes[0].confirmadaEm = dia("2026-01-02");
    expect(periodo(d).contagens.elegiveis).toBeNull();
  });
  function liberacaoIndividual(d: DadosIndicadores, animalId: string, data = "2026-01-10", aptaDesde = data) {
    const vinculo = d.elegibilidade.vinculos.find(v => v.animalId === animalId)!;
    d.elegibilidade.decisoes.push({ id: `lib${animalId}${data}`, vinculoCicloId: vinculo.id, data: dia(data), aptaDesde: dia(aptaDesde),
      tipo: "LIBERAR", status: "VALIDO", criadoEm: dia(data) });
  }
  it("liberação individual durante a janela contribui desde a aptidão, inclusive sem política no ciclo inicial", () => {
    const d = dados(); matriz(d, "a"); d.elegibilidade.vinculos[0].politicaId = null;
    d.elegibilidade.iniciais[0].situacao = "VAZIA"; d.elegibilidade.iniciais[0].aptaDesde = null;
    liberacaoIndividual(d, "a", "2026-01-05", "2026-01-10");
    const r = periodo(d);
    expect(r.contagens).toMatchObject({ saidasPev: 1, animaisComPendenciaElegibilidade: 0 });
    expect(r.contagens.elegiveis).toBeCloseTo(12 / 21, 12);
    expect(r.detalhamento[0]).toMatchObject({ origemElegibilidade: "SAIDA_PEV", elegibilidadeInicio: { aptaDesde: null },
      elegibilidadeLiberacao: { dataReferencia: "2026-01-10", decisaoId: "liba2026-01-05" } });
    d.elegibilidade.decisoes[0].status = "ANULADO";
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 0, elegiveis: null });
  });
  it("liberação após aborto entra uma vez e somente se ainda pertencer ao ciclo e estiver liberada na data", () => {
    const d = dados(); matriz(d, "a");
    d.elegibilidade.partos.push({ id: "aborto", animalId: "a", propriedadeId: 1, data: dia("2025-12-20"), tipo: "ABORTO",
      desfecho: "ABORTO", gestacaoId: null, status: "VALIDO", incluidoSaldoAnterior: false });
    Object.assign(d.elegibilidade.vinculos[0], { chaveCiclo: "PARTO:aborto", inicioCiclo: dia("2025-12-20") });
    liberacaoIndividual(d, "a"); liberacaoIndividual(d, "a", "2026-01-12");
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 1, elegiveis: 12 / 21 });
    d.elegibilidade.decisoes.push({ id: "bloqueio", vinculoCicloId: "va", data: dia("2026-01-09"), aptaDesde: null,
      tipo: "BLOQUEAR", status: "VALIDO", criadoEm: dia("2026-01-09") });
    // A decisão de 10/01 libera novamente; o bloqueio anterior não prevalece sobre ela.
    expect(periodo(d).contagens.saidasPev).toBe(1);
    d.elegibilidade.partos.push({ ...d.elegibilidade.partos[0], id: "outroCiclo", data: dia("2026-01-08") });
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 0, elegiveis: null });
  });
  it("decisão não contorna política inválida, bloqueio posterior ou sítio na liberação", () => {
    const d = dados(); matriz(d, "a", "2026-02-01");
    liberacaoIndividual(d, "a", "2026-01-05", "2026-01-10");
    d.elegibilidade.politicas[0].parametros = {};
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 0, elegiveis: null });
    d.elegibilidade.politicas = dados().elegibilidade.politicas;
    d.elegibilidade.decisoes.push({ id: "bloqueio", vinculoCicloId: "va", data: dia("2026-01-09"), aptaDesde: null,
      tipo: "BLOQUEAR", status: "VALIDO", criadoEm: dia("2026-01-09") });
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 0, elegiveis: 0 });
    d.elegibilidade.decisoes.pop();
    d.elegibilidade.localizacoes[0].ate = dia("2026-01-09");
    d.elegibilidade.localizacoes.push({ id: "sitio2", animalId: "a", propriedadeId: 2, loteId: null, desde: dia("2026-01-09"), ate: null });
    expect(periodo(d).contagens).toMatchObject({ saidasPev: 0, elegiveis: 0 });
  });
  it("liberação individual não transforma situação reprodutiva desconhecida em denominador conhecido", () => {
    const d = dados(); matriz(d, "a");
    d.elegibilidade.iniciais[0].situacao = "DESCONHECIDA"; d.elegibilidade.iniciais[0].aptaDesde = null;
    liberacaoIndividual(d, "a");
    const r = periodo(d);
    expect(r.contagens).toMatchObject({ saidasPev: 0, elegiveis: null, animaisComPendenciaElegibilidade: 1 });
    expect(r.detalhamento[0].motivos).toContain("SITUACAO_REPRODUTIVA_DESCONHECIDA");
  });
  it("falta de localização e conflito de papel nos filtros geram pendência identificada", () => {
    const d = dados(); matriz(d, "a"); d.elegibilidade.localizacoes[0].ate = dia("2025-12-31");
    expect(periodo(d)).toMatchObject({ contagens: { elegiveis: null, animaisComPendenciaElegibilidade: 1 }, pendencias: expect.arrayContaining(["LOCALIZACAO_DESCONHECIDA_NO_FILTRO"]) });
    d.elegibilidade.localizacoes[0].ate = null;
    d.elegibilidade.papeis.push({ id: "conflito", animalId: "a", tipo: "RECEPTORA", inicio: dia("2025-12-01"), fim: null });
    expect(periodo(d, { papeis: ["NENHUM"] }).pendencias).toContain("PAPEL_DESCONHECIDO_NO_FILTRO");
  });
  it("não considera desconhecido no passado um animal que entrou somente depois", () => {
    const d = dados(); matriz(d, "a"); d.elegibilidade.animais[0].dataEntrada = dia("2026-02-01"); d.elegibilidade.localizacoes[0].desde = dia("2026-02-01");
    expect(periodo(d).contagens).toMatchObject({ elegiveis: 0, animaisComPendenciaElegibilidade: 0 });
  });
  it("política e restrições posteriores não reescrevem a liberação congelada do período", () => {
    const d = dados(); matriz(d, "a");
    d.elegibilidade.politicas.push({ id: "p2", versao: 2, parametros: { ...d.elegibilidade.politicas[0].parametros as object, pevPrimiparasDias: 300 } });
    d.elegibilidade.restricoes.push({ id: "futura", animalId: "a", data: dia("2026-01-22"), ate: null, status: "VALIDO", tipo: "TEMPORARIA" });
    const r = calcularIndicadoresReprodutivos(d, filtros());
    expect(r.periodos[0].contagens.elegiveis).toBe(1); expect(r.politicas.map(p => p.id)).toEqual(["politica"]);
  });
  it("baixa durante o intervalo exclui a matriz inteira, preservando o período anterior", () => {
    const d = dados(); matriz(d, "a"); tentativa(d, "t1", "a", "2026-01-05"); negativa(d, "n1", "t1", "a", "2026-01-10");
    tentativa(d, "t2", "a", "2026-01-25"); positiva(d, "g", "t2", "a");
    d.elegibilidade.baixas.push({ animalId: "a", data: dia("2026-01-30"), estornadaEm: null });
    const r = calcularIndicadoresReprodutivos(d, filtros({ fim: "2026-02-11" }));
    expect(r.periodos[0].contagens).toMatchObject({ elegiveis: 1, tentativas: 1 });
    expect(r.periodos[1].contagens).toMatchObject({ elegiveis: 0, tentativas: 0 });
    expect(r.periodos[1].detalhamento[0].motivos).toContain("BAIXA_EXCLUI_TODO_PERIODO");
  });
  it("totais usam somas dos componentes e distinguem participação de matrizes únicas", () => {
    const d = dados(); matriz(d, "a"); matriz(d, "b");
    tentativa(d, "t1", "a", "2026-01-05"); negativa(d, "n", "t1", "a", "2026-01-10");
    tentativa(d, "t2", "a", "2026-01-25"); positiva(d, "g", "t2", "a");
    d.elegibilidade.restricoes.push({ id: "bloqueioB", animalId: "b", data: dia("2026-01-22"), ate: null, status: "VALIDO", tipo: "TEMPORARIA" });
    const r = calcularIndicadoresReprodutivos(d, filtros({ fim: "2026-02-11" }));
    expect(r.periodos.map(p => p.taxas.servico)).toEqual([50, 100]);
    expect(r.totais).toMatchObject({ contagens: { elegiveis: 3, matrizesServidas: 2, tentativas: 2, positivas: 1 }, participacoesAnimalPeriodo: 3, animaisUnicos: 2 });
    expect(r.totais.taxas.servico).toBeCloseTo(200 / 3, 10); expect(r.totais.taxas.prenhez).toBeCloseTo(100 / 3, 10);
  });
  it("lote e papel se aplicam nas datas históricas e tipos filtram somente os numeradores", () => {
    const d = dados(); matriz(d, "a"); const lote = "11111111-1111-4111-8111-111111111111";
    d.elegibilidade.localizacoes[0].loteId = lote; d.elegibilidade.localizacoes[0].ate = dia("2026-01-10");
    d.elegibilidade.localizacoes.push({ id: "depois", animalId: "a", propriedadeId: 1, loteId: null, desde: dia("2026-01-10"), ate: null });
    tentativa(d, "ia", "a", "2026-01-05"); tentativa(d, "te", "a", "2026-01-20", "TE");
    expect(periodo(d, { loteId: lote }).contagens).toMatchObject({ elegiveis: 1, tentativas: 1 });
    expect(periodo(d, { tiposTentativa: ["TE"] }).contagens).toMatchObject({ elegiveis: 1, tentativas: 1 });
    d.elegibilidade.papeis[0].fim = dia("2026-01-10"); d.elegibilidade.papeis.push({ id: "rec", animalId: "a", tipo: "RECEPTORA", inicio: dia("2026-01-10"), fim: null });
    expect(periodo(d, { papeis: ["NENHUM"] }).contagens).toMatchObject({ elegiveis: 1, tentativas: 1 });
  });
  it("CSV transporta valores reais, parâmetros e pendências sem zeros enganosos", () => {
    const d = dados(); matriz(d, "a"); tentativa(d, "t", "a");
    const csv = exportarIndicadoresCsv(calcularIndicadoresReprodutivos(d, filtros()));
    expect(csv).toContain('"Base IDEAGRI/IILB — metodologia Fazendinha v1"');
    expect(csv).toContain('"2026-01-01";"2026-01-21";"1";"1";"1";"0";"0";"1";"100";"";""');
    expect(csv).toContain("TENTATIVAS_SEM_DIAGNOSTICO");
    expect(csv).toContain('"DETALHAMENTO POR MATRIZ"'); expect(csv).toContain('"TENTATIVAS E EVIDÊNCIAS"');
  });
});
