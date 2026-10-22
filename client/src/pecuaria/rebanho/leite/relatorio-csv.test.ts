import { expect, it } from "vitest";
import { csvCustosLeite, type RelatorioExportavel } from "./relatorio-csv";
it("conserva ausências e zero, usa custos do recorte, mascara dinheiro e neutraliza fórmula de nome", () => {
  const resumo = {
    situacao: "OCULTO",
    producao: { litros: 0, completa: false },
    custos: { totalConhecido: "900", cobertura: "COMPLETO" },
    custoPorLitro: "1.50",
  };
  const dados: RelatorioExportavel = {
    coberturaPeriodo: {
      diasInformados: 1,
      diasSemFolha: ["2026-10-02"],
      diasParciais: [],
      completa: false,
    },
    consolidado: resumo,
    animais: [
      { ...resumo, animalId: "animal", brinco: "123", nome: '=HYPERLINK("x")' },
    ],
    ritmo: [
      {
        data: "2026-10-02",
        litros: null,
        estado: "SEM_FOLHA",
        esperadas: null,
        resolvidas: null,
        pendentes: null,
      },
    ],
  };
  const csv = csvCustosLeite(dados, "2026-10-01", "2026-10-02");
  expect(csv).toContain('"TOTAL";"";"0";"";"";"OCULTO"');
  expect(csv).toContain('"2026-10-02";"";"SEM_FOLHA";"";"";""');
  expect(csv).toContain('"\'=HYPERLINK(""x"")"');
  expect(csv).not.toContain('"900"');
  expect(csv).not.toContain('"1.50"');
});
it("exporta estados físicos pendentes preservando litros e oculta motivos financeiros", () => {
  const resumo = { situacao: "OCULTO", motivos: ["PERIODO_FINALIDADE_SEM_RATEIO"], producao: { litros: 18.5, completa: false }, custos: { totalConhecido: "999", cobertura: "PARCIAL" }, custoPorLitro: null };
  const csv = csvCustosLeite({ consolidado: resumo, animais: [], coberturaPeriodo: { diasInformados: 1, diasSemFolha: [], diasParciais: [], diasFinalidadePendente: ["2026-10-01"], diasSemAnimaisElegiveis: ["2026-10-02"], completa: false }, ritmo: [{ data: "2026-10-01", litros: 18.5, estado: "FINALIDADE_PENDENTE", esperadas: 1, resolvidas: 1, pendentes: 0 }] }, "2026-10-01", "2026-10-02");
  expect(csv).toContain('"Dias com finalidade pendente";"2026-10-01"');
  expect(csv).toContain('"18.5";"FINALIDADE_PENDENTE"');
  expect(csv).not.toContain("PERIODO_FINALIDADE_SEM_RATEIO");
  expect(csv).not.toContain('"999"');
});
