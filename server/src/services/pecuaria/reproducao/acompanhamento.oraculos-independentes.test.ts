import { describe, expect, it } from "vitest";
import { identidadeDemandaAcompanhamento, proporAcompanhamentos } from "./acompanhamento.calc.js";
import { parametrosAcompanhamentoSchema } from "./acompanhamento.schemas.js";
import { perdaSchema } from "./schemas.js";
import { desfechoGestacao } from "./desfecho-gestacao.calc.js";
import { calcularEsperaAcompanhamento, calcularIepAcompanhamento, calcularPerdasAcompanhamento, calcularTentativasPorConcepcao,
  type CicloAcompanhamentoIndicador, type FiltrosAcompanhamentoIndicadores, type GestacaoAcompanhamentoIndicador, type PartoAcompanhamentoIndicador } from "./acompanhamento-indicadores.calc.js";
import type { EntradaElegibilidade } from "./elegibilidade.calc.js";
import type { DadosIndicadores } from "./indicadores.calc.js";
import { construirDadosAcompanhamento } from "./acompanhamento-indicadores.js";
import { consultaIndicadoresSchema } from "./indicadores.schemas.js";

const id = "00000000-0000-4000-8000-000000000001";
const outra = "00000000-0000-4000-8000-000000000002";
const data = (d: string) => new Date(`${d}T00:00:00Z`);
const local = { propriedadeId: 7, loteId: "lote-historico", papel: "NENHUM" };
const politica = (versao = 1) => ({ id, versao, parametros: { versao: 1 as const, efeito: "ALERTA" as const,
  diagnostico: { diasAposTentativa: 0 }, reconfirmacoes: [{ ocorrencia: 2, diasAposPrimeiroPositivo: 35 }, { ocorrencia: 1, diasAposPrimeiroPositivo: 7 }] } });
const filtro = (p: Partial<FiltrosAcompanhamentoIndicadores> = {}): FiltrosAcompanhamentoIndicadores => ({ propriedadeId: 7, inicio: "2026-01-01", fim: "2026-01-31", corte: "2026-03-01", ...p });
const perda = (p: Partial<GestacaoAcompanhamentoIndicador> = {}): GestacaoAcompanhamentoIndicador => ({ id: "g", animalId: "animal", valida: true,
  confirmadaEm: "2026-01-01", localConfirmacao: local, primeiroDgPositivo: { id: "primeiro", data: "2026-01-01", local }, encerramento: null,
  coberturaSeguimento: [{ desde: "2026-01-01", ate: "2026-01-31", evidenciaIds: ["presenca-continuada"] }],
  evidencias: [{ id: "controle", gestacaoId: "g", data: "2026-02-02", tipo: "DG_POSITIVO", valida: true }], ...p });
const parto = (id: string, d: string, desfecho: PartoAcompanhamentoIndicador["desfecho"] = "VIVO"): PartoAcompanhamentoIndicador => ({ id, animalId: "animal", data: d, valido: true, desfecho, local });
function contexto(d: string, bloqueios: EntradaElegibilidade["restricoes"] = []): Omit<EntradaElegibilidade, "referencia"> {
  return { animalId: "animal", propriedadeId: 7, sexo: "F", propriedadeNaData: 7, localizacaoConflitante: false, baixaEm: null,
    ciclo: { chaveCiclo: "PARTO:p", inicioCiclo: data("2026-01-01"), partoId: "p", aborto: false, paridade: 1, aptaDesdeInicial: null },
    vinculo: { id: "c", politicaId: null, chaveCiclo: "PARTO:p" }, politica: null,
    decisoes: [{ id: "liberacao", data: data(d), tipo: "LIBERAR", aptaDesde: data(d), status: "VALIDO", criadoEm: data(d) }],
    papel: "NENHUM", papelConflitante: false, descarte: false, restricoes: bloqueios, situacaoReprodutiva: "APTA", perdaGestacionalEm: null };
}
const ciclo = (p: Partial<CicloAcompanhamentoIndicador> = {}): CicloAcompanhamentoIndicador => ({ id: "c", chaveCiclo: "PARTO:p", animalId: "animal", inicio: "2026-01-01", localInicio: local, localCorte: local,
  partoId: "p", partoEm: "2026-01-01", fimPev: "2026-01-10", servicos: [{ id: "te", data: "2026-01-31", tipo: "TE", valido: true, propriedadeId: 7 }],
  candidatosLiberacao: [{ data: "2026-01-15", contexto: contexto("2026-01-15") }], restricoes: [], ...p });

