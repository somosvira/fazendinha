// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ProgramacaoRetirada } from "./UIProgramacaoRetirada";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import type { ConsultaProgramacaoDTO } from "./programacao-types";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({
  listarProdutos: vi.fn().mockResolvedValue([]),
}));
vi.mock("./modelo", async (original) => ({
  ...(await original<typeof import("./modelo")>()),
  hojeOperacional: () => "2026-10-19",
}));
const dados: ConsultaProgramacaoDTO = {
  propriedadeId: 2,
  dataReferencia: "2026-10-19",
  versaoAtual: 0,
  vigente: null,
  historico: [],
  previsoes: [],
  meta: null,
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  setPropriedadeAtiva(2);
  vi.mocked(consultarLeite).mockResolvedValue(dados);
});
async function escolher(rotulo: string, opcao: string) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fireEvent.keyDown(screen.getByLabelText(rotulo), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
}
describe("Programação de retirada", () => {
  it("leitura não oferece configuração e não transforma meta em retirada", async () => {
    vi.mocked(consultarLeite).mockResolvedValue({
      ...dados,
      meta: {
        estado: "NAO_AFERIVEL",
        metaLitros: "100",
        saldoLitros: null,
        motivo: "Sem lastro físico confiável",
      },
    });
    render(<ProgramacaoRetirada podeLancar={false} />);
    await screen.findByText("Meta não aferível");
    expect(
      screen.queryByRole("button", { name: /Configurar rotina de coleta/ }),
    ).toBeNull();
    expect(screen.getByText("Sem lastro físico confiável")).toBeTruthy();
    expect(registrarLeite).not.toHaveBeenCalled();
  });
  it("salva uma alternativa única com versão e sítio, conservando campos no erro", async () => {
    vi.mocked(registrarLeite).mockRejectedValue(new Error("Versão mudou"));
    render(<ProgramacaoRetirada podeLancar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Configurar rotina de coleta/ }),
    );
    await escolher("Frequência da coleta", "Semanal");
    await escolher("Dia da semana", "Quarta-feira");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rotina de coleta" }));
    await screen.findByText("Versão mudou");
    expect(registrarLeite).toHaveBeenCalledWith("/programacao", 2, {
      propriedadeId: 2,
      versaoEsperada: 0,
      vigenteDesde: "2026-10-19",
      tipo: "SEMANAL",
      diaSemana: 3,
    });
    expect(
      screen.getByLabelText("Dia da semana").textContent,
    ).toContain("Quarta-feira");
    expect(screen.queryByLabelText("Meta de litros")).toBeNull();
  });
  it("dias escolhidos exigem seleção e não enviam meta", async () => {
    vi.mocked(registrarLeite).mockResolvedValue({});
    render(<ProgramacaoRetirada podeLancar />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Configurar rotina de coleta/ }),
    );
    await escolher("Frequência da coleta", "Dias escolhidos");
    fireEvent.click(screen.getByRole("button", { name: "Salvar rotina de coleta" }));
    await screen.findByText("Escolha ao menos um dia da semana.");
    expect(registrarLeite).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Segunda-feira"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar rotina de coleta" }));
    await waitFor(() => expect(registrarLeite).toHaveBeenCalled());
    expect(vi.mocked(registrarLeite).mock.calls[0][2]).toEqual({
      propriedadeId: 2,
      versaoEsperada: 0,
      vigenteDesde: "2026-10-19",
      tipo: "DIAS_ESCOLHIDOS",
      diasSemana: [1],
    });
  });
  it("não aplica resposta anterior depois da troca da referência", async () => {
    let resolver: ((r: ConsultaProgramacaoDTO) => void) | undefined;
    vi.mocked(consultarLeite)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      )
      .mockResolvedValueOnce({ ...dados, dataReferencia: "2026-10-20" });
    render(<ProgramacaoRetirada podeLancar />);
    fireEvent.change(screen.getByLabelText("Data de referência"), {
      target: { value: "2026-10-20" },
    });
    await screen.findByText("Nenhuma programação vigente nesta data.");
    resolver?.({
      ...dados,
      meta: {
        estado: "ATINGIDA",
        saldoLitros: "100",
        metaLitros: "100",
        motivo: null,
      },
    });
    await waitFor(() => expect(screen.queryByText(/Meta atingida/)).toBeNull());
  });
});
it("data compartilhada recebe formato brasileiro e salva a vigência ISO com versão e sítio", async () => {
  vi.mocked(registrarLeite).mockResolvedValue({});
  render(<ProgramacaoRetirada podeLancar />);
  fireEvent.click(await screen.findByRole("button", { name: /Configurar rotina de coleta/ }));
  fireEvent.change(screen.getByLabelText("Vigente desde"), { target: { value: "20/10/2026" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar rotina de coleta" }));
  await waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/programacao", 2, { propriedadeId: 2, versaoEsperada: 0, vigenteDesde: "2026-10-20", tipo: "DIARIA" }));
});
