import { describe, expect, it } from "vitest";
import { calcularElegibilidadeNaData, calcularElegibilidadesDoConjunto, type DadosElegibilidade, type EntradaElegibilidade } from "./elegibilidade.calc.js";
import { parametrosElegibilidadeSchema, decidirElegibilidadeCicloSchema } from "./elegibilidade.schemas.js";

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const parametros = () => parametrosElegibilidadeSchema.parse({ versao: 1, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 40,
  pevMultiparasDias: 60, aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "EXCLUIR",
  perdaGestacional: "EXIGE_LIBERACAO", papeisIncluidos: ["NENHUM", "RECEPTORA"] });
function entrada(patch: Partial<EntradaElegibilidade> = {}): EntradaElegibilidade {
  return { animalId: "animal", propriedadeId: 1, referencia: dia("2026-03-01"), sexo: "F", propriedadeNaData: 1,
    localizacaoConflitante: false, baixaEm: null, ciclo: { chaveCiclo: "PARTO:parto", inicioCiclo: dia("2026-01-20"), partoId: "parto", aborto: false, paridade: 1, aptaDesdeInicial: null },
    vinculo: { id: "vinculo", politicaId: "politica", chaveCiclo: "PARTO:parto" }, politica: { id: "politica", versao: 1, parametros: parametros() },
    decisoes: [], papel: "NENHUM", papelConflitante: false, descarte: false, restricoes: [], situacaoReprodutiva: "VAZIA", perdaGestacionalEm: null, ...patch };
}
const decisao = (tipo: string, data = "2026-02-15", aptaDesde: string | null = null) => ({ id: tipo, tipo, data: dia(data), aptaDesde: aptaDesde ? dia(aptaDesde) : null, status: "VALIDO", criadoEm: dia(data) });