describe("oráculos independentes: política e identidade factual", () => {
  it("não instala um prazo clínico omitido", () => {
    expect(parametrosAcompanhamentoSchema.safeParse({}).success).toBe(false);
    expect(parametrosAcompanhamentoSchema.safeParse({ versao: 1, efeito: "ALERTA", diagnostico: null, reconfirmacoes: [] }).success).toBe(false);
    expect(parametrosAcompanhamentoSchema.safeParse({ ...politica().parametros, diagnostico: {} }).success).toBe(false);
  });
  it("zero explícito prevê DG na data do fato e reconfirmação respeita calendário bissexto", () => {
    expect(proporAcompanhamentos(politica(), { tentativaId: "t", data: "2024-02-29" })[0].previstaPara).toBe("2024-02-29");
    const previsoes = proporAcompanhamentos(politica(), { gestacaoId: "g", data: "2024-02-29" });
    expect(previsoes.map(p => [p.ocorrencia, p.previstaPara])).toEqual([[1, "2024-03-07"], [2, "2024-04-04"]]);
  });
  it("versão nova altera regra congelada, nunca identidade da mesma ocorrência", () => {
    const a = proporAcompanhamentos(politica(1), { gestacaoId: "g", data: "2026-01-01" });
    const b = proporAcompanhamentos({ ...politica(2), parametros: { ...politica().parametros, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 14 }] } }, { gestacaoId: "g", data: "2026-01-01" });
    expect(identidadeDemandaAcompanhamento(a[0])).toBe(identidadeDemandaAcompanhamento(b[0]));
    expect(a[0].previstaPara).toBe("2026-01-08"); expect(b[0].previstaPara).toBe("2026-01-15");
    expect(a[0].regraSnapshot.politicaVersao).toBe(1); expect(b[0].regraSnapshot.politicaVersao).toBe(2);
    expect(identidadeDemandaAcompanhamento(a[1])).not.toBe(identidadeDemandaAcompanhamento(a[0]));
  });
  it("origem distinta não colide e uma proposta exige exatamente uma âncora", () => {
    const t = proporAcompanhamentos(politica(), { tentativaId: "mesmo-id", data: "2026-01-01" })[0];
    const g = proporAcompanhamentos(politica(), { gestacaoId: "mesmo-id", data: "2026-01-01" })[0];
    expect(identidadeDemandaAcompanhamento(t)).not.toBe(identidadeDemandaAcompanhamento(g));
    for (const fato of [{ data: "2026-01-01" }, { tentativaId: "t", gestacaoId: "g", data: "2026-01-01" }]) expect(() => proporAcompanhamentos(politica(), fato)).toThrow();
  });
  it("rejeita ocorrências duplicadas e versão de exame sem identidade", () => {
    expect(parametrosAcompanhamentoSchema.safeParse({ ...politica().parametros, reconfirmacoes: [{ ocorrencia: 1, diasAposPrimeiroPositivo: 7 }, { ocorrencia: 1, diasAposPrimeiroPositivo: 30 }] }).success).toBe(false);
    expect(parametrosAcompanhamentoSchema.safeParse({ ...politica().parametros, diagnostico: { diasAposTentativa: 10, tipoExameVersao: 3 } }).success).toBe(false);
  });
  it("propor não muta parâmetros de uma política nem suas ocorrências", () => {
    const p = politica(); const anterior = structuredClone(p);
    proporAcompanhamentos(p, { gestacaoId: "g", data: "2026-01-01" });
    expect(p).toEqual(anterior);
  });
});

