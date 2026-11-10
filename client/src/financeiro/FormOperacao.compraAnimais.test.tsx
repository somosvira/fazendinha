// @vitest-environment jsdom
// Compra de animais no FormOperacao: o cadastro de cada animal é o MESMO de "Novo animal", aberto em
// modal; a operação só cadastra o animal ao ser confirmada.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../lib/controles.fixture"; // define ResizeObserver e scrollIntoView para o Radix
import { FormOperacao } from "./FormOperacao";
import { setPropriedadeAtiva } from "../propriedadeScope";
import type { ConfiguracoesFinanceiras, RascunhoOperacao } from "./novo-api";
import { limparRascunhoAtivo } from "./rascunhoAtivo";
import { brl, hoje } from "./financeiro-ui";
import { uid } from "../lib/uid.fixture";
import { cadastrarAnimal, listarCategorias, listarGenitores, obterCatalogos, preverComposicaoAnimal } from "../pecuaria/rebanho/api";
import { consultarBezerreiro } from "../pecuaria/rebanho/bezerreiro/api";
import { listarPropriedades } from "@/api/propriedades";
import { formAnimalInicial } from "../pecuaria/rebanho/forms/CadastroAnimal";
import type { AnimalCompraForm } from "./AnimaisCompra";
import type { Catalogos } from "../pecuaria/rebanho/types";

