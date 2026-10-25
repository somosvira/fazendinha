import { describe, expect, it } from "vitest";
import { calcularBalancoLeite, calcularPrecoFaturadoLeite, csvSnapshotLeite, mascararEmissaoLeite } from "./relatoriosleite.calc.js";
const movimento = (id: string, data: string, tipo: string, origem: string, quantidade: string) => ({ id, data, tipo, origem, quantidade, produtoId: "leite", produtoNome: "Leite", metodoValorizacao: "LEITE_FIFO_V1" });
describe("balanço do razão e exportação preservada", () => {
  it("preço faturado usa volume/valor das parcelas documentais, com ponderação e zero/desconhecido explícitos", () => {
    expect(calcularPrecoFaturadoLeite([{ quantidade: "2", valor: "4" }, { quantidade: "8", valor: "24" }])).toMatchObject({ quantidadeLitros: "10", valorFaturado: "28.00", precoFaturadoPorLitro: "2.8000" });
    expect(calcularPrecoFaturadoLeite([{ quantidade: "0", valor: "0" }]).precoFaturadoPorLitro).toBeNull();
    expect(calcularPrecoFaturadoLeite([{ quantidade: "2", valor: null }]).precoFaturadoPorLitro).toBeNull();
    expect(calcularPrecoFaturadoLeite([])).toMatchObject({ valorFaturado: null, precoFaturadoPorLitro: null, cobertura: "SEM_ALOCACOES" });
  });
  it("conserva abertura+produção−vendas−interno−descarte com inverso sem afirmar medição de campo", () => {
    const balanco = calcularBalancoLeite([movimento("1", "2026-09-30", "ENTRADA", "PRODUCAO", "10"), movimento("2", "2026-10-01", "ENTRADA", "PRODUCAO", "20"),
      movimento("3", "2026-10-01", "SAIDA", "VENDA", "8"), movimento("4", "2026-10-01", "SAIDA", "NUTRICAO", "4"), movimento("5", "2026-10-01", "SAIDA", "PERDA", "3"),
      movimento("6", "2026-10-02", "ENTRADA", "PERDA", "1"), movimento("fora", "2026-11-01", "SAIDA", "VENDA", "99")], "2026-10-01", "2026-10-31");
    expect(balanco[0]).toMatchObject({ abertura: "10", producaoConfirmada: "20", vendas: "8", interno: "4", descarte: "2", encerramentoRazao: "16", identidadeConservada: true, confiavel: true, medicaoCampo: null, conciliacaoCampo: "NAO_REALIZADA" });
  });
  it("compara10L observados contra12L do razão sem ajuste e preserva abertura anterior com data", () => {
    const fonte = [movimento("1", "2026-10-01", "ENTRADA", "PRODUCAO", "12")];
    const conf = [{ id: "c1", produtoId: "leite", produtoNome: "Leite", data: "2026-10-01", litrosObservados: "10", versao: 2, referencia: "Régua tanque", responsavel: "João" },
      { id: "c0", produtoId: "leite", produtoNome: "Leite", data: "2026-09-28", litrosObservados: "7", versao: 1, referencia: "Régua anterior", responsavel: "João" }];
    const b = calcularBalancoLeite(fonte, "2026-10-01", "2026-10-01", conf)[0];
    expect(b).toMatchObject({ encerramentoRazao: "12", divergenciaLitros: "-2", conciliacaoCampo: "DIVERGENTE", medicaoCampo: { litrosObservados: "10", versao: 2 }, aberturaObservada: { data: "2026-09-28", litrosObservados: "7" } });
    expect(fonte[0].quantidade).toBe("12");
    expect(calcularBalancoLeite(fonte, "2026-10-01", "2026-10-02", conf)[0].medicaoCampo).toBeNull();
    expect(calcularBalancoLeite([], "2026-10-01", "2026-10-01", conf)[0]).toMatchObject({ encerramentoRazao: null, divergenciaLitros: null, conciliacaoCampo: "INCONCLUSIVA" });
  });
  it("não certifica legado nem ajuste sem regra e preserva zero conhecido", () => {
    const b = calcularBalancoLeite([{ ...movimento("1", "2026-10-01", "ENTRADA", "PRODUCAO", "5"), metodoValorizacao: "LEGADO" }, movimento("2", "2026-10-02", "SAIDA", "VENDA", "5")], "2026-10-01", "2026-10-31")[0];
    expect(b.encerramentoRazao).toBe("0"); expect(b.confiavel).toBe(false); expect(b.pendencias).toContain("MOVIMENTOS_SEM_LASTRO_LEITEIRO");
    expect(calcularBalancoLeite([], "2026-10-01", "2026-10-31")).toEqual([]);
  });
  it("re-mascara dinheiro sem alterar snapshot original e CSV tem títulos humanos, zero e unidade de qualidade", () => {
    const emissao = { snapshot: { valoresIncluidos: true, corteEm: "2026-10-01T00:00:00Z", propriedade: { nome: "Sítio A" }, filtros: { inicio: "2026-10-01", fim: "2026-10-01" },
      dados: { producao: { ritmo: [{ data: "2026-10-01", litros: 0, estado: "COMPLETA" }] }, qualidade: [{ id: "a", data: "2026-10-01", sujeito: { tipo: "COLETIVO", origem: "Tanque" }, formatoSnapshot: { nome: "Composição", versao: 2, campos: [{ codigo: "GORDURA", rotulo: "Gordura" }] }, resultados: [{ campo: "GORDURA", valor: 0, unidade: "%" }] }] },
      valores: { comercial: [{ retiradaId: "x", versao: 1, valorTotal: "9876.54" }] } } };
    const oculto = mascararEmissaoLeite(emissao, false);
    expect(oculto.snapshot.valores).toBeNull(); expect(emissao.snapshot.valores).not.toBeNull();
    const csv = csvSnapshotLeite(oculto);
    expect(csv).toContain('"Ritmo diário"'); expect(csv).toContain('"Gordura";"0";"%"'); expect(csv).not.toContain("9876.54"); expect(csv).not.toContain("snapshot.dados");
    expect(csvSnapshotLeite(emissao)).toContain("9876.54");
  });
  it("escapa células de texto e não permite fórmula de planilha no CSV", () => {
    const csv = csvSnapshotLeite({ propriedade: { nome: '=IMPORTXML("ataque")' } });
    expect(csv).toContain("'=IMPORTXML"); expect(csv).toContain('""ataque""');
  });
});
