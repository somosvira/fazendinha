import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { protocoloSchema, etapaIatfSchema } from "../reproducao/schemas.js";
import { etapasReprodutivasDoContrato } from "./reproducao.js";
import { calendarioIatf } from "../reproducao/regras.calc.js";
import { momentosDasAcoes, snapshotMomento } from "./momentos.js";
import { resolverTipoAplicacaoCadastroTx } from "./cadastros-produtos.js";
import { patchProdutoSchema } from "../../estoque/produtos.schemas.js";

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
  it.each([['IATF', 'IA', 'TE'], ['TETF', 'TE', 'IA']] as const)("%s aceita %s ou outro fato declarado sem material fixo", (finalidade, tentativaTipo, outro) => {
    const etapa = { nome: "Tentativa", tipo: "TENTATIVA", intervalo: 36, unidade: "HORAS", tentativaTipo };
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade, etapas: [etapa] }).success).toBe(true);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade, etapas: [{ ...etapa, tentativaTipo: outro }] }).success).toBe(true);
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
  expect(snapshotMomento({ id, ...momento })).toEqual({ id, ...momento, politicaExecucao: "CONFIRMACAO_OBRIGATORIA" });
  expect(momentosDasAcoes([{ momento }, { momento }])).toEqual([{ ...momento, politicaExecucao: "CONFIRMACAO_OBRIGATORIA" }]);
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
  const perfil = patchProdutoSchema.shape.perfilSanitario;
  expect(perfil.safeParse({ carenciaLeiteHoras: null, carenciaCarneHoras: null, tipoAplicacaoId: id }).success).toBe(true);
  expect(perfil.safeParse({ carenciaLeiteHoras: null, carenciaCarneHoras: null, tipoAplicacaoId: "nome de vacina" }).success).toBe(false);
});


describe("modalidades independentes de protocolos novos", () => {
  it.each(["IATF", "TETF"] as const)("aceita as quatro combinações de %s", finalidade => {
    for (const modalidadeTentativa of ["ETAPA", "EXTERNA"] as const) for (const modalidadeDiagnostico of ["PROTOCOLO", "EXTERNO"] as const) {
      const tentativa = { nome: "Tentativa", tipo: "TENTATIVA", intervalo: 10, unidade: "DIAS", tentativaTipo: finalidade === "IATF" ? "IA" : "TE" };
      const dg = { nome: "DG", tipo: "AVALIACAO", intervalo: 30, unidade: "DIAS", planoAvaliacao: { tipo: "DIAGNOSTICO" } };
      const etapas = [aplicacao, ...(modalidadeTentativa === "ETAPA" ? [tentativa] : []), ...(modalidadeDiagnostico === "PROTOCOLO" ? [dg] : [])];
      expect(protocoloSchema.safeParse({ ...protocolo, finalidade, modalidadeTentativa, modalidadeDiagnostico, etapas }).success).toBe(true);
    }
  });
  it("rejeita escolhas incompletas ou contraditórias", () => {
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade: "IATF", modalidadeTentativa: "EXTERNA" }).success).toBe(false);
    expect(protocoloSchema.safeParse({ ...protocolo, finalidade: "IATF", modalidadeTentativa: "ETAPA", modalidadeDiagnostico: "EXTERNO" }).success).toBe(false);
  });
});

