import { expect, it, vi } from "vitest";
vi.mock("../../../db.js", () => ({ prisma: {} }));
import { combinarCustosSitios } from "./custos.js";

const producao = (litros: number | null, completa = true) => ({ litros, esperadas: 2, medidas: 2, naoOrdenhadas: 0, resolvidas: 2, pendentes: 0, completa });
const custos = (total: string | null, cobertura: "COMPLETO" | "PARCIAL" | "DESCONHECIDO" = "COMPLETO") => ({ rotulo: "Custo direto registrado", cobertura, situacao: cobertura, totalConhecido: total, componentesPendentes: cobertura === "COMPLETO" ? 0 : 1, limitacoes: [], componentes: [] });
const sitio = (id: number, total: string | null, litros: number | null, motivos: string[] = [], cobertura: "COMPLETO" | "PARCIAL" | "DESCONHECIDO" = "COMPLETO") => ({
  sitio: { id, nome: `Sítio ${id}` },
  r: { periodo: { inicio: "2026-10-01", fim: "2026-10-31" },
    consolidado: { custos: custos(total, cobertura), producao: producao(litros), animaisSemComponentes: [], custoPorLitro: null, situacao: motivos.length ? "NAO_APURADO" : "APURADO", motivos },
    porClassificacao: [{ finalidade: "NUTRICAO", custos: custos(total, cobertura) }] },
}) as never;

it("custo por litro consolidado é custo total ÷ litros totais, não média dos sítios", () => {
  // Sítio 1: R$ 100 / 100 L = R$ 1,00/L; sítio 2: R$ 900 / 300 L = R$ 3,00/L. Média simples seria R$ 2,00/L.
  const r = combinarCustosSitios([sitio(1, "100.00", 100), sitio(2, "900.00", 300)], true);
  expect(r.consolidado).toMatchObject({ custoPorLitro: "2.50", situacao: "APURADO" });
  expect(r.consolidado.custos.totalConhecido).toBe("1000.00");
  expect(r.consolidado.producao.litros).toBe(400);
  expect(r.porClassificacao).toEqual([expect.objectContaining({ finalidade: "NUTRICAO", custos: expect.objectContaining({ totalConhecido: "1000.00", cobertura: "COMPLETO" }) })]);
  expect(r.porSitio.map(s => s.nome)).toEqual(["Sítio 1", "Sítio 2"]);
});
it("pendência em qualquer sítio deixa o consolidado não apurado e a cobertura parcial", () => {
  const r = combinarCustosSitios([sitio(1, "100.00", 100), sitio(2, null, 300, ["CUSTO_PENDENTE"], "DESCONHECIDO")], true);
  expect(r.consolidado).toMatchObject({ custoPorLitro: null, situacao: "NAO_APURADO", motivos: ["CUSTO_PENDENTE"] });
  expect(r.consolidado.custos.cobertura).toBe("PARCIAL");
});
it("sem permissão de valores o consolidado fica oculto", () => {
  const r = combinarCustosSitios([sitio(1, null, 100)], false);
  expect(r.consolidado).toMatchObject({ situacao: "OCULTO", custoPorLitro: null });
  expect(r.consolidado.custos.situacao).toBe("OCULTO");
});
it("sítio sem leite e sem custo não trava o custo por litro do consolidado", () => {
  const vazio = sitio(3, null, null, ["SEM_VOLUME_POSITIVO"], "DESCONHECIDO") as unknown as { r: { consolidado: { producao: { esperadas: number }; custos: { componentesPendentes: number } } } };
  vazio.r.consolidado.producao.esperadas = 0;
  vazio.r.consolidado.custos.componentesPendentes = 0;
  const r = combinarCustosSitios([sitio(1, "100.00", 100), sitio(2, "900.00", 300), vazio as never], true);
  expect(r.consolidado).toMatchObject({ custoPorLitro: "2.50", situacao: "APURADO", motivos: [] });
  expect(r.consolidado.custos.cobertura).toBe("COMPLETO");
  expect(r.porSitio.map(s => s.nome)).toEqual(["Sítio 1", "Sítio 2", "Sítio 3"]);
});
