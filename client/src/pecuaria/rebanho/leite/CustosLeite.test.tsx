// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CustosLeite } from "./CustosLeite";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
const resumo = {
  custoPorLitro: null,
  situacao: "NAO_APURADO",
  motivos: ["DIAS_SEM_FOLHA"],
  producao: { litros: 600, completa: true },
  custos: { totalConhecido: "900.00", cobertura: "COMPLETO" },
};
it("explica a cobertura parcial sem apresentar custo por litro como zero", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({
    ritmo: [],
    coberturaPeriodo: {
      diasInformados: 1,
      diasSemFolha: ["2026-10-02"],
      diasParciais: [],
      completa: false,
    },
    consolidado: resumo,
    animais: [],
  });
  render(<CustosLeite />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar período" }));
  expect(
    await screen.findByText(
      "O período está incompleto. Os litros informados não representam toda a produção esperada.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Não apurado")).toBeTruthy();
  expect(screen.queryByText("R$ 0,00")).toBeNull();
});
it("trocar o filtro libera nova consulta e ignora a resposta antiga", async () => {
  let resolver!: (valor: unknown) => void;
  vi.mocked(consultarLeite).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  render(<CustosLeite />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar período" }));
  fireEvent.change(screen.getByLabelText("Início"), {
    target: { value: "2026-10-02" },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Consultar período",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  resolver({
    ritmo: [],
    coberturaPeriodo: {
      diasInformados: 1,
      diasSemFolha: [],
      diasParciais: [],
      completa: true,
    },
    consolidado: resumo,
    animais: [],
  });
  await Promise.resolve();
  expect(screen.queryByText("Litros medidos")).toBeNull();
});
it.each(["NAO_APURADO", "OCULTO"])("preserva litros e explica finalidade sem vazar motivos financeiros em %s", async situacao => {
  vi.mocked(consultarLeite).mockResolvedValue({ ritmo: [], coberturaPeriodo: { diasInformados: 1, diasSemFolha: [], diasParciais: [], diasFinalidadePendente: ["2026-10-01"], diasSemAnimaisElegiveis: ["2026-10-02"], completa: false },
    consolidado: { ...resumo, situacao, motivos: ["PERIODO_FINALIDADE_SEM_RATEIO", "FINALIDADE_PRODUCAO_PENDENTE"] }, animais: [] });
  render(<CustosLeite />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar período" }));
  await screen.findByText("600 L");
  expect(screen.getByText(/Finalidade histórica a conciliar em 1 dia/)).toBeTruthy();
  expect(screen.queryByText("R$ 0,00")).toBeNull();
  const motivo = screen.queryByText(/Custo de um intervalo com mais de uma finalidade/);
  expect(Boolean(motivo)).toBe(situacao !== "OCULTO");
});
