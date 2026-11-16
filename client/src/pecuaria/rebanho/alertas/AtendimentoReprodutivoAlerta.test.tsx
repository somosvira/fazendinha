// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AtendimentoReprodutivoAlerta } from "./AtendimentoReprodutivoAlerta";
import {
  AlertasApiError,
  decidirAlertaReprodutivo,
  registrarRetiradaFisica,
  type DetalheAlerta,
} from "./api";
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  decidirAlertaReprodutivo: vi.fn(),
  registrarRetiradaFisica: vi.fn(),
}));
vi.mock("../../../components/DatePicker", () => ({
  DatePicker: ({
    value,
    onChange,
    popoverClassName: _camada,
    ...p
  }: {
    value: string;
    onChange: (valor: string) => void;
    popoverClassName?: string;
  }) => (
    <input
      {...p}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
const detalhe: DetalheAlerta = {
  produtor: "reproducao",
  alertaId: "alerta",
  necessidadeId: "necessidade",
  revisao: 7,
  titulo: "Etapa pendente",
  motivo: "Sem execução",
  situacao: "PENDENTE",
  evidenciaDisparo: {},
  origem: {
    estado: "DISPONIVEL",
    animal: { id: "animal", brinco: "24", nome: null },
    participacaoId: "participacao",
    tipo: "ETAPA_VENCIDA",
    origemId: "tarefa",
    dataReferencia: "2026-01-01",
  },
  acoes: ["REAGENDAR", "DISPENSAR", "RETIRAR", "SUSPENDER"],
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(decidirAlertaReprodutivo).mockResolvedValue({});
  vi.mocked(registrarRetiradaFisica).mockResolvedValue({});
});
function preencherMotivo() {
  fireEvent.change(screen.getByLabelText("Motivo"), {
    target: { value: "Revisão com responsável do sítio" },
  });
  fireEvent.click(screen.getByLabelText(/Conferi o cuidado/));
}
it.each(["Reagendar cuidado", "Suspender até revisão"])(
  "%s exige data futura e destino, mantendo a revisão do cuidado",
  async (nome) => {
    render(
      <AtendimentoReprodutivoAlerta
        detalhe={detalhe}
        propriedadeId={2}
        onAtualizado={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: nome }));
    preencherMotivo();
    fireEvent.submit(
      document.getElementById("atendimento-reprodutivo-alerta")!,
    );
    expect(decidirAlertaReprodutivo).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Data de revisão"), {
      target: { value: "2099-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Destino do cuidado"), {
      target: { value: "Avaliação veterinária" },
    });
    fireEvent.submit(
      document.getElementById("atendimento-reprodutivo-alerta")!,
    );
    await waitFor(() =>
      expect(decidirAlertaReprodutivo).toHaveBeenCalledWith(
        "alerta",
        expect.objectContaining({
          propriedadeId: 2,
          revisao: 7,
          data: "2099-01-01",
          destino: "Avaliação veterinária",
          tipo: nome === "Reagendar cuidado" ? "REAGENDAR" : "SUSPENDER",
        }),
      ),
    );
  },
);
it("dispensa só decisão administrativa e conflito exige reconsulta antes de outro envio", async () => {
  vi.mocked(decidirAlertaReprodutivo).mockRejectedValue(
    new AlertasApiError("Cuidado mudou", 409),
  );
  const atualizado = vi.fn();
  render(
    <AtendimentoReprodutivoAlerta
      detalhe={detalhe}
      propriedadeId={2}
      onAtualizado={atualizado}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Dispensar cuidado" }));
  preencherMotivo();
  fireEvent.submit(document.getElementById("atendimento-reprodutivo-alerta")!);
  await screen.findByText("Cuidado mudou");
  const input = vi.mocked(decidirAlertaReprodutivo).mock.calls[0][1];
  expect(input).not.toHaveProperty("data");
  expect(input).not.toHaveProperty("destino");
  fireEvent.submit(document.getElementById("atendimento-reprodutivo-alerta")!);
  expect(decidirAlertaReprodutivo).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText("Reconsultar cuidado"));
  expect(atualizado).toHaveBeenCalledTimes(1);
});
it("retirada física é fato da inserção e não depende de participação ativa ou permite dispensa", async () => {
  const dispositivo: DetalheAlerta = {
    ...detalhe,
    titulo: "Dispositivo com retirada pendente",
    origem: {
      ...detalhe.origem,
      tipo: "DISPOSITIVO_SEM_RETIRADA",
      origemId: "insercao-factual",
      participacaoId: null,
    },
    acoes: [
      "REGISTRAR_RETIRADA_FISICA",
      "REAGENDAR",
      "SUSPENDER",
      "DISPENSAR",
      "RETIRAR",
    ],
  };
  const atualizado = vi.fn();
  render(
    <AtendimentoReprodutivoAlerta
      detalhe={dispositivo}
      propriedadeId={2}
      onAtualizado={atualizado}
    />,
  );
  expect(screen.queryByText("Dispensar cuidado")).toBeNull();
  expect(screen.queryByText("Retirar participação")).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Registrar retirada física" }),
  );
  fireEvent.change(screen.getByLabelText("Data real da retirada"), {
    target: { value: "2026-01-05" },
  });
  fireEvent.change(screen.getByLabelText("Observação da retirada"), {
    target: { value: "Dispositivo retirado conforme registro" },
  });
  fireEvent.submit(document.getElementById("atendimento-reprodutivo-alerta")!);
  expect(registrarRetiradaFisica).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(/Confirmo que o dispositivo/));
  fireEvent.submit(document.getElementById("atendimento-reprodutivo-alerta")!);
  await waitFor(() =>
    expect(registrarRetiradaFisica).toHaveBeenCalledWith(
      "insercao-factual",
      expect.objectContaining({
        propriedadeId: 2,
        realizadaEm: "2026-01-05",
        confirmarRetiradaFisica: true,
        observacao: "Dispositivo retirado conforme registro",
      }),
    ),
  );
  expect(decidirAlertaReprodutivo).not.toHaveBeenCalled();
  expect(atualizado).toHaveBeenCalledTimes(1);
});
it("capacidade de leitura não apresenta comandos de escrita", () => {
  render(
    <AtendimentoReprodutivoAlerta
      detalhe={{ ...detalhe, acoes: [] }}
      propriedadeId={2}
      onAtualizado={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button")).toBeNull();
});
