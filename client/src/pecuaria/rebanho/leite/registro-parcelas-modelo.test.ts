import { expect, it } from "vitest";
import { novaParcela, prepararParcelas, parcelaSalva, selecionarParcelasAlteradas, aplicarParcelasSalvas } from "./registro-parcelas-modelo";
import type { ContextoParcelas, ParcelaOrdenha } from "./parcelas-types";
const contexto: ContextoParcelas = {
  configuracao: { id: "c", propriedadeId: 1, vigenteDesde: "2026-10-01", inicial: false, fonteProducao: "GERAL", ordenhas: [] },
  sessoes: [], medicoes: [], tanques: [{ id: "t1v2", identidadeId: "t1", versao: 2, propriedadeId: 1, nome: "Principal", fabricante: null, modelo: null, numeroSerie: null, capacidadeLitros: 100, vigenteDesde: "2026-10-01", ativo: true, referenciaTabela: null, tabelaConversao: [{ mm: 10, litros: 20 }] }], animais: [], origensAutomaticas: [],
  contexto: { carencias: [{ posicaoId: "m", horario: null, animais: [{ animalId: "a", estado: "EM_CARENCIA", evidencias: [] }] }], partos: [], origensColostro: [], criterioColostro: null },
};
const parcela = () => ({ ...novaParcela("COMERCIAL", ["b"]), tanqueId: "t1v2", responsavel: "Maria", litros: "0", regua: "10" });
it("preserva zero explícito e régua sem conversão ou soma", () => {
  expect(prepararParcelas([parcela()], contexto, "m")[0]).toMatchObject({ litros: 0, reguaMm: 10, tanqueId: "t1v2", versaoEsperada: 0 });
  expect(() => prepararParcelas([{ ...parcela(), litros: "" }], contexto, "m")).toThrow("litros");
});
it("recusa capacidade excedida e não presume capacidade de recipiente livre", () => {
  expect(() => prepararParcelas([{ ...parcela(), litros: "101" }], contexto, "m")).toThrow("capacidade");
  expect(prepararParcelas([{ ...parcela(), tanqueId: "", recipiente: "Reservatório segregado", litros: "500" }], contexto, "m")[0].litros).toBe(500);
});
it("exige motivo em declaração direta e aceita origem desconhecida explícita sem liberar comercial", () => {
  const direta = { ...parcela(), natureza: "NAO_COMERCIAL" as const, direta: true, animais: [], litros: "10" };
  expect(() => prepararParcelas([direta], contexto, "m", true)).toThrow("Justifique");
  expect(prepararParcelas([{ ...direta, justificativa: "Origem não identificada no registro de campo" }], contexto, "m", true)[0]).toMatchObject({ animaisOrigem: [], declaracaoDireta: { justificativa: "Origem não identificada no registro de campo" } });
  expect(() => prepararParcelas([{ ...parcela(), animais: [], litros: "10" }], contexto, "m", true)).toThrow("animais de origem");
});
it("bloqueia origem comercial em carência e exige segregação física entre naturezas", () => {
  expect(() => prepararParcelas([{ ...parcela(), animais: ["a"] }], contexto, "m")).toThrow("carência");
  const comercial = { ...parcela(), litros: "10" };
  const descarte = { ...parcela(), natureza: "NAO_COMERCIAL" as const, animais: ["a"], litros: "10" };
  expect(() => prepararParcelas([comercial, descarte], contexto, "m", true)).toThrow("segregadas");
});
it("snapshot próprio de primeira ordenha só mantém contexto na mesma sessão com parto e versão atuais", () => {
  const parto = { id: "parto1", versao: 1, animalId: "a1", data: "2026-10-24" };
  const salva = { id: "m1", sessaoId: "s1", tanque: null, recipiente: "Balde", litros: 5, reguaMm: null, origemLitros: "MANUAL", natureza: "COLOSTRO" as const, animaisOrigem: ["a1"], responsavel: "Maria", observacao: null, versao: 1, entradaId: null, declaracaoDireta: null, primeiraOrdenhaColostro: true, criterioColostroSnapshot: { configuracaoId: "c", criterio: { tipo: "PRIMEIRA_ORDENHA" }, partos: [parto], primeiraOrdenhaColostro: true } };
  const p = parcelaSalva(salva);
  const proprio: ContextoParcelas = { ...contexto, sessoes: [{ id: "s1", posicaoId: "m", nome: "Manhã", ordem: 1 }], medicoes: [salva], contexto: { ...contexto.contexto, partos: [parto], origensColostro: [], criterioColostro: { tipo: "PRIMEIRA_ORDENHA" } } };
  expect(prepararParcelas([p], proprio, "m", true)[0]).not.toHaveProperty("declaracaoDireta");
  expect(() => prepararParcelas([p], { ...proprio, medicoes: [] }, "m", true)).toThrow("Justifique");
  expect(() => prepararParcelas([p], { ...proprio, contexto: { ...proprio.contexto, partos: [{ ...parto, versao: 2 }] } }, "m", true)).toThrow("Justifique");
});

