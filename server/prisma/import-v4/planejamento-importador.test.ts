import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { cargaSchema, mapeamentoSchema } from "./contrato.js";
import { importarV4 } from "./importador.js";

function cenario() {
  const dados = cargaSchema.parse({
    versao: 4, origem: "IDEAGRI", sha256: "a".repeat(64), animais: [{ id: "1" }],
    fatos: [{ origem: "IDEAGRI", chaveExterna: "REPRODUCAO:1", tipo: "IA", animalIdeagriId: 1,
      data: "2024-02-01", hora: null, tentativaChave: null, resultado: null, desfecho: null,
      desfechoOriginal: null, contaParidade: false, anteriorEntrada: false, quantidade: null,
      criasComReferencia: [], snapshot: { id: "1" } }],
    lactacoes: [], periodos: [], programacoes: [], participacoes: [], protocolos: [], etapas: [],
    catalogos: { tiposParto: [], motivosSecagem: [] }, relatorio: { totais: {}, porTipo: {}, pendencias: [] },
  });
  const mapa = mapeamentoSchema.parse({ bancoOrigem: "TESTE", autorId: 1 });
  const escritas: string[] = [];
  const vazio = { findMany: async () => [] };
  const db = {
    usuario: { findUnique: async () => ({ id: 1 }) },
    animal: { findMany: async () => [{ id: "animal", ideagriId: 1, sexo: "F", dataEntrada: new Date("2024-01-01"), partosAntesDaEntrada: 0, localizacoes: [] }] },
    vinculoImportacaoPecuaria: vazio,
    tentativaReprodutiva: vazio, partoAnimal: vazio, avaliacaoReprodutiva: vazio, lactacaoAnimal: vazio,
    criaParto: vazio, situacaoInicialReprodutiva: vazio, restricaoReprodutiva: vazio,
    $transaction: async () => { escritas.push("transação"); throw new Error("falha transacional"); },
  } as unknown as PrismaClient;
  return { dados, mapa, db, escritas };
}

describe("planejamento V4 sem banco", () => {
  it("prévia apresenta manifesto e dependências sem abrir escrita", async () => {
    const { dados, mapa, db, escritas } = cenario();
    dados.fatos.push({ ...dados.fatos[0], chaveExterna: "REPRODUCAO:2", tipo: "DIAGNOSTICO", data: "2024-03-01", tentativaChave: "REPRODUCAO:1", snapshot: { id: "2" } });
    const resultado = await importarV4(db, dados, mapa);
    expect(escritas).toEqual([]);
    expect(resultado.manifesto.itens.map((i) => [i.chave, i.dependencias])).toEqual([
      ["REPRODUCAO:1", []], ["REPRODUCAO:2", ["REPRODUCAO:1"]],
    ]);
    expect(resultado.recibo).toEqual([]);
  });
  it("duplicidade no lote bloqueia tudo antes de escrever", async () => {
    const { dados, mapa, db, escritas } = cenario();
    dados.fatos.push({ ...dados.fatos[0] });
    const resultado = await importarV4(db, dados, mapa, true);
    expect(resultado.conflitos).toContainEqual({ chave: "REPRODUCAO:1", motivo: expect.stringMatching(/duplicada/i) });
    expect(escritas).toEqual([]);
  });
  it("recibo identifica falha e impede tentativa de executar o diagnóstico dependente", async () => {
    const { dados, mapa, db, escritas } = cenario();
    dados.fatos.push({ ...dados.fatos[0], chaveExterna: "REPRODUCAO:2", tipo: "DIAGNOSTICO", data: "2024-03-01", tentativaChave: "REPRODUCAO:1", snapshot: { id: "2" } });
    const resultado = await importarV4(db, dados, mapa, true);
    expect(escritas).toEqual(["transação"]);
    expect(resultado.recibo.map((i) => [i.chave, i.estado])).toEqual([
      ["REPRODUCAO:1", "FALHOU"], ["REPRODUCAO:2", "BLOQUEADO"],
    ]);
    expect(resultado.importados).toBe(0);
  });
  it("execução rejeita manifesto divergente antes de abrir transação", async () => {
    const { dados, mapa, db, escritas } = cenario();
    const previa = await importarV4(db, dados, mapa);
    dados.fatos[0].quantidade = "2";
    const resultado = await importarV4(db, dados, mapa, true, previa.manifesto.hash);
    expect(resultado.conflitos.some((c) => /manifesto/i.test(c.motivo))).toBe(true);
    expect(escritas).toEqual([]);
  });
  it("trocar autoria ou localização invalida o manifesto revisado", async () => {
    const { dados, mapa, db, escritas } = cenario();
    const previa = await importarV4(db, dados, mapa);
    const outroAutor = await importarV4(db, dados, { ...mapa, autorId: 2 }, true, previa.manifesto.hash);
    expect(outroAutor.conflitos.some((c) => /manifesto/i.test(c.motivo))).toBe(true);
    const animais = await db.animal.findMany();
    db.animal.findMany = (async () => animais.map((a) => ({ ...a, localizacoes: [{ id: "local", desde: new Date("2024-01-01"), ate: null, propriedadeId: 9 }] }))) as typeof db.animal.findMany;
    const outroLocal = await importarV4(db, dados, mapa, true, previa.manifesto.hash);
    expect(outroLocal.conflitos.some((c) => /manifesto/i.test(c.motivo))).toBe(true);
    expect(escritas).toEqual([]);
  });
  it("recibo da repetição conserva o ID dos registros reutilizados", async () => {
    const { dados, mapa, db, escritas } = cenario();
    const previa = await importarV4(db, dados, mapa);
    db.vinculoImportacaoPecuaria.findMany = (async () => [{ bancoOrigem: "TESTE", tabelaOrigem: "REPRODUCAO", chaveOrigem: "1", destinoId: "tentativa-original", hashOrigem: previa.manifesto.itens[0].hash }]) as typeof db.vinculoImportacaoPecuaria.findMany;
    const resultado = await importarV4(db, dados, mapa, true);
    expect(resultado.recibo).toEqual([{ chave: "REPRODUCAO:1", estado: "REUTILIZADO", destinoId: "tentativa-original" }]);
    expect(resultado.existentes).toBe(1);
    expect(resultado.importados).toBe(0);
    expect(escritas).toEqual([]);
  });

});