describe("elegibilidade temporal e política por ciclo", () => {
  it("considera D0 no parto e libera exatamente no limite configurado", () => {
    expect(calcularElegibilidadeNaData(entrada({ referencia: dia("2026-02-28") }))).toMatchObject({ elegivel: false, aptaDesde: "2026-03-01" });
    expect(calcularElegibilidadeNaData(entrada())).toMatchObject({ elegivel: true, politicaVersao: 1 });
  });
  it("usa PEV de multípara sem substituir a política congelada por outra", () => {
    const v = entrada(); v.ciclo!.paridade = 2;
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: false, aptaDesde: "2026-03-21" });
    expect(calcularElegibilidadeNaData({ ...v, politica: { ...v.politica!, id: "nova", versao: 2 } }).motivos).toContain("POLITICA_AUSENTE_NO_INICIO_CICLO");
  });
  it("histórico sem vínculo ou política é pendente; não adota configuração retroativa", () => {
    expect(calcularElegibilidadeNaData(entrada({ vinculo: null }))).toMatchObject({ estado: "PENDENTE", baseElegivel: null });
    expect(calcularElegibilidadeNaData(entrada({ vinculo: { id: "v", chaveCiclo: "PARTO:parto", politicaId: null } }))).toMatchObject({ estado: "PENDENTE", politicaId: null });
  });
  it("bloqueio explícito prevalece mesmo sem política e política inválida conserva sua identidade", () => {
    const v = entrada({ politica: null, decisoes: [decisao("BLOQUEAR")] });
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ estado: "NAO_ELEGIVEL", elegivel: false });
    const invalida = calcularElegibilidadeNaData({ ...v, decisoes: [], politicaInvalida: { id: "politica", versao: 3 } });
    expect(invalida).toMatchObject({ estado: "PENDENTE", politicaId: "politica", politicaVersao: 3 });
    expect(invalida.motivos).toContain("POLITICA_INVALIDA");
  });
  it("liberação explícita pode resolver ausência congelada sem inventar política", () => {
    const r = calcularElegibilidadeNaData(entrada({ vinculo: { id: "v", chaveCiclo: "PARTO:parto", politicaId: null }, politica: null, decisoes: [decisao("LIBERAR", "2026-02-20", "2026-02-20")] }));
    expect(r).toMatchObject({ elegivel: true, politicaId: null, aptaDesde: "2026-02-20" });
    expect(r.alertas).toContain("LIBERACAO_INDIVIDUAL_SEM_POLITICA");
  });
  it("novilha exige liberação registrada e não usa PEV contado da entrada", () => {
    const v = entrada(); v.ciclo = { chaveCiclo: "INICIAL", inicioCiclo: dia("2026-01-01"), partoId: null, aborto: false, paridade: null, aptaDesdeInicial: null };
    v.vinculo!.chaveCiclo = "INICIAL";
    expect(calcularElegibilidadeNaData(v).motivos).toContain("LIBERACAO_EXPLICITA_NECESSARIA");
    v.ciclo.aptaDesdeInicial = dia("2026-02-01");
    expect(calcularElegibilidadeNaData(v).elegivel).toBe(true);
  });
  it("aborto exige escolha própria e não herda PEV de nascimento", () => {
    const v = entrada(); v.ciclo!.aborto = true;
    expect(calcularElegibilidadeNaData(v).estado).toBe("PENDENTE");
    v.politica!.parametros = { ...parametros(), aborto: "PEV_CONFIGURADO", pevAposAbortoDias: 5 };
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: true, aptaDesde: "2026-01-25" });
  });
  it("decisões futuras ou anuladas não alteram passado e retomar conserva bloqueio anterior no histórico", () => {
    const v = entrada({ decisoes: [decisao("BLOQUEAR"), decisao("RETOMAR_POLITICA", "2026-03-02")] });
    expect(calcularElegibilidadeNaData(v).elegivel).toBe(false);
    expect(calcularElegibilidadeNaData({ ...v, referencia: dia("2026-03-02") }).elegivel).toBe(true);
    expect(calcularElegibilidadeNaData({ ...v, decisoes: [{ ...decisao("BLOQUEAR"), status: "ANULADO" }] }).elegivel).toBe(true);
  });
  it("liberação individual não ignora gestação, descarte ou sítio", () => {
    const v = entrada({ decisoes: [decisao("LIBERAR", "2026-02-20", "2026-02-20")] });
    for (const patch of [{ situacaoReprodutiva: "GESTANTE" }, { descarte: true }, { propriedadeNaData: 2 }])
      expect(calcularElegibilidadeNaData({ ...v, ...patch }).elegivel).toBe(false);
  });
  it("restrição respeita fim exclusivo, política de alertas e baixa", () => {
    const v = entrada({ restricoes: [{ id: "r", data: dia("2026-02-01"), ate: dia("2026-03-01"), status: "VALIDO" }] });
    expect(calcularElegibilidadeNaData(v).elegivel).toBe(true);
    v.restricoes = [{ ...v.restricoes[0], ate: null }];
    expect(calcularElegibilidadeNaData(v).elegivel).toBe(false);
    v.politica!.parametros.restricoes = "APENAS_ALERTAR";
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: true, alertas: ["RESTRICAO_REPRODUTIVA"] });
    expect(calcularElegibilidadeNaData({ ...v, baixaEm: dia("2026-03-01") }).elegivel).toBe(false);
  });
  it("não torna diagnóstico pendente negativo e conserva base para eventual estimativa explícita", () => {
    expect(calcularElegibilidadeNaData(entrada({ situacaoReprodutiva: "AGUARDANDO_DIAGNOSTICO" }))).toMatchObject({ baseElegivel: true, elegivel: null, estado: "PENDENTE" });
  });
  it("perda requer liberação posterior, conforme configuração", () => {
    const v = entrada({ perdaGestacionalEm: dia("2026-02-25"), decisoes: [decisao("LIBERAR", "2026-02-20", "2026-02-20")] });
    expect(calcularElegibilidadeNaData(v).motivos).toContain("PERDA_AGUARDA_LIBERACAO");
    expect(calcularElegibilidadeNaData({ ...v, decisoes: [decisao("LIBERAR", "2026-02-26", "2026-02-26")] }).elegivel).toBe(true);
  });
  it("papel e localização desconhecidos não recebem inclusão presumida", () => {
    expect(calcularElegibilidadeNaData(entrada({ papel: null })).estado).toBe("PENDENTE");
    expect(calcularElegibilidadeNaData(entrada({ localizacaoConflitante: true })).estado).toBe("PENDENTE");
  });
});

