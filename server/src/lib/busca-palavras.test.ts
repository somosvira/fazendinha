import { describe, expect, it } from "vitest";
import { inicioDePalavra } from "./busca-palavras.js";

type Condicao = Record<string, { startsWith?: string; contains?: string; mode?: string }>;

/** Reproduz em memória o que o banco avalia para o OR devolvido. */
function casa(valor: string, termo: string, insensitive = false) {
  const { OR } = inicioDePalavra("nome", termo, { insensitive });
  if (!OR) return true;
  const alvo = insensitive ? valor.toLowerCase() : valor;
  return (OR as Condicao[]).some(({ nome: f }) => {
    const t = insensitive ? (f.startsWith ?? f.contains ?? "").toLowerCase() : (f.startsWith ?? f.contains ?? "");
    return f.startsWith !== undefined ? alvo.startsWith(t) : alvo.includes(t);
  });
}

describe("inicioDePalavra", () => {
  it("sem termo não restringe a busca", () => {
    expect(inicioDePalavra("nome", "")).toEqual({});
    expect(inicioDePalavra("nome", "   ")).toEqual({});
  });

  it("casa o início do nome e o início de qualquer palavra", () => {
    expect(casa("diclofenaco 50 ml", "di")).toBe(true);
    expect(casa("soro dimetil", "di")).toBe(true);
    expect(casa("sal mineral (dispenser)", "di")).toBe(true);
    expect(casa("soro-diluente", "di")).toBe(true);
    expect(casa("sal/dicalcio", "di")).toBe(true);
  });

  it("não casa o termo no meio ou no fim da palavra", () => {
    expect(casa("ivermectina", "di")).toBe(false);
    expect(casa("abamectina", "g")).toBe(false);
    expect(casa("aditivo", "di")).toBe(false);
    expect(casa("medicamento", "di")).toBe(false);
  });

  it("uma letra só encontra palavras que começam com ela", () => {
    expect(casa("gentamicina", "g")).toBe(true);
    expect(casa("vacina gripe", "g")).toBe(true);
    expect(casa("antibiótico", "g")).toBe(false);
  });

  it("termo com mais de uma palavra segue a ordem do nome", () => {
    expect(casa("vacina aftosa oleosa", "vacina af")).toBe(true);
    expect(casa("vacina aftosa oleosa", "aftosa ol")).toBe(true);
    expect(casa("vacina aftosa oleosa", "aftosa va")).toBe(false);
  });

  it("insensitive ignora a caixa", () => {
    expect(casa("Diclofenaco", "DI", true)).toBe(true);
    expect(casa("Soro Dimetil", "di", true)).toBe(true);
    expect(casa("Ivermectina", "DI", true)).toBe(false);
  });

  it("repassa o modo insensitive às condições", () => {
    const { OR } = inicioDePalavra("nome", "di", { insensitive: true });
    expect((OR as Condicao[]).every(c => c.nome.mode === "insensitive")).toBe(true);
  });
});
