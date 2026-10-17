import { describe, expect, it } from "vitest";
import { calcularAcompanhamentoIndicadores, calcularEsperaAcompanhamento, calcularIepAcompanhamento, calcularPerdasAcompanhamento, calcularTentativasPorConcepcao, primeiraLiberacaoValidaIndicador,
  type CicloAcompanhamentoIndicador, type ConcepcaoAcompanhamentoIndicador, type FiltrosAcompanhamentoIndicadores, type GestacaoAcompanhamentoIndicador, type PartoAcompanhamentoIndicador } from "./acompanhamento-indicadores.calc.js";
import type { EntradaElegibilidade } from "./elegibilidade.calc.js";

const data = (d: string) => new Date(`${d}T00:00:00Z`);
const filtros = (alteracoes: Partial<FiltrosAcompanhamentoIndicadores> = {}): FiltrosAcompanhamentoIndicadores => ({ propriedadeId: 1, inicio: "2026-01-01", fim: "2026-01-31", corte: "2026-02-10", ...alteracoes });
const local = { propriedadeId: 1, loteId: "lote", papel: "NENHUM" };
function contexto(alteracoes: Partial<Omit<EntradaElegibilidade, "referencia">> = {}): Omit<EntradaElegibilidade, "referencia"> {
  return { animalId: "animal", propriedadeId: 1, sexo: "F", propriedadeNaData: 1, localizacaoConflitante: false, baixaEm: null,
    ciclo: { chaveCiclo: "INICIAL", inicioCiclo: data("2026-01-01"), partoId: null, aborto: false, paridade: null, aptaDesdeInicial: null },
    vinculo: { id: "vinculo", politicaId: null, chaveCiclo: "INICIAL" }, politica: null,
    decisoes: [{ id: "liberacao", data: data("2026-01-10"), tipo: "LIBERAR", aptaDesde: data("2026-01-10"), status: "VALIDO", criadoEm: data("2026-01-10") }],
    papel: "NENHUM", papelConflitante: false, descarte: false, restricoes: [], situacaoReprodutiva: "APTA", perdaGestacionalEm: null, ...alteracoes };
}
function ciclo(alteracoes: Partial<CicloAcompanhamentoIndicador> = {}): CicloAcompanhamentoIndicador {
  return { id: "vinculo", chaveCiclo: "INICIAL", animalId: "animal", inicio: "2026-01-01", localInicio: local, localCorte: local, fimPev: null,
    servicos: [{ id: "ia", data: "2026-01-30", tipo: "IA", valido: true, propriedadeId: 1 }],
    candidatosLiberacao: ["2026-01-01", "2026-01-10", "2026-01-30"].map(d => ({ data: d, contexto: contexto() })), restricoes: [], ...alteracoes };
}
function gestacao(alteracoes: Partial<GestacaoAcompanhamentoIndicador> = {}): GestacaoAcompanhamentoIndicador {
  return { id: "gestacao", animalId: "animal", valida: true, confirmadaEm: "2026-01-02", localConfirmacao: local,
    primeiroDgPositivo: { id: "dg-inicial", data: "2026-01-02", local }, encerramento: null,
    coberturaSeguimento: [{ desde: "2026-01-02", ate: "2026-02-01", evidenciaIds: ["registro-continuo"] }],
    evidencias: [{ id: "dg-seguimento", gestacaoId: "gestacao", data: "2026-02-02", tipo: "DG_POSITIVO", valida: true }], ...alteracoes };
}
function parto(id: string, d: string, desfecho: PartoAcompanhamentoIndicador["desfecho"] = "VIVO"): PartoAcompanhamentoIndicador {
  return { id, animalId: "animal", data: d, desfecho, valido: true, local };
}

