import { describe, expect, it } from "vitest";
import type { DashboardData } from "../../api";
import { dashboardParaCsv } from "./dashboardExport";

const hero = { valor: null, unidade: "L/dia", anterior: null, variacaoAbsoluta: null, variacaoPercentual: null, comparavel: false, serie: [] };
const data: DashboardData = {
  periodo: { chave: "7d", inicio: "2026-07-10", fim: "2026-07-16", rotuloComparacao: "7 dias anteriores" },
  atualizacao: { geradoEm: "2026-07-16T10:00:00Z", dadoMaisRecenteEm: null, animaisAtivos: 2, diasComProducao: 0, diasEsperados: 7, producaoParcial: true, avisos: [] },
  herois: { vacasEmLactacao: { ...hero, valor: 1, unidade: "vacas" }, producaoMediaVaca: { ...hero, unidade: "L/vaca/dia" }, producaoTotalDia: hero, percentualVacasLactacao: { ...hero, valor: 50, unidade: "%" } },
  estadosReprodutivos: { totalElegiveis: 1, segmentos: [{ chave: "PRENHE", label: "Prenhes", quantidade: 1, percentual: 100 }] },
  indicadores: { producao: [{ chave: "p", label: "Produção", valor: null, unidade: "L", qualidade: "indisponivel" }], reproducao: [], rebanho: [] },
  alertas: [{ chave: "ccs-alta", label: "CCS alta", quantidade: 0, severidade: "critico", tab: "sanidade", detalhe: "Sem casos", acao: { dominio: "sanidade", tipoEvento: "EXAME" }, itens: [] }],
  grupos: [{ grupoId: null, nome: "Sem grupo", animaisAtivos: 2, vacas: 1, emLactacao: 1, percentualDoRebanho: 100 }],
};

describe("dashboardParaCsv", () => {
  it("exporta todas as seções sem converter indisponível em zero", () => {
    const csv = dashboardParaCsv(data);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Painel do rebanho"');
    expect(csv).toContain('"Estado reprodutivo"');
    expect(csv).toContain('"Sem grupo";"2";"1";"1"');
    expect(csv).toContain('"Produção";;"L";"indisponivel"');
  });
});
