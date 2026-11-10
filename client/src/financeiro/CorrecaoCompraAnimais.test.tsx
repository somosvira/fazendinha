// @vitest-environment jsdom
// Correção de uma compra de animais cancelada: "Criar correção" na ficha e o FormOperacao em modo correção,
// com os animais da original (`animalId`, nunca `animal`), sem adicionar, remover nem editar o cadastro.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../lib/controles.fixture"; // ResizeObserver e scrollIntoView para o Radix
import { FormOperacao } from "./FormOperacao";
import { OperacaoFinanceiraDetalhe } from "./OperacaoFinanceiraDetalhe";
import * as navegacao from "../estoque/navegacao";
import type { ConfiguracoesFinanceiras, Operacao } from "./novo-api";
import { brl } from "./financeiro-ui";
import { uid } from "../lib/uid.fixture";

const mocks = vi.hoisted(() => ({ criarOperacao: vi.fn(), obterOperacao: vi.fn() }));
vi.mock("./novo-api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./novo-api")>()), ...mocks }));

const config: ConfiguracoesFinanceiras = {
  contas: [{ id: uid(1), nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false }],
  parceiros: [{ id: uid(1), nome: "Fazenda Vendedora", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true, referencias: 0 }],
  categorias: [{ id: uid(300), nome: "Compra de animais", tipo: "DESPESA", ativo: true } as never],
  centrosCusto: [{ id: uid(400), nome: "Corte", ativo: true, ordem: 1 }],
  produtos: [],
};

type ItemOriginal = { n: number; unidade: string; quantidade: string; valorUnitario: string; valorTotal: string };
const itemAnimal = ({ n, unidade, quantidade, valorUnitario, valorTotal }: ItemOriginal) => ({
  id: uid(200 + n), ordem: n, descricao: `Animal ${100 + n}`, quantidade, unidade, valorUnitario, valorTotal, estocavel: false, produtoId: null,
  animalId: uid(100 + n), animal: { id: uid(100 + n), brinco: String(100 + n), nome: n === 1 ? "Estrela" : null, situacao: { baixa: { tipo: "COMPRA_ESTORNADA", data: "2026-10-02" }, devolucao: null } },
  categoriaId: uid(300), categoriaNome: "Compra de animais", centroCustoId: null, centroCustoNome: null,
});
const frete = (ordem: number) => ({ id: uid(250), ordem, descricao: "Frete do caminhão", quantidade: "1", unidade: "un", valorUnitario: "300", valorTotal: "300", estocavel: false, produtoId: null, categoriaId: uid(300), centroCustoId: null });

function compraCancelada(itens: ItemOriginal[], extras: Partial<Operacao> = {}): Operacao {
  return {
    id: uid(7), numero: 7, tipo: "COMPRA_ANIMAIS", status: "CANCELADA", data: "2026-09-02", descricao: "Garrotes do leilão", valorTotal: "0",
    parceiroId: uid(1), parceiro: { id: uid(1), nome: "Fazenda Vendedora", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true },
    centroCustoId: uid(400), centroCusto: { id: uid(400), nome: "Corte" },
    itens: [...itens.map(itemAnimal), frete(itens.length + 1)],
    transacoes: [{ id: uid(1), seq: 1, tipo: "PAGAMENTO", status: "CONFIRMADA", data: "2026-09-02", formaPagamento: "PIX", valorTotal: "5160", movimentos: [{ id: uid(2), seq: 1, contaId: uid(1), conta: { id: uid(1), nome: "Banco principal" }, direcao: "SAIDA", valor: "5160" }] }],
    compromissos: [], movimentosEstoque: [], documentos: [],
    ...extras,
  } as unknown as Operacao;
}
const porKg: ItemOriginal[] = [
  { n: 1, unidade: "kg", quantidade: "380", valorUnitario: "12.0000", valorTotal: "4560" },
  { n: 2, unidade: "kg", quantidade: "300", valorUnitario: "12.0000", valorTotal: "3600" },
];
const porCabeca: ItemOriginal[] = [
  { n: 1, unidade: "cab", quantidade: "1", valorUnitario: "4500.0000", valorTotal: "4500" },
  { n: 2, unidade: "cab", quantidade: "1", valorUnitario: "4000.5000", valorTotal: "4000.50" },
];