describe("oráculos independentes: explicação e causa de perda", () => {
  const input = { chave: id, animalId: outra, propriedadeId: 7, data: "2026-01-20", gestacaoId: id };
  it.each([undefined, "", "  ", "abc"])("causa desconhecida não permite explicação insuficiente %s", motivo => {
    expect(perdaSchema.safeParse({ ...input, motivo, causaClinica: { estado: "DESCONHECIDA" } }).success).toBe(false);
  });
  it("admite explicação do contexto sem laudo nem causa confirmada", () => {
    expect(perdaSchema.parse({ ...input, motivo: "Observado retorno ao cio; causa desconhecida", causaClinica: { estado: "DESCONHECIDA" } })).toMatchObject({ causaClinica: { estado: "DESCONHECIDA" } });
    expect(perdaSchema.safeParse({ ...input, motivo: "Observação registrada no atendimento" }).success).toBe(true);
    expect(perdaSchema.safeParse({ ...input, motivo: "Observação registrada", causaClinica: { estado: "CONFIRMADA" } }).success).toBe(false);
  });
  it("palavra perda não inventa desfecho e texto sem essa palavra não apaga tipo explícito", () => {
    const g = { id: "g", encerradaEm: data("2026-01-20"), motivoEncerramento: "perda registrada" };
    expect(desfechoGestacao(g, [])).toBe("NAO_IDENTIFICADO");
    const tipada = { ...g, tipoEncerramento: "PERDA", motivoEncerramento: "Causa desconhecida" };
    expect(desfechoGestacao(tipada, [])).toBe("PERDA");
    expect(desfechoGestacao({ ...g, encerradaEm: null, tipoEncerramento: "PERDA" }, [])).toBe("ABERTA");
  });
  it("parto válido identifica encerramento por fato, parto anulado não o comprova", () => {
    const g = { id: "g", encerradaEm: data("2026-01-20"), tipoEncerramento: null };
    expect(desfechoGestacao(g, [{ gestacaoId: "g", status: "ANULADO" }])).toBe("NAO_IDENTIFICADO");
    expect(desfechoGestacao(g, [{ gestacaoId: "g", status: "VALIDO" }])).toBe("PARTO");
  });
});

describe("oráculos independentes: populações e dias reais", () => {
  it("TE usa data real e três relógios independentes sem deslocamento analítico", () => {
    const r = calcularEsperaAcompanhamento([ciclo()], filtro()).coorte[0];
    expect([r.diasPartoServico, r.diasFimPevServico, r.diasLiberacaoServico]).toEqual([30, 21, 16]);
  });
  it("restrição intermediária aparece sem retirar dias corridos; restrição na liberação impede marco", () => {
    const r = calcularEsperaAcompanhamento([ciclo({ restricoes: [{ id: "r", inicio: "2026-01-20", fim: "2026-01-25", efeito: "BLOQUEIO" }] })], filtro()).coorte[0];
    expect(r.diasLiberacaoServico).toBe(16); expect(r.restricoesIntermediarias.map(r => r.id)).toEqual(["r"]);
    const bloqueada = contexto("2026-01-15", [{ id: "r", data: data("2026-01-14"), ate: null, status: "VALIDO" }]);
    expect(calcularEsperaAcompanhamento([ciclo({ candidatosLiberacao: [{ data: "2026-01-15", contexto: bloqueada }] })], filtro()).coorte[0].diasLiberacaoServico).toBeNull();
  });
  it("fila atual inclui ciclo antigo e não o injeta na coorte de janeiro", () => {
    const c = ciclo({ inicio: "2025-12-31", servicos: [], candidatosLiberacao: [{ data: "2026-01-15", contexto: contexto("2026-01-15") }, { data: "2026-03-01", contexto: contexto("2026-01-15") }] });
    const r = calcularEsperaAcompanhamento([c], filtro());
    expect(r.coorte).toEqual([]); expect(r.filaAtual.map(l => l.cicloId)).toEqual(["c"]);
    expect(r.filaAtual[0].diasAguardandoServico).toBe(45);
  });
  it("perda no último dia da janela e seguimento comprovado fecham1/2; hiato não vira sucesso", () => {
    const perdida = perda({ id: "perdida", encerramento: { tipo: "PERDA", data: "2026-01-31", fatoId: "perda", explicacao: "Observação registrada; causa não identificada" } });
    const hiato = perda({ id: "hiato", coberturaSeguimento: [{ desde: "2026-01-01", ate: "2026-01-15", evidenciaIds: ["a"] }, { desde: "2026-01-17", ate: "2026-02-01", evidenciaIds: ["b"] }], evidencias: [{ id: "controle", gestacaoId: "hiato", data: "2026-02-02", tipo: "DG_POSITIVO", valida: true }] });
    const r = calcularPerdasAcompanhamento([perdida, perda(), hiato], filtro({ janelaPerdaDias: 30 }));
    expect([r.numerador, r.denominador, r.percentual]).toEqual([1, 2, 50]); expect(r.contagens.incompletos).toBe(1);
    expect(calcularPerdasAcompanhamento([perdida, perda()], filtro()).percentual).toBeNull();
  });
  it("janela futura ou falta de DG inicial fica pendente; contagem não fabrica denominador", () => {
    const r = calcularPerdasAcompanhamento([perda({ primeiroDgPositivo: null }), perda({ id: "futura", primeiroDgPositivo: { id: "dg", data: "2026-01-31", local } })], filtro({ janelaPerdaDias: 60 }));
    expect(r.denominador).toBe(0); expect(r.percentual).toBeNull(); expect(r.contagens.incompletos).toBe(2);
  });
  it("IEP usa parto anterior ao recorte e alternativa todos os partos tem outro par", () => {
    const fatos = [parto("antes", "2025-01-01"), parto("aborto", "2025-08-01", "ABORTO"), parto("atual", "2026-01-01", "NATIMORTO")];
    const principal = calcularIepAcompanhamento(fatos, filtro());
    expect(principal.pares[0]).toMatchObject({ anteriorId: "antes", atualId: "atual", dias: 365, abortosIntermediarios: [{ id: "aborto", data: "2025-08-01" }] });
    const todos = calcularIepAcompanhamento(fatos, filtro({ iepModo: "TODOS_PARTOS" }));
    expect(todos.pares[0]).toMatchObject({ anteriorId: "aborto", atualId: "atual", dias: 153 });
  });
  it("gêmeos não duplicam parto; join repetido não duplica concepção nem tentativas", () => {
    const p = parto("parto", "2026-01-01");
    expect(calcularIepAcompanhamento([parto("antes", "2025-01-01"), p, structuredClone(p)], filtro()).pares).toHaveLength(1);
    const c = ciclo(); c.servicos.unshift({ id: "ia", data: "2026-01-10", tipo: "IA", valido: true, propriedadeId: 7 });
    const g = { id: "g", animalId: "animal", tentativaId: "te", confirmadaEm: "2026-02-15", valida: true, evidenciaIds: ["dg"], localConfirmacao: local };
    const r = calcularTentativasPorConcepcao([c], [g, structuredClone(g)], filtro());
    expect(r.concepcoes).toBe(1); expect(r.mediaTentativas).toBe(2); expect(r.linhas[0].tentativaIds).toEqual(["ia", "te"]);
  });
  it("mesma identidade com fatos divergentes exige correção em vez de escolher uma versão", () => {
    expect(() => calcularIepAcompanhamento([parto("p", "2026-01-01"), parto("p", "2026-01-02")], filtro())).toThrow(/divergentes/);
  });
});

