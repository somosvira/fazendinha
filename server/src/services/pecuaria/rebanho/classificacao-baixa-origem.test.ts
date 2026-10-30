import { expect, it } from "vitest";
import { mapBaixaIdeagri } from "./classificacao-baixa-origem.js";

it.each([
  ["Venda", 1, "VENDA"], ["Abate", 2, "ABATE"], ["Doação", null, "DOACAO"],
  ["Cadastro indevido", null, "CADASTRO_INDEVIDO"], ["Doença", 3, "MORTE"],
  ["Morte", null, "MORTE"], ["Extravio", null, "EXTRAVIO"],
] as const)("preserva tipo comprovado %s/%s", (nome, classe, tipo) => {
  expect(mapBaixaIdeagri(nome, classe).tipo).toBe(tipo);
});
it.each([
  [null, null], ["Baixa produção", 1], ["Problemas reprodutivos", 2], ["Problemas no parto", null], [null, 99],
] as const)("não presume venda ou morte para origem ambígua %s/%s", (nome, classe) => {
  expect(() => mapBaixaIdeagri(nome, classe)).toThrow(/regularização histórica/i);
});

it.each([["Venda", 3], ["Morte", 1]] as const)("não escolhe entre evidências conflitantes %s/%s", (nome, classe) => {
  expect(() => mapBaixaIdeagri(nome, classe)).toThrow(/conflito/i);
});
