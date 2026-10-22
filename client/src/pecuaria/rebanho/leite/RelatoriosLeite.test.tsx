// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { RelatoriosLeite } from "./RelatoriosLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../propriedadeScope", () => ({
  getPropriedadeAtiva: () => null,
  comPropriedade: () => ({}),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const lista = {
  propriedadeId: 2,
  itens: [
    {
      id: "emissao",
      inicio: "2026-10-01",
      fim: "2026-10-01",
      corteEm: "2026-10-19T18:00:00Z",
      versaoCalculo: "V1",
      valoresIncluidos: false,
    },
  ],
  total: 1,
  pagina: 1,
  tamanho: 20,
};
const emissao = {
  id: "emissao",
  criadoEm: "2026-10-19T18:00:00Z",
  snapshot: {
    corteEm: "2026-10-19T18:00:00Z",
    versaoCalculo: "LEITE_GERENCIAL_V1",
    propriedade: { id: 2, nome: "Fazenda A" },
    filtros: { inicio: "2026-10-01", fim: "2026-10-01" },
    valoresIncluidos: false,
    valores: null,
    cobertura: {
      producao: {
        diasInformados: 1,
        diasSemFolha: [],
        diasParciais: ["2026-10-01"],
        completa: false,
      },
      producaoNaoConfirmadaLitros: "54",
    },
    dados: {
      producao: { ritmo: [], consolidado: { litros: 54 }, animais: [] },
      qualidade: [],
      destinos: [],
      descartes: [],
      balanco: [],
    },
    limitacoes: ["Sem medição física de campo"],
  },
};
it("abre os números preservados sem chamar produção viva nem emitir novamente", async () => {
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.endsWith("/emissao") ? emissao : lista,
  );
  render(<RelatoriosLeite podeExportar={false} podeFinanceiro={false} />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Abrir relatório de 01/10/2026",
    }),
  );
  await screen.findByText("54 L");
  expect(
    screen.getByText(
      "Valores financeiros não incluídos ou ocultos pela permissão atual.",
    ),
  ).toBeTruthy();
  expect(registrarLeite).not.toHaveBeenCalled();
  expect(
    vi
      .mocked(consultarLeite)
      .mock.calls.every(([p]) => p.startsWith("/relatorios/emissoes")),
  ).toBe(true);
  expect(
    screen.queryByRole("button", { name: "Exportar esta emissão em CSV" }),
  ).toBeNull();
});
it("usa o sítio resolvido na emissão e não solicita valores sem permissão financeira", async () => {
  vi.mocked(consultarLeite).mockResolvedValue(lista);
  vi.mocked(registrarLeite).mockResolvedValue(emissao);
  render(<RelatoriosLeite podeExportar podeFinanceiro={false} />);
  await screen.findByRole("button", { name: "Abrir relatório de 01/10/2026" });
  fireEvent.click(
    screen.getByRole("button", { name: "Emitir relatório preservado" }),
  );
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/relatorios/emissoes",
      2,
      expect.objectContaining({ incluirValores: false }),
    ),
  );
  expect(screen.queryByLabelText("Incluir valores financeiros")).toBeNull();
});
it("separa expedição, aceite e faturamento documentado na emissão", async () => {
  const cf = {
    ...emissao,
    snapshot: {
      ...emissao.snapshot,
      dados: {
        ...emissao.snapshot.dados,
        comercialDocumental: {
          entregas: [
            {
              id: "entrega",
              referencia: "Retirada conferida",
              produtoNome: "Leite",
              data: "2026-10-01",
              numeroOperacao: 417,
              parceiroNome: "Comprador",
              expedidoLitros: "100",
              volumeAceito: "90",
              quantidadeFaturadaLitros: "20",
              motivo: "Conferido no documento",
            },
          ],
          demonstrativos: [],
        },
      },
      valores: {
        custos: {
          consolidado: {
            custoPorLitro: null,
            custos: { totalConhecido: null },
          },
        },
        comercial: [],
        documental: {
          demonstrativos: [],
          faturamento: {
            quantidadeLitros: "20",
            valorFaturado: "60",
            precoFaturadoPorLitro: "3",
          },
        },
      },
    },
  };
  vi.mocked(consultarLeite).mockImplementation(async (p) =>
    p.endsWith("/emissao") ? cf : lista,
  );
  render(<RelatoriosLeite podeExportar={false} podeFinanceiro />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Abrir relatório de 01/10/2026",
    }),
  );
  await screen.findByText("100 L");
  expect(screen.getByText("90 L")).toBeTruthy();
  expect(screen.getAllByText("20 L").length).toBe(2);
  expect(screen.getByText(/R\$\s*3,00/)).toBeTruthy();
  expect(screen.queryByText(/R\$\s*0,60/)).toBeNull();
});
