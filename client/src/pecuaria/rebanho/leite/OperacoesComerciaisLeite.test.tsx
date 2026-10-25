// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { OperacoesComerciaisLeite } from "./OperacoesComerciaisLeite";
import { FecharOperacaoComercialLeite } from "./FecharOperacaoComercialLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import type { OperacaoComercialLeiteDTO } from "./comercial-operacoes-types";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../financeiro/novo-api", () => ({
  obterConfiguracoesFinanceiras: vi.fn(),
}));
const o: OperacaoComercialLeiteDTO = {
  id: "comercial",
  propriedadeId: 7,
  parceiroId: "comprador",
  parceiroNome: "Laticínio",
  inicio: "2026-10-01",
  fim: "2026-10-19",
  referencia: "Coletas de outubro",
  versao: 3,
  status: "ABERTA",
  retiradoLitros: "250",
  fechamento: null,
  historicoFechamentos: [],
  retiradas: [
    {
      id: "r1",
      movimentoId: "m1",
      produtoId: "leite",
      data: "2026-10-18",
      quantidadeLitros: "100",
      referencia: "Coleta A",
      pontoColeta: null,
      horarioColeta: null,
      comprovantes: [],
    },
    {
      id: "r2",
      movimentoId: "m2",
      produtoId: "leite",
      data: "2026-10-19",
      quantidadeLitros: "150",
      referencia: "Coleta B",
      pontoColeta: null,
      horarioColeta: null,
      comprovantes: [],
    },
  ],
};
const config = {
  contas: [],
  categorias: [],
  centrosCusto: [{ id: "centro", nome: "Leite", ativo: true, ordem: 1 }],
  parceiros: [],
  produtos: [],
} satisfies ConfiguracoesFinanceiras;
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  setPropriedadeAtiva(7);
  vi.mocked(consultarLeite).mockImplementation(async (path) =>
    path.includes("cadastros")
      ? ({
          parceiros: [{ id: "comprador", nome: "Laticínio" }],
          produtos: [{ id: "leite", nome: "Leite" }],
        } as never)
      : ({ propriedadeId: 7, total: 1, porPagina: 20, itens: [o] } as never),
  );
  vi.mocked(registrarLeite).mockImplementation(async (path) =>
    path.endsWith("previa-fechamento")
      ? ({ valorTotal: "625.00" } as never)
      : ({ id: o.id } as never),
  );
});
it("operador acessa coletas e abertura sem preço nem fechamento financeiro", async () => {
  render(<OperacoesComerciaisLeite podeLancar podeFinanceiro={false} />);
  await screen.findByText("Aberta · preço pendente");
  fireEvent.click(
    screen.getByRole("button", { name: "Ver Coletas de outubro" }),
  );
  expect(
    screen.getByRole("button", { name: "Registrar retirada" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Conferir fechamento" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Registrar retirada" }));
  expect(screen.getByLabelText("Litros retirados")).toBeTruthy();
  expect(screen.queryByText("Preço negociado por litro (R$)")).toBeNull();
});
it("fechamento inclui todas as retiradas e usa total Decimal da prévia servidor", async () => {
  const salvar = vi.fn();
  render(
    <FecharOperacaoComercialLeite
      operacao={o}
      config={config}
      aoSalvar={salvar}
      aoCancelar={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Preço negociado por litro (R$)"), {
    target: { value: "2,50" },
  });
  fireEvent.change(screen.getByLabelText("Motivo e referência do acordo"), {
    target: { value: "Acordo de outubro" },
  });
  fireEvent.change(screen.getByLabelText("Centro de custo da receita"), {
    target: { value: "centro" },
  });
  fireEvent.change(screen.getByLabelText("Condição financeira"), {
    target: { value: "A_PRAZO" },
  });
  fireEvent.change(screen.getByLabelText("Vencimento"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Confirmar fechamento" })
      .closest("form")!,
  );
  await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
  expect(registrarLeite).toHaveBeenCalledWith(
    "/comercial/operacoes/comercial/fechamentos",
    7,
    expect.objectContaining({
      retiradas: [
        { retiradaId: "r1", quantidadeReconhecida: 100, motivoDiferenca: null },
        { retiradaId: "r2", quantidadeReconhecida: 150, motivoDiferenca: null },
      ],
      financeiro: {
        condicao: "A_PRAZO",
        parcelas: [{ valor: 625, dataVencimento: "2026-10-30" }],
      },
    }),
  );
});
it("divergência por retirada pede motivo antes de calcular o fechamento", async () => {
  render(
    <FecharOperacaoComercialLeite
      operacao={o}
      config={config}
      aoSalvar={vi.fn()}
      aoCancelar={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Preço negociado por litro (R$)"), {
    target: { value: "2,50" },
  });
  fireEvent.change(screen.getByLabelText("Litros reconhecidos em Coleta B"), {
    target: { value: "0" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Confirmar fechamento" })
      .closest("form")!,
  );
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Justifique a diferença em cada retirada.",
  );
  expect(registrarLeite).not.toHaveBeenCalled();
});
it("resposta perdida do fechamento reenvia payload sem exigir prévia com versão antiga", async () => {
  const salvar = vi.fn();
  let fechamentos = 0;
  vi.mocked(registrarLeite).mockImplementation(async (path) => {
    if (path.endsWith("previa-fechamento"))
      return { valorTotal: "625.00" } as never;
    if (++fechamentos === 1) throw new Error("Resposta perdida");
    return { id: o.id } as never;
  });
  render(
    <FecharOperacaoComercialLeite
      operacao={o}
      config={config}
      aoSalvar={salvar}
      aoCancelar={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText("Preço negociado por litro (R$)"), {
    target: { value: "2,50" },
  });
  fireEvent.change(screen.getByLabelText("Motivo e referência do acordo"), {
    target: { value: "Acordo de outubro" },
  });
  fireEvent.change(screen.getByLabelText("Centro de custo da receita"), {
    target: { value: "centro" },
  });
  fireEvent.change(screen.getByLabelText("Condição financeira"), {
    target: { value: "A_PRAZO" },
  });
  fireEvent.change(screen.getByLabelText("Vencimento"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Confirmar fechamento" })
      .closest("form")!,
  );
  await screen.findByText("Resposta perdida");
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Confirmar fechamento" }),
    ).toHaveProperty("disabled", false),
  );
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Confirmar fechamento" })
      .closest("form")!,
  );
  await waitFor(() => expect(salvar).toHaveBeenCalledTimes(1));
  expect(
    vi
      .mocked(registrarLeite)
      .mock.calls.filter(([p]) => p.endsWith("previa-fechamento")),
  ).toHaveLength(1);
  expect(fechamentos).toBe(2);
});

it("abre operação indicada na URL mesmo fora da página de listagem", async () => {
  history.replaceState(null, "", "/pecuaria/leite?leiteSecao=operacoes&operacaoLeiteId=comercial&operacoesDe=2026-10-01&operacoesAte=2026-10-19");
  vi.mocked(consultarLeite).mockImplementation(async caminho => {
    if (caminho === "/comercial/operacoes/comercial") return o;
    if (caminho.includes("cadastros")) return { parceiros: [], produtos: [] };
    return { propriedadeId: 7, itens: [], total: 30, porPagina: 20 };
  });
  render(<OperacoesComerciaisLeite podeLancar={false} podeFinanceiro={false} />);
  await screen.findByText("Coletas da operação");
  expect(consultarLeite).toHaveBeenCalledWith("/comercial/operacoes/comercial", 7);
  expect(screen.getByText(/Coleta A/)).toBeTruthy();
  history.replaceState(null, "", "/");
});