it.each([["IATF", "IA"], ["TETF", "TE"]] as const)("preserva prazo factual na leitura e derivação de %s", (finalidade, publico) => {
  const regra = { finalidade: "DIAGNOSTICO", ocorrencia: 1, publico, referencia: publico, intervalo: 30, unidade: "DIAS", antecedencia: 2, tolerancia: 1, resolucao: "DIAGNOSTICO_CONCLUSIVO" };
  const dg = { nome: "DG", tipo: "AVALIACAO", intervalo: 7.5, unidade: "DIAS", referenciaPrazoDiagnostico: true, planoAvaliacao: { tipo: "DIAGNOSTICO" } };
  const input = { ...protocolo, finalidade, modalidadeTentativa: "EXTERNA", modalidadeDiagnostico: "PROTOCOLO", configuracaoAcompanhamento: { versao: 2, efeito: "ALERTA", regras: [regra] }, etapas: [dg] };
  expect(protocoloSchema.safeParse(input).success).toBe(true);
  const [gravada] = etapasReprodutivasDoContrato(input.etapas);
  const derivada = etapaIatfSchema.parse(gravada.configuracao);
  expect(derivada).toEqual(dg);
  expect(calendarioIatf(new Date("2026-01-01T15:00:00Z"), [derivada])[0]).toMatchObject({ previsaoPendente: true, precisaoTemporal: "DIA" });
  expect(protocoloSchema.safeParse({ ...input, configuracaoAcompanhamento: null }).success).toBe(false);
  expect(protocoloSchema.safeParse({ ...input, etapas: [dg, dg] }).success).toBe(false);
  expect(protocoloSchema.safeParse({ ...input, configuracaoAcompanhamento: { ...input.configuracaoAcompanhamento, regras: [{ ...regra, intervalo: 1.5 }] } }).success).toBe(false);
  expect(protocoloSchema.safeParse({ ...input, configuracaoAcompanhamento: { ...input.configuracaoAcompanhamento, regras: [{ ...regra, tipoExameId: id }] } }).success).toBe(false);
  expect(etapaIatfSchema.safeParse({ ...dg, planoAvaliacao: { tipo: "SEXAGEM" } }).success).toBe(false);
});

it("recebe exatamente uma origem de produto na aplicação do builder", () => {
  const plano = aplicacao.planoAplicacao;
  expect(etapaIatfSchema.safeParse({ ...aplicacao, planoAplicacao: { ...plano, produtoId: undefined, produtoCatalogoId: id, categoriaId: id } }).success).toBe(true);
  expect(etapaIatfSchema.safeParse({ ...aplicacao, planoAplicacao: { ...plano, produtoCatalogoId: id } }).success).toBe(false);
  expect(etapaIatfSchema.safeParse({ ...aplicacao, planoAplicacao: { ...plano, produtoId: undefined } }).success).toBe(false);
});


