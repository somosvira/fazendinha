// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ConfiguracoesOrdenha } from "./ConfiguracoesOrdenha";
import { salvarConfiguracao } from "./api";
import type { ConfiguracaoOrdenha } from "./types";
vi.mock("./api", () => ({ salvarConfiguracao: vi.fn() }));
const configuracao: ConfiguracaoOrdenha = {
  id: null,
  propriedadeId: 1,
  vigenteDesde: "1900-01-01",
  inicial: true,
  ordenhas: [
    { posicaoId: "p1", nome: "Manhã", ordem: 1, horario: null },
    { posicaoId: "p2", nome: "Tarde", ordem: 2, horario: "14:00" },
  ],
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  vi.mocked(salvarConfiguracao).mockResolvedValue(configuracao);
});
describe("Configuração de ordenhas", () => {
  it("preserva identidade ao reordenar e mantém horário desconhecido nulo", async () => {
    const aoSalvar = vi.fn();
    render(
      <ConfiguracoesOrdenha
        configuracao={configuracao}
        data="2026-10-20"
        aoFechar={vi.fn()}
        aoSalvar={aoSalvar}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Mover Tarde para cima" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(vi.mocked(salvarConfiguracao).mock.calls[0][0]).toMatchObject({
      propriedadeId: 1,
      vigenteDesde: "2026-10-20",
      ordenhas: [
        { posicaoId: "p2", nome: "Tarde", ordem: 1, horario: "14:00" },
        { posicaoId: "p1", nome: "Manhã", ordem: 2, horario: null },
      ],
    });
  });
  it("não envia nomes em branco e mantém dados após falha", async () => {
    vi.mocked(salvarConfiguracao).mockRejectedValue(
      new Error("Rotina conflitante"),
    );
    render(
      <ConfiguracoesOrdenha
        configuracao={configuracao}
        data="2026-10-20"
        aoFechar={vi.fn()}
        aoSalvar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getAllByLabelText("Nome")[0], {
      target: { value: "" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await screen.findByText("Dê um nome a cada ordenha.");
    expect(salvarConfiguracao).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText("Nome")[0], {
      target: { value: "Primeira" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar configuração" }),
    );
    await screen.findByText("Rotina conflitante");
    expect(
      (screen.getAllByLabelText("Nome")[0] as HTMLInputElement).value,
    ).toBe("Primeira");
  });
});

it("configura a fonte geral e o intervalo individual sem mudar as ordenhas", async () => {
  render(
    <ConfiguracoesOrdenha
      configuracao={configuracao}
      data="2026-10-23"
      aoFechar={vi.fn()}
      aoSalvar={vi.fn()}
    />,
  );
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Fonte da produção diária" }),
    { key: "ArrowDown" },
  );
  fireEvent.click(
    await screen.findByRole("option", { name: "Aferição geral nos tanques" }),
  );
  fireEvent.change(screen.getByLabelText("Aferir a cada"), {
    target: { value: "2" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
  await waitFor(() =>
    expect(salvarConfiguracao).toHaveBeenCalledWith(
      expect.objectContaining({
        fonteProducao: "GERAL",
        intervaloIndividualQuantidade: 2,
        intervaloIndividualUnidade: "MESES",
        ordenhas: configuracao.ordenhas,
      }),
    ),
  );
});

it("protege Cancelar após reordenar mesmo sem mudar um campo nativo", async () => {
  const aoFechar = vi.fn();
  render(<ConfiguracoesOrdenha configuracao={configuracao} data="2026-10-23" aoFechar={aoFechar} aoSalvar={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Mover Tarde para cima" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await screen.findByText("Descartar alterações?");
  expect(aoFechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect((screen.getAllByLabelText("Nome")[0] as HTMLInputElement).value).toBe("Tarde");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
  expect(aoFechar).toHaveBeenCalledOnce();
});
it("Cancelar fecha a configuração intacta sem aviso", () => {
  const aoFechar = vi.fn();
  render(<ConfiguracoesOrdenha configuracao={configuracao} data="2026-10-23" aoFechar={aoFechar} aoSalvar={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(aoFechar).toHaveBeenCalledOnce();
  expect(screen.queryByText("Descartar alterações?")).toBeNull();
});

for (const entrada of ["31/02/2026", "12/1", ""]) it(`não grava configuração com vigência digitada inválida (${entrada || "vazia"})`, async () => {
  const aoSalvar = vi.fn();
  render(<ConfiguracoesOrdenha configuracao={configuracao} data="2026-10-20" aoFechar={vi.fn()} aoSalvar={aoSalvar} />);
  const campo = screen.getByLabelText("Vigente desde") as HTMLInputElement;
  fireEvent.change(campo, { target: { value: entrada } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
  expect(salvarConfiguracao).not.toHaveBeenCalled();
  expect(aoSalvar).not.toHaveBeenCalled();
  expect(campo.value).toBe(entrada);
  fireEvent.change(campo, { target: { value: "21/10/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar configuração" }));
  await waitFor(() => expect(aoSalvar).toHaveBeenCalledTimes(1));
  expect(salvarConfiguracao).toHaveBeenCalledWith(expect.objectContaining({ vigenteDesde: "2026-10-21" }));
});
