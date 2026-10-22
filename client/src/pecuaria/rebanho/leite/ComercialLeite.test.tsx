// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ComercialLeite } from "./ComercialLeite";
import { NovaEntregaComercialLeite } from "./NovaEntregaComercialLeite";
import { NovoDemonstrativoLeite } from "./NovoDemonstrativoLeite";
import { ComprovantesEntregaLeite } from "./ComprovantesEntregaLeite";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import {
  montarConferencia,
  novaConferencia,
  type EntregaComercial,
} from "./comercial-types";
import {
  obterConfiguracoesFinanceiras,
  type ConfiguracoesFinanceiras,
} from "../../../financeiro/novo-api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
vi.mock("./operacoes-api", async (original) => ({
  ...(await original<typeof import("./operacoes-api")>()),
  consultarLeite: vi.fn(),
}));
vi.mock("../../../financeiro/novo-api", () => ({
  obterConfiguracoesFinanceiras: vi.fn(),
}));
vi.mock("./modelo", async (original) => ({
  ...(await original<typeof import("./modelo")>()),
  hojeOperacional: () => "2026-10-19",
}));
const config: ConfiguracoesFinanceiras = {
  parceiros: [
    {
      id: "p",
      nome: "Comprador real",
      documento: null,
      tipo: "CLIENTE",
      telefone: null,
      email: null,
      ativo: true,
      referencias: 0,
    },
  ],
  contas: [],
  categorias: [],
  centrosCusto: [],
  produtos: [{ id: "leite", nome: "Leite", unidade: "L", ativo: true }],
};
const entrega: EntregaComercial = {
  id: "e1",
  propriedadeId: 2,
  parceiroId: "p",
  parceiroNome: "Comprador real",
  retiradaId: "r1",
  produtoId: "leite",
  data: "2026-10-19",
  operacaoId: "v1",
  numeroOperacao: 12,
  versaoVendaId: "versao-v1",
  pontoColeta: null,
  horarioColeta: null,
  referencia: "Coleta 19",
  expedidoLitros: "100",
  volumeAceito: null,
  versao: 2,
  situacao: "PENDENTE",
  motivo: "Aguardando resposta do comprador",
  destinacaoInformada: null,
  quantidadeFaturada: "0",
  valorFaturado: "0.00",
  quantidadeDisponivel: null,
  limiteExpedidoPendenteLitros: "100",
  valorDisponivel: "225.00",
  aceitePendente: true,
  historico: [],
  comprovantes: [],
};
const fetchMock = vi.fn();
const aoSalvar = vi.fn();
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  setPropriedadeAtiva(2);
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ id: "novo" }), { status: 201 }),
  );
  vi.mocked(obterConfiguracoesFinanceiras).mockResolvedValue(config);
  vi.mocked(consultarLeite).mockImplementation(async (caminho) => {
    if (caminho.includes("vendas-vinculaveis"))
      return {
        propriedadeId: 2,
        itens: [
          {
            operacaoId: "v1",
            numero: 12,
            data: "2026-10-19",
            parceiroId: "p",
            parceiroNome: "Comprador real",
            valorTotal: null,
            retiradaId: "r1",
            produtoId: "leite",
            quantidadeLitros: "100",
            podeVincular: true,
            impedimento: null,
          },
          {
            operacaoId: "v-legado",
            numero: 13,
            parceiroNome: "Comprador real",
            quantidadeLitros: null,
            podeVincular: false,
            impedimento: "Histórico V1 exige reconciliação",
          },
        ],
        total: 2,
        pagina: 1,
        porPagina: 20,
      } as never;
    if (caminho.includes("demonstrativos"))
      return {
        propriedadeId: 2,
        itens: [],
        total: 0,
        pagina: 1,
        porPagina: 20,
      } as never;
    return {
      propriedadeId: 2,
      itens: [entrega],
      total: 1,
      pagina: 1,
      porPagina: 20,
    } as never;
  });
});
function conferencia() {
  fireEvent.change(
    screen.getByLabelText("Motivo ou evidência da conferência"),
    { target: { value: "Aceite ainda não informado pelo comprador" } },
  );
  fireEvent.change(screen.getByLabelText("Referência da entrega"), {
    target: { value: "Coleta informada" },
  });
}
async function escolherExistente() {
  await waitFor(() =>
    expect(
      screen
        .getAllByRole("option")
        .some((o) => o.getAttribute("value") === "v1"),
    ).toBe(true),
  );
  fireEvent.change(screen.getByLabelText("Venda registrada"), {
    target: { value: "v1" },
  });
  conferencia();
}
describe("comercial do leite", () => {
  it("aceite desconhecido nunca copia expedido, zero conhecido continua explícito e rejeição exige zero", () => {
    expect(
      montarConferencia({
        ...novaConferencia(),
        aceito: "100",
        motivo: "Aguardando aceite",
      }).volumeAceito,
    ).toBeNull();
    expect(
      montarConferencia({
        situacao: "ACEITE_INFORMADO",
        aceito: "0",
        motivo: "Aceite zero informado",
        destinacao: "",
      }).volumeAceito,
    ).toBe(0);
    expect(() =>
      montarConferencia({
        situacao: "REJEITADA",
        aceito: "1",
        motivo: "Rejeição informada",
        destinacao: "",
      }),
    ).toThrow("zero");
    expect(() =>
      montarConferencia({
        situacao: "DESTINACAO_POSTERIOR",
        aceito: "",
        motivo: "Destinação a registrar",
        destinacao: "",
      }),
    ).toThrow("destinação");
  });
  it("operador vincula venda sem enviar valores e repete chave após falha sem aceitar cem litros automaticamente", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Resposta perdida" }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "novo" }), { status: 201 }),
      );
    render(
      <NovaEntregaComercialLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        podeFinanceiro={false}
        config={null}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    await escolherExistente();
    expect(
      screen.queryByRole("option", {
        name: "Criar venda com entrega",
      }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar vínculo da entrega" }),
    );
    await screen.findByText("Resposta perdida");
    expect(aoSalvar).not.toHaveBeenCalled();
    const primeiro = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(primeiro.vinculo).toEqual({
      tipo: "VENDA_EXISTENTE",
      operacaoId: "v1",
    });
    expect(primeiro.volumeAceito).toBeNull();
    expect("valorTotal" in primeiro).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar vínculo da entrega" }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(primeiro);
  });
  it("candidato com impedimento não é convertido nem vinculado automaticamente", async () => {
    render(
      <NovaEntregaComercialLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        podeFinanceiro
        config={config}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    await escolherExistente();
    const option = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("value") === "v-legado") as HTMLOptionElement;
    expect(option.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Venda registrada"), {
      target: { value: "v-legado" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar vínculo da entrega" }),
    );
    await screen.findByText("Selecione uma venda vinculável sem impedimentos.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("nova venda e entrega usam uma confirmação atômica, mantendo aceite pendente", async () => {
    render(
      <NovaEntregaComercialLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        podeFinanceiro
        config={config}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Vínculo da entrega"), {
      target: { value: "NOVA_VENDA" },
    });
    fireEvent.change(screen.getByLabelText("Produto de leite"), {
      target: { value: "leite" },
    });
    fireEvent.change(screen.getByLabelText("Volume expedido (L)"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("Valor total definitivo (R$)"), {
      target: { value: "225" },
    });
    fireEvent.change(screen.getByLabelText("Comprador"), {
      target: { value: "p" },
    });
    fireEvent.change(screen.getByLabelText("Condição financeira"), {
      target: { value: "A_PRAZO" },
    });
    fireEvent.change(screen.getByLabelText("Vencimento da parcela"), {
      target: { value: "2026-10-30" },
    });
    conferencia();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar venda e entrega" }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/pecuaria/rebanho/leite/comercial/entregas",
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.vinculo).toMatchObject({
      tipo: "NOVA_VENDA",
      venda: {
        produtoId: "leite",
        quantidadeLitros: 100,
        valorTotal: 225,
        financeiro: { condicao: "A_PRAZO" },
      },
    });
    expect(payload.volumeAceito).toBeNull();
  });
  it("perfil sem Financeiro consulta volumes e não pede documentos ou cadastros financeiros", async () => {
    render(<ComercialLeite podeLancar={false} podeFinanceiro={false} />);
    await screen.findByText("Coleta 19");
    expect(
      screen.getByRole("cell", { name: /Aceito: Ainda não informado/ }),
    ).toBeTruthy();
    expect(obterConfiguracoesFinanceiras).not.toHaveBeenCalled();
    expect(
      vi
        .mocked(consultarLeite)
        .mock.calls.some((c) => c[0].includes("demonstrativos")),
    ).toBe(false);
    expect(
      screen.queryByRole("button", { name: "Registrar demonstrativo" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Registrar entrega" }),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("conferência parcial registra somente o aceite informado e a versão, sem retorno físico presumido", async () => {
    render(<ComercialLeite podeLancar podeFinanceiro={false} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Conferir Coleta 19" }),
    );
    fireEvent.change(screen.getByLabelText("Situação do aceite"), {
      target: { value: "DIVERGENCIA" },
    });
    fireEvent.change(screen.getByLabelText(/Volume aceito \(L\)/), {
      target: { value: "80" },
    });
    fireEvent.change(
      screen.getByLabelText("Motivo ou evidência da conferência"),
      { target: { value: "Comprador informou diferença de volume" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar conferência da entrega" }),
    );
    await screen.findByText(
      "Nova conferência registrada. Nenhum retorno ao estoque ou efeito financeiro foi presumido.",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      versaoEsperada: 2,
      volumeAceito: 80,
      situacao: "DIVERGENCIA",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/entregas/e1/conferencias");
  });
  it("demonstrativo parcial exige motivo do aceite desconhecido e não cria pagamento nem nova venda", async () => {
    render(
      <NovoDemonstrativoLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        config={config}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Comprador do demonstrativo"), {
      target: { value: "p" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Alocar Coleta 19" }),
    );
    fireEvent.change(screen.getByLabelText("Referência do demonstrativo"), {
      target: { value: "Demonstrativo outubro" },
    });
    fireEvent.change(screen.getByLabelText("Preço-base informado (R$/L)"), {
      target: { value: "2,25" },
    });
    fireEvent.change(screen.getByLabelText("Volume reconhecido (L)"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Valor comercial informado (R$)"), {
      target: { value: "112,50" },
    });
    fireEvent.change(screen.getByLabelText("Litros alocados a Coleta 19"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Valor alocado a Coleta 19 (R$)"), {
      target: { value: "112,50" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar demonstrativo sem nova venda",
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Justificativa do aceite pendente de Coleta 19"),
      { target: { value: "Documento parcial com aceite pendente expresso" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar demonstrativo sem nova venda",
      }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toMatchObject({
      volumeReconhecido: 50,
      valorComercial: 112.5,
      valorPagamentoInformado: null,
      componentes: [],
      alocacoes: [
        {
          entregaId: "e1",
          versaoEsperadaEntrega: 2,
          versaoVendaId: "versao-v1",
          quantidadeLitros: 50,
          valor: 112.5,
          motivoAceitePendente:
            "Documento parcial com aceite pendente expresso",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/comercial/demonstrativos");
  });
  it("aloca várias entregas parcialmente e preserva retenção/adiantamento manuais sem baixar ou receber novamente", async () => {
    const segunda = {
      ...entrega,
      id: "e2",
      referencia: "Coleta 18",
      data: "2026-10-18",
      volumeAceito: "50",
      expedidoLitros: "50",
      aceitePendente: false,
      quantidadeDisponivel: "50",
      limiteExpedidoPendenteLitros: null,
      valorDisponivel: "100.00",
      versaoVendaId: "versao-v2",
      versao: 4,
    };
    vi.mocked(consultarLeite).mockResolvedValue({
      propriedadeId: 2,
      itens: [entrega, segunda],
      total: 2,
      pagina: 1,
      porPagina: 20,
    });
    render(
      <NovoDemonstrativoLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        config={config}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Comprador do demonstrativo"), {
      target: { value: "p" },
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Alocar Coleta 19" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Alocar Coleta 18" }));
    for (const [nome, valor] of [
      ["Referência do demonstrativo", "Demonstrativo parcial outubro"],
      ["Preço-base informado (R$/L)", "2,25"],
      ["Volume reconhecido (L)", "75"],
      ["Valor comercial informado (R$)", "168,75"],
      ["Pagamento informado (R$) — opcional", "153,75"],
      ["Litros alocados a Coleta 19", "101"],
      ["Valor alocado a Coleta 19 (R$)", "112,50"],
      ["Litros alocados a Coleta 18", "25"],
      ["Valor alocado a Coleta 18 (R$)", "56,25"],
      [
        "Justificativa do aceite pendente de Coleta 19",
        "Aceite pendente documentado no demonstrativo",
      ],
    ])
      fireEvent.change(screen.getByLabelText(nome), {
        target: { value: valor },
      });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar demonstrativo sem nova venda",
      }),
    );
    await screen.findByText(
      "Uma alocação excede o saldo disponível de volume ou valor da entrega.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Litros alocados a Coleta 19"), {
      target: { value: "50" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar componente manual" }),
    );
    fireEvent.change(screen.getByLabelText("Natureza do componente 1"), {
      target: { value: "RETENCAO" },
    });
    fireEvent.change(screen.getByLabelText("Valor do componente 1 (R$)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Referência do componente 1"), {
      target: { value: "Retenção contratual" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Adicionar componente manual" }),
    );
    fireEvent.change(screen.getByLabelText("Natureza do componente 2"), {
      target: { value: "ADIANTAMENTO" },
    });
    fireEvent.change(screen.getByLabelText("Valor do componente 2 (R$)"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("Referência do componente 2"), {
      target: { value: "Adiantamento anterior" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar demonstrativo sem nova venda",
      }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.alocacoes).toHaveLength(2);
    expect(payload).toMatchObject({
      volumeReconhecido: 75,
      valorComercial: 168.75,
      valorPagamentoInformado: 153.75,
      componentes: [
        { natureza: "RETENCAO", valor: 10, referencia: "Retenção contratual" },
        {
          natureza: "ADIANTAMENTO",
          valor: 5,
          referencia: "Adiantamento anterior",
        },
      ],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("permite conciliar entregas históricas de comprador inativo sem reativá-lo", async () => {
    render(
      <NovoDemonstrativoLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        config={{
          ...config,
          parceiros: config.parceiros.map((p) => ({ ...p, ativo: false })),
        }}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("option", {
        name: "Comprador real (inativo · histórico)",
      }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Comprador do demonstrativo"), {
      target: { value: "p" },
    });
    await screen.findByRole("button", { name: "Alocar Coleta 19" });
    expect(consultarLeite).toHaveBeenCalledWith(
      "/comercial/entregas?de=2026-10-01&ate=2026-10-19&parceiroId=p&pagina=1",
      2,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("usa o sítio resolvido pelo servidor para operar a fazenda de sítio único invisível", async () => {
    setPropriedadeAtiva(null);
    render(<ComercialLeite podeLancar podeFinanceiro={false} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Registrar entrega" }),
    );
    await escolherExistente();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar vínculo da entrega" }),
    );
    await screen.findByText(
      "Entrega registrada. O vínculo físico e comercial foi preservado sem duplicar a retirada.",
    );
    expect(fetchMock.mock.calls[0][1].headers["X-Propriedade-Id"]).toBe("2");
  });
  it("anula documento com versão e motivo, sem acionar retorno de estoque ou transação de caixa", async () => {
    vi.mocked(consultarLeite).mockImplementation(async (caminho) =>
      caminho.includes("demonstrativos")
        ? ({
            propriedadeId: 2,
            itens: [
              {
                id: "d1",
                propriedadeId: 2,
                parceiroId: "p",
                inicio: "2026-10-01",
                fim: "2026-10-19",
                referencia: "Demonstrativo parcial",
                precoBase: "2.2500",
                volumeReconhecido: "50",
                valorComercial: "112.50",
                valorPagamentoInformado: null,
                componentes: [],
                versao: 3,
                status: "VALIDO",
                motivoAnulacao: null,
                criadoEm: "2026-10-19",
                alocacoes: [
                  {
                    id: "a1",
                    entregaId: "e1",
                    quantidade: "50",
                    valor: "112.50",
                    ativo: true,
                    motivoAceitePendente: "Aceite ainda não informado",
                  },
                ],
              },
            ],
            total: 1,
            pagina: 1,
            porPagina: 20,
          } as never)
        : ({
            propriedadeId: 2,
            itens: [entrega],
            total: 1,
            pagina: 1,
            porPagina: 20,
          } as never),
    );
    render(<ComercialLeite podeLancar podeFinanceiro />);
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Anular Demonstrativo parcial",
      }),
    );
    fireEvent.change(screen.getByLabelText("Motivo da anulação"), {
      target: { value: "Revisão comercial documentada" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmar anulação do demonstrativo",
      }),
    );
    await screen.findByText(
      "Demonstrativo anulado. Alocações liberadas e histórico preservado; estoque e caixa não foram alterados.",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/comercial/demonstrativos/d1/anulacao",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      versaoEsperada: 3,
      motivo: "Revisão comercial documentada",
    });
  });
  it("não inicia upload de comprovante vazio", async () => {
    render(
      <ComprovantesEntregaLeite
        entrega={entrega}
        sitio={2}
        podeLancar
        onMudou={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Anexar comprovante (até 10 MB)"), {
      target: {
        files: [new File([], "vazio.pdf", { type: "application/pdf" })],
      },
    });
    await screen.findByText("Envie um arquivo não vazio de até 10 MB.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("remove imediatamente campos e ação de nova venda quando o acesso financeiro é retirado", () => {
    const view = render(
      <NovaEntregaComercialLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        podeFinanceiro
        config={config}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Vínculo da entrega"), {
      target: { value: "NOVA_VENDA" },
    });
    expect(screen.getByLabelText("Valor total definitivo (R$)")).toBeTruthy();
    view.rerender(
      <NovaEntregaComercialLeite
        sitio={2}
        de="2026-10-01"
        ate="2026-10-19"
        podeFinanceiro={false}
        config={null}
        aoSalvar={aoSalvar}
        aoCancelar={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Valor total definitivo (R$)")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirmar venda e entrega" }),
    ).toBeNull();
    expect(
      (screen.getByLabelText("Vínculo da entrega") as HTMLSelectElement).value,
    ).toBe("VENDA_EXISTENTE");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
