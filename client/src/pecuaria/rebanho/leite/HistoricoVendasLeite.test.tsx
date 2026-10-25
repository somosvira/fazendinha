// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { HistoricoVendasLeite } from "./HistoricoVendasLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { lerValorCorrecao, type VendaLeiteHistorico } from "./vendas-types";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
const venda: VendaLeiteHistorico = {
  operacaoId: "op1",
  numero: 10,
  retiradaId: "retirada",
  versaoComercial: 1,
  status: "CONFIRMADA",
  parceiroId: "parceiro",
  parceiroNome: "Comprador",
  data: "2026-10-19",
  produtoId: "produto",
  quantidadeLitros: "100",
  valorTotal: "225.00",
  valorRecebidoConfirmado: "0.00",
  estadoFinanceiro: "A_RECEBER",
  podeCorrigir: true,
  motivoBloqueio: null,
  categoriaId: "cat-antiga",
  centroCustoId: "centro-antigo",
  motivoCorrecao: null,
  corrigeOperacaoId: null,
};
const config: ConfiguracoesFinanceiras = {
  parceiros: [
    {
      id: "parceiro",
      nome: "Comprador",
      documento: null,
      tipo: "CLIENTE",
      telefone: null,
      email: null,
      ativo: true,
      referencias: 0,
    },
  ],
  contas: [
    {
      id: "conta",
      nome: "Conta real",
      tipo: "BANCO",
      instituicao: null,
      identificacao: null,
      saldoAbertura: "0",
      dataSaldoAbertura: "2026-01-01",
      incluirNoSaldoGeral: true,
      ativo: true,
      saldoAtual: "0",
      temMovimentos: false,
    },
  ],
  categorias: [],
  centrosCusto: [],
  produtos: [],
};
const onMudou = vi.fn();
const props = {
  produtoId: "produto",
  data: "2026-10-19",
  propriedadeId: 2,
  config,
  podeLancar: true,
  revisao: 0,
  onMudou,
};
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consultarLeite).mockResolvedValue({
    itens: [venda],
    total: 1,
    pagina: 1,
    porPagina: 20,
  });
  vi.mocked(registrarLeite).mockResolvedValue({});
});
async function preparar() {
  fireEvent.click(
    (await screen.findAllByRole("button", { name: "Corrigir venda #10" }))[0],
  );
  fireEvent.change(screen.getByLabelText("Novo valor total (R$)"), {
    target: { value: "250,00" },
  });
  await escolher("Nova condição financeira", "A receber");
  fireEvent.change(screen.getByLabelText("Vencimento da nova parcela"), {
    target: { value: "2026-10-30" },
  });
  fireEvent.change(screen.getByLabelText("Motivo da correção comercial"), {
    target: { value: "Preço definitivo corrigido" },
  });
}
async function escolher(rotulo: string, opcao: string) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fireEvent.keyDown(screen.getByLabelText(rotulo), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: opcao }));
}
describe("Histórico comercial do leite", () => {
  it("consulta todos os produtos do sítio quando nenhum produto está selecionado", async () => {
    render(<HistoricoVendasLeite {...props} produtoId="" />);
    (await screen.findAllByRole("button", { name: "Corrigir venda #10" }))[0];
    expect(
      screen.getByRole("heading", { name: "Vendas de leite do sítio" }),
    ).toBeTruthy();
    expect(consultarLeite).toHaveBeenCalledWith(
      "/estoque/vendas?de=2026-10-01&ate=2026-10-19&pagina=1",
      2,
    );
  });

  it("corrige 225 para 250 mantendo cem litros somente na apresentação", async () => {
    render(<HistoricoVendasLeite {...props} />);
    await preparar();
    expect(screen.getByText(/Origem preservada: 100 L/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar correção comercial" }),
    );
    await screen.findByText(
      "Correção comercial confirmada. Os litros e a saída física única foram preservados.",
    );
    expect(registrarLeite).toHaveBeenCalledWith(
      "/estoque/vendas/correcoes",
      2,
      {
        operacaoId: "op1",
        versaoEsperada: 1,
        parceiroId: "parceiro",
        valorTotal: 250,
        motivo: "Preço definitivo corrigido",
        financeiro: {
          condicao: "A_PRAZO",
          parcelas: [{ valor: 250, dataVencimento: "2026-10-30" }],
        },
      },
    );
    expect(onMudou).toHaveBeenCalledOnce();
    const payload = vi.mocked(registrarLeite).mock.calls[0][2];
    for (const campo of [
      "produtoId",
      "quantidadeLitros",
      "data",
      "categoriaId",
      "centroCustoId",
    ])
      expect(campo in payload).toBe(false);
  });
  it("erro do serviço conserva campos e não anuncia sucesso", async () => {
    vi.mocked(registrarLeite).mockRejectedValue(
      new Error("Há recebimento confirmado"),
    );
    render(<HistoricoVendasLeite {...props} />);
    await preparar();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar correção comercial" }),
    );
    await screen.findByText("Há recebimento confirmado");
    expect(
      (screen.getByLabelText("Novo valor total (R$)") as HTMLInputElement)
        .value,
    ).toBe("250,00");
    expect(onMudou).not.toHaveBeenCalled();
    expect(screen.queryByText(/Correção comercial confirmada/)).toBeNull();
  });
  it("consulta não oferece ação e recebida orienta regularização explícita", async () => {
    vi.mocked(consultarLeite).mockResolvedValue({
      itens: [
        {
          ...venda,
          podeCorrigir: false,
          estadoFinanceiro: "RECEBIDA",
          valorRecebidoConfirmado: "225.00",
          motivoBloqueio:
            "Faça o estorno financeiro explícito dos recebimentos antes de corrigir",
        },
      ],
      total: 1,
      pagina: 1,
      porPagina: 20,
    });
    render(<HistoricoVendasLeite {...props} podeLancar={false} />);
    await screen.findAllByText("Recebida");
    fireEvent.click(screen.getAllByRole("button", { name: "Ver venda #10" })[0]);
    expect(
      screen.queryByRole("button", { name: "Corrigir venda #10" }),
    ).toBeNull();
    expect(
      screen.getByText(
        /Esta tela não devolve dinheiro nem litros automaticamente/,
      ),
    ).toBeTruthy();
    expect(registrarLeite).not.toHaveBeenCalled();
  });
  it("recebida não permite correção ainda que DTO seja inconsistente", async () => {
    vi.mocked(consultarLeite).mockResolvedValue({
      itens: [{ ...venda, valorRecebidoConfirmado: "1.00" }],
      total: 1,
      pagina: 1,
      porPagina: 20,
    });
    render(<HistoricoVendasLeite {...props} />);
    await screen.findAllByText("A receber");
    expect(
      screen.queryByRole("button", { name: "Corrigir venda #10" }),
    ).toBeNull();
  });
  it("recebido agora exige conta real e envia nova condição explícita", async () => {
    render(<HistoricoVendasLeite {...props} />);
    await preparar();
    await escolher("Nova condição financeira", "Recebido agora");
    await escolher("Conta de recebimento", "Conta real");
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar correção comercial" }),
    );
    await waitFor(() => expect(registrarLeite).toHaveBeenCalled());
    expect(vi.mocked(registrarLeite).mock.calls[0][2].financeiro).toEqual({
      condicao: "A_VISTA",
      contaId: "conta",
    });
  });
  it("ignora resposta de outro sítio e consulta o mês selecionado", async () => {
    let resolver: ((r: unknown) => void) | undefined;
    vi.mocked(consultarLeite)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolver = resolve;
          }),
      )
      .mockResolvedValueOnce({ itens: [], total: 0, pagina: 1, porPagina: 20 });
    const view = render(<HistoricoVendasLeite {...props} />);
    view.rerender(<HistoricoVendasLeite {...props} propriedadeId={3} />);
    await screen.findByText(
      "Nenhuma venda registrada para o filtro no período.",
    );
    resolver?.({ itens: [venda], total: 1, pagina: 1, porPagina: 20 });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Corrigir venda #10" }),
      ).toBeNull(),
    );
    expect(consultarLeite).toHaveBeenCalledWith(
      "/estoque/vendas?produtoId=produto&de=2026-10-01&ate=2026-10-19&pagina=1",
      3,
    );
  });
  it("aceita moeda decimal sem presumir separador de milhares", () => {
    expect(lerValorCorrecao("250,00")).toBe(250);
    for (const v of ["0", "-1", "1e3", "1.234,00", "1,234"])
      expect(() => lerValorCorrecao(v)).toThrow();
  });
});
