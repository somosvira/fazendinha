// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PainelIndicadores } from "./PainelIndicadores";
import type { SnapshotIndicadoresReprodutivos } from "./indicadores-api";
afterEach(cleanup);
function snapshot(): SnapshotIndicadoresReprodutivos {
  const contagens = {
    vaziasAptasInicio: 0,
    negativasAnteriores: 0,
    anterioresSemDiagnostico: 2,
    estimativaVaziasAnteriores: null,
    saidasPev: 0,
    contribuicaoPev: 0,
    elegiveisConhecidas: 3.5,
    elegiveis: null,
    matrizesServidas: 4,
    tentativas: 8,
    positivas: 2,
    negativas: 2,
    abertas: 4,
    naoClassificaveis: 0,
    denominadorConcepcao: 4,
    animaisComPendenciaElegibilidade: 2,
  };
  const taxas = { servico: null, concepcao: 50, prenhez: null };
  return {
    versao: 1,
    versaoMetodologia: "v1",
    metodologia: {
      rotulo: "Método preservado",
      fontes: [],
      regras: ["Regra original"],
      deslocamentoTeDias: 7,
      concepcaoEstimada: null,
    },
    filtros: {
      propriedadeId: 9,
      inicio: "2026-01-01",
      fim: "2026-05-06",
      corte: "2026-10-17",
      deslocamentoTeDias: 7,
    },
    sobraInicial: null,
    periodos: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i}`,
      inicio: `2026-${String(i + 1).padStart(2, "0")}-01`,
      fim: `2026-${String(i + 1).padStart(2, "0")}-21`,
      contagens,
      taxas,
      pendencias: ["ELEGIBILIDADE_PENDENTE"],
      maturidade: { corte: "2026-10-17", diasAposFim: 5, tentativasAbertas: 4 },
      detalhamento: [],
    })),
    totais: {
      contagens,
      taxas,
      animaisUnicos: 8,
      participacoesAnimalPeriodo: 20,
    },
    pendencias: ["ELEGIBILIDADE_PENDENTE"],
  };
}
it("explica taxas com contagens reais e distingue pendente, conhecido e zero", () => {
  const s = snapshot();
  s.totais.taxas.concepcao = 0;
  s.totais.contagens.positivas = 0;
  render(<PainelIndicadores snapshot={s} />);
  expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  expect(
    screen.getByText("0 positivas / 4 no denominador de concepção."),
  ).toBeTruthy();
  expect(
    screen.getByText(/2 participações com aptidão a conferir/),
  ).toBeTruthy();
  expect(screen.getByText("Depende da taxa de serviço.")).toBeTruthy();
  expect(screen.queryByText("57%")).toBeNull();
  fireEvent.click(
    screen.getAllByRole("button", { name: "Conferir pendências" })[0],
  );
  expect(
    screen
      .getByRole("tab", { name: "Pendências" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(
    screen.getByRole("table", { name: "Animais e participações a conferir" }),
  ).toBeTruthy();
});
it("pagina períodos, mantém seleção na página e conserva datas completas acessíveis", () => {
  render(<PainelIndicadores snapshot={snapshot()} />);
  expect(
    screen
      .getByRole("button", { name: "01/06/2026 a 21/06/2026" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(
    screen.queryByRole("button", { name: "01/01/2026 a 21/01/2026" }),
  ).toBeNull();
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Paginação de períodos" }),
    ).getByRole("button", { name: "Próxima" }),
  );
  expect(
    screen
      .getByRole("button", { name: "01/02/2026 a 21/02/2026" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "01/01/2026 a 21/01/2026" }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Ver animais deste período" }),
  );
  expect(screen.getByText("Nenhum animal neste período.")).toBeTruthy();
  fireEvent.change(
    screen.getByRole("combobox", { name: "Períodos por página" }),
    { target: { value: "8" } },
  );
  expect(
    screen
      .getByRole("button", { name: "01/06/2026 a 21/06/2026" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(screen.queryByText("Nenhum animal neste período.")).toBeNull();
});
it("torna o ano visível em intervalo multianual e navega abas pelo teclado", () => {
  const s = snapshot();
  s.periodos[0].inicio = "2025-12-20";
  s.periodos[0].fim = "2026-01-09";
  render(<PainelIndicadores snapshot={s} />);
  expect(
    screen.getByRole("button", { name: "01/06/2026 a 21/06/2026" }).textContent,
  ).toContain("2026");
  const aba = screen.getByRole("tab", { name: "Visão geral" });
  aba.focus();
  fireEvent.keyDown(aba, { key: "End" });
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "Pendências" }),
  );
  fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
  expect(
    screen
      .getByRole("tab", { name: "Fila de manejo" })
      .getAttribute("aria-selected"),
  ).toBe("true");
  expect(screen.getByText(/não contém acompanhamento gerencial/)).toBeTruthy();
});
it("intervalo menor que 21 dias conserva ausência de denominador e mostra orientação", () => {
  const s = snapshot();
  s.periodos = [];
  s.totais.taxas = { servico: null, concepcao: null, prenhez: null };
  s.totais.contagens.denominadorConcepcao = 0;
  render(<PainelIndicadores snapshot={s} />);
  expect(
    screen.getByText("O intervalo não contém um período completo de 21 dias."),
  ).toBeTruthy();
  expect(screen.getByText(/Nenhum período completo de 21 dias/)).toBeTruthy();
  expect(
    screen.getByText("Sem tentativas com resultado para calcular concepção."),
  ).toBeTruthy();
});
