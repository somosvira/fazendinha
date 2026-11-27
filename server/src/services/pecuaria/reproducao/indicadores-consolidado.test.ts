import { expect, it, vi } from "vitest";
vi.mock("../../../db.js", () => ({ prisma: {} }));
import { combinarIndicadores, somarBase, somarContagens } from "./indicadores-consolidado.js";
import { calcularTaxasIndicadores, type ContagensIndicadores } from "./indicadores.calc.js";

const contagens = (elegiveis: number | null, servidas: number, tentativas: number, positivas: number): ContagensIndicadores => ({
  vaziasAptasInicio: elegiveis ?? 0, negativasAnteriores: 0, anterioresSemDiagnostico: 0, estimativaVaziasAnteriores: 0, saidasPev: 0, contribuicaoPev: 0,
  elegiveisConhecidas: elegiveis ?? 0, elegiveis, matrizesServidas: servidas, tentativas, positivas, negativas: tentativas - positivas, abertas: 0, naoClassificaveis: 0,
  denominadorConcepcao: tentativas, animaisComPendenciaElegibilidade: 0 });
const snapshot = (c: ContagensIndicadores) => ({
  versao: 2, versaoMetodologia: "X", metodologia: { rotulo: "", fontes: [], regras: [], deslocamentoTeDias: 7, concepcaoEstimada: null }, filtros: {}, politicas: [], sobraInicial: null,
  periodos: [{ id: "p1", inicio: "2026-10-01", fim: "2026-10-21", contagens: c, taxas: calcularTaxasIndicadores(c), pendencias: [], maturidade: { corte: "2026-11-01", diasAposFim: 11, tentativasAbertas: 1 }, detalhamento: [] }],
  totais: { contagens: c, taxas: calcularTaxasIndicadores(c), participacoesAnimalPeriodo: 1, animaisUnicos: 1 }, pendencias: [],
}) as never;

it("taxas consolidadas vêm da soma das contagens, não da média das taxas", () => {
  // Sítio A: 10 elegíveis, 9 servidas (90%); sítio B: 90 elegíveis, 27 servidas (30%). Média simples seria 60%.
  const r = combinarIndicadores([{ sitio: { id: 1, nome: "A" }, s: snapshot(contagens(10, 9, 9, 3)) }, { sitio: { id: 2, nome: "B" }, s: snapshot(contagens(90, 27, 27, 9)) }]);
  expect(r.totais.contagens).toMatchObject({ elegiveis: 100, matrizesServidas: 36, tentativas: 36, positivas: 12 });
  expect(r.totais.taxas).toEqual(calcularTaxasIndicadores(r.totais.contagens));
  expect(r.periodos[0].maturidade.tentativasAbertas).toBe(2);
  expect(r.acompanhamento).toBeUndefined();
  expect(r.porSitio.map(s => s.nome)).toEqual(["A", "B"]);
});
it("elegíveis desconhecidos em um sítio mantêm o total desconhecido", () => {
  expect(somarContagens([contagens(10, 1, 1, 0), contagens(null, 1, 1, 0)]).elegiveis).toBeNull();
});
it("base de cálculo soma os sítios e fica parcial se algum sítio tiver pendências", () => {
  expect(somarBase([
    { animaisValidos: 5, animaisPendentes: 0, participacoesValidas: 5, participacoesPendentes: 0, parcial: false },
    { animaisValidos: 2, animaisPendentes: 3, participacoesValidas: 2, participacoesPendentes: 4, parcial: true },
    undefined,
  ])).toEqual({ animaisValidos: 7, animaisPendentes: 3, participacoesValidas: 7, participacoesPendentes: 4, parcial: true });
  expect(somarBase([undefined])).toBeUndefined();
});
