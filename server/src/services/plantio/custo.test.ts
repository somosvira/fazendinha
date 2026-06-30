import { describe, it, expect } from "vitest";
import { quebrarPorCategoria } from "../rebanho/custo-producao.js";

// O motor de quebra por categoria é reusado do rebanho; aqui validamos a LÓGICA
// de split custeio vs investimento do café (a parte nova do P2) sem tocar no
// banco — replicando a regra `ehInvestimento` aplicada em custo.ts.
const ehInvestimento = (centro: string) => /investimento/i.test(centro);

interface Lanc {
  valor: number;
  categoria: string;
  centro: string;
}

function split(lancs: Lanc[]) {
  const custeio = lancs.filter((l) => !ehInvestimento(l.centro));
  const investimento = lancs.filter((l) => ehInvestimento(l.centro));
  const custeioTotal = custeio.reduce((s, l) => s + l.valor, 0);
  const investimentoTotal = investimento.reduce((s, l) => s + l.valor, 0);
  const breakdown = quebrarPorCategoria(custeio.map((l) => ({ categoria: l.categoria, valor: l.valor })));
  return { custeioTotal, investimentoTotal, breakdown };
}

describe("custo plantio — split custeio vs investimento", () => {
  it("separa por 'investimento' no nome do centro de custo", () => {
    const r = split([
      { valor: 1000, categoria: "Adubo", centro: "Plantio Café" },
      { valor: 500, categoria: "Mão de obra", centro: "Atividade Plantio" },
      { valor: 8000, categoria: "Mudas", centro: "Plantio Café - investimento" },
    ]);
    expect(r.custeioTotal).toBe(1500);
    expect(r.investimentoTotal).toBe(8000);
  });

  it("breakdown do custeio agrega por categoria com pct sobre o custeio", () => {
    const r = split([
      { valor: 1000, categoria: "Adubo", centro: "Plantio Café" },
      { valor: 1000, categoria: "Adubo", centro: "Atividade Plantio" },
      { valor: 2000, categoria: "Defensivo", centro: "Plantio Café" },
      { valor: 9999, categoria: "Mudas", centro: "Plantio Café - investimento" },
    ]);
    expect(r.custeioTotal).toBe(4000);
    expect(r.breakdown.total).toBe(4000);
    // Adubo aparece somado (1000+1000) e Defensivo agregado; ambos 50% do custeio.
    expect(r.breakdown.linhas).toEqual([
      { categoria: "Adubo", valor: 2000, pct: 50 },
      { categoria: "Defensivo", valor: 2000, pct: 50 },
    ]);
    // investimento NÃO entra no breakdown nem no custeioTotal.
    expect(r.investimentoTotal).toBe(9999);
  });

  it("só investimento → custeio 0, breakdown vazio (não divide por zero)", () => {
    const r = split([{ valor: 5000, categoria: "Formação", centro: "Plantio Café - investimento" }]);
    expect(r.custeioTotal).toBe(0);
    expect(r.investimentoTotal).toBe(5000);
    expect(r.breakdown).toEqual({ total: 0, linhas: [] });
  });
});