it.each(["IATF", "TETF"])("calendário de %s aceita tentativa factual e acompanhamentos independentes", finalidade => {
 const tentativa = {nome:"Cobertura",tipo:"TENTATIVA",tentativaTipo:"COBERTURA",intervalo:2,unidade:"DIAS"};
 const dg = {nome:"DG",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO"}};
 const rec = {nome:"Reconfirmação",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",referenciaPrazoReconfirmacao:true,planoAvaliacao:{tipo:"RECONFIRMACAO"}};
 const regrasDG = ["IA","TE","COBERTURA"].map(publico=>({finalidade:"DIAGNOSTICO",ocorrencia:1,publico,referencia:publico,intervalo:30,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"DIAGNOSTICO_CONCLUSIVO"}));
 const regraRec = {finalidade:"RECONFIRMACAO",ocorrencia:1,publico:"GESTACAO",referencia:"PRIMEIRO_DG_POSITIVO",intervalo:20,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"RECONFIRMACAO_CONCLUSIVA"};
 for(const incluiDG of [false,true]) for(const incluiRec of [false,true]){
  const regras=[...(incluiDG?regrasDG:[]),...(incluiRec?[regraRec]:[])];
  const input={...protocolo,finalidade,modalidadeTentativa:"ETAPA",modalidadeDiagnostico:incluiDG?"PROTOCOLO":"EXTERNO",configuracaoAcompanhamento:regras.length?{versao:2,efeito:"ALERTA",regras}:null,etapas:[tentativa,...(incluiDG?[dg]:[]),...(incluiRec?[rec]:[])]};
  const parsed=protocoloSchema.parse(input);
  const etapas=etapasReprodutivasDoContrato(parsed.etapas).map(e=>etapaIatfSchema.parse(e.configuracao));
  const calendario=calendarioIatf(new Date("2026-01-01T12:00:00Z"),etapas);
  expect(calendario[0].previsaoPendente).toBe(false);
  expect(calendario.slice(1).every(e=>e.previsaoPendente)).toBe(true);
 }
 expect(etapaIatfSchema.safeParse({...rec,planoAvaliacao:{tipo:"DIAGNOSTICO"}}).success).toBe(false);
});

it("valida ordem guiada sem reinterpretar versões legadas", () => {
 const tentativa={nome:"Tentativa",tipo:"TENTATIVA",tentativaTipo:"IA",intervalo:2,unidade:"DIAS"};
 const preparo={...aplicacao,intervalo:48,unidade:"HORAS"};
 const base={...protocolo,finalidade:"IATF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"EXTERNO",encerramentoGuiado:true};
 expect(protocoloSchema.safeParse({...base,etapas:[preparo,tentativa]}).success).toBe(true);
 expect(protocoloSchema.safeParse({...base,etapas:[tentativa,preparo]}).success).toBe(false);
 expect(protocoloSchema.safeParse({...base,etapas:[{...preparo,intervalo:49},tentativa]}).success).toBe(false);
 expect(protocoloSchema.safeParse({...base,etapas:[tentativa,tentativa]}).success).toBe(false);
 expect(protocoloSchema.safeParse({...base,encerramentoGuiado:undefined,etapas:[tentativa,preparo]}).success).toBe(true);
});

it.each(["IA", "TE", "COBERTURA"])("exige regra de DG para a tentativa guiada %s e preserva regras herdadas", tipo => {
 const regra=(publico:string)=>({finalidade:"DIAGNOSTICO",ocorrencia:1,publico,referencia:publico,intervalo:30,unidade:"DIAS",antecedencia:0,tolerancia:0,resolucao:"DIAGNOSTICO_CONCLUSIVO"});
 const tentativa={nome:"Tentativa",tipo:"TENTATIVA",tentativaTipo:tipo,intervalo:2,unidade:"DIAS"};
 const dg={nome:"DG",tipo:"AVALIACAO",intervalo:0,unidade:"DIAS",referenciaPrazoDiagnostico:true,planoAvaliacao:{tipo:"DIAGNOSTICO"}};
 const base={...protocolo,publicado:true,encerramentoGuiado:true,finalidade:"IATF",modalidadeTentativa:"ETAPA",modalidadeDiagnostico:"PROTOCOLO",etapas:[tentativa,dg]};
 const outro=tipo === "IA" ? "TE" : "IA";
 expect(protocoloSchema.safeParse({...base,configuracaoAcompanhamento:{versao:2,efeito:"ALERTA",regras:[regra(outro)]}}).success).toBe(false);
 expect(protocoloSchema.safeParse({...base,configuracaoAcompanhamento:{versao:2,efeito:"ALERTA",regras:[regra(outro),regra(tipo)]}}).success).toBe(true);
 expect(protocoloSchema.safeParse({...base,modalidadeTentativa:"EXTERNA",etapas:[dg],configuracaoAcompanhamento:{versao:2,efeito:"ALERTA",regras:[regra(outro)]}}).success).toBe(true);
});

it("valida o formato do DG externo sem regravar a regra herdada de outra modalidade", () => {
 const regra = (publico: "IA" | "TE") => ({ finalidade: "DIAGNOSTICO", ocorrencia: 1, publico, referencia: publico, intervalo: 30, unidade: "DIAS", antecedencia: 2, tolerancia: 1, resolucao: "DIAGNOSTICO_CONCLUSIVO" });
 const dg = { nome: "DG externo à tentativa", tipo: "AVALIACAO", intervalo: 0, unidade: "DIAS", referenciaPrazoDiagnostico: true, planoAvaliacao: { tipo: "DIAGNOSTICO" } };
 const dados = { ...protocolo, encerramentoGuiado: true, finalidade: "IATF", modalidadeTentativa: "EXTERNA", modalidadeDiagnostico: "PROTOCOLO", etapas: [dg] };
 const regras = [{ ...regra("TE"), tipoExameId: id }, regra("IA")];
 const configuracaoAcompanhamento = { versao: 2, efeito: "ALERTA", regras };
 expect(protocoloSchema.parse({ ...dados, configuracaoAcompanhamento }).configuracaoAcompanhamento).toEqual(configuracaoAcompanhamento);
 expect(protocoloSchema.safeParse({ ...dados, configuracaoAcompanhamento: { ...configuracaoAcompanhamento, regras: [regra("TE"), { ...regra("IA"), tipoExameId: id }] } }).success).toBe(false);
});