beforeEach(() => { window.history.replaceState(null, "", "/financeiro/operacoes"); mocks.criarOperacao.mockResolvedValue({ id: uid(30), numero: 30, documentos: [] }); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); });

function montarCorrecao(base: Operacao, onSalvo = vi.fn()) {
  return render(<FormOperacao config={config} operacaoBase={base} onSalvo={onSalvo} />);
}

describe("Criar correção na ficha", () => {
  async function abrirFicha(operacao: Operacao) {
    mocks.obterOperacao.mockResolvedValue(operacao);
    render(<OperacaoFinanceiraDetalhe operacaoId={operacao.id} onVoltar={vi.fn()} onAbrir={vi.fn()} onCorrigir={vi.fn()} />);
    await screen.findByText("Garrotes do leilão");
  }

  it("aparece para compra de animais cancelada", async () => {
    await abrirFicha(compraCancelada(porKg));
    expect(screen.getByRole("button", { name: "Criar correção" })).toBeTruthy();
  });

  it("fica oculto para devolução com animais, para compra confirmada e sem acesso à Pecuária", async () => {
    await abrirFicha(compraCancelada(porKg, { tipo: "DEVOLUCAO" }));
    expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
    cleanup();
    await abrirFicha(compraCancelada(porKg, { status: "CONFIRMADA" }));
    expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
    cleanup();
    vi.spyOn(navegacao, "podeAcessarArea").mockReturnValue(false);
    await abrirFicha(compraCancelada(porKg));
    expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
  });

  it("não reabre a correção quando já existe uma", async () => {
    await abrirFicha(compraCancelada(porKg, { correcoes: [{ id: uid(40), numero: 8, descricao: "x", status: "CONFIRMADA" }] }));
    expect(screen.queryByRole("button", { name: "Criar correção" })).toBeNull();
  });
});