describe("espera em dias corridos e população conferível", () => {
  it("matriz que voltou ao sítio reaparece na fila atual sem reabrir a coorte encerrada pela saída", () => {
    const c = ciclo({ saidaEm: "2026-01-20", servicos: [],
      candidatosLiberacao: ["2026-01-10", "2026-02-10"].map(d => ({ data: d, contexto: contexto() })) });
    const resultado = calcularEsperaAcompanhamento([c], filtros());
    expect(resultado.coorte[0].esperaObservadaAte).toBe("2026-01-20");
    expect(resultado.filaAtual).toHaveLength(1);
    expect(resultado.filaAtual[0]).toMatchObject({ cicloId: "vinculo", diasAguardandoServico: 31, esperaObservadaAte: "2026-02-10" });
    c.servicos.push({ id: "ia-destino", data: "2026-01-30", tipo: "IA", valido: true, propriedadeId: 2 });
    expect(calcularEsperaAcompanhamento([c], filtros()).filaAtual).toHaveLength(0);
  });

  it("serviço após a saída não atende a coorte do sítio de origem", () => {
    const c = ciclo({ saidaEm: "2026-01-20", localCorte: { propriedadeId: 2 },
      servicos: [{ id: "ia-destino", data: "2026-01-30", tipo: "IA", valido: true, propriedadeId: 2 }] });
    const resultado = calcularEsperaAcompanhamento([c], filtros());
    expect(resultado.coorte[0]).toMatchObject({ primeiroServico: null, esperaObservadaAte: "2026-01-20", diasEsperaObservada: 10, diasLiberacaoServico: null, tentativas: 0 });
    expect(resultado.resumoCoorte).toMatchObject({ comServico: 0, semServico: 1, mediaDiasLiberacaoServico: null });
  });

  it("não usa min(aptaDesde): restrição torna válida somente a liberação de20, apesar do candidato10", () => {
    const c = ciclo();
    const restricao = { id: "r", data: data("2026-01-05"), ate: data("2026-01-20"), status: "VALIDO" };
    c.candidatosLiberacao = ["2026-01-10", "2026-01-20"].map(d => ({ data: d, contexto: contexto({ restricoes: [restricao] }) }));
    expect(primeiraLiberacaoValidaIndicador(c, "2026-01-30").primeira?.data).toBe("2026-01-20");
    expect(calcularEsperaAcompanhamento([c], filtros()).coorte[0].diasLiberacaoServico).toBe(10);
  });

  it("restrição intermediária fica destacada e não subtrai dias do intervalo10→30", () => {
    const c = ciclo({ restricoes: [{ id: "r", inicio: "2026-01-15", fim: "2026-01-18", efeito: "BLOQUEIO" }] });
    const linha = calcularEsperaAcompanhamento([c], filtros()).coorte[0];
    expect(linha.diasLiberacaoServico).toBe(20);
    expect(linha.restricoesIntermediarias.map(r => r.id)).toEqual(["r"]);
  });

  it("fimPEV, parto e liberação usam relógios separados e ausência não vira zero", () => {
    const c = ciclo({ partoId: "parto", partoEm: "2026-01-01", fimPev: "2026-01-15" });
    const linha = calcularEsperaAcompanhamento([c], filtros()).coorte[0];
    expect([linha.diasPartoServico, linha.diasFimPevServico, linha.diasLiberacaoServico]).toEqual([29, 15, 20]);
    const semLiberacao = calcularEsperaAcompanhamento([ciclo({ candidatosLiberacao: [] })], filtros()).coorte[0];
    expect(semLiberacao.diasLiberacaoServico).toBeNull();
    expect(semLiberacao.pendencias).toContain("PRIMEIRA_LIBERACAO_NAO_COMPROVADA");
  });

  it("serviço anterior ao fimPEV mantém datas e antecipação explícitas sem inventar zero", () => {
    const resultado = calcularEsperaAcompanhamento([ciclo({ fimPev: "2026-02-01" })], filtros()).coorte[0];
    expect(resultado.diasFimPevServico).toBeNull();
    expect(resultado.antecipacoes).toEqual([{ referencia: "FIM_PEV", desde: "2026-02-01", servicoEm: "2026-01-30", dias: 2 }]);
    expect(resultado.pendencias).toContain("SERVICO_ANTERIOR_A_MARCO");
  });

  it("espera de ciclo encerrado ou saída para na última observação, sem continuar crescendo no corte", () => {
    for (const encerramento of [{ saidaEm: "2026-01-20" }, { fim: "2026-01-20" }]) {
      const resultado = calcularEsperaAcompanhamento([ciclo({ ...encerramento, servicos: [] })], filtros());
      expect(resultado.coorte[0]).toMatchObject({ esperaObservadaAte: "2026-01-20", diasEsperaObservada: 10, diasAguardandoServico: null });
      expect(resultado.filaAtual).toHaveLength(0);
    }
  });

  it("decisão registrada depois da aptaDesde não libera retrospectivamente o candidato anterior", () => {
    const decisao = { id: "liberacao", data: data("2026-01-20"), tipo: "LIBERAR", aptaDesde: data("2026-01-10"), status: "VALIDO", criadoEm: data("2026-01-20") };
    const c = ciclo({ candidatosLiberacao: ["2026-01-10", "2026-01-20"].map(d => ({ data: d, contexto: contexto({ decisoes: [decisao] }) })) });
    expect(primeiraLiberacaoValidaIndicador(c, "2026-01-30").primeira?.data).toBe("2026-01-20");
  });

  it("coorte de janeiro e fila atual são independentes e a saída permanece na coorte", () => {
    const saiu = ciclo({ saidaEm: "2026-01-20", servicos: [], localCorte: { propriedadeId: 2 } });
    const antigo = ciclo({ id: "ciclo-anterior", inicio: "2025-12-01", servicos: [], candidatosLiberacao: ["2026-01-10", "2026-02-10"].map(d => ({data:d,contexto:contexto()})) });
    const resultado = calcularEsperaAcompanhamento([saiu, antigo], filtros());
    expect(resultado.coorte.map(c => c.cicloId)).toEqual(["vinculo"]);
    expect(resultado.resumoCoorte).toMatchObject({ ciclos: 1, saidas: 1, semServico: 1 });
    expect(resultado.filaAtual.map(c => c.cicloId)).toEqual(["ciclo-anterior"]);
  });

  it("fila contém liberadas sem serviço; ausência de liberação e restrição atual ficam separadas", () => {
    const semLiberacao = ciclo({ id:"sem-liberacao",servicos:[],candidatosLiberacao:[] });
    const restrita = ciclo({ id:"restrita",servicos:[],candidatosLiberacao:[
      {data:"2026-01-10",contexto:contexto()},
      {data:"2026-02-10",contexto:contexto({restricoes:[{id:"bloqueio",data:data("2026-02-01"),ate:null,status:"VALIDO"}]})},
    ] });
    const resultado = calcularEsperaAcompanhamento([semLiberacao,restrita],filtros());
    expect(resultado.filaAtual).toHaveLength(0);
    expect(resultado.pendenciasFila.map(p=>p.motivo)).toEqual(["LIBERACAO_NAO_COMPROVADA","RESTRICAO_NO_CORTE"]);
    expect(resultado.pendenciasFila[1].linha.primeiraLiberacao?.data).toBe("2026-01-10");
  });

  it("sítio da coorte não é substituído pelo sítio atual ou pelo sítio do serviço", () => {
    const c = ciclo({ localCorte: { propriedadeId: 2 }, servicos: [{ id: "ia", data: "2026-01-30", tipo: "IA", valido: true, propriedadeId: 2 }] });
    const resultado = calcularEsperaAcompanhamento([c], filtros());
    expect(resultado.coorte).toHaveLength(1);
    expect(resultado.coorte[0].primeiroServico?.propriedadeId).toBe(2);
  });

  it("restrição, papel desconhecido ou contexto de outro ciclo não comprovam liberação", () => {
    for (const patch of [{ papel: null }, { situacaoReprodutiva: "AGUARDANDO_DIAGNOSTICO" }, { vinculo: null }]) {
      const c = ciclo({ candidatosLiberacao: [{ data: "2026-01-10", contexto: contexto(patch) }] });
      expect(primeiraLiberacaoValidaIndicador(c, "2026-01-30").primeira).toBeNull();
    }
    const outro = ciclo({ chaveCiclo: "PARTO:outro" });
    expect(primeiraLiberacaoValidaIndicador(outro, "2026-01-30").primeira).toBeNull();
  });

  it("liberação e serviço na mesma data podem produzir zero comprovado sem hora inventada", () => {
    const c = ciclo({ servicos: [{ id: "ia", data: "2026-01-10", tipo: "IA", valido: true, propriedadeId: 1 }] });
    expect(calcularEsperaAcompanhamento([c], filtros()).coorte[0].diasLiberacaoServico).toBe(0);
  });

  it("repetições usam serviços válidos selecionados no ciclo e desconhecido no filtro fica pendente", () => {
    const c = ciclo(); c.servicos.push({ id: "te", data: "2026-02-02", tipo: "TE", valido: true, propriedadeId: 1 }, { id: "anulada", data: "2026-02-03", tipo: "IA", valido: false, propriedadeId: 1 });
    expect(calcularEsperaAcompanhamento([c], filtros()).coorte[0]).toMatchObject({ tentativas: 2, repeticoes: 1 });
    expect(calcularEsperaAcompanhamento([c], filtros({ tiposTentativa: ["IA"] })).coorte[0].repeticoes).toBe(0);
    const desconhecido = ciclo({ localInicio: { propriedadeId: null } });
    const resultado = calcularEsperaAcompanhamento([desconhecido], filtros());
    expect(resultado.coorte).toHaveLength(0); expect(resultado.pendenciasEscopo).toContainEqual({ cicloId: "vinculo", populacao: "COORTE" });
  });

  it("join repetido de serviço não cria tentativa nem repetição adicional", () => {
    const c = ciclo(); c.servicos.push(structuredClone(c.servicos[0]));
    expect(calcularEsperaAcompanhamento([c], filtros()).coorte[0]).toMatchObject({ tentativas: 1, repeticoes: 0 });
  });
});

