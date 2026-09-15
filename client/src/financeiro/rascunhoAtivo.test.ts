// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { setToken } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
import { confirmarRascunhoOperacao, descartarRascunhoOperacao, obterRascunhoOperacao, salvarRascunhoOperacao, type RascunhoOperacao } from "./novo-api";
import { estadoRascunhoAtivo, limparRascunhoAtivo, marcarEdicaoRascunho, prepararPublicacaoRascunho } from "./rascunhoAtivo";

const rascunho = (versao: number): RascunhoOperacao => ({ id: 8, versao, updatedAt: "2026-09-14T12:00:00Z", documentos: [], dados: {} });

afterEach(() => {
  limparRascunhoAtivo();
  setPropriedadeAtiva(null);
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("rascunhoAtivo", () => {
  it("publica o resultado de leituras e escritas", () => {
    prepararPublicacaoRascunho("leitura")(rascunho(1));
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(1);
    prepararPublicacaoRascunho("escrita")(null);
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
  });

  it("não deixa uma leitura lenta sobrescrever uma escrita mais nova", () => {
    const leitura = prepararPublicacaoRascunho("leitura");
    prepararPublicacaoRascunho("escrita")(rascunho(3));
    expect(leitura(rascunho(2))).toEqual(rascunho(2));
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(3);
  });

  it("ignora a resposta de uma requisição feita em outro sítio", () => {
    setPropriedadeAtiva(1);
    const escrita = prepararPublicacaoRascunho("escrita");
    setPropriedadeAtiva(2);
    escrita(rascunho(5));
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
  });

  it("ignora a resposta de uma requisição feita em outra sessão", () => {
    setToken("sessao-anterior");
    const leitura = prepararPublicacaoRascunho("leitura");
    setToken("sessao-nova");
    leitura(rascunho(6));
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
  });

  it("limpar esquece o rascunho sem descartar a leitura do contexto atual", () => {
    prepararPublicacaoRascunho("escrita")(rascunho(1));
    const leitura = prepararPublicacaoRascunho("leitura");
    limparRascunhoAtivo();
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
    leitura(rascunho(1));
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(1);
  });

  it("só dá o rascunho como conhecido depois de uma resposta, e limpar volta a desconhecido", () => {
    expect(estadoRascunhoAtivo().conhecido).toBe(false);
    prepararPublicacaoRascunho("leitura")(null);
    expect(estadoRascunhoAtivo()).toMatchObject({ rascunho: null, conhecido: true });
    limparRascunhoAtivo();
    expect(estadoRascunhoAtivo().conhecido).toBe(false);
  });

  it("marca e desmarca a edição do rascunho", () => {
    const desmarcar = marcarEdicaoRascunho();
    expect(estadoRascunhoAtivo().editando).toBe(true);
    desmarcar();
    expect(estadoRascunhoAtivo().editando).toBe(false);
  });

  it("as chamadas de rascunho da API mantêm a store em dia", async () => {
    const respostas: unknown[] = [rascunho(1), rascunho(2), {}, rascunho(3), { id: 99 }];
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => respostas.shift() })));

    await obterRascunhoOperacao();
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(1);
    await salvarRascunhoOperacao({}, 1);
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(2);
    await descartarRascunhoOperacao();
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
    await salvarRascunhoOperacao({});
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(3);
    await expect(confirmarRascunhoOperacao(3)).resolves.toEqual({ id: 99 });
    expect(estadoRascunhoAtivo().rascunho).toBeNull();
  });

  it("uma falha da API não altera o rascunho conhecido", async () => {
    prepararPublicacaoRascunho("escrita")(rascunho(4));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: "Conflito" }) })));
    await expect(salvarRascunhoOperacao({}, 1)).rejects.toThrow("Conflito");
    expect(estadoRascunhoAtivo().rascunho?.versao).toBe(4);
  });
});