describe("FormOperacao em modo correção da compra de animais", () => {
  it("carrega os animais da original, sem adicionar, remover nem editar o cadastro", () => {
    montarCorrecao(compraCancelada(porKg));
    const lista = screen.getByRole("list", { name: "Animais da compra" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(lista.textContent).toContain("Animal 101");
    expect(lista.textContent).toContain("Estrela");
    expect(screen.queryByRole("button", { name: "Adicionar animal" })).toBeNull();
    expect(screen.queryByLabelText("Editar animal 101")).toBeNull();
    expect(screen.queryByLabelText("Remover animal 101")).toBeNull();
    const ficha = within(lista).getAllByRole("link", { name: /^Dados do animal .+ na ficha \(abre em nova aba\)$/ });
    expect(ficha).toHaveLength(2);
    expect(ficha[0].getAttribute("href")).toContain(`/pecuaria/rebanho/animais/${uid(101)}`);
    expect(screen.getByRole("combobox", { name: "Tipo de operação" }).hasAttribute("disabled") || screen.getByRole("combobox", { name: "Tipo de operação" }).getAttribute("data-disabled") !== null).toBe(true);
    const previa = screen.getByTestId("conteudo-resumo-operacao").textContent ?? "";
    expect(previa).toContain("Manter 2 animais da compra original (reativa os que estavam baixados pelo estorno)");
    expect(previa).not.toContain("Cadastrar 2 animais");
    expect(screen.getByRole("heading", { name: "Outros itens da compra" })).toBeTruthy();
    expect((screen.getByLabelText("Descrição do item 1") as HTMLInputElement).value).toBe("Frete do caminhão");
  });

  it("deduz kg: unidade, peso pago e preço vêm da original", () => {
    montarCorrecao(compraCancelada(porKg));
    expect(screen.getByRole("radio", { name: "Por kg" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Peso pago do animal 101") as HTMLInputElement).value).toBe("380");
    expect((screen.getByLabelText("Preço do animal 101") as HTMLInputElement).value).toBe("12");
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(4560));
    expect(screen.getByLabelText("Valor do animal 102").textContent).toBe(brl(3600));
  });

  it("deduz arroba com o peso exato (400 kg a R$ 300/@ = 26,667 @ na original)", () => {
    montarCorrecao(compraCancelada([{ n: 1, unidade: "@", quantidade: "26.667", valorUnitario: "299.9963", valorTotal: "8000" }]));
    expect(screen.getByRole("radio", { name: "Por arroba" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Peso pago do animal 101") as HTMLInputElement).value).toBe("400");
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(8000));
  });

  it("deduz por cabeça e permite trocar para o valor do lote com a soma", () => {
    montarCorrecao(compraCancelada(porCabeca));
    expect(screen.getByRole("radio", { name: "Por cabeça" }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Preço do animal 101") as HTMLInputElement).value).toBe("4500");
    fireEvent.click(screen.getByRole("radio", { name: "Valor do lote" }));
    expect((screen.getByLabelText("Valor total do lote") as HTMLInputElement).value).toBe("8500.5");
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(4250.25));
    expect(screen.getByLabelText("Valor do animal 102").textContent).toBe(brl(4250.25));
  });

  it("envia animalId e corrigeOperacaoId, sem `animal`, com o preço corrigido", async () => {
    const onSalvo = vi.fn();
    const { container } = montarCorrecao(compraCancelada(porKg), onSalvo);
    fireEvent.change(screen.getByLabelText("Preço do animal 101"), { target: { value: "13" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.criarOperacao).toHaveBeenCalledOnce());
    const corpo = mocks.criarOperacao.mock.calls[0][0];
    expect(corpo).toMatchObject({ tipo: "COMPRA_ANIMAIS", corrigeOperacaoId: uid(7), parceiroId: uid(1), centroCustoId: uid(400) });
    expect(corpo.itens).toHaveLength(3);
    expect(corpo.itens[0]).toMatchObject({ descricao: "Animal 101", quantidade: "380", unidade: "kg", valorTotal: "4940.00", animalId: uid(101), categoriaId: uid(300), centroCustoId: null, estocavel: false });
    expect(corpo.itens[1]).toMatchObject({ animalId: uid(102), quantidade: "300", unidade: "kg", valorTotal: "3600.00" });
    expect(corpo.itens.every((item: Record<string, unknown>, i: number) => i === 2 || (!("animal" in item) && item.produtoId === undefined))).toBe(true);
    expect(corpo.itens[2]).toMatchObject({ descricao: "Frete do caminhão", unidade: "un", estocavel: false });
    expect(corpo.itens[2].animalId).toBeUndefined();
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
  });

  it("mostra o erro `itens` (conjunto de animais) na confirmação", async () => {
    const { ApiError } = await import("./novo-api");
    mocks.criarOperacao.mockRejectedValueOnce(new ApiError("A correção mantém exatamente os animais da operação original. Para devolver cabeças, use a devolução.", 409, "CONFLITO", "itens"));
    const { container } = montarCorrecao(compraCancelada(porKg));
    fireEvent.submit(container.querySelector("form")!);
    expect((await screen.findAllByText(/A correção mantém exatamente os animais/)).length).toBeGreaterThan(0);
    expect(document.querySelector("#animal-1")?.getAttribute("aria-invalid")).toBeNull();
  });

  it("mostra o erro itens.N.animalId na linha do animal certo", async () => {
    const { ApiError } = await import("./novo-api");
    mocks.criarOperacao.mockRejectedValueOnce(new ApiError("O animal já está na compra ativa #9", 409, "CONFLITO", "itens.1.animalId"));
    const { container } = montarCorrecao(compraCancelada(porKg));
    fireEvent.submit(container.querySelector("form")!);
    const linha = await waitFor(() => {
      const el = document.getElementById("animal-2")!;
      expect(el.getAttribute("aria-invalid")).toBe("true");
      return el;
    });
    expect(within(linha).getByText("O animal já está na compra ativa #9")).toBeTruthy();
    expect(within(linha).queryByRole("button", { name: "Corrigir no cadastro" })).toBeNull();
    expect(document.getElementById("animal-1")?.getAttribute("aria-invalid")).toBeNull();
  });
});
