import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UNIDADES, UNIDADES_ORDENADAS, converterQuantidade, mesmaBase, rotuloUnidade } from "./unidades";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Paridade com o server (services/estoque/unidades.ts) sem import cruzado entre
// os pacotes: lê o arquivo-fonte do server em disco e extrai a tabela UNIDADES
// via regex, comparando chave a chave com a tabela do client. Se o server mudar
// a tabela, este teste falha (em vez de silenciosamente divergir).
type EntradaTabela = { rotulo: string; base: string; fator: number };

function extrairTabelaUnidades(conteudoArquivo: string): Record<string, EntradaTabela> {
  const blocoUnidades = conteudoArquivo.match(/\bUNIDADES:[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!blocoUnidades) throw new Error("Não encontrou a declaração de UNIDADES no arquivo — regex do teste de paridade pode estar desatualizada.");
  const tabela: Record<string, EntradaTabela> = {};
  const regexEntrada = /(\w+):\s*\{([^}]*)\}/g;
  let entrada: RegExpExecArray | null;
  while ((entrada = regexEntrada.exec(blocoUnidades[1]))) {
    const [, chave, campos] = entrada;
    const rotulo = campos.match(/rotulo:\s*"([^"]*)"/)?.[1];
    const base = campos.match(/base:\s*"([^"]*)"/)?.[1];
    const fator = campos.match(/fator:\s*([\d.]+)/)?.[1];
    if (rotulo === undefined || base === undefined || fator === undefined) {
      throw new Error(`Entrada "${chave}" incompleta (rotulo/base/fator) — regex do teste de paridade pode estar desatualizada.`);
    }
    tabela[chave] = { rotulo, base, fator: Number(fator) };
  }
  if (Object.keys(tabela).length === 0) throw new Error("Nenhuma entrada extraída de UNIDADES — regex do teste de paridade pode estar desatualizada.");
  return tabela;
}

const conteudoServidor = readFileSync(path.join(__dirname, "../../../server/src/services/estoque/unidades.ts"), "utf-8");
const conteudoCliente = readFileSync(path.join(__dirname, "./unidades.ts"), "utf-8");
const tabelaServidor = extrairTabelaUnidades(conteudoServidor);
const tabelaCliente = extrairTabelaUnidades(conteudoCliente);

describe("unidades (client) — paridade com o server", () => {
  it("o arquivo do server tem pelo menos as 11 unidades esperadas", () => {
    expect(Object.keys(tabelaServidor).sort()).toEqual(["CX", "DOSE", "G", "HA", "KG", "L", "M", "ML", "SC", "T", "UN"]);
  });

  it("mesmas chaves do server (extraídas do arquivo-fonte)", () => {
    expect(Object.keys(UNIDADES).sort()).toEqual(Object.keys(tabelaServidor).sort());
  });

  it("mesmos rótulos, base e fator do server (extraídos do arquivo-fonte)", () => {
    for (const chave of Object.keys(tabelaServidor)) {
      const esperado = tabelaServidor[chave];
      const atual = UNIDADES[chave as keyof typeof UNIDADES];
      expect(atual.rotulo).toBe(esperado.rotulo);
      expect(atual.base).toBe(esperado.base);
      expect(atual.fator).toBe(esperado.fator);
    }
  });

  it("a tabela extraída do próprio client bate com o objeto UNIDADES importado (regex não está mentindo)", () => {
    for (const chave of Object.keys(tabelaCliente)) {
      const extraido = tabelaCliente[chave];
      const importado = UNIDADES[chave as keyof typeof UNIDADES];
      expect(importado.rotulo).toBe(extraido.rotulo);
      expect(importado.base).toBe(extraido.base);
      expect(importado.fator).toBe(extraido.fator);
    }
  });

  it("UNIDADES_ORDENADAS cobre todas as chaves", () => {
    expect([...UNIDADES_ORDENADAS].sort()).toEqual(Object.keys(UNIDADES).sort());
  });
});

describe("rotuloUnidade / mesmaBase / converterQuantidade", () => {
  it("rótulos", () => {
    expect(rotuloUnidade("KG")).toBe("kg");
    expect(rotuloUnidade("ML")).toBe("mL");
  });

  it("mesmaBase agrupa massa e volume", () => {
    expect(mesmaBase("KG", "T")).toBe(true);
    expect(mesmaBase("L", "ML")).toBe(true);
    expect(mesmaBase("KG", "L")).toBe(false);
  });

  it("converte dentro da mesma base", () => {
    expect(converterQuantidade(200, "ML", "L")).toBeCloseTo(0.2);
    expect(converterQuantidade(1, "T", "KG")).toBe(1000);
  });

  it("erro claro em bases diferentes", () => {
    expect(() => converterQuantidade(1, "ML", "KG")).toThrow();
  });
});
