import { describe, it, expect } from "vitest";
import { COMANDOS, buscar } from "./searchIndex";

const labels = (q: string) => buscar(COMANDOS, q).map((c) => c.label);
const ids = (q: string) => buscar(COMANDOS, q).map((c) => c.id);

describe("buscar()", () => {
  it("query vazia retorna a curadoria de destinos-topo (não vazia)", () => {
    const r = buscar(COMANDOS, "");
    expect(r.length).toBeGreaterThan(0);
    // a curadoria começa pelo Dashboard financeiro
    expect(r[0].id).toBe("fin-dashboard");
    // inclui o painel de pelo menos um módulo operacional
    expect(r.map((c) => c.id)).toContain("pec-rebanho");
    expect(r.map((c) => c.id)).toContain("pla-dashboard");
  });

  it("query só de espaços conta como vazia", () => {
    expect(buscar(COMANDOS, "   ")).toEqual(buscar(COMANDOS, ""));
  });

  it('"talh" encontra Talhão', () => {
    expect(ids("talh")).toContain("pla-talhao");
  });

  it('sinônimo "ferrugem" encontra Fitossanidade', () => {
    expect(ids("ferrugem")).toContain("pla-fitossanidade");
  });

  it('"gasto" encontra Gastos e a ação "Lançar gasto"', () => {
    const r = ids("gasto");
    expect(r).toContain("fin-gastos");
    expect(r).toContain("acao-lancar-gasto");
  });

  it('busca é insensível a acento: "nutricao" encontra Nutrição', () => {
    const r = ids("nutricao");
    expect(r).toContain("pla-nutricao");
  });

  it("sinônimo de animal: \"vaca\" encontra o Rebanho", () => {
    expect(ids("vaca")).toContain("pec-rebanho");
  });

  it('ranking: prefixo de label vem antes de match por sinônimo', () => {
    // "rel" começa o label "Relatórios" → deve vir antes de qualquer match indireto
    const r = labels("rel");
    expect(r[0]).toBe("Relatórios");
  });

  it("ranking: label-prefix antes de substring no meio da palavra", () => {
    // "ca" começa "Caixinha" e "Cadastros"; também aparece no meio de outras.
    const r = buscar(COMANDOS, "ca");
    const cat = r.findIndex((c) => c.id === "fin-caixinha"); // label "Caixinha"
    expect(cat).toBeGreaterThanOrEqual(0);
    // o primeiro resultado deve ter label começando com "ca"
    expect(r[0].label.toLowerCase().startsWith("ca")).toBe(true);
  });

  it("sem match retorna lista vazia", () => {
    expect(buscar(COMANDOS, "xyzqwk")).toEqual([]);
  });

  it("multi-token faz AND (todos os tokens precisam casar)", () => {
    // "novo animal" casa a ação "Novo animal", mas não "Gastos"
    const r = ids("novo animal");
    expect(r).toContain("acao-novo-animal");
    expect(r).not.toContain("fin-gastos");
  });

  it("respeita um índice pré-filtrado (ex.: por permissão)", () => {
    const semFinanceiro = COMANDOS.filter((c) => c.grupo !== "Financeiro");
    const r = buscar(semFinanceiro, "dashboard").map((c) => c.id);
    expect(r).not.toContain("fin-dashboard");
  });

  it("limita o resultado a no máximo 24 itens", () => {
    // "a" casa um monte de coisas — não pode estourar o cap
    expect(buscar(COMANDOS, "a").length).toBeLessThanOrEqual(24);
  });
});