describe("perdas com janela explícita e seguimento demonstrável", () => {
  const perda = () => gestacao({ id: "perda", encerramento: { tipo: "PERDA", data: "2026-01-15", fatoId: "perda-registrada", explicacao: "Observação clínica registrada; causa não identificada" }, evidencias: [] });
  it("uma perda, uma acompanhada e uma incompleta produzem1/2, nunca1/3", () => {
    const resultado = calcularPerdasAcompanhamento([perda(), gestacao(), gestacao({ id: "incompleta", evidencias: [], coberturaSeguimento: [] })], filtros({ janelaPerdaDias: 30 }));
    expect(resultado).toMatchObject({ numerador: 1, denominador: 2, percentual: 50, contagens: { gestacoes: 3, perdasAteCorte: 1, incompletos: 1 } });
  });

  it("sem duração escolhida há contagens e nenhum percentual ou denominador implícito", () => {
    expect(calcularPerdasAcompanhamento([perda(), gestacao()], filtros())).toMatchObject({ janelaDias: null, numerador: null, denominador: null, percentual: null, contagens: { gestacoes: 2, perdasAteCorte: 1 } });
  });

  it("gestação aberta ou exame de outra gestação não comprovam seguimento", () => {
    const semProva = gestacao({ id: "sem-prova", evidencias: [] });
    const outra = gestacao({ id: "sem-vinculo", evidencias: [{ id: "dg", gestacaoId: "outra", data: "2026-02-02", tipo: "DG_POSITIVO", valida: true }] });
    const resultado = calcularPerdasAcompanhamento([semProva, outra], filtros({ janelaPerdaDias: 30 }));
    expect(resultado).toMatchObject({ denominador: 0, percentual: null, contagens: { incompletos: 2 } });
  });

  it("exame tardio sem continuidade comprovada não transforma hiato em sucesso", () => {
    const comHiato = gestacao({ coberturaSeguimento: [{ desde: "2026-01-02", ate: "2026-01-15", evidenciaIds: ["a"] }, { desde: "2026-01-17", ate: "2026-02-01", evidenciaIds: ["b"] }] });
    const linha = calcularPerdasAcompanhamento([comHiato], filtros({ janelaPerdaDias: 30 })).coorte[0];
    expect(linha.estado).toBe("INCOMPLETO"); expect(linha.motivos).toContain("CONTINUIDADE_DE_SEGUIMENTO_NAO_COMPROVADA");
    comHiato.coberturaSeguimento[1].desde = "2026-01-16";
    expect(calcularPerdasAcompanhamento([comHiato], filtros({ janelaPerdaDias: 30 })).denominador).toBe(1);
  });

  it("parto terminal antes do fim da janela e janela imatura permanecem separados", () => {
    const terminal = gestacao({ encerramento: { tipo: "PARTO", data: "2026-01-20", fatoId: "parto" }, evidencias: [] });
    const imatura = gestacao({ id: "imatura", confirmadaEm: "2026-01-31", primeiroDgPositivo: { id: "dg", data: "2026-01-31", local } });
    const resultado = calcularPerdasAcompanhamento([terminal, imatura], filtros({ janelaPerdaDias: 30 }));
    expect(resultado.denominador).toBe(0);
    expect(resultado.coorte[0].motivos).toContain("DESFECHO_TERMINAL_ANTES_DO_FIM_DA_JANELA");
    expect(resultado.coorte[1].motivos).toContain("JANELA_AINDA_NAO_COMPLETADA");
  });

  it("palavras no motivo não inferem perda; causa desconhecida com explicação é aceita", () => {
    const ambiguo = gestacao({ encerramento: { tipo: "NAO_IDENTIFICADO", data: "2026-01-15", fatoId: "legado", explicacao: "Texto legado menciona perda" } });
    const resultado = calcularPerdasAcompanhamento([ambiguo, perda()], filtros({ janelaPerdaDias: 30 }));
    expect(resultado.contagens.perdasAteCorte).toBe(1); expect(resultado.numerador).toBe(1);
    const semExplicacao = perda(); semExplicacao.encerramento!.explicacao = " ";
    const historica=calcularPerdasAcompanhamento([semExplicacao],filtros({janelaPerdaDias:30}));
    expect(historica.denominador).toBe(1);expect(historica.numerador).toBe(1);expect(historica.coorte[0].lacunas).toContain("EXPLICACAO_HISTORICA_PERDA_AUSENTE");
  });

  it("primeiroDG ausente não é suprido por reconfirmação e entra como pendência, não denominador", () => {
    const resultado = calcularPerdasAcompanhamento([gestacao({ primeiroDgPositivo: null })], filtros({ janelaPerdaDias: 30 }));
    expect(resultado).toMatchObject({ denominador: 0, percentual: null, contagens: { semPrimeiroDg: 1, incompletos: 1 } });
  });
});

