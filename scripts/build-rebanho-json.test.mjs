import { test } from "node:test";
import assert from "node:assert/strict";
import {
  categoriaDe, parseAnimal, derivarStatusRepro, delEStatusLactacao, diasEntre,
} from "./build-rebanho-json.mjs";

test("categoriaDe mapeia CDCATEGORIA por código e sexo", () => {
  assert.equal(categoriaDe("7", "F"), "VACA");
  assert.equal(categoriaDe("6", "F"), "NOVILHA");
  assert.equal(categoriaDe("5", "F"), "BEZERRA");
  assert.equal(categoriaDe("1", "M"), "BEZERRO");
  assert.equal(categoriaDe("2", "M"), "TOURO");
  assert.equal(categoriaDe("3", "M"), "TOURO");
  assert.equal(categoriaDe("4", "M"), "TOURO");
});

test("parseAnimal lê linha @A@ (baixado com motivo) — vazios viram null", () => {
  const linha = "1002~|~CATARINA~|~F~|~7~|~2019-06-01~|~2022-10-01~|~~|~~|~0~|~BAIXADO~|~2026-04-10~|~Venda~|~Principal - Leite~|~";
  const a = parseAnimal(linha);
  assert.equal(a.numero, "1002");
  assert.equal(a.nome, "CATARINA");
  assert.equal(a.sexo, "F");
  assert.equal(a.categoria, "VACA");
  assert.equal(a.dataNascimento, "2019-06-01");
  assert.equal(a.dataEntrada, "2022-10-01");
  assert.equal(a.brincoEletronico, null);
  assert.equal(a.numPartosEntrada, 0);
  assert.equal(a.status, "BAIXADO");
  assert.equal(a.dataBaixa, "2026-04-10");
  assert.equal(a.motivoBaixa, "Venda");
  assert.equal(a.setor, "Principal - Leite");
  assert.equal(a.raca, "Girolando"); // pelagem vazia → default
});

test("parseAnimal: ativo sem nome → nome null, dataBaixa/motivo null", () => {
  const a = parseAnimal("10~|~~|~F~|~7~|~2023-05-13~|~2023-05-13~|~~|~~|~0~|~ATIVO~|~~|~~|~Principal~|~Girolando");
  assert.equal(a.nome, null);
  assert.equal(a.status, "ATIVO");
  assert.equal(a.dataBaixa, null);
  assert.equal(a.motivoBaixa, null);
  assert.equal(a.raca, "Girolando");
});

test("derivarStatusRepro: DG positivo => PRENHE; del<60 => PEV; senão VAZIA", () => {
  assert.equal(derivarStatusRepro({ ultimoDgResultado: "positivo" }, 100), "PRENHE");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: "negativo" }, 30), "PEV");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: null }, 200), "VAZIA");
  assert.equal(derivarStatusRepro({ ultimoDgResultado: null }, null), "VAZIA");
});

test("diasEntre conta dias inteiros", () => {
  assert.equal(diasEntre("2026-01-01", "2026-01-31"), 30);
});

test("delEStatusLactacao: lactação aberta → del + lactacaoAberta; seca → del null", () => {
  const hoje = "2026-06-17";
  // aberta: início recente, sem secagem posterior
  const aberta = delEStatusLactacao({ dtInicioUltLac: "2026-05-04", dtUltSecagem: "2025-12-02" }, hoje);
  assert.equal(aberta.del, diasEntre("2026-05-04", hoje));
  assert.deepEqual(aberta.lactacaoAberta, { dtInicio: "2026-05-04" });
  // seca: secagem depois do início
  const seca = delEStatusLactacao({ dtInicioUltLac: "2025-07-12", dtUltSecagem: "2026-04-14" }, hoje);
  assert.equal(seca.del, null);
  assert.equal(seca.lactacaoAberta, null);
  // sem início → seca
  assert.equal(delEStatusLactacao({ dtInicioUltLac: null, dtUltSecagem: null }, hoje).del, null);
});