function conjunto(): DadosElegibilidade {
  return { animais: [{ id: "animal", sexo: "F", dataEntrada: dia("2025-01-01"), partosAntesDaEntrada: 0 }],
    partos: [{ id: "parto", animalId: "animal", propriedadeId: 1, data: dia("2026-01-20"), status: "VALIDO", tipo: "NORMAL", desfecho: "NASCIMENTO", incluidoSaldoAnterior: false, gestacaoId: "g" }],
    tentativas: [], lactacoes: [], avaliacoes: [], iniciais: [],
    gestacoes: [{ id: "g", animalId: "animal", propriedadeId: 1, tentativaId: null, confirmadaEm: dia("2025-06-01"), encerradaEm: dia("2026-01-20"), motivoEncerramento: "PARTO_NORMAL", status: "VALIDO" }],
    localizacoes: [{ id: "l", animalId: "animal", propriedadeId: 1, loteId: null, desde: dia("2025-01-01"), ate: null }],
    vinculos: [{ id: "v", animalId: "animal", chaveCiclo: "PARTO:parto", inicioCiclo: dia("2026-01-20"), politicaId: "politica" }],
    politicas: [{ id: "politica", versao: 1, parametros: parametros() }], decisoes: [], restricoes: [],
    papeis: [{ id: "p", animalId: "animal", tipo: "NENHUM", inicio: dia("2025-01-01"), fim: null }], baixas: [] };
}
describe("avaliação em várias datas com o mesmo conjunto", () => {
  it("parto encerra gestação e inicia ciclo sem ser interpretado como perda", () => {
    const dados = conjunto();
    expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")).toMatchObject({ elegivel: true });
    expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-02-28")).get("animal")).toMatchObject({ elegivel: false });
    dados.partos[0].gestacaoId = null;
    expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")?.motivos).not.toContain("PERDA_AGUARDA_LIBERACAO");
  });
  it("configuração futura não substitui o vínculo do ciclo e ausência continua congelada", () => {
    const dados = conjunto(); dados.politicas.push({ id: "p2", versao: 2, parametros: { ...parametros(), pevPrimiparasDias: 200 } });
    expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")).toMatchObject({ elegivel: true, politicaVersao: 1 });
    dados.vinculos[0].politicaId = null;
    expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")).toMatchObject({ politicaId: null, estado: "PENDENTE" });
  });
  it("origem inicial anulada e encerramento desvinculado geram pendência", () => {
    const dados = conjunto(); dados.partos = [];
    dados.vinculos[0] = { ...dados.vinculos[0], chaveCiclo: "INICIAL", situacaoInicialId: "inicial-anulada" };
    const r = calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")!;
    expect(r.estado).toBe("PENDENTE");
    expect(r.motivos).toContain("ORIGEM_INICIAL_ANULADA");
    const outro = conjunto(); outro.partos[0].gestacaoId = null; outro.gestacoes[0].motivoEncerramento = "PARTO_DESVINCULADO: correção";
    expect(calcularElegibilidadesDoConjunto(outro, 1, dia("2026-03-01")).get("animal")?.motivos).toContain("ENCERRAMENTO_GESTACAO_DESCONHECIDO");
  });
});

describe("contratos sem defaults clínicos", () => {
  it("recusa parâmetros ausentes e aborto ambíguo", () => {
    expect(parametrosElegibilidadeSchema.safeParse({}).success).toBe(false);
    expect(parametrosElegibilidadeSchema.safeParse({ ...parametros(), aborto: "PEV_CONFIGURADO" }).success).toBe(false);
  });
  it("recusa liberação retroativa em aptaDesde e valores em bloqueio", () => {
    const v = { chave: "10000000-0000-4000-8000-000000000001", vinculoCicloId: "10000000-0000-4000-8000-000000000002", propriedadeId: 1, data: "2026-03-01", tipo: "LIBERAR", aptaDesde: "2026-02-28", motivo: "Liberação revisada" };
    expect(decidirElegibilidadeCicloSchema.safeParse(v).success).toBe(false);
    expect(decidirElegibilidadeCicloSchema.safeParse({ ...v, tipo: "BLOQUEAR", aptaDesde: null }).success).toBe(true);
  });
});