describe("IEP por parto qualificante e integridade do relatório", () => {
  it("principal liga vivo/natimorto com anterior fora do período e destaca aborto intermediário", () => {
    const partos = [parto("anterior", "2025-01-01"), parto("aborto", "2026-01-10", "ABORTO"), parto("atual", "2026-01-15", "NATIMORTO")];
    const resultado = calcularIepAcompanhamento(partos, filtros());
    expect(resultado.pares).toEqual([{ animalId: "animal", anteriorId: "anterior", atualId: "atual", anteriorEm: "2025-01-01", atualEm: "2026-01-15", dias: 379,abortosIntermediarios:[{id:"aborto",data:"2026-01-10"}] }]);
    expect(resultado.abortos.map(p => p.id)).toEqual(["aborto"]);
    const alternativa = calcularIepAcompanhamento(partos, filtros({ iepModo: "TODOS_PARTOS" }));
    expect(alternativa.pares.map(p => p.dias)).toEqual([374, 5]);
  });

  it("parto intermediário com desfecho desconhecido impede inventar o par principal", () => {
    const resultado = calcularIepAcompanhamento([parto("anterior", "2025-01-01"), parto("incerto", "2026-01-10", "DESCONHECIDO"), parto("atual", "2026-01-15")], filtros());
    expect(resultado.pares).toHaveLength(0);
    expect(resultado.pendencias).toContainEqual({ partoId: "atual", motivo: "PARTO_INTERMEDIARIO_DESCONHECIDO" });
  });

  it("sem anterior ou com fatos distintos no mesmo dia não produz IEP zero", () => {
    expect(calcularIepAcompanhamento([parto("primeiro", "2026-01-15")], filtros())).toMatchObject({ semAnterior: ["primeiro"], mediaDias: null });
    const conflitantes = calcularIepAcompanhamento([parto("a", "2026-01-15"), parto("b", "2026-01-15")], filtros());
    expect(conflitantes.pares).toHaveLength(0); expect(conflitantes.pendencias).toHaveLength(2);
  });

  it("gêmeos ou joins que repetem o mesmo parto não multiplicam o evento nem seu IEP", () => {
    const atual = parto("atual", "2026-01-15");
    const resultado = calcularIepAcompanhamento([parto("anterior", "2025-01-01"), atual, structuredClone(atual)], filtros());
    expect(resultado.pares).toHaveLength(1); expect(resultado.mediaDias).toBe(379);
    expect(() => calcularIepAcompanhamento([atual, { ...atual, data: "2026-01-16" }], filtros())).toThrow(/divergentes/);
  });

  it("envelopeV2 é aditivo, não modifica fatos de entrada e não inventa taxas", () => {
    const dados = { ciclos: [ciclo()], gestacoes: [gestacao()], partos: [parto("p", "2026-01-15")] };
    const antes = structuredClone(dados);
    const resultado = calcularAcompanhamentoIndicadores(dados, filtros());
    expect(resultado.versao).toBe(2); expect(resultado).not.toHaveProperty("taxas");
    expect(dados).toEqual(antes);
  });

  it.each([0, -1, 1.5, Number.NaN])("janela inválida%s é recusada em vez de virar padrão clínico", janelaPerdaDias => {
    expect(() => calcularPerdasAcompanhamento([], filtros({ janelaPerdaDias }))).toThrow();
  });
});

