// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { consultarLeite, registrarLeite } from "./operacoes-api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { listarProdutos, type ProdutoDTO } from "../../../estoque/api";
import { OrdenhasGerais } from "./OrdenhasGerais";
import type { ConsultaOrdenhasGerais } from "./tanques-types";
vi.mock("./operacoes-api", () => ({
  consultarLeite: vi.fn(),
  registrarLeite: vi.fn(),
}));
vi.mock("../../../estoque/api", () => ({
  listarProdutos: vi.fn(async () => []),
}));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: vi.fn(() => 1) }));
const dados: ConsultaOrdenhasGerais = {
  origensAutomaticas: [],
  configuracao: {
    id: "config",
    propriedadeId: 1,
    vigenteDesde: "2026-10-01",
    inicial: false,
    fonteProducao: "GERAL",
    intervaloIndividualQuantidade: 1,
    intervaloIndividualUnidade: "MESES",
    ordenhas: [],
  },
  tanques: [
    {
      id: "tanque",
      identidadeId: "t",
      propriedadeId: 1,
      versao: 1,
      nome: "Tanque 3000",
      fabricante: null,
      modelo: null,
      numeroSerie: null,
      capacidadeLitros: 3000,
      vigenteDesde: "2026-10-01",
      ativo: true,
      tabelaConversao: [{ mm: 0, litros: 22.5 }],
      referenciaTabela: "Fabricante",
    },
  ],
  sessoes: [
    { id: "manha", posicaoId: "manha", nome: "Manhã", ordem: 1 },
    { id: "tarde", posicaoId: "tarde", nome: "Tarde", ordem: 2 },
  ],
  medicoes: [],
  animais: [],
};
beforeEach(() => {
  vi.mocked(getPropriedadeAtiva).mockReturnValue(1);
  vi.mocked(listarProdutos).mockResolvedValue([]);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  sessionStorage.clear();
  history.replaceState(null, "", "/?dataOperacional=2026-10-20");
  vi.mocked(consultarLeite).mockResolvedValue(dados);
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it("recupera o rascunho de cada ordenha ao navegar e usa o ponto zero real da tabela", async () => {
  render(<OrdenhasGerais podeLancar />);
  const litros = await screen.findByLabelText("Litros desta ordenha");
  fireEvent.change(screen.getByLabelText("Régua (mm)"), {
    target: { value: "0" },
  });
  expect((litros as HTMLInputElement).value).toBe("22.5");
  fireEvent.change(screen.getByLabelText("Responsável"), {
    target: { value: "Maria" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Tarde" }));
  expect(
    (screen.getByLabelText("Litros desta ordenha") as HTMLInputElement).value,
  ).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Manhã" }));
  expect(
    (screen.getByLabelText("Litros desta ordenha") as HTMLInputElement).value,
  ).toBe("22.5");
  expect((screen.getByLabelText("Responsável") as HTMLInputElement).value).toBe(
    "Maria",
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar aferição" }));
  await waitFor(() =>
    expect(registrarLeite).toHaveBeenCalledWith(
      "/geral",
      1,
      expect.objectContaining({
        posicaoId: "manha",
        litros: 22.5,
        reguaMm: 0,
        versaoEsperada: 0,
      }),
    ),
  );
});
it("não oferece gravação a usuário só de leitura e distingue falta de aferição de zero", async () => {
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findByLabelText("Litros desta ordenha");
  expect(screen.queryByRole("button", { name: "Salvar aferição" })).toBeNull();
  expect(
    (
      screen
        .getByLabelText("Litros desta ordenha")
        .closest("fieldset") as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByText("Aferição não registrada")).toBeTruthy();
});

const produtoLeite: ProdutoDTO = { id: "leite", nome: "Leite cru", unidade: "L", ativo: true };
function comMedicao(): ConsultaOrdenhasGerais {
  return { ...dados, medicoes: [{
    id: "medicao", sessaoId: "manha", tanque: dados.tanques[0], litros: 100,
    reguaMm: null, origemLitros: "DIRETA", natureza: "COMERCIAL", animaisOrigem: [],
    responsavel: "Maria", observacao: null, versao: 1, entradaId: null,
  }] };
}
function promessaPendente<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: Error) => void;
  const promessa = new Promise<T>((resolve, reject) => { resolver = resolve; rejeitar = reject; });
  return { promessa, resolver, rejeitar };
}
it("distingue carregamento, erro HTTP 500 e recuperação sem perder o preenchimento", async () => {
  const primeira = promessaPendente<ProdutoDTO[]>();
  vi.mocked(consultarLeite).mockResolvedValue(comMedicao());
  vi.mocked(listarProdutos).mockReturnValueOnce(primeira.promessa).mockResolvedValue([produtoLeite]);
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText("Carregando produtos para o estoque…");
  expect(screen.queryByText(/Nenhum produto elegível/)).toBeNull();
  expect((screen.getByRole("button", { name: "Confirmar entrada no estoque" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => primeira.rejeitar(new Error("HTTP 500")));
  await screen.findByText(/Não foi possível carregar os produtos para o estoque/);
  fireEvent.change(screen.getByLabelText("Motivo da correção ou declaração da natureza"), { target: { value: "Produção comercial conferida" } });
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  const seletor = screen.getByRole("combobox", { name: "Produto para o estoque" });
  await waitFor(() => expect((seletor as HTMLButtonElement).disabled).toBe(false));
  fireEvent.keyDown(seletor, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Leite cru" }));
  expect((screen.getByLabelText("Motivo da correção ou declaração da natureza") as HTMLInputElement).value).toBe("Produção comercial conferida");
  expect((screen.getByLabelText("Responsável") as HTMLInputElement).value).toBe("Maria");
  expect(registrarLeite).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar entrada no estoque" }));
  await waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/geral/confirmacoes", 1, expect.objectContaining({ produtoId: "leite", motivoNatureza: "Produção comercial conferida" })));
});
it("explica uma lista vazia bem-sucedida e exclui produtos inelegíveis", async () => {
  vi.mocked(consultarLeite).mockResolvedValue(comMedicao());
  vi.mocked(listarProdutos).mockResolvedValue([
    { ...produtoLeite, unidade: "KG" }, { ...produtoLeite, rastrearPartidas: true }, { ...produtoLeite, ativo: false },
  ]);
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText(/Nenhum produto elegível/);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
  expect((screen.getByRole("button", { name: "Confirmar entrada no estoque" }) as HTMLButtonElement).disabled).toBe(true);
});
it("ignora produtos de uma consulta anterior após troca de sítio", async () => {
  const antiga = promessaPendente<ProdutoDTO[]>();
  vi.mocked(consultarLeite).mockResolvedValue(comMedicao());
  vi.mocked(listarProdutos).mockReturnValueOnce(antiga.promessa).mockResolvedValue([]);
  const tela = render(<OrdenhasGerais podeLancar />);
  await screen.findByText("Carregando produtos para o estoque…");
  vi.mocked(getPropriedadeAtiva).mockReturnValue(2);
  tela.rerender(<OrdenhasGerais podeLancar />);
  await screen.findByText(/Nenhum produto elegível/);
  await act(async () => antiga.resolver([produtoLeite]));
  expect(screen.getByText(/Nenhum produto elegível/)).toBeTruthy();
  expect(listarProdutos).toHaveBeenLastCalledWith({ ativo: true }, 2);
  expect(registrarLeite).not.toHaveBeenCalled();
});

it("pré-seleciona as origens calculadas no servidor, sem depender da folha individual", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, animais: [], origensAutomaticas: [{ animalId: "aurora", brinco: "103", nome: "Aurora", del: 10 }] });
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText("Animais de origem · 1");
  fireEvent.change(screen.getByLabelText("Litros desta ordenha"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "Maria" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar aferição" }));
  await waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/geral", 1, expect.objectContaining({ animaisOrigem: ["aurora"] })));
});

it("preserva origens salvas e uma seleção vazia intencional do rascunho", async () => {
  const resultado = { ...comMedicao(), origensAutomaticas: [{ animalId: "aurora", brinco: "103", nome: "Aurora", del: 10 }] };
  resultado.medicoes[0].animaisOrigem = ["origem-historica"];
  vi.mocked(consultarLeite).mockResolvedValue(resultado);
  sessionStorage.setItem("fazendinha:leite:geral:1:2026-10-20:manha:tanque", JSON.stringify({ versao: 1, litros: "123", regua: "", natureza: "COMERCIAL", origens: [], responsavel: "Maria", motivo: "Conferência de origem" }));
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText("Animais de origem · 0");
  fireEvent.click(screen.getByRole("button", { name: "Descartar rascunho" }));
  expect(screen.getByText("Animais de origem · 1")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Conferir animais" }));
  expect(screen.getByRole("checkbox", { name: /Origem salva · origem-historica/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("checkbox", { name: /103 · Aurora/ }).getAttribute("aria-checked")).toBe("false");
  const historica = screen.getByRole("checkbox", { name: /Origem salva · origem-historica/ }) as HTMLButtonElement;
  expect(historica.disabled).toBe(false);
  fireEvent.click(historica);
  expect(historica.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar seleção" }));
  expect(screen.getByText("Animais de origem · 0")).toBeTruthy();
});

it("escolhe somente um tanque, conserva o rascunho ao trocar e não exige os demais", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, tanques: [...dados.tanques, { ...dados.tanques[0], id: "segundo", identidadeId: "t2", nome: "Tanque 2000", capacidadeLitros: 2000 }] });
  render(<OrdenhasGerais podeLancar />);
  const litros = await screen.findByLabelText("Litros desta ordenha");
  fireEvent.change(litros, { target: { value: "155" } });
  fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "Maria" } });
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Tanque desta aferição" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: /Tanque 2000/ }));
  expect(screen.getAllByLabelText("Litros desta ordenha")).toHaveLength(1);
  expect((screen.getByLabelText("Litros desta ordenha") as HTMLInputElement).value).toBe("");
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Tanque desta aferição" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: /Tanque 3000/ }));
  expect((screen.getByLabelText("Litros desta ordenha") as HTMLInputElement).value).toBe("155");
  fireEvent.click(screen.getByRole("button", { name: "Salvar aferição" }));
  await waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/geral", 1, expect.objectContaining({ tanqueId: "tanque", litros: 155 })));
  expect(screen.queryByText(/de 2 tanques/)).toBeNull();
});

it("conserva a versão histórica da aferição e abre os tanques com botões do padrão", async () => {
  const resultado = comMedicao();
  resultado.tanques = [{ ...dados.tanques[0], id: "nova-versao", versao: 2, capacidadeLitros: 3500 }];
  vi.mocked(consultarLeite).mockResolvedValue(resultado);
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText("Aferição salva · ainda não confirmada no estoque");
  expect(screen.getByRole("combobox", { name: "Tanque desta aferição" }).textContent).toContain("3.000");
  fireEvent.click(screen.getByRole("button", { name: "Gerenciar tanques" }));
  expect(await screen.findByRole("dialog", { name: "Configuração dos tanques" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Nova versão de Tanque 3000" }).getAttribute("data-slot")).toBe("button");
});

it("preserva produto e justificativa da confirmação ao trocar o tanque, sem sujar a aferição salva", async () => {
  const resultado = comMedicao();
  resultado.tanques = [...dados.tanques, { ...dados.tanques[0], id: "segundo", identidadeId: "t2", nome: "Tanque 2000" }];
  vi.mocked(consultarLeite).mockResolvedValue(resultado);
  vi.mocked(listarProdutos).mockResolvedValue([produtoLeite]);
  render(<OrdenhasGerais podeLancar />);
  await screen.findByLabelText("Motivo da correção ou declaração da natureza");
  fireEvent.change(screen.getByLabelText("Motivo da correção ou declaração da natureza"), { target: { value: "Origem comercial conferida" } });
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Produto para o estoque" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Leite cru" }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Tanque desta aferição" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: /Tanque 2000/ }));
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Tanque desta aferição" }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: /Tanque 3000/ }));
  expect((screen.getByLabelText("Motivo da correção ou declaração da natureza") as HTMLInputElement).value).toBe("Origem comercial conferida");
  expect(screen.getByRole("combobox", { name: "Produto para o estoque" }).textContent).toContain("Leite cru");
  expect((screen.getByRole("button", { name: "Confirmar entrada no estoque" }) as HTMLButtonElement).disabled).toBe(false);
});

it("protege a seleção de origens no modal e mantém a edição ao continuar", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, origensAutomaticas: [{ animalId: "aurora", brinco: "103", nome: "Aurora", del: 10 }] });
  render(<OrdenhasGerais podeLancar />);
  fireEvent.click(await screen.findByRole("button", { name: "Conferir animais" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /103 · Aurora/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(await screen.findByRole("dialog", { name: "Descartar alterações?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
  expect(screen.getByRole("checkbox", { name: /103 · Aurora/ }).getAttribute("aria-checked")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Aplicar seleção" }));
  expect(screen.getByText("Animais de origem · 0")).toBeTruthy();
  expect(registrarLeite).not.toHaveBeenCalled();
});

it("não confirma com preparação local baseada em versão antiga da aferição", async () => {
  vi.mocked(consultarLeite).mockResolvedValue(comMedicao());
  vi.mocked(listarProdutos).mockResolvedValue([produtoLeite]);
  sessionStorage.setItem("fazendinha:leite:geral:1:2026-10-20:manha:tanque", JSON.stringify({ versao: 0, litros: "100", regua: "", natureza: "COMERCIAL", origens: [], responsavel: "Maria", motivo: "Declaração da versão anterior", produto: "leite", alterado: false }));
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText(/a versão no servidor mudou/);
  expect((screen.getByRole("button", { name: "Confirmar entrada no estoque" }) as HTMLButtonElement).disabled).toBe(true);
  expect(registrarLeite).not.toHaveBeenCalled();
});
