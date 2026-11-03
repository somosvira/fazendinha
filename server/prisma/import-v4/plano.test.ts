import { describe, expect, it } from "vitest";
import { criarManifesto, executarPlano, separarChave } from "./plano.js";

describe("manifesto de reconciliação", () => {
  const itens = [
    { chave: "REPRODUCAO:1", hash: "a", entidade: "TentativaReprodutiva", dependencias: [], operacao: "CRIAR" as const },
    { chave: "REPRODUCAO:2", hash: "b", entidade: "AvaliacaoReprodutiva", dependencias: ["REPRODUCAO:1"], operacao: "CRIAR" as const },
  ];
  it("produz a mesma identidade independentemente da ordem de entrada", () => {
    const a = criarManifesto("fonte", itens);
    const b = criarManifesto("fonte", [...itens].reverse());
    expect(a).toEqual(b);
    expect(a.itens.map((i) => i.chave)).toEqual(["REPRODUCAO:1", "REPRODUCAO:2"]);
    expect(a.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(criarManifesto("outra-fonte", itens).hash).not.toBe(a.hash);
    expect(criarManifesto("fonte", [{ ...itens[0], hash: "alterado" }, itens[1]]).hash).not.toBe(a.hash);
  });
  it("rejeita duplicidade por chave em vez de criar um plano ambíguo", () => {
    expect(() => criarManifesto("fonte", [itens[0], itens[0]])).toThrow(/duplicada/i);
  });
  it("preserva sufixos da chave externa e rejeita identidades incompletas", () => {
    expect(separarChave("REPRODUCAO:lote:1")).toEqual({ tabelaOrigem: "REPRODUCAO", chaveOrigem: "lote:1" });
    for (const chave of ["", "REPRODUCAO", ":1", "REPRODUCAO:"]) {
      expect(() => separarChave(chave)).toThrow(/chave/i);
    }
  });
});

describe("execução de dependências da importação", () => {
  it("ordena dependências e conserva o destino de fatos já existentes", async () => {
    const fatos: string[] = [];
    const resultado = await executarPlano([
      { chave: "B:2", dependencias: ["A:1"], gravar: async () => { fatos.push("avaliação"); return { destinoId: "avaliacao", reutilizado: false }; } },
      { chave: "A:1", dependencias: [], gravar: async () => ({ destinoId: "tentativa-existente", reutilizado: true }) },
    ]);
    expect(fatos).toEqual(["avaliação"]);
    expect(resultado).toEqual([
      { chave: "A:1", estado: "REUTILIZADO", destinoId: "tentativa-existente" },
      { chave: "B:2", estado: "CRIADO", destinoId: "avaliacao" },
    ]);
  });
  it("falha no pai bloqueia descendentes, mantendo o recibo dos independentes", async () => {
    const fatos: string[] = [];
    const resultado = await executarPlano([
      { chave: "A:1", dependencias: [], gravar: async () => { throw new Error("conflito de origem"); } },
      { chave: "B:2", dependencias: ["A:1"], gravar: async () => { fatos.push("indevido"); return { destinoId: "b", reutilizado: false }; } },
      { chave: "C:3", dependencias: ["B:2"], gravar: async () => { fatos.push("indevido"); return { destinoId: "c", reutilizado: false }; } },
      { chave: "D:4", dependencias: [], gravar: async () => { fatos.push("independente"); return { destinoId: "d", reutilizado: false }; } },
    ]);
    expect(fatos).toEqual(["independente"]);
    expect(resultado.map((i) => [i.chave, i.estado]).sort()).toEqual([
      ["A:1", "FALHOU"], ["B:2", "BLOQUEADO"], ["C:3", "BLOQUEADO"], ["D:4", "CRIADO"],
    ]);
  });
  it("não executa ciclo, dependência ausente ou chave duplicada", async () => {
    const gravar = async () => { throw new Error("não deveria executar"); };
    expect((await executarPlano([
      { chave: "A:1", dependencias: ["B:2"], gravar },
      { chave: "B:2", dependencias: ["A:1"], gravar },
    ])).every((i) => i.estado === "BLOQUEADO")).toBe(true);
    expect((await executarPlano([{ chave: "A:1", dependencias: ["X:9"], gravar }]))[0].estado).toBe("BLOQUEADO");
    await expect(executarPlano([
      { chave: "A:1", dependencias: [], gravar },
      { chave: "A:1", dependencias: [], gravar },
    ])).rejects.toThrow(/duplicada/i);
  });
  it("aceita dependência reutilizada de uma execução anterior", async () => {
    const resultado = await executarPlano([
      { chave: "B:2", dependencias: ["A:1"], gravar: async () => ({ destinoId: "b", reutilizado: false }) },
    ], new Set(["A:1"]));
    expect(resultado).toEqual([{ chave: "B:2", estado: "CRIADO", destinoId: "b" }]);
  });
});
