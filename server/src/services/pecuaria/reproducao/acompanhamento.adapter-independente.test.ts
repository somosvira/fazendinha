import { describe, expect, it } from "vitest";
import { construirDadosAcompanhamento, calcularAcompanhamentoDoConjunto } from "./acompanhamento-indicadores.js";
import { consultaIndicadoresSchema } from "./indicadores.schemas.js";
import type { DadosIndicadores } from "./indicadores.calc.js";
const dia = (s: string) => new Date(`${s}T00:00:00Z`);
const filtros = (p: Record<string, unknown> = {}) => consultaIndicadoresSchema.parse({ propriedadeId: 7, inicio: "2026-01-01", fim: "2026-01-31", corte: "2026-03-01", janelaPerdaDias: 30, ...p });
function dados(): DadosIndicadores {
  return { identificacoes: [{ id: "a", brinco: "7", nome: null }], evidencias: [], elegibilidade: {
    animais: [{ id: "a", sexo: "F", dataEntrada: dia("2025-01-01"), partosAntesDaEntrada: 0 }], partos: [], tentativas: [], lactacoes: [], gestacoes: [],
    localizacoes: [{ id: "l", animalId: "a", propriedadeId: 7, loteId: "lote-primeiro", desde: dia("2025-01-01"), ate: null }], avaliacoes: [], iniciais: [], vinculos: [], politicas: [], decisoes: [], restricoes: [], papeis: [{ id: "p", animalId: "a", tipo: "NENHUM", inicio: dia("2025-01-01"), fim: null }], baixas: [] } };
}
function gestacao(d: DadosIndicadores, tipo: "PERDA" | "ABORTO" | "NATIMORTO" | "NASCIMENTO", encerramento = "2026-01-31") {
  d.elegibilidade.gestacoes.push({ id: "g", animalId: "a", propriedadeId: 7, tentativaId: null, confirmadaEm: dia("2026-01-01"), encerradaEm: dia(encerramento), status: "VALIDO", tipoEncerramento: tipo === "PERDA" ? "PERDA" : "PARTO", motivoEncerramento: tipo === "PERDA" ? "Observação clínica registrada" : `PARTO_${tipo}` });
  d.evidencias.push({ id: "primeiro-dg", animalId: "a", tentativaId: null, gestacaoId: "g", data: dia("2026-01-01"), resultado: "POSITIVO", status: "VALIDO", fonte: "EXAME_INTERPRETADO" });
  if (tipo !== "PERDA") d.elegibilidade.partos.push({ id: "parto", animalId: "a", propriedadeId: 7, data: dia(encerramento), tipo, desfecho: tipo === "ABORTO" ? "ABORTO" : "NASCIMENTO", status: "VALIDO", incluidoSaldoAnterior: false, gestacaoId: "g", observacao: null, crias: tipo === "NASCIMENTO" ? [{ viva: false }, { viva: true }] : tipo === "NATIMORTO" ? [{ viva: false }] : [] });
}
describe("adapter dos indicadores — contraprovas independentes com fatos reais", () => {
  it("animal sem início comprovado permanece como pendência sem ciclo fictício", () => {
    const r = calcularAcompanhamentoDoConjunto(dados(), filtros());
    expect(r.espera.coorte).toEqual([]); expect(r.espera.filaAtual).toEqual([]);
    expect(r.pendenciasOrigemCiclo).toContainEqual({ animalId: "a", motivo: "INICIO_CICLO_NAO_COMPROVADO", local: { propriedadeId: 7, loteId: "lote-primeiro", papel: "NENHUM" } });
  });
  it.each([{ tipo: "PERDA" as const, registrada: 1, aborto: 0 }, { tipo: "ABORTO" as const, registrada: 0, aborto: 1 }, { tipo: "NATIMORTO" as const, registrada: 0, aborto: 0 }])("$tipo tem composição factual própria sem duplicar gestação", ({ tipo, registrada, aborto }) => {
    const d = dados(); gestacao(d, tipo); const antes = structuredClone(d);
    const r = calcularAcompanhamentoDoConjunto(d, filtros());
    expect(r.perdas.contagens).toMatchObject({ gestacoes: 1, perdasRegistradas: registrada, abortos: aborto, perdasAteCorte: registrada + aborto });
    expect(r.perdas.composicaoNumerador).toEqual({ perdasRegistradas: registrada, abortos: aborto });
    expect(r.perdas.denominador).toBe(1); expect(d).toEqual(antes);
    if (tipo === "ABORTO") {
      expect(r.perdas.coorte[0].evidenciaIds).toEqual(["parto"]);
      expect(r.perdas.coorte[0].lacunas).toContain("EXPLICACAO_HISTORICA_ABORTO_AUSENTE");
    }
  });
  it("NASCIMENTO usa vida das crias: gêmeos com uma viva são um parto VIVO", () => {
    const d = dados(); gestacao(d, "NASCIMENTO");
    const r = construirDadosAcompanhamento(d, filtros()); expect(r.partos).toHaveLength(1); expect(r.partos[0].desfecho).toBe("VIVO");
    d.elegibilidade.partos[0].crias = [{ viva: false }, { viva: false }];
    expect(construirDadosAcompanhamento(d, filtros()).partos[0].desfecho).toBe("NATIMORTO");
    d.elegibilidade.partos[0].crias = [];
    expect(construirDadosAcompanhamento(d, filtros()).partos[0].desfecho).toBe("DESCONHECIDO");
  });
  it("confirmadaEm sem exame positivo não inventa primeiro DG ou denominador", () => {
    const d = dados(); gestacao(d, "PERDA"); d.evidencias = [];
    const r = calcularAcompanhamentoDoConjunto(d, filtros());
    expect(r.perdas.coorte[0].primeiroDgPositivo).toBeNull(); expect(r.perdas.denominador).toBe(0); expect(r.perdas.percentual).toBeNull();
    expect(r.perdas.coorte[0].motivos).toContain("PRIMEIRO_DG_POSITIVO_NAO_COMPROVADO"); expect(r.perdas.contagens.perdasRegistradas).toBe(1);
  });
  it("primeiro DG requer prova da mesma gestação válida e não usa exame anulado", () => {
    const d = dados(); gestacao(d, "PERDA");
    d.evidencias.unshift({ ...d.evidencias[0], id: "outra", gestacaoId: "outra", data: dia("2025-12-01") }, { ...d.evidencias[0], id: "anulado", status: "ANULADO", data: dia("2025-12-01") });
    expect(construirDadosAcompanhamento(d, filtros()).gestacoes[0].primeiroDgPositivo?.id).toBe("primeiro-dg");
  });
  it("transferência não substitui localização histórica do DG pela atual", () => {
    const d = dados(); gestacao(d, "PERDA"); d.elegibilidade.localizacoes[0].ate = dia("2026-01-15");
    d.elegibilidade.localizacoes.push({ id: "novo", animalId: "a", propriedadeId: 8, loteId: "lote-segundo", desde: dia("2026-01-15"), ate: null });
    const origem = calcularAcompanhamentoDoConjunto(d, filtros()); const destino = calcularAcompanhamentoDoConjunto(d, filtros({ propriedadeId: 8 }));
    expect(origem.perdas.contagens.gestacoes).toBe(1); expect(destino.perdas.contagens.gestacoes).toBe(0);
    expect(origem.perdas.coorte[0].primeiroDgPositivo?.local).toMatchObject({ propriedadeId: 7, loteId: "lote-primeiro" });
  });
  it("apenas localização não comprova seguimento sem outra evidência gestacional", () => {
    const d = dados(); gestacao(d, "NASCIMENTO", "2026-02-10"); d.elegibilidade.partos = []; d.elegibilidade.gestacoes[0].encerradaEm = null; d.elegibilidade.gestacoes[0].tipoEncerramento = null;
    const r = calcularAcompanhamentoDoConjunto(d, filtros());
    expect(r.perdas.denominador).toBe(0); expect(r.perdas.coorte[0].motivos).toContain("EVIDENCIA_DE_SEGUIMENTO_AUSENTE");
  });
  it("alerta sanitário configurado não aparece como bloqueio intermediário", () => {
    const d = dados(); gestacao(d, "NASCIMENTO");
    d.elegibilidade.vinculos.push({ id: "v", animalId: "a", chaveCiclo: "PARTO:parto", inicioCiclo: dia("2026-01-31"), politicaId: "pol" });
    d.elegibilidade.politicas.push({ id: "pol", versao: 1, parametros: { versao: 1, metodologia: "IDEAGRI_IILB_BASE_V1", pevPrimiparasDias: 0, pevMultiparasDias: 0, aborto: "LIBERACAO_EXPLICITA", pevAposAbortoDias: null, descarte: "EXCLUIR", restricoes: "APENAS_ALERTAR", perdaGestacional: "RETOMAR_CICLO", papeisIncluidos: ["NENHUM"] } });
    d.elegibilidade.restricoes.push({ id: "r", animalId: "a", tipo: "TEMPORARIA", status: "VALIDO", data: dia("2026-02-01"), ate: null });
    expect(construirDadosAcompanhamento(d, filtros()).ciclos[0].restricoes).toContainEqual({ id: "r", inicio: "2026-02-01", fim: null, efeito: "ALERTA" });
  });
});
