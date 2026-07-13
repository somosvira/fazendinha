import { describe, it, expect } from "vitest";
import { reconciliarMes, type FluxoData } from "./reconciliacao";

/* Dados reais do mock p/ Abril/26 (idx 21) — o mês do bug reportado. Aqui montamos
 * uma janela mínima onde creditoTotal/debitoTotal são o dado lossless do backend. */
function fluxoAbril(): { R: FluxoData; idx: number } {
  const idx = 0; // janela de 1 mês p/ o teste
  const receitaLeite = 158403;
  const receitaCafe = 0;
  const custeioLeitePuro = 459541; // 469351 BPO − 0 animal − 9810 caminhão
  const custeioCafe = 1503;
  const sedeOutros = 4586;
  const investLeite = 579106;
  const investCafe = 35254;
  const animalAquisicao = 0;
  const rnCaminhao = 9810;
  // Backend lossless: totalGeral = crédito − débito. Aqui há um débito "outros"
  // (invest de atividade outros) de 42.690 que vaza dos baldes — o resíduo real de abril.
  const creditoTotal = receitaLeite + receitaCafe; // 158403
  const debitoTotal =
    custeioLeitePuro + custeioCafe + sedeOutros + investLeite + investCafe + animalAquisicao + rnCaminhao + 42690;
  const totalGeral = creditoTotal - debitoTotal; // −974.290 ≈ o −974k do gráfico

  const R: FluxoData = {
    totalGeral: [totalGeral],
    creditoTotal: [creditoTotal],
    debitoTotal: [debitoTotal],
    receitaLeite: [receitaLeite],
    receitaCafe: [receitaCafe],
    custeioLeitePuro: [custeioLeitePuro],
    custeioCafe: [custeioCafe],
    sedeOutros: [sedeOutros],
    investLeite: [investLeite],
    investCafe: [investCafe],
    animalAquisicao: [animalAquisicao],
    rnCaminhao: [rnCaminhao],
  };
  return { R, idx };
}

describe("reconciliarMes()", () => {
  it("líquido é o totalGeral (o número que o gráfico plota)", () => {
    const { R, idx } = fluxoAbril();
    const r = reconciliarMes(R, idx);
    expect(r.liquido).toBe(R.totalGeral[idx]);
  });

  it("entrada − gasto === líquido (identidade lossless)", () => {
    const { R, idx } = fluxoAbril();
    const r = reconciliarMes(R, idx);
    expect(r.entrada - r.gastoTotal).toBe(r.liquido);
  });

  it("o breakdown do gasto soma EXATAMENTE ao gasto total", () => {
    const { R, idx } = fluxoAbril();
    const r = reconciliarMes(R, idx);
    const soma = r.breakdown.reduce((s, l) => s + l.valor, 0);
    expect(soma).toBe(r.gastoTotal);
  });

  it("expõe o vazamento como linha 'não classificado' (≥ 0 no dado real)", () => {
    const { R, idx } = fluxoAbril();
    const r = reconciliarMes(R, idx);
    expect(r.naoClassificado).toBe(42690);
    expect(r.breakdown.some((l) => l.label.startsWith("Outros"))).toBe(true);
  });

  it("sem resíduo material, não gera linha 'Outros' de ruído", () => {
    const { R, idx } = fluxoAbril();
    // Zera o vazamento: debitoTotal passa a ser exatamente a soma dos baldes.
    const semLeak: FluxoData = {
      ...R,
      debitoTotal: [R.custeioLeitePuro[0] + R.custeioCafe[0] + R.sedeOutros[0] + R.investLeite[0] + R.investCafe[0] + R.animalAquisicao[0] + R.rnCaminhao[0]],
      totalGeral: [R.creditoTotal![0] - (R.custeioLeitePuro[0] + R.custeioCafe[0] + R.sedeOutros[0] + R.investLeite[0] + R.investCafe[0] + R.animalAquisicao[0] + R.rnCaminhao[0])],
    };
    const r = reconciliarMes(semLeak, idx);
    expect(r.naoClassificado).toBe(0);
    expect(r.breakdown.some((l) => l.label.startsWith("Outros"))).toBe(false);
    // Mesmo sem a linha residual, o breakdown ainda fecha.
    expect(r.breakdown.reduce((s, l) => s + l.valor, 0)).toBe(r.gastoTotal);
  });

  it("fallback: sem creditoTotal/debitoTotal deriva gasto do líquido", () => {
    const { R, idx } = fluxoAbril();
    const semTotais: FluxoData = { ...R, creditoTotal: undefined, debitoTotal: undefined };
    const r = reconciliarMes(semTotais, idx);
    // entrada = receita baldes; gasto = entrada − liquido; breakdown ainda fecha.
    expect(r.entrada).toBe(R.receitaLeite[idx] + R.receitaCafe[idx]);
    expect(r.entrada - r.gastoTotal).toBe(r.liquido);
    expect(r.breakdown.reduce((s, l) => s + l.valor, 0)).toBe(r.gastoTotal);
  });
});
