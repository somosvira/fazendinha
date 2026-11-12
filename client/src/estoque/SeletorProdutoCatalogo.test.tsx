// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SeletorProdutoCatalogo, type ProdutoEscolhido } from "./SeletorProdutoCatalogo";
import { buscarProdutosUnificado, type BuscaProdutosDTO, type ProdutoDTO } from "./api";

vi.mock("./api", async (importOriginal) => ({ ...(await importOriginal<typeof import("./api")>()), buscarProdutosUnificado: vi.fn() }));
// O formulário de cadastro tem testes próprios: aqui basta saber que o seletor o abre e recebe o produto salvo.
vi.mock("../financeiro/FormProduto", () => ({
  FormProduto: ({ onSalvo, onFechar }: { onSalvo: (p: unknown) => void; onFechar: () => void }) => (
    <div role="dialog" aria-label="Novo produto"><button type="button" onClick={() => onSalvo({ id: "novo", nome: "Produto novo", unidade: "UN" })}>Salvar produto de teste</button><button type="button" onClick={onFechar}>Fechar</button></div>
  ),
}));

const meu = { id: "p1", nome: "Ivermectina 1%", unidade: "ML", apresentacao: "frasco 50 mL", fabricante: { id: "f1", nome: "Ourofino", ativo: true } } as unknown as ProdutoDTO;
const catalogo = { id: "c1", nome: "Biomox 20% PS", apresentacao: "sachê 100 g", nomeCompleto: "Biomox 20% PS (sachê 100 g)", fabricante: { id: "f2", nome: "Vetbrands" }, classificacaoTecnica: null, unidadeSugerida: "G" as const, categoriaSugeridaId: "cat-1", usoSanitario: true, usoNutricional: false, usoGenetico: false };
const resposta: BuscaProdutosDTO = { meus: [meu], catalogo: [catalogo] };

function Montado({ inicial = null, uso, aoMudar, somenteMeus }: { inicial?: ProdutoEscolhido | null; uso?: "sanitario"; aoMudar?: (v: ProdutoEscolhido | null) => void; somenteMeus?: boolean }) {
  const [valor, setValor] = useState<ProdutoEscolhido | null>(inicial);
  return <SeletorProdutoCatalogo rotulo="Produto do item 1" value={valor} uso={uso} somenteMeus={somenteMeus} debounceMs={0} onChange={(v) => { setValor(v); aoMudar?.(v); }} />;
}
const campo = () => screen.getByRole("combobox", { name: "Produto do item 1" });

beforeEach(() => { vi.mocked(buscarProdutosUnificado).mockReset().mockResolvedValue(resposta); });
afterEach(cleanup);