function dadosComParto(desfecho: "ABORTO" | "NATIMORTO", diaParto = "2026-01-20"): DadosIndicadores {
  const p = { id: "parto-comprovado", animalId: "animal", propriedadeId: 7, data: data(diaParto), tipo: desfecho, desfecho: desfecho === "ABORTO" ? "ABORTO" : "NASCIMENTO", status: "VALIDO", incluidoSaldoAnterior: false, gestacaoId: "g", observacao: null };
  return { identificacoes: [{ id: "animal", brinco: "7", nome: null }], evidencias: [{ id: "primeiro-dg", animalId: "animal", tentativaId: null, gestacaoId: "g", data: data("2026-01-01"), resultado: "POSITIVO", status: "VALIDO", fonte: "EXAME_INTERPRETADO" }],
    elegibilidade: { animais: [{ id: "animal", sexo: "F", dataEntrada: data("2025-01-01"), partosAntesDaEntrada: 0 }], partos: [p], tentativas: [], lactacoes: [],
      gestacoes: [{ id: "g", animalId: "animal", propriedadeId: 7, tentativaId: null, confirmadaEm: data("2026-01-01"), encerradaEm: data(diaParto), tipoEncerramento: "PARTO", motivoEncerramento: "PARTO_ABORTO", status: "VALIDO" }],
      localizacoes: [{ id: "local", animalId: "animal", propriedadeId: 7, loteId: null, desde: data("2025-01-01"), ate: null }], avaliacoes: [], iniciais: [], vinculos: [], politicas: [], decisoes: [], restricoes: [], papeis: [], baixas: [] } };
}
describe("oráculos independentes: aborto factual em perdas analíticas", () => {
  it("aborto histórico sem texto conta uma vez pela gestação e conserva Parto.id como prova", () => {
    const g = perda({ encerramento: { tipo: "PERDA", subtipo: "ABORTO", data: "2026-01-20", fatoId: "parto-aborto" } });
    const r = calcularPerdasAcompanhamento([g, structuredClone(g)], filtro({ janelaPerdaDias: 30 }));
    expect(r).toMatchObject({ numerador: 1, denominador: 1, percentual: 100, composicaoNumerador: { perdasRegistradas: 0, abortos: 1 }, contagens: { gestacoes: 1, abortos: 1, perdasRegistradas: 0 } });
    expect(r.coorte[0].evidenciaIds).toEqual(["parto-aborto"]); expect(r.coorte[0].encerramento?.explicacao).toBeUndefined();
    expect(r.coorte[0].lacunas).toContain("EXPLICACAO_HISTORICA_ABORTO_AUSENTE");
  });
  it("perda histórica tipada sem texto conta com lacuna, enquanto desfecho não identificado fica incompleto", () => {
    const comprovada = perda({ encerramento: { tipo: "PERDA", subtipo: "PERDA_REGISTRADA", data: "2026-01-20", fatoId: "perda-auditada" } });
    const ambigua = perda({ id: "ambigua", encerramento: { tipo: "NAO_IDENTIFICADO", data: "2026-01-20", fatoId: "g-ambigua" } });
    const r = calcularPerdasAcompanhamento([comprovada, ambigua], filtro({ janelaPerdaDias: 30 }));
    expect(r).toMatchObject({ numerador: 1, denominador: 1, percentual: 100, composicaoNumerador: { perdasRegistradas: 1, abortos: 0 } });
    expect(r.coorte[0].evidenciaIds).toEqual(["perda-auditada"]); expect(r.coorte[0].lacunas.length).toBeGreaterThan(0);
    expect(r.coorte[1].estado).toBe("INCOMPLETO"); expect(r.coorte[1].motivos).toContain("DESFECHO_NAO_IDENTIFICADO");
  });
  it("perda registrada e aborto têm composição própria, natimorto não vira perda", () => {
    const aborto = perda({ id: "aborto", encerramento: { tipo: "PERDA", subtipo: "ABORTO", data: "2026-01-20", fatoId: "pa" } });
    const registrada = perda({ id: "registrada", encerramento: { tipo: "PERDA", subtipo: "PERDA_REGISTRADA", data: "2026-01-20", fatoId: "g-registrada", explicacao: "Observação clínica registrada" } });
    const natimorto = perda({ id: "natimorto", encerramento: { tipo: "PARTO", data: "2026-01-31", fatoId: "pn" }, evidencias: [{ id: "pn", gestacaoId: "natimorto", data: "2026-01-31", tipo: "PARTO_QUALIFICANTE", valida: true }] });
    const r = calcularPerdasAcompanhamento([aborto, registrada, natimorto], filtro({ janelaPerdaDias: 30 }));
    expect(r).toMatchObject({ numerador: 2, denominador: 3, composicaoNumerador: { perdasRegistradas: 1, abortos: 1 }, contagens: { perdasAteCorte: 2, abortos: 1, perdasRegistradas: 1 } });
    expect(r.coorte[2].estado).toBe("SEM_PERDA_COM_SEGUIMENTO");
  });
  it("aborto posterior à janela fica na contagem até corte sem entrar no numerador daquela janela", () => {
    const g = perda({ encerramento: { tipo: "PERDA", subtipo: "ABORTO", data: "2026-02-10", fatoId: "pa" } });
    const r = calcularPerdasAcompanhamento([g], filtro({ janelaPerdaDias: 30 }));
    expect(r.numerador).toBe(0); expect(r.contagens.abortos).toBe(1); expect(r.coorte[0].estado).not.toBe("PERDA_NA_JANELA");
  });
  it("adapter usa parto ligado válido e não grava outra perda nem altera o fato", () => {
    const dados = dadosComParto("ABORTO"); const antes = structuredClone(dados);
    const r = construirDadosAcompanhamento(dados, consultaIndicadoresSchema.parse(filtro({ janelaPerdaDias: 30 })));
    expect(r.gestacoes).toHaveLength(1); expect(r.gestacoes[0].encerramento).toMatchObject({ tipo: "PERDA", subtipo: "ABORTO", fatoId: "parto-comprovado", data: "2026-01-20" });
    expect(r.gestacoes[0].encerramento?.explicacao).toBeUndefined(); expect(dados).toEqual(antes);
    expect(calcularPerdasAcompanhamento(r.gestacoes, filtro({ janelaPerdaDias: 30 })).numerador).toBe(1);
  });
  it("adapter mantém natimorto como parto e aborto anulado não é prova de perda", () => {
    const dados = dadosComParto("NATIMORTO");
    expect(construirDadosAcompanhamento(dados, consultaIndicadoresSchema.parse(filtro())).gestacoes[0].encerramento?.tipo).toBe("PARTO");
    dados.elegibilidade.partos[0].status = "ANULADO";
    expect(construirDadosAcompanhamento(dados, consultaIndicadoresSchema.parse(filtro())).gestacoes[0].encerramento?.tipo).not.toBe("PERDA");
  });
});
