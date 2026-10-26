import { describe, expect, it } from "vitest";
import { planejarFornecimentoLeite, valorGerencialLeite } from "./nutricao.calc.js";
const origem = (entradaId: string, natureza: string, quantidade: string, valor: string | null = null) => ({ entradaId, produtoId: entradaId, natureza, quantidade, valor, data: "2026-10-01", ordem: 1 });
describe("fornecimento leiteiro da dieta", () => {
 it("prioriza 40 L não comerciais e complementa 20 L comerciais sem perder custo", () => { const p = planejarFornecimentoLeite([origem("com", "COMERCIAL", "80", "112"), origem("nc", "NAO_COMERCIAL", "40", "56")], "60"); expect(p.parcelas.map(o => [o.entradaId,o.quantidade.toString()])).toEqual([["nc","40"],["com","20"]]); expect(p.custoProducao?.toString()).toBe("84"); expect(valorGerencialLeite("60","2.50").toString()).toBe("150"); expect(valorGerencialLeite("60","2.70").toString()).toBe("162"); });
 it("80 elegíveis fornecem 60 mantendo 20, sem exigir preço ou custo", () => { const p = planejarFornecimentoLeite([origem("nc", "NAO_COMERCIAL", "80")], "60"); expect(p.restante.toString()).toBe("20"); expect(p.custoProducao).toBeNull(); });
 it("50 disponíveis nunca viram 60; colostro não integra leite comum", () => { expect(() => planejarFornecimentoLeite([origem("nc","NAO_COMERCIAL","50"), origem("col","COLOSTRO","100")], "60")).toThrow("Saldo elegível insuficiente"); });
 it("conserva mililitros Decimal e resíduos de custo", () => { const p = planejarFornecimentoLeite([origem("a","NAO_COMERCIAL","0.3","0.01"),origem("b","COMERCIAL","0.7","0.03")], "0.6"); expect(p.parcelas.reduce((s,o) => s.plus(o.quantidade), p.quantidade.mul(0)).toString()).toBe("0.6"); expect(p.restante.toString()).toBe("0.4"); });
});
