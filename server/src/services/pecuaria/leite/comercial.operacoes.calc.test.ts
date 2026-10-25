import { expect, it } from "vitest";
import { calcularFechamentoLeite } from "./comercial.operacoes.calc.js";
const origens = [
  { id: "a", quantidade: 100 },
  { id: "b", quantidade: 150 },
];
const parcelas = [
  { retiradaId: "a", quantidadeReconhecida: 100 },
  { retiradaId: "b", quantidadeReconhecida: 150 },
];
it("fecha 250 L em duas retiradas por R$625, sem recalcular o volume físico", () => {
  const r = calcularFechamentoLeite(origens, parcelas, "2.50");
  expect(r.total.toFixed(2)).toBe("625.00");
  expect(r.volume.toString()).toBe("250");
});
it("exige todas as retiradas, unicidade e justificativa de divergência inclusive zero", () => {
  expect(() =>
    calcularFechamentoLeite(origens, parcelas.slice(0, 1), 2.5),
  ).toThrow(/todas/);
  expect(() =>
    calcularFechamentoLeite(origens, [parcelas[0], parcelas[0]], 2.5),
  ).toThrow(/uma única/);
  expect(() =>
    calcularFechamentoLeite(
      origens,
      [parcelas[0], { retiradaId: "b", quantidadeReconhecida: 0 }],
      2.5,
    ),
  ).toThrow(/Justifique/);
  const r = calcularFechamentoLeite(
    origens,
    [
      parcelas[0],
      {
        retiradaId: "b",
        quantidadeReconhecida: 0,
        motivoDiferenca: "Rejeição no comprador",
      },
    ],
    2.5,
    -10,
  );
  expect(r.total.toString()).toBe("240");
  expect(origens[1].quantidade).toBe(150);
});
it("arredonda dinheiro uma vez em Decimal e não aceita zero fictício", () => {
  expect(
    calcularFechamentoLeite(
      [{ id: "a", quantidade: 1 }],
      [{ retiradaId: "a", quantidadeReconhecida: 1 }],
      "2.505",
    ).total.toFixed(2),
  ).toBe("2.51");
  expect(() => calcularFechamentoLeite(origens, parcelas, 0)).toThrow();
  expect(() => calcularFechamentoLeite(origens, parcelas, 2.5, -625)).toThrow();
});