vi.mock("../pecuaria/rebanho/bezerreiro/api", () => ({ consultarBezerreiro: vi.fn() }));
vi.mock("../pecuaria/rebanho/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../pecuaria/rebanho/api")>()),
  obterCatalogos: vi.fn(), listarCategorias: vi.fn(), cadastrarAnimal: vi.fn(), listarGenitores: vi.fn(), preverComposicaoAnimal: vi.fn(),
}));
vi.mock("@/api/propriedades", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/api/propriedades")>()), listarPropriedades: vi.fn() }));

const config: ConfiguracoesFinanceiras = {
  contas: [{ id: uid(1), nome: "Banco principal", tipo: "BANCO", instituicao: null, identificacao: null, saldoAbertura: "1000", dataSaldoAbertura: "2026-09-01", saldoAtual: "1000", incluirNoSaldoGeral: true, ativo: true, temMovimentos: false }],
  parceiros: [{ id: uid(1), nome: "Fornecedor Rural", documento: null, tipo: "FORNECEDOR", telefone: null, email: null, ativo: true, referencias: 0 }],
  categorias: [{ id: uid(5), nome: "Compra de animais", tipo: "DESPESA", ativo: true } as never],
  centrosCusto: [{ id: uid(9), nome: "Pecuária de corte", ativo: true, ordem: 1 }],
  produtos: [{ id: uid(1), nome: "Ração", unidade: "KG" }],
};
const catalogos: Catalogos = {
  racas: [{ id: "raca-1", nome: "Nelore", sigla: "NE", base: true }],
  motivosBaixa: [],
  propriedades: [{ id: 1, nome: "Sítio Sede", apelido: null }],
  lotes: [],
};

beforeEach(() => {
  limparRascunhoAtivo();
  setPropriedadeAtiva(1);
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarPropriedades).mockResolvedValue([{ id: 1, nome: "Sítio Sede", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 0 }]);
  vi.mocked(obterCatalogos).mockResolvedValue(catalogos);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: [], semCategoria: 0 });
  vi.mocked(listarGenitores).mockResolvedValue([]);
  vi.mocked(preverComposicaoAnimal).mockResolvedValue(null);
  vi.mocked(consultarBezerreiro).mockResolvedValue({ perfis: [] });
});
afterEach(() => { limparRascunhoAtivo(); setPropriedadeAtiva(null); cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const DATA = hoje();

const animalForm = (id: number, brinco: string, extra: Partial<AnimalCompraForm> = {}): AnimalCompraForm => ({
  id,
  cadastro: { ...formAnimalInicial(DATA), brinco, aptidao: "CORTE" },
  payload: {
    brinco, nome: null, brincoEletronico: null, sisbov: null, sexo: "F", dataNascimento: "2026-01-10", nascimentoEstimado: false, dataEntrada: DATA, partosAntesDaEntrada: 0,
    observacao: null, loteId: null, aptidao: "CORTE", papelReprodutivo: "NENHUM", composicao: [], pesoEntradaKg: 180, maeId: null, maeExternaId: null, paiId: null, paiExternoId: null,
  },
  entradaSegueOperacao: true,
  resumo: { brinco, nome: null, sexo: "F", composicao: "", aptidao: "CORTE", pesoEntradaKg: 180 },
  pesoPago: "", preco: "", categoriaId: "", centroCustoId: "",
  ...extra,
});

const rascunhoCom = (formulario: Record<string, unknown>): RascunhoOperacao => ({
  id: uid(8), versao: 2, updatedAt: "2026-09-07T12:00:00Z", documentos: [],
  dados: { formulario: {
    tipo: "COMPRA_ANIMAIS", condicao: "A_VISTA", descricao: "Garrotes do leilão", valorOperacao: "", itens: [], parceiroId: uid(1), categoriaId: "", centroCustoId: uid(9),
    contaId: uid(1), formaPagamento: "PIX", data: DATA, valorAgora: "", parcelas: [], animais: [], unidadePrecoAnimal: "CABECA", valorLote: "", ...formulario,
  } },
});

type Chamada = { url: string; init?: RequestInit };
/** fetch que aceita o rascunho e devolve `respostaConfirmacao` ao confirmar. */
function simularApi(respostaConfirmacao?: { status: number; corpo: unknown }) {
  const chamadas: Chamada[] = [];
  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const caminho = String(url);
    chamadas.push({ url: caminho, init });
    if (caminho.endsWith("/financeiro/operacoes/rascunho") && init?.method === "PUT") return { ok: true, json: async () => ({ id: "draft", dados: {}, versao: 4, documentos: [] }) };
    if (caminho.endsWith("/financeiro/operacoes/rascunho/confirmacao")) {
      return respostaConfirmacao ? { ok: false, status: respostaConfirmacao.status, json: async () => respostaConfirmacao.corpo } : { ok: true, json: async () => ({ id: uid(77), numero: 77, documentos: [] }) };
    }
    return { ok: true, json: async () => ({ existente: null }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  const rascunhosSalvos = () => chamadas.filter((c) => c.url.endsWith("/financeiro/operacoes/rascunho") && c.init?.method === "PUT").map((c) => JSON.parse(String(c.init?.body)) as { dados: { formulario: Record<string, any>; operacao: Record<string, any> } });
  return { fetchMock, chamadas, rascunhosSalvos };
}

/** O rascunho recuperado só é regravado depois de uma alteração do usuário. */
function alterarDescricao(texto = "Garrotes do leilão de setembro") {
  fireEvent.change(screen.getByRole("textbox", { name: "Descrição" }), { target: { value: texto } });
}

function montar(rascunho: RascunhoOperacao | null = null, onSalvo = vi.fn()) {
  return render(<FormOperacao config={config} rascunho={rascunho} tipoInicial={rascunho ? undefined : "COMPRA_ANIMAIS"} onSalvo={onSalvo} />);
}

async function abrirModal() {
  fireEvent.click(await screen.findByRole("button", { name: "Adicionar animal" }));
  const dialogo = await screen.findByRole("dialog");
  await within(dialogo).findByLabelText("Brinco");
  return dialogo;
}
async function adicionarAnimal(brinco: string) {
  const dialogo = await abrirModal();
  fireEvent.change(within(dialogo).getByLabelText("Brinco"), { target: { value: brinco } });
  fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar animal" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("compra de animais: tela", () => {
  it("oferece Compra de animais no tipo e começa sem item em branco", async () => {
    simularApi();
    montar();
    expect(screen.getByRole("combobox", { name: "Tipo de operação" }).textContent).toContain("Compra de animais");
    expect(screen.queryByRole("textbox", { name: "Descrição do item 1" })).toBeNull();
    expect(screen.getByText(/Nenhum animal adicionado/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Outros itens da compra" })).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Tipo de operação" }));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toContain("Compra de animais");
  });

  it("adiciona dois animais pelo modal, resume cada um e não chama a API de cadastro", async () => {
    simularApi();
    montar();
    await adicionarAnimal("101");
    await adicionarAnimal("102");
    expect(screen.getByLabelText("Editar animal 101")).toBeTruthy();
    expect(screen.getByLabelText("Editar animal 102")).toBeTruthy();
    const lista = screen.getByRole("list", { name: "Animais da compra" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(lista.textContent).toContain("Fêmea");
    expect(lista.textContent).toContain("Leite");
    expect(lista.textContent).toContain("Raça não informada");
    expect(lista.textContent).toContain("Sem peso de entrada");
    expect(cadastrarAnimal).not.toHaveBeenCalled();
    const previa = screen.getByTestId("conteudo-resumo-operacao").textContent ?? "";
    expect(previa).toContain("Cadastrar 2 animais no Rebanho do sítio Sítio Sede");
    expect(previa).toContain("Nenhum movimento de estoque será gerado.");
  });

  it("o modal usa o cadastro compartilhado: sítio fixo, data de entrada da operação e validação do brinco", async () => {
    simularApi();
    montar();
    const dialogo = await abrirModal();
    expect((within(dialogo).getByLabelText("Sítio") as HTMLElement).textContent).toContain("Sítio Sede");
    expect(within(dialogo).getByLabelText("Sítio").matches(":disabled, [aria-disabled='true'], [data-disabled]")).toBe(true);
    expect(within(dialogo).queryByRole("button", { name: "Registrar nascimento pelo parto" })).toBeNull();
    for (const campo of ["Brinco", "Nome", "Sexo", "Brinco eletrônico", "SISBOV", "Data de nascimento", "Data de entrada", "Partos antes da entrada", "Lote", "Finalidade", "Papel reprodutivo", "Peso de entrada (kg)", "Observação"]) {
      expect(within(dialogo).getByLabelText(campo)).toBeTruthy();
    }
    for (const secao of ["Identificação", "Datas e filiação", "Localização e finalidade", "Composição racial"]) expect(within(dialogo).getByRole("heading", { name: secao })).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar animal" }));
    expect(await within(dialogo).findByText("Informe o brinco")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Animais da compra" })).toBeNull();
  });

  it("recusa brinco repetido na mesma compra", async () => {
    simularApi();
    montar();
    await adicionarAnimal("101");
    const dialogo = await abrirModal();
    fireEvent.change(within(dialogo).getByLabelText("Brinco"), { target: { value: " 101 " } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar animal" }));
    expect(await within(dialogo).findByText("O brinco 101 já está nesta operação")).toBeTruthy();
  });

  it("fechar o modal descarta a edição e devolve o foco a quem o abriu", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
    simularApi();
    montar();
    const acionador = await screen.findByRole("button", { name: "Adicionar animal" });
    acionador.focus();
    const dialogo = await abrirModal();
    fireEvent.change(within(dialogo).getByLabelText("Brinco"), { target: { value: "999" } });
    fireEvent.keyDown(dialogo, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("list", { name: "Animais da compra" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar animal" })));
  });

  it("editar reabre o modal com os dados e confirmar atualiza só o resumo, mantendo o preço", async () => {
    simularApi();
    montar(rascunhoCom({ animais: [animalForm(1, "101", { preco: "4500" })] }));
    fireEvent.click(screen.getByLabelText("Editar animal 101"));
    const dialogo = await screen.findByRole("dialog", { name: "Editar animal 101" });
    await within(dialogo).findByLabelText("Brinco");
    expect((within(dialogo).getByLabelText("Brinco") as HTMLInputElement).value).toBe("101");
    fireEvent.change(within(dialogo).getByLabelText("Brinco"), { target: { value: "101-A" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar animal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Editar animal 101-A")).toBeTruthy();
    expect((screen.getByLabelText("Preço do animal 101-A") as HTMLInputElement).value).toBe("4500");
  });

  it("remove um animal da compra", async () => {
    simularApi();
    montar(rascunhoCom({ animais: [animalForm(1, "101", { preco: "4500" }), animalForm(2, "102", { preco: "4000" })] }));
    fireEvent.click(screen.getByLabelText("Remover animal 101"));
    expect(screen.queryByLabelText("Editar animal 101")).toBeNull();
    expect(screen.getByLabelText("Editar animal 102")).toBeTruthy();
  });
});

describe("compra de animais: preço", () => {
  it("por cabeça mostra o valor de cada item e o total na prévia", async () => {
    simularApi();
    montar(rascunhoCom({ animais: [animalForm(1, "101", { preco: "4500" }), animalForm(2, "102", { preco: "4000.5" })] }));
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(4500));
    expect(screen.getByLabelText("Valor do animal 102").textContent).toBe(brl(4000.5));
    expect(screen.getByTestId("conteudo-resumo-operacao").textContent).toContain(brl(8500.5));
  });

  it("por kg pede o peso pago e calcula peso × preço", async () => {
    simularApi();
    montar(rascunhoCom({ unidadePrecoAnimal: "KG", animais: [animalForm(1, "101", { pesoPago: "380", preco: "12" }), animalForm(2, "102")] }));
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(4560));
    expect(screen.getByLabelText("Valor do animal 102").textContent).toBe("—");
    fireEvent.change(screen.getByLabelText("Peso pago do animal 102"), { target: { value: "250.5" } });
    fireEvent.change(screen.getByLabelText("Preço do animal 102"), { target: { value: "13" } });
    expect(screen.getByLabelText("Valor do animal 102").textContent).toBe(brl(3256.5));
  });

  it("por arroba converte o peso pago em @ (450 kg a R$ 300/@ = 30 @ = R$ 9.000)", async () => {
    simularApi();
    montar(rascunhoCom({ unidadePrecoAnimal: "ARROBA", animais: [animalForm(1, "101", { pesoPago: "450", preco: "300" })] }));
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(9000));
    expect(within(screen.getByRole("list", { name: "Animais da compra" })).getByText("30 @")).toBeTruthy();
  });

  it("valor do lote divide em centavos e deixa a sobra no último animal", async () => {
    simularApi();
    const animais = Array.from({ length: 7 }, (_, i) => animalForm(i + 1, `G${i + 1}`));
    montar(rascunhoCom({ unidadePrecoAnimal: "LOTE", valorLote: "10000", animais }));
    expect(screen.getByLabelText("Valor do animal G1").textContent).toBe(brl(1428.57));
    expect(screen.getByLabelText("Valor do animal G6").textContent).toBe(brl(1428.57));
    expect(screen.getByLabelText("Valor do animal G7").textContent).toBe(brl(1428.58));
    expect(screen.getByRole("status", { name: "Preço médio por animal" }).textContent).toContain(brl(1428.57));
    expect(screen.queryByLabelText("Preço do animal G1")).toBeNull();
    expect(screen.getByTestId("conteudo-resumo-operacao").textContent).toContain(brl(10000));
  });

  it("trocar a unidade limpa os preços e escolher o lote mostra o campo do valor total", async () => {
    simularApi();
    montar(rascunhoCom({ animais: [animalForm(1, "101", { preco: "4500" })] }));
    fireEvent.click(screen.getByRole("radio", { name: "Por kg" }));
    expect((screen.getByLabelText("Preço do animal 101") as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Peso pago do animal 101")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Valor do lote" }));
    expect(screen.getByLabelText("Valor total do lote")).toBeTruthy();
  });
});

describe("compra de animais: envio e rascunho", () => {
  it("salva o rascunho com os animais e o payload do item (animal + frete, sem produto nem estoque)", async () => {
    const api = simularApi();
    montar(rascunhoCom({
      unidadePrecoAnimal: "KG",
      animais: [animalForm(1, "101", { pesoPago: "380", preco: "12", categoriaId: uid(5) }), animalForm(2, "102", { pesoPago: "300", preco: "12" })],
      itens: [{ id: 50, categoriaId: "", centroCustoId: "", produtoId: "", descricao: "Frete do caminhão", quantidade: "1", unidade: "un", modoValor: "UNITARIO", valorUnitario: "300", valorTotal: "" }],
    }));
    alterarDescricao();
    await waitFor(() => expect(api.rascunhosSalvos().length).toBeGreaterThan(0), { timeout: 3000 });
    const salvo = api.rascunhosSalvos().at(-1)!;
    expect(salvo.dados.formulario.animais).toHaveLength(2);
    expect(salvo.dados.formulario.unidadePrecoAnimal).toBe("KG");
    const { operacao } = salvo.dados;
    expect(operacao.tipo).toBe("COMPRA_ANIMAIS");
    expect(operacao.itens).toHaveLength(3);
    expect(operacao.itens[0]).toMatchObject({
      descricao: "Animal 101", quantidade: "380", unidade: "kg", valorTotal: "4560.00", categoriaId: uid(5), centroCustoId: null, estocavel: false,
      animal: { brinco: "101", sexo: "F", aptidao: "CORTE", dataEntrada: DATA, pesoEntradaKg: 180 },
    });
    expect(operacao.itens[0].produtoId).toBeUndefined();
    expect(operacao.itens[0].animal).not.toHaveProperty("origem");
    expect(operacao.itens[0].animal).not.toHaveProperty("propriedadeId");
    expect(operacao.itens[1]).toMatchObject({ descricao: "Animal 102", quantidade: "300", unidade: "kg", valorTotal: "3600.00" });
    expect(operacao.itens[2]).toMatchObject({ descricao: "Frete do caminhão", quantidade: "1", unidade: "un", valorUnitario: "300", estocavel: false });
    expect(operacao.itens[2].animal).toBeUndefined();
    expect(operacao.itens[2].produtoId).toBeUndefined();
    expect(operacao.itens.every((item: { partidas?: unknown }) => item.partidas === undefined)).toBe(true);
  });

  it("a data de entrada acompanha a data da operação enquanto não foi mudada no cadastro", async () => {
    const api = simularApi();
    montar(rascunhoCom({ data: "2026-09-01", animais: [animalForm(1, "101", { preco: "4500" }), animalForm(2, "102", { preco: "4500", entradaSegueOperacao: false, payload: { ...animalForm(2, "102").payload, dataEntrada: "2026-08-20" } })] }));
    alterarDescricao();
    await waitFor(() => expect(api.rascunhosSalvos().length).toBeGreaterThan(0), { timeout: 3000 });
    const itens = api.rascunhosSalvos().at(-1)!.dados.operacao.itens;
    expect(itens[0].animal.dataEntrada).toBe("2026-09-01");
    expect(itens[1].animal.dataEntrada).toBe("2026-08-20");
  });

  it("no lote, cada animal vai como item por cabeça com a parte do valor", async () => {
    const api = simularApi();
    montar(rascunhoCom({ unidadePrecoAnimal: "LOTE", valorLote: "10000", animais: Array.from({ length: 7 }, (_, i) => animalForm(i + 1, `G${i + 1}`)) }));
    alterarDescricao();
    await waitFor(() => expect(api.rascunhosSalvos().length).toBeGreaterThan(0), { timeout: 3000 });
    const itens = api.rascunhosSalvos().at(-1)!.dados.operacao.itens;
    expect(itens.map((item: { valorTotal: string }) => item.valorTotal)).toEqual(["1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.57", "1428.58"]);
    expect(itens.every((item: { unidade: string; quantidade: string }) => item.unidade === "cab" && item.quantidade === "1")).toBe(true);
  });

  it("um animal adicionado pelo modal entra no rascunho salvo e volta ao reabrir a tela", async () => {
    const api = simularApi();
    const primeira = montar();
    await adicionarAnimal("101");
    fireEvent.change(screen.getByLabelText("Preço do animal 101"), { target: { value: "4500" } });
    await waitFor(() => {
      const salvo = api.rascunhosSalvos().at(-1);
      expect(salvo?.dados.formulario.animais?.[0]?.preco).toBe("4500");
    }, { timeout: 3000 });
    const dados = api.rascunhosSalvos().at(-1)!.dados;
    primeira.unmount();
    limparRascunhoAtivo();
    montar({ id: uid(8), versao: 3, updatedAt: "2026-09-07T12:00:00Z", documentos: [], dados });
    expect(screen.getByLabelText("Editar animal 101")).toBeTruthy();
    expect((screen.getByLabelText("Preço do animal 101") as HTMLInputElement).value).toBe("4500");
    expect(screen.getByLabelText("Valor do animal 101").textContent).toBe(brl(4500));
    expect(cadastrarAnimal).not.toHaveBeenCalled();
  });

  it("sem animal ou sem preço, confirmar leva ao ponto pendente sem enviar", async () => {
    const api = simularApi();
    const { container } = montar(rascunhoCom({ animais: [] }));
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText("Adicione ao menos um animal à compra.")).toBeTruthy();
    expect(api.chamadas.some((c) => c.url.endsWith("/confirmacao"))).toBe(false);
  });

  it("marca o animal recusado pela API e reabre o modal no campo", async () => {
    const api = simularApi({ status: 409, corpo: { error: "Já existe um animal ativo com o brinco 102 neste sítio", code: "CONFLITO", campo: "itens.1.animal.brinco" } });
    const { container } = montar(rascunhoCom({ animais: [animalForm(1, "101", { preco: "4500" }), animalForm(2, "102", { preco: "4000" })] }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Adicionar animal" }) as HTMLButtonElement).disabled).toBe(false)); // sítio da compra carregado
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(api.chamadas.some((c) => c.url.endsWith("/confirmacao"))).toBe(true));
    const linha = await waitFor(() => {
      const el = document.getElementById("animal-2");
      expect(el?.getAttribute("aria-invalid")).toBe("true");
      return el!;
    });
    expect(within(linha).getByText("Já existe um animal ativo com o brinco 102 neste sítio")).toBeTruthy();
    expect(document.getElementById("animal-1")?.getAttribute("aria-invalid")).toBeNull();
    fireEvent.click(within(linha).getByRole("button", { name: "Corrigir no cadastro" }));
    const dialogo = await screen.findByRole("dialog", { name: "Editar animal 102" });
    expect(await within(dialogo).findByText("Já existe um animal ativo com o brinco 102 neste sítio")).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.id).toBe("animal-compra-brinco"));
    fireEvent.change(within(dialogo).getByLabelText("Brinco"), { target: { value: "103" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar animal" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Editar animal 103")).toBeTruthy();
    expect(document.getElementById("animal-2")?.getAttribute("aria-invalid")).toBeNull();
  });

  it("com vários sítios e nenhum ativo, pede a fazenda antes de cadastrar animais", async () => {
    setPropriedadeAtiva(null);
    vi.mocked(listarPropriedades).mockResolvedValue([
      { id: 1, nome: "Sede", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 0 },
      { id: 2, nome: "Barra", apelido: null, cidade: null, uf: null, principal: false, ativo: true, ordem: 1 },
    ]);
    simularApi();
    montar();
    expect(await screen.findByText(/Selecione uma fazenda no seletor do topo/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Adicionar animal" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
