// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { setToken } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
import { configuracaoPadrao } from "./lib/relatorios";
import { concluirEdicaoRascunhoRelatorio, contextoEdicaoRascunhoRelatorio, enfileirarSalvamentoRascunhoRelatorio, estadoRascunhoRelatorioAtivo, guardarEdicaoRascunhoRelatorio, limparRascunhoRelatorioAtivo, prepararPublicacaoRascunhoRelatorio } from "./rascunhoRelatorioAtivo";

const configuracao = { ...configuracaoPadrao(), nome: "Fechamento" };
afterEach(() => { limparRascunhoRelatorioAtivo(); setPropriedadeAtiva(null); localStorage.clear(); });

describe("recuperação do rascunho de relatório", () => {
  it("não deixa uma leitura anterior apagar a edição recente", () => {
    const publicar = prepararPublicacaoRascunhoRelatorio("leitura");
    guardarEdicaoRascunhoRelatorio(configuracao);
    publicar(null);
    expect(estadoRascunhoRelatorioAtivo().recuperacao?.configuracao).toBe(configuracao);
    expect(estadoRascunhoRelatorioAtivo().conhecido).toBe(false);
  });

  it("uma gravação antiga conserva a edição mais recente para recuperação", () => {
    guardarEdicaoRascunhoRelatorio(configuracao);
    const recente = { ...configuracao, nome: "Fechamento revisado" };
    guardarEdicaoRascunhoRelatorio(recente);
    concluirEdicaoRascunhoRelatorio(configuracao, { id: "rascunho", versao: 4, configuracao, updatedAt: "" });
    expect(estadoRascunhoRelatorioAtivo().recuperacao?.configuracao).toBe(recente);
    expect(estadoRascunhoRelatorioAtivo().rascunho?.versao).toBe(4);
  });

  it("falha conserva dados e a gravação correspondente encerra a recuperação", () => {
    guardarEdicaoRascunhoRelatorio(configuracao);
    concluirEdicaoRascunhoRelatorio(configuracao, null, "Sem conexão");
    expect(estadoRascunhoRelatorioAtivo().recuperacao?.erro).toBe("Sem conexão");
    concluirEdicaoRascunhoRelatorio(configuracao, { id: "rascunho", versao: 4, configuracao, updatedAt: "" });
    expect(estadoRascunhoRelatorioAtivo().recuperacao).toBeNull();
  });

  it("recuperação não aparece em outra sessão ou sítio", () => {
    setToken("sessao-a"); setPropriedadeAtiva(1);
    const pertence = contextoEdicaoRascunhoRelatorio();
    guardarEdicaoRascunhoRelatorio(configuracao);
    setPropriedadeAtiva(2);
    expect(estadoRascunhoRelatorioAtivo().recuperacao).toBeNull();
    expect(pertence()).toBe(false);
    setPropriedadeAtiva(1); setToken("sessao-b");
    expect(estadoRascunhoRelatorioAtivo().recuperacao).toBeNull();
  });

  it("descarte ou emissão removem a recuperação", () => {
    guardarEdicaoRascunhoRelatorio(configuracao);
    prepararPublicacaoRascunhoRelatorio("escrita")(null);
    expect(estadoRascunhoRelatorioAtivo().recuperacao).toBeNull();
  });

  it("serializa gravações de duas instâncias mesmo quando a primeira falha", async () => {
    const ordem: string[] = [];
    let liberar!: () => void;
    const primeira = enfileirarSalvamentoRascunhoRelatorio(async () => { ordem.push("primeira"); await new Promise<void>(resolve => { liberar = resolve; }); throw new Error("rede"); });
    const falha = primeira.catch(() => undefined);
    const segunda = enfileirarSalvamentoRascunhoRelatorio(async () => { ordem.push("segunda"); });
    await Promise.resolve(); await Promise.resolve();
    expect(ordem).toEqual(["primeira"]);
    liberar(); await falha; await segunda;
    expect(ordem).toEqual(["primeira", "segunda"]);
  });
});