describe("tentativas por concepção, acumuladas no ciclo", () => {
  const concepcao = (alteracoes: Partial<ConcepcaoAcompanhamentoIndicador> = {}): ConcepcaoAcompanhamentoIndicador => ({ id:"gestacao",animalId:"animal",tentativaId:"ia",confirmadaEm:"2026-02-05",valida:true,evidenciaIds:["gestacao-confirmada"],localConfirmacao:local,...alteracoes });
  it("usa data do serviço no período e confirmação até corte, incluindo tentativas anteriores fora do período", () => {
    const c=ciclo({inicio:"2025-12-01"});c.servicos.unshift({id:"anterior",data:"2025-12-10",tipo:"IA",valido:true,propriedadeId:1});
    const resultado=calcularTentativasPorConcepcao([c],[concepcao()],filtros());
    expect(resultado.linhas[0]).toMatchObject({servicoEm:"2026-01-30",confirmadaEm:"2026-02-05",numeroTentativas:2,tentativaIds:["anterior","ia"]});
    expect(resultado.referenciaPeriodo).toBe("SERVICO_CONCEPTIVO");
  });
  it("segunda concepção depois de perda acumula4tentativas no mesmo ciclo, sem reiniciar na perda", () => {
    const c=ciclo();c.servicos=["2026-01-05","2026-01-10","2026-01-20","2026-01-25"].map((d,i)=>({id:`t${i+1}`,data:d,tipo:"IA",valido:true,propriedadeId:1}));
    const resultado=calcularTentativasPorConcepcao([c],[concepcao({id:"g1",tentativaId:"t2",confirmadaEm:"2026-01-15"}),concepcao({id:"g2",tentativaId:"t4"})],filtros());
    expect(resultado.linhas.map(l=>l.numeroTentativas)).toEqual([2,4]);expect(resultado.mediaTentativas).toBe(3);
    expect(resultado.contagem).toBe("ACUMULADA_NO_CICLO_SEM_REINICIAR_NA_PERDA");
  });
  it("reconfirmação da mesma gestação não cria outra concepção", () => {
    const g=concepcao();const resultado=calcularTentativasPorConcepcao([ciclo()],[g,structuredClone(g)],filtros());
    expect(resultado.concepcoes).toBe(1);expect(resultado.mediaTentativas).toBe(1);
  });
  it("concepção sem tentativa é pendência referenciada pela confirmação, sem inventar data do serviço", () => {
    const resultado=calcularTentativasPorConcepcao([], [concepcao({tentativaId:null,confirmadaEm:"2026-01-15"})],filtros());
    expect(resultado.linhas).toHaveLength(0);expect(resultado.mediaTentativas).toBeNull();
    expect(resultado.pendencias).toContainEqual({concepcaoId:"gestacao",referencia:"CONFIRMACAO",data:"2026-01-15",motivo:"CONCEPCAO_SEM_TENTATIVA_COMPROVADA"});
  });
  it("ordem intradiária ausente fica pendente; ordem factual explícita permite conferir a contagem", () => {
    const c=ciclo();c.servicos.push({...c.servicos[0],id:"segunda"});
    const g=concepcao({tentativaId:"segunda"});
    expect(calcularTentativasPorConcepcao([c],[g],filtros()).linhas[0]).toMatchObject({numeroTentativas:null,pendencias:["ORDEM_INTRADIARIA_NAO_COMPROVADA"]});
    c.servicos[0].ordem=1;c.servicos[1].ordem=2;
    expect(calcularTentativasPorConcepcao([c],[g],filtros()).linhas[0].numeroTentativas).toBe(2);
  });
  it("ausência de prova ou resultado posterior ao corte não compõe o cálculo", () => {
    const resultado=calcularTentativasPorConcepcao([ciclo()],[concepcao({evidenciaIds:[]}),concepcao({id:"futura",confirmadaEm:"2026-03-01"})],filtros());
    expect(resultado.concepcoes).toBe(0);expect(resultado.pendencias[0].motivo).toBe("CONCEPCAO_SEM_PROVA_CRONOLOGICA");
  });
});
