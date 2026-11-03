import { expect, it } from "vitest";
import { resumirAfericoesIndividuais } from "./producao-individual.calc";
const ponto = (data: string, litros: number | null, extras = {}) => ({ participanteId: data, data, litros, completa: true, excluido: false, lactacaoId: "l1", comparabilidade: "manha:MEDIDO|tarde:MEDIDO", finalidade: "COMPROVADA", ...extras });
it("usa toda a série real ordenada, sem preencher dias; preserva zero e exclui anulados e pendências", () => {
  const r = resumirAfericoesIndividuais([ponto("2026-10-20", 20), ponto("2026-10-01", 0), ponto("2026-10-03", null), ponto("2026-10-05", 999, { excluido: true })]);
  expect(r.pontos.map(p => p.data)).toEqual(["2026-10-01", "2026-10-20"]);
  expect(r.media).toBe(10); expect(r.maior?.litros).toBe(20); expect(r.variacao).toBe(20); expect(r.percentual).toBeNull();
});
it("não compara subtotal parcial com total, lactações diferentes ou ordenhas diferentes", () => {
  for (const extras of [{ completa: false }, { lactacaoId: "l2" }, { lactacaoId: null }, { comparabilidade: "manha:MEDIDO" }]) {
    const r = resumirAfericoesIndividuais([ponto("2026-10-01", 30), ponto("2026-10-20", 10, extras)]);
    expect(r.variacao).toBeNull();
  }
});
it("compara apenas as duas últimas aferições e conserva queda e percentual reais", () => {
  const r = resumirAfericoesIndividuais([ponto("2026-10-01", 30), ponto("2026-10-20", 24)]);
  expect(r.variacao).toBe(-6); expect(r.percentual).toBe(-20);
});
it("não apresenta zero na ausência de aferições", () => {
  expect(resumirAfericoesIndividuais([])).toMatchObject({ media: null, maior: null, ultima: null, variacao: null });
});