describe("SeletorProdutoCatalogo", () => {
  it("somenteMeus oculta o grupo Catálogo", async () => {
    render(<Montado somenteMeus />);
    fireEvent.focus(campo());
    const lista = await screen.findByRole("listbox", { name: "Produto do item 1" });
    expect(within(lista).getAllByRole("group").map((g) => g.firstElementChild?.textContent)).toEqual(["Meus produtos"]);
    expect(screen.queryByRole("option", { name: /Biomox/ })).toBeNull();
  });

  it("mostra 'Buscando…' enquanto carrega e agrupa Meus produtos e Catálogo com fabricante", async () => {
    let liberar!: (d: BuscaProdutosDTO) => void;
    vi.mocked(buscarProdutosUnificado).mockReturnValueOnce(new Promise((r) => { liberar = r; }));
    render(<Montado />);
    fireEvent.focus(campo());
    expect((await screen.findByRole("status")).textContent).toBe("Buscando produtos…");
    liberar(resposta);
    const lista = await screen.findByRole("listbox", { name: "Produto do item 1" });
    const grupos = within(lista).getAllByRole("group");
    expect(grupos.map((g) => g.firstElementChild?.textContent)).toEqual(["Meus produtos", "Catálogo"]);
    expect(within(grupos[0]).getByRole("option").textContent).toContain("Ivermectina 1%");
    expect(within(grupos[0]).getByRole("option").textContent).toContain("Ourofino");
    expect(within(grupos[1]).getByRole("option").textContent).toContain("Biomox 20% PS (sachê 100 g)");
    expect(within(grupos[1]).getByRole("option").textContent).toContain("Vetbrands");
    expect(campo().getAttribute("aria-expanded")).toBe("true");
  });

  it("escolher produto da fazenda devolve a união 'produto'", async () => {
    const aoMudar = vi.fn();
    render(<Montado aoMudar={aoMudar} />);
    fireEvent.focus(campo());
    fireEvent.click(await screen.findByRole("option", { name: /Ivermectina 1%/ }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "produto", produtoId: "p1", nome: "Ivermectina 1%" }));
    expect(campo()).toHaveProperty("value", "Ivermectina 1%");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("escolher item do catálogo devolve produtoCatalogoId, unidade e categoria sugeridas, sem diálogo", async () => {
    const aoMudar = vi.fn();
    render(<Montado aoMudar={aoMudar} />);
    fireEvent.focus(campo());
    fireEvent.click(await screen.findByRole("option", { name: /Biomox/ }));
    expect(aoMudar).toHaveBeenCalledWith({ tipo: "catalogo", produtoCatalogoId: "c1", nomeCompleto: "Biomox 20% PS (sachê 100 g)", unidadeSugerida: "G", categoriaSugeridaId: "cat-1", fabricante: "Vetbrands" });
    expect(campo()).toHaveProperty("value", "Biomox 20% PS (sachê 100 g)");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navega por teclado: setas, Home/End, Enter escolhe e Escape fecha sem escolher", async () => {
    const aoMudar = vi.fn();
    render(<Montado aoMudar={aoMudar} />);
    fireEvent.focus(campo());
    await screen.findAllByRole("option");
    const ativa = () => campo().getAttribute("aria-activedescendant");
    const opcoes = screen.getAllByRole("option");
    expect(ativa()).toBe(opcoes[0].id);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    expect(ativa()).toBe(opcoes[1].id);
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    expect(ativa()).toBe(opcoes[0].id); // dá a volta
    fireEvent.keyDown(campo(), { key: "End" });
    expect(ativa()).toBe(opcoes[1].id);
    fireEvent.keyDown(campo(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(aoMudar).not.toHaveBeenCalled();
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    await screen.findAllByRole("option");
    fireEvent.keyDown(campo(), { key: "ArrowDown" });
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "catalogo", produtoCatalogoId: "c1" }));
  });

  it("busca o texto digitado (com o filtro de uso) e descarta o resultado antigo", async () => {
    render(<Montado uso="sanitario" />);
    fireEvent.focus(campo());
    await screen.findAllByRole("option");
    fireEvent.change(campo(), { target: { value: "biomox" } });
    await waitFor(() => expect(buscarProdutosUnificado).toHaveBeenLastCalledWith({ q: "biomox", uso: "sanitario", limite: 10 }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
  });

  it("sem resultado oferece Cadastrar produto, que abre o formulário e escolhe o produto salvo", async () => {
    vi.mocked(buscarProdutosUnificado).mockResolvedValue({ meus: [], catalogo: [] });
    const aoMudar = vi.fn();
    render(<Montado aoMudar={aoMudar} />);
    fireEvent.change(campo(), { target: { value: "xyz" } });
    expect(await screen.findByText("Nenhum produto encontrado para “xyz”.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar produto" }));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar produto de teste" }));
    expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "produto", produtoId: "novo", nome: "Produto novo" }));
    expect(campo()).toHaveProperty("value", "Produto novo");
  });

  it("erro mostra a mensagem e 'Tentar novamente' refaz a busca", async () => {
    vi.mocked(buscarProdutosUnificado).mockRejectedValueOnce(new Error("Falha de conexão."));
    render(<Montado />);
    fireEvent.focus(campo());
    expect((await screen.findByRole("alert")).textContent).toContain("Falha de conexão.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("option", { name: /Ivermectina/ })).toBeTruthy();
    expect(buscarProdutosUnificado).toHaveBeenCalledTimes(2);
  });

  it("seleção atual aparece no campo e pode ser limpa", async () => {
    const aoMudar = vi.fn();
    render(<Montado inicial={{ tipo: "produto", produtoId: "p1", nome: "Ivermectina 1%" }} aoMudar={aoMudar} />);
    expect(campo()).toHaveProperty("value", "Ivermectina 1%");
    fireEvent.click(screen.getByRole("button", { name: "Limpar produto do item 1" }));
    expect(aoMudar).toHaveBeenCalledWith(null);
    expect(campo()).toHaveProperty("value", "");
  });
});
