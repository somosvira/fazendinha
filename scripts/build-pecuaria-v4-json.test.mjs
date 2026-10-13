import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS,
  transformarV4,
  verificarCompletude,
} from "./build-pecuaria-v4-json.mjs";
const linha = (tag, registro) =>
  `@${tag}@${CAMPOS[tag].map((c) => registro[c] ?? "").join("~|~")}`;
const animal = linha("A", {
  id: "1",
  tipo: "A",
  rebanho: "1",
  sexo: "F",
  entrada: "2023-01-01",
  partosAntesEntrada: "2",
});
const r = (registro) =>
  linha("R", {
    id: "10",
    animal: "1",
    data: "2024-01-01",
    tipo: "1",
    ...registro,
  });
test("transformação é determinística e mantém doses desconhecidas", () => {
  const a = transformarV4(animal + "\n" + r({}));
  const b = transformarV4(r({}) + "\n" + animal);
  assert.deepEqual(a, b);
  assert.equal(a.fatos[0].quantidade, null);
  assert.equal(a.fatos[0].snapshot.doses, null);
  assert.equal(a.relatorio.pendencias[0].codigo, "QUANTIDADE_DESCONHECIDA");
});
test("CDDIAGNOSTICO aponta da tentativa ao exame, nunca escolhe por data", () => {
  const dados = transformarV4(
    [
      animal,
      r({ diagnosticoRef: "20" }),
      r({ id: "20", tipo: "4", data: "2024-02-01", diagnostico: "P" }),
      r({ id: "21", tipo: "4", data: "2024-02-02", diagnostico: "P" }),
    ].join("\n"),
  );
  assert.equal(dados.fatos[1].tentativaChave, "REPRODUCAO:10");
  assert.equal(dados.fatos[2].tentativaChave, null);
});
test("aborto/natimorto contam parto; anterior à entrada só identifica possível sobreposição", () => {
  const dados = transformarV4(
    [
      animal,
      linha("TP", { id: "2", nome: "Aborto" }),
      r({ id: "11", tipo: "7", data: "2022-01-01", tipoParto: "2" }),
    ].join("\n"),
  );
  assert.equal(dados.fatos[0].desfecho, "ABORTO");
  assert.equal(dados.fatos[0].contaParidade, true);
  assert.equal(dados.fatos[0].anteriorEntrada, true);
  assert.equal(dados.fatos[0].incluidoSaldoAnterior, undefined);
  assert.deepEqual(dados.fatos[0].criasComReferencia, []);
});
test("TE mantém material legado sem tratar CDEMBRIAO como cria; lactação só liga referência explícita", () => {
  const dados = transformarV4(
    [
      animal,
      r({ tipo: "3", embriao: "900" }),
      linha("L", { id: "1", animal: "1", inicio: "2024-01-01" }),
    ].join("\n"),
  );
  assert.equal(dados.fatos[0].snapshot.embriao, "900");
  assert.deepEqual(dados.fatos[0].criasComReferencia, []);
  assert.equal(dados.lactacoes[0].partoChave, null);
});
test("rejeita dump parcial, chaves duplicadas e datas inválidas", () => {
  assert.throws(() => transformarV4(animal), /incompleta/);
  assert.throws(
    () => transformarV4([animal, r({}), r({})].join("\n")),
    /duplicada/,
  );
  assert.throws(
    () => transformarV4([animal, r({ data: "2024-02-31" })].join("\n")),
    /inválida/,
  );
});

test("completude exige marcador final e contagens para todas tabelas", () => {
  const texto = animal + "\n" + r({});
  const dados = transformarV4(texto);
  assert.throws(() => verificarCompletude(texto, dados), /marcador final/);
  assert.throws(
    () => verificarCompletude(texto + "\n@V4@FIM", dados),
    /Contagem/,
  );
});