const medicao: ParcelaOrdenha = { id: "m1", sessaoId: "s1", tanque: null, recipiente: "Balde", litros: 5, reguaMm: null, origemLitros: "MANUAL", natureza: "COLOSTRO", animaisOrigem: [], responsavel: "Maria", observacao: null, versao: 1, entradaId: null, declaracaoDireta: { justificativa: "Registro direto conferido" }, primeiraOrdenhaColostro: null, criterioColostroSnapshot: null };
it("compara os valores persistidos sem regravar formatação, produto ou motivo e distingue null de false", () => {
  const rascunho = { ...parcelaSalva(medicao), litros: "5,00", responsavel: " Maria ", motivo: "Conferência da natureza", produto: "p1" };
  const preparar = (p = rascunho) => prepararParcelas([p], contexto, "m");
  expect(selecionarParcelasAlteradas(preparar(), [medicao])).toEqual([]);
  expect(preparar()[0]).not.toHaveProperty("primeiraOrdenhaColostro");
  expect(selecionarParcelasAlteradas(preparar({ ...rascunho, primeira: false }), [medicao])).toEqual([expect.objectContaining({ primeiraOrdenhaColostro: false })]);
  const falsa = { ...medicao, primeiraOrdenhaColostro: false };
  expect(selecionarParcelasAlteradas(prepararParcelas([parcelaSalva(falsa)], contexto, "m"), [falsa])).toEqual([]);
});
it("revalida o contexto antes de escolher as parcelas alteradas", () => {
  const salva = { ...medicao, natureza: "COMERCIAL" as const, animaisOrigem: ["a"], declaracaoDireta: null };
  expect(() => selecionarParcelasAlteradas(prepararParcelas([parcelaSalva(salva)], contexto, "m"), [salva])).toThrow("carência");
});
it("associa respostas existentes por ID e novas por ordem sem absorver a parcela intacta", () => {
  const antiga = parcelaSalva(medicao);
  const alterada = { ...parcelaSalva({ ...medicao, id: "m2" }), litros: "7", produto: "p2", motivo: "Correção medida" };
  const nova = { ...novaParcela("COLOSTRO", [], true), recipiente: "Nova", litros: "8", responsavel: "Maria", justificativa: "Registro direto conferido", produto: "p3", motivo: "Natureza nova" };
  const inputs = prepararParcelas([nova, alterada], contexto, "m");
  const resultado = aplicarParcelasSalvas([antiga, nova, alterada], inputs, [{ ...medicao, id: "m-nova", recipiente: "Nova", litros: 8 }, { ...medicao, id: "m2", litros: 7, versao: 2 }]);
  expect(resultado[0]).toBe(antiga);
  expect(resultado[1]).toMatchObject({ id: "m-nova", chave: nova.chave, produto: "p3", motivo: "Natureza nova" });
  expect(resultado[2]).toMatchObject({ id: "m2", chave: alterada.chave, litros: "7", versao: 2, produto: "p2", motivo: "Correção medida" });
});
