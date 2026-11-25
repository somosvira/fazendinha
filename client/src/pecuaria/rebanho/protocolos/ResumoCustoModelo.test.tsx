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
  expect(await screen.findByText("Parcial")).toBeTruthy();
  expect(screen.getByText(/0,00/)).toBeTruthy();
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
it("sem permissão financeira não consulta valores", () => {
  m.usuario.mockReturnValue({ dono: false, areas: ["pecuaria"], flags: [] });
  render(<ResumoCustoModelo etapas={[]} propriedadeId={1} completo />);
  expect(screen.getByText("Valores ocultos")).toBeTruthy();
  expect(m.req).not.toHaveBeenCalled();
});

it("usa o escopo consolidado sem propriedade no corpo, ignorando sítio na URL", async () => {
  window.history.replaceState(null, "", "/configuracoes/pecuaria/reproducao/protocolos/novo?sitio=7");
  render(<ResumoCustoModelo etapas={[]} propriedadeId={null} completo />);
  await waitFor(() => expect(m.req).toHaveBeenCalledWith("/modelos/estimativa", undefined, { etapas: [], referenciasPagina: 1 }));
  expect(screen.queryByRole("combobox", { name: "Sítio para referências de custo" })).toBeNull();
});

it("reconsulta ao trocar o sítio e envia produto do catálogo como pendente", async () => {
  const etapas = [{ nome: "Aplicação", tipo: "APLICACAO" as const, intervalo: 0, unidade: "DIAS" as const, planoAplicacao: { produtoId: "", produtoCatalogoId: "catalogo", dose: "2", unidadeDose: "ML" as const } }];
  const tela = render(<ResumoCustoModelo etapas={etapas} propriedadeId={null} completo />);
  await waitFor(() => expect(m.req).toHaveBeenCalledWith("/modelos/estimativa", undefined, expect.objectContaining({ etapas: [expect.objectContaining({ produtoCatalogoId: "catalogo", quantidade: "2" })] })));
  tela.rerender(<ResumoCustoModelo etapas={etapas} propriedadeId={7} completo />);
  await waitFor(() => expect(m.req).toHaveBeenCalledWith("/modelos/estimativa", 7, expect.not.objectContaining({ propriedadeId: expect.anything() })));
});
