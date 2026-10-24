import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { protocoloSchema, etapaIatfSchema } from "../reproducao/schemas.js";
import { etapasReprodutivasDoContrato } from "./reproducao.js";
import { calendarioIatf } from "../reproducao/regras.calc.js";
import { momentosDasAcoes, snapshotMomento } from "./momentos.js";
import { resolverTipoAplicacaoCadastroTx } from "./cadastros-produtos.js";
import { produtoSchema } from "../../estoque/produtos.schemas.js";

const id = "c0000000-0000-4000-8000-000000000001";
const aplicacao = { nome: "Aplicação", tipo: "APLICACAO" as const, intervalo: 7.5, unidade: "DIAS" as const, planoAplicacao: { produtoId: id, dose: "2", unidadeDose: "ML" as const } };
const protocolo = { nome: "Modelo", versao: 1, publicado: true, etapas: [aplicacao] };

describe("finalidade explícita e compatibilidade", () => {
  it("permite preparação sem tentativa e mantém exigência do contrato legado", () => {
    expect(protocoloSchema.safeParse(protocolo).success).toBe(false);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade: "PRE_SINCRONIZACAO" }).success).toBe(true);
    expect(protocoloSchema.safeParse({ ...protocolo, nome: "IATF sem classificação" }).success).toBe(false);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade: "SANITARIO" }).success).toBe(false);
  });
  it.each([['IATF', 'IA', 'TE'], ['TETF', 'TE', 'IA']] as const)("%s exige %s declarado sem material fixo", (finalidade, tentativaTipo, outro) => {
    const etapa = { nome: "Tentativa", tipo: "TENTATIVA", intervalo: 36, unidade: "HORAS", tentativaTipo };
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade, etapas: [etapa] }).success).toBe(true);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade, etapas: [{ ...etapa, tentativaTipo: outro }] }).success).toBe(false);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade, etapas: [{ ...etapa, planoTentativa: { tipo: tentativaTipo, materialId: id, quantidade: 1 } }] }).success).toBe(false);
    const { tentativaTipo: _, ...legado } = etapa;
    expect(protocoloSchema.safeParse({ ...protocolo, etapas: [{ ...legado, planoTentativa: { tipo: tentativaTipo, materialId: id, quantidade: 1 } }] }).success).toBe(true);
  });
  it("exige modo manual para exame e IA/TE sem transformar modos antigos ausentes", () => {
    const etapa = { nome: "IA", tipo: "TENTATIVA", tentativaTipo: "IA", intervalo: 0, unidade: "DIAS" };
    expect(etapaIatfSchema.safeParse(etapa).success).toBe(true);
    expect(etapaIatfSchema.safeParse({ ...etapa, momento: { nome: "Momento", ordem: 1, modoAtendimento: "AUTOMATIZADA" } }).success).toBe(false);
  });
});

it("conserva fração, horas, referência e tolerâncias na persistência e no cálculo", () => {
  const orientacaoTemporal = { versao: 1, referencia: "ETAPA_ANTERIOR", intervaloHoras: 36, toleranciaAntesMinutos: 30, toleranciaDepoisMinutos: 90, efeito: "ALERTA" };
  const entrada = [aplicacao, { ...aplicacao, intervalo: 36, unidade: "HORAS", orientacaoTemporal }];
  const gravadas = etapasReprodutivasDoContrato(entrada);
  const derivadas = gravadas.map(e => etapaIatfSchema.parse(e.configuracao));
  expect(derivadas).toEqual(entrada);
  expect(gravadas.map(e => [e.diaRelativo, e.unidadeIntervalo])).toEqual([[7.5, "DIAS"], [36, "HORAS"]]);
  expect(calendarioIatf(new Date("2026-10-01T08:00:00Z"), derivadas).map(e => e.previstaEm.toISOString())).toEqual(["2026-10-08T20:00:00.000Z", "2026-10-02T20:00:00.000Z"]);
  expect(calendarioIatf(new Date("2026-10-01T00:00:00Z"), derivadas, "DIA").every(e => e.previsaoPendente)).toBe(true);
});

it("congela instruções e modo e rejeita metadados contraditórios no mesmo momento", () => {
  const momento = { nome: "Preparo", ordem: 1, instrucoesGerais: "Conferir identificação", modoAtendimento: "MANUAL" as const };
  expect(snapshotMomento({ id, ...momento })).toEqual({ id, ...momento });
  expect(momentosDasAcoes([{ momento }, { momento }])).toEqual([momento]);
  expect(() => momentosDasAcoes([{ momento }, { momento: { ...momento, instrucoesGerais: "Outro texto" } }])).toThrow("conservar");
  expect(() => momentosDasAcoes([{ momento: { ...momento, instrucoesGerais: "x".repeat(2001) } }])).toThrow();
});

it("resolve classificação explícita antes do padrão e deixa ausência disponível somente no modo manual", async () => {
  const findFirst = vi.fn().mockResolvedValue({ id, nome: "Vacina" });
  const tx = { tipoAplicacaoSanitaria: { findFirst } } as unknown as Prisma.TransactionClient;
  expect(await resolverTipoAplicacaoCadastroTx(tx, id, "outro", true, "tipoAplicacaoId")).toEqual({ id, nome: "Vacina" });
  expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id, ativo: true } }));
  expect(await resolverTipoAplicacaoCadastroTx(tx, null, null, false, "tipoAplicacaoId")).toBeNull();
  await expect(resolverTipoAplicacaoCadastroTx(tx, null, null, true, "tipoAplicacaoId")).rejects.toThrow("atendimento manual");
  findFirst.mockResolvedValue(null);
  await expect(resolverTipoAplicacaoCadastroTx(tx, id, null, false, "tipoAplicacaoId")).rejects.toThrow("inativo");
});

it("aceita metadados opcionais no perfil e valida identificadores sem exigir via ou orientação", () => {
  const perfil = produtoSchema.shape.perfilSanitario;
  expect(perfil.safeParse({ carenciaLeiteHoras: null, carenciaCarneHoras: null, tipoAplicacaoId: id }).success).toBe(true);
  expect(perfil.safeParse({ carenciaLeiteHoras: null, carenciaCarneHoras: null, tipoAplicacaoId: "nome de vacina" }).success).toBe(false);
});
