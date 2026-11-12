// @vitest-environment jsdom
import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ cabecalho: vi.fn(), participantes: vi.fn() }));
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../estoque/api", () => ({
  listarProdutos: vi.fn().mockResolvedValue([]),
}));
vi.mock("../api", () => ({
  listarMaterialGenetico: vi.fn().mockResolvedValue([]),
}));
vi.mock("../protocolos/OperacaoProtocolo", () => ({
  OperacaoProtocolo: ({
    gestao,
    revisao,
  }: {
    gestao: ReactNode;
    revisao: number;
  }) => (
    <div>
      <p data-testid="revisao-operacao">{revisao}</p>
      {gestao}
    </div>
  ),
}));
vi.mock("./ParticipacoesProgramacao", () => ({
  ParticipacoesProgramacao: (props: {
    podeRevisarBloqueio: boolean;
    aoRevisarBloqueio: () => void;
  }) => {
    m.participantes(props);
    return (
      <button
        disabled={!props.podeRevisarBloqueio}
        onClick={props.aoRevisarBloqueio}
      >
        Confirmar revisão simulada
      </button>
    );
  },
}));
vi.mock("../protocolos/api", async (original) => ({
  ...(await original<typeof import("../protocolos/api")>()),
  obterCabecalhoProtocolo: m.cabecalho,
  reqProtocolo: vi
    .fn()
    .mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 }),
}));
import { Iatf } from "./Iatf";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
const cabecalho = {
  id: "grupo",
  modo: "COLETIVO",
  tipo: "REPRODUTIVO",
  nome: "Turma",
  propriedadeId: 7,
  status: "ABERTA",
  inicioReferencia: "2026-11-07",
  precisaoTemporal: "DIA",
  participantesTotal: 6,
  protocolo: { id: "modelo", nome: "Modelo", versao: 1 },
  contagens: { total: 6, atendidos: 0, pendentes: 6 },
};
beforeEach(() => {
  vi.clearAllMocks();
  setPropriedadeAtiva(7);
  m.cabecalho.mockResolvedValue(cabecalho);
});
afterEach(() => {
  cleanup();
  setPropriedadeAtiva(null);
});
it.each([
  { podeLancar: true, status: "ABERTA", sitio: 7, permitido: true },
  { podeLancar: false, status: "ABERTA", sitio: 7, permitido: false },
  { podeLancar: true, status: "ENCERRADA", sitio: 7, permitido: false },
  { podeLancar: true, status: "ABERTA", sitio: 9, permitido: false },
])(
  "revisão de bloqueio respeita lançamento, programação e sítio: %j",
  async (c) => {
    m.cabecalho.mockResolvedValue({ ...cabecalho, status: c.status });
    render(
      <Iatf
        propriedadeId={c.sitio}
        programacaoId="grupo"
        podeLancar={c.podeLancar}
      />,
    );
    const acao = await screen.findByRole("button", {
      name: "Confirmar revisão simulada",
    });
    expect(acao).toHaveProperty("disabled", !c.permitido);
  },
);
it("após revisão confirmada atualiza execução e cabeçalho sem remontar a página", async () => {
  const onMudou = vi.fn();
  render(
    <Iatf
      propriedadeId={7}
      programacaoId="grupo"
      podeLancar
      onMudou={onMudou}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Confirmar revisão simulada" }),
  );
  await waitFor(() => expect(m.cabecalho).toHaveBeenCalledTimes(2));
  expect(screen.getByTestId("revisao-operacao").textContent).toBe("1");
  expect(onMudou).toHaveBeenCalledTimes(1);
});
