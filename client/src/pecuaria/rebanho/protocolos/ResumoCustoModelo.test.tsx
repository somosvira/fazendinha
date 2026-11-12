import { alterarControle } from "@/lib/controles.fixture";
// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResumoCustoModelo } from "./ResumoCustoModelo";
const m = vi.hoisted(() => ({
  req: vi.fn(),
  usuario: vi.fn(),
  sitios: vi.fn(),
}));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  reqProtocolo: m.req,
}));
vi.mock("../../../lib/auth", () => ({ getUsuario: m.usuario }));
vi.mock("../../../api/propriedades", () => ({ listarPropriedades: m.sitios }));
const estimativa = {
  situacao: "PARCIAL",
  total: null,
  totalConhecido: "0.00",
  componentesConhecidos: 1,
  componentesPendentes: 1,
  referencias: {
    itens: [
      {
        descricao: "Retirada",
        natureza: "SERVICO",
        origem: "Referência explícita",
        data: "2026-01-01",
        unidade: "POR_ATENDIMENTO",
        quantidade: "1",
        valorUnitario: "0",
        valor: "0.00",
      },
    ],
    total: 11,
    pagina: 1,
    porPagina: 10,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(
    null,
    "",
    "/configuracoes/pecuaria/reproducao/protocolos/novo",
  );
  m.sitios.mockResolvedValue([{ id: 7, nome: "Sítio das referências" }]);
  m.usuario.mockReturnValue({
    dono: true,
    areas: ["pecuaria", "financeiro"],
    flags: ["verValores"],
  });
  m.req.mockResolvedValue(estimativa);
});
afterEach(cleanup);
it("zero documentado mantém valor e cobertura parcial; modal continua aberto ao paginar", async () => {
  render(<ResumoCustoModelo etapas={[]} propriedadeId={1} completo />);
  expect(await screen.findByText("Estimativa parcial")).toBeTruthy();
  expect(screen.getByText(/0,00/)).toBeTruthy();
  expect(screen.getByText("1 componentes não apurados")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Conferir referências" }));
  const modal = screen.getByRole("dialog");
  expect(
    within(modal).getByRole("table", { name: "Referências do modelo" }),
  ).toBeTruthy();
  let resolver!: (v: typeof estimativa) => void;
  m.req.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  fireEvent.click(within(modal).getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("Consultando referências…")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBe(modal);
  await waitFor(() => expect(m.req).toHaveBeenCalledTimes(2));
  await act(async () => {
    resolver({
      ...estimativa,
      referencias: { ...estimativa.referencias, pagina: 2 },
    });
  });
  expect(
    within(modal).getByRole("table", { name: "Referências do modelo" }),
  ).toBeTruthy();
});
it("sem permissão financeira ou sítio não consulta valores", () => {
  m.usuario.mockReturnValue({ dono: false, areas: ["pecuaria"], flags: [] });
  const tela = render(
    <ResumoCustoModelo etapas={[]} propriedadeId={1} completo />,
  );
  expect(screen.getByText("Valores ocultos")).toBeTruthy();
  expect(m.req).not.toHaveBeenCalled();
  tela.unmount();
  m.usuario.mockReturnValue({
    dono: true,
    areas: ["pecuaria", "financeiro"],
    flags: [],
  });
  render(<ResumoCustoModelo etapas={[]} propriedadeId={null} completo />);
  expect(
    screen.getByText(/Selecione um sítio para consultar o custo previsto/),
  ).toBeTruthy();
  expect(m.req).not.toHaveBeenCalled();
});

it("respeita sítio do endereço em Consolidado sem exigir alterar o seletor global", async () => {
  window.history.replaceState(
    null,
    "",
    "/configuracoes/pecuaria/reproducao/protocolos/novo?sitio=7",
  );
  render(<ResumoCustoModelo etapas={[]} propriedadeId={null} completo />);
  await waitFor(() =>
    expect(m.req).toHaveBeenCalledWith(
      "/modelos/estimativa",
      7,
      expect.objectContaining({ propriedadeId: 7 }),
    ),
  );
  expect(
    screen.getByRole("combobox", { name: "Sítio para referências de custo" }),
  ).toBeTruthy();
  expect(
    screen.queryByText(/Selecione um sítio para consultar o custo/),
  ).toBeNull();
});
it("oferece seleção local dentro da revisão e só estima após escolher o sítio", async () => {
  render(<ResumoCustoModelo etapas={[]} propriedadeId={null} completo />);
  expect(m.req).not.toHaveBeenCalled();
  const controle = await screen.findByRole("combobox", {
    name: "Sítio para referências de custo",
  });
  await waitFor(() => expect(controle).toHaveProperty("disabled", false));
  await alterarControle(controle, { target: { value: "7" } });
  await waitFor(() =>
    expect(m.req).toHaveBeenCalledWith(
      "/modelos/estimativa",
      7,
      expect.objectContaining({ propriedadeId: 7 }),
    ),
  );
  expect(screen.getByText(/preserva a visão global/)).toBeTruthy();
});
