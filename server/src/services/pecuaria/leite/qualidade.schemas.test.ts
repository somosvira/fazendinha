import { describe, expect, it } from "vitest";
import { criarFormatoQualidadeSchema, registrarQualidadeSchema, corrigirQualidadeSchema, consultarQualidadeSchema } from "./qualidade.schemas.js";
import { validarObservacoesExame } from "../exames/formatos.js";
const id = "10000000-0000-4000-8000-000000000001";
const base = { chave: id, propriedadeId: 1, data: "2026-10-19", tipoExameId: id, formatoExameHash: "a".repeat(64) };
const campos = [{ codigo: "CAMPO_DO_LAUDO", tipo: "NUMERO" as const, unidade: "unidade informada", obrigatorio: true },
  { codigo: "OBSERVACAO", tipo: "TEXTO" as const }, { codigo: "PRESENCA", tipo: "BOOLEANO" as const }];
describe("qualidade do leite configurada a partir do laudo", () => {
  it("aceita campos/unidades manuais sem catálogo, thresholds ou diagnóstico presumidos", () => {
    const formato = criarFormatoQualidadeSchema.parse({ chave: id, nome: "Laudo da fazenda", campos });
    expect(formato.campos[0].unidade).toBe("unidade informada");
    expect(formato.campos[1].unidade).toBeUndefined();
    expect(validarObservacoesExame(formato.campos, [{ campo: "CAMPO_DO_LAUDO", valor: 0 }, { campo: "PRESENCA", valor: false }])).toEqual([
      { campo: "CAMPO_DO_LAUDO", valor: "0", unidade: "unidade informada" }, { campo: "PRESENCA", valor: false, unidade: null },
    ]);
  });
  it("coleta pendente não equivale a zero e sujeito coletivo não admite animal implícito", () => {
    expect(registrarQualidadeSchema.parse({ ...base, sujeito: { tipo: "COLETIVO", origem: "Tanque identificado no laudo" } }).resultados).toEqual([]);
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito: { tipo: "COLETIVO", origem: "Tanque", animalId: id } }).success).toBe(false);
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito: { tipo: "COLETIVO" } }).success).toBe(false);
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito: { tipo: "ANIMAL", animalId: id, entradaId: id } }).success).toBe(false);
  });
  it("não aceita retiradas/entidades inventadas nem unidade enviada para sobrescrever o formato", () => {
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito: { tipo: "COLETIVO", origem: "Laudo", retiradaId: id } }).success).toBe(false);
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito: { tipo: "ANIMAL", animalId: id }, resultados: [{ campo: "CAMPO_DO_LAUDO", valor: 1, unidade: "outra" }] }).success).toBe(false);
  });
  it("exige versão, motivo e resultado na correção, preservando anulação distinta", () => {
    const correcao = { chave: id, propriedadeId: 1, versaoEsperada: 1, motivo: "Laudo corrigido", resultados: [{ campo: "CAMPO_DO_LAUDO", valor: 0 }] };
    expect(corrigirQualidadeSchema.safeParse(correcao).success).toBe(true);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, motivo: "" }).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, resultados: [] }).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, anular: true }).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, anular: true, resultados: undefined }).success).toBe(true);
  });
  it("valida datas reais e filtros coerentes", () => {
    expect(registrarQualidadeSchema.safeParse({ ...base, data: "2026-02-30", sujeito: { tipo: "ANIMAL", animalId: id } }).success).toBe(false);
    expect(consultarQualidadeSchema.safeParse({ inicio: "2026-10-20", fim: "2026-10-19" }).success).toBe(false);
    expect(consultarQualidadeSchema.safeParse({ sujeito: "COLETIVO", animalId: id }).success).toBe(false);
  });
});


describe("datas operacionais da amostra", () => {
  const sujeito = { tipo: "COLETIVO", origem: "Tanque" };
  const correcao = { chave: id, propriedadeId: 1, versaoEsperada: 1, motivo: "Conferência das datas" };
  it("aceita datas independentes e opcionais sem inferir ou impor ordem cronológica", () => {
    expect(registrarQualidadeSchema.parse({ ...base, sujeito, dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: null })).toMatchObject({ dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: null });
    expect(registrarQualidadeSchema.parse({ ...base, sujeito, dataRecebimentoLaudo: "2026-10-16" })).not.toHaveProperty("dataResultadoLaboratorial");
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito, dataResultadoLaboratorial: "2026-02-30" }).success).toBe(false);
    expect(registrarQualidadeSchema.safeParse({ ...base, sujeito, dataRecebimentoLaudo: "2026-10-16T00:00:00Z" }).success).toBe(false);
  });
  it("correção só de datas exige motivo e versão, distingue omissão de limpeza e não aceita resultados vazios", () => {
    expect(corrigirQualidadeSchema.parse({ ...correcao, dataRecebimentoLaudo: null })).toMatchObject({ dataRecebimentoLaudo: null });
    expect(corrigirQualidadeSchema.parse({ ...correcao, dataRecebimentoLaudo: "2026-10-16" })).not.toHaveProperty("dataResultadoLaboratorial");
    expect(corrigirQualidadeSchema.safeParse(correcao).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, dataRecebimentoLaudo: null, motivo: "" }).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, dataRecebimentoLaudo: null, versaoEsperada: undefined }).success).toBe(false);
    expect(corrigirQualidadeSchema.safeParse({ ...correcao, dataRecebimentoLaudo: null, resultados: [] }).success).toBe(false);
  });
});