describe("política v2 de avaliação e aptidão explícitas", () => {
  const grupo = { idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ["MEDIDO"] as ("MEDIDO")[], escalaEcc: null, validadeEccDias: null };
  function v2() {
    const v = entrada();
    v.politica!.parametros = parametrosElegibilidadeSchema.parse({ ...parametros(), versao: 2, criteriosAptidao: { vacas: grupo, novilhas: grupo, diasAvaliacaoPosParto: 30 } });
    return v;
  }
  it("critérios e PEV atingidos nunca liberam automaticamente", () => {
    expect(calcularElegibilidadeNaData(v2())).toMatchObject({ estado: "PENDENTE", elegivel: null, aptidaoClinica: { estado: "NAO_DETERMINADA" }, necessidadeAptidao: { estado: "AVALIACAO_DEVIDA" } });
  });
  it("antecipação conserva PEV original e decisão depende do exame preservado", () => {
    const v = v2(); v.referencia = dia("2026-02-15");
    const exame = { id: "e", animalId: "animal", propriedadeId: 1, data: dia("2026-02-10"), atualizadoEm: dia("2026-02-10"), status: "VALIDO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", resultadoOpcao: "APTO", retornoEm: null };
    v.toques = [exame];
    v.decisoes = [{ ...decisao("LIBERAR", "2026-02-11", "2026-02-11"), exameAptidaoId: "e", exameAptidaoSnapshot: { id: "e", data: "2026-02-10", atualizadoEm: exame.atualizadoEm.toISOString(), resultado: "APTO" } }];
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: true, aptaDesde: "2026-02-11", pevOriginalAte: "2026-03-01", aptidaoClinica: { estado: "APTA" } });
    v.toques = [{ ...exame, resultadoOpcao: "NAO_APTO", atualizadoEm: dia("2026-02-12") }];
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: false, revisaoDecisaoNecessaria: true, aptaDesde: "2026-03-01", aptidaoClinica: { estado: "NAO_APTA" } });
    expect(calcularElegibilidadeNaData(v).motivos).toContain("EXAME_ALTERADO_REVISAR_DECISAO");
  });
  it("resultado não apto posterior exige revisão da decisão anterior", () => {
    const v = v2(); const exame = { id: "e", animalId: "animal", propriedadeId: 1, data: dia("2026-02-10"), atualizadoEm: dia("2026-02-10"), status: "VALIDO", finalidadePrincipal: "APTIDAO_REPRODUTIVA", resultadoOpcao: "APTO", retornoEm: null };
    v.toques = [exame, { ...exame, id: "novo", data: dia("2026-02-20"), resultadoOpcao: "NAO_APTO" }];
    v.decisoes = [{ ...decisao("LIBERAR", "2026-02-11", "2026-02-11"), exameAptidaoId: "e", exameAptidaoSnapshot: { id: "e", data: "2026-02-10", atualizadoEm: exame.atualizadoEm.toISOString(), resultado: "APTO" } }];
    expect(calcularElegibilidadeNaData(v)).toMatchObject({ elegivel: null, revisaoDecisaoNecessaria: true });
  });
});

it("saldo de partos positivo identifica vaca e não usa critérios de novilha quando falta a data do parto", () => {
  const dados = conjunto();
  dados.animais[0] = { ...dados.animais[0], partosAntesDaEntrada: 3, dataNascimento: dia("2020-01-01") };
  dados.partos = []; dados.gestacoes = [];
  dados.iniciais = [{ id: "inicial", animalId: "animal", data: dia("2026-01-01"), criadoEm: dia("2026-01-01"), situacao: "VAZIA", status: "VALIDO", aptaDesde: null }];
  dados.vinculos[0] = { ...dados.vinculos[0], chaveCiclo: "INICIAL", situacaoInicialId: "inicial" };
  const grupo = { idadeMinimaMeses: null, percentualPesoAdulto: null, pesoMinimoKg: null, eccMinimo: null, pesoAdultoReferenciaKg: null, validadePesoDias: null, precisaoPesoAceita: ["MEDIDO"], escalaEcc: null, validadeEccDias: null };
  dados.politicas[0].parametros = { ...parametros(), versao: 2, criteriosAptidao: { vacas: grupo, novilhas: { ...grupo, idadeMinimaMeses: 15 }, diasAvaliacaoPosParto: 45 } };
  expect(calcularElegibilidadesDoConjunto(dados, 1, dia("2026-03-01")).get("animal")?.necessidadeAptidao)
    .toMatchObject({ estado: "PENDENCIA_DADOS", pendencias: ["DATA_PARTO_NAO_COMPROVADA"], criteriosNaoAtingidos: [] });
});
