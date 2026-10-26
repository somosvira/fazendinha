// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { ResumoLeitePainel } from "./ResumoLeitePainel";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const resumo = {
  litros: null,
  diasSitioEsperados: 2,
  diasSitioInformados: 0,
  diasSitioSemFolha: 2,
  diasSitioParciais: 0,
  diasSitioSemParticipantes: 0,
  medicoesPendentes: 0,
  completa: false,
  rotinas: [],
};
it("não apresenta ausência de folhas como zero e liga ao mesmo período", async () => {
  vi.mocked(consultarLeite).mockResolvedValue(resumo);
  render(
    <ResumoLeitePainel
      inicio="2026-10-01"
      fim="2026-10-02"
      propriedadeId={2}
      revisao={0}
    />,
  );
  await screen.findByText("Não informado");
  expect(screen.queryByText("0 L")).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Ver ritmo e custos do leite" })
      .getAttribute("href"),
  ).toContain("inicio=2026-10-01&fim=2026-10-02");
});
it("resposta de outro sítio não substitui o resumo atual", async () => {
  let antiga!: (valor: unknown) => void;
  vi.mocked(consultarLeite)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          antiga = resolve;
        }),
    )
    .mockResolvedValue({ ...resumo, litros: "0.000" });
  const props = { inicio: "2026-10-01", fim: "2026-10-02", revisao: 0 };
  const tela = render(<ResumoLeitePainel {...props} propriedadeId={1} />);
  tela.rerender(<ResumoLeitePainel {...props} propriedadeId={2} />);
  await screen.findByText("0 L");
  await act(async () => antiga({ ...resumo, litros: "999.000" }));
  expect(screen.queryByText("999 L")).toBeNull();
});
it("distingue finalidade pendente de dia sem elegíveis e mantém volume conhecido", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...resumo, litros: "18.5", diasSitioSemAnimaisElegiveis: 1, diasSitioFinalidadePendente: 1 });
  render(<ResumoLeitePainel inicio="2026-10-01" fim="2026-10-02" propriedadeId={2} revisao={0} />);
  await screen.findByText("18,5 L");
  expect(screen.getByText(/1 dia\(s\) por sítio sem animais elegíveis/)).toBeTruthy();
  expect(screen.getByText(/finalidade histórica a conciliar. Litros registrados preservados/)).toBeTruthy();
});
