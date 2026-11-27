// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SeletorProdutoCatalogo, type ProdutoEscolhido } from "./SeletorProdutoCatalogo";
import { buscarPaginaProdutos, type ProdutoDTO } from "./api";
vi.mock("./api", async (original) => ({ ...(await original<typeof import("./api")>()), buscarPaginaProdutos: vi.fn() }));
vi.mock("../financeiro/FormProduto", () => ({ FormProduto: () => null }));
const local = { id: "p1", nome: "Produto local", unidade: "UN", apresentacao: "frasco", fabricante: { nome: "Fabricante" } } as ProdutoDTO;
const catalogo = { id: "c1", nome: "Referência", nomeCompleto: "Referência (caixa)", apresentacao: "caixa", fabricante: { id: "f", nome: "Fábrica" }, classificacaoTecnica: { id: "t", nome: "Medicamento" }, unidadeSugerida: "UN" as const, categoriaSugeridaId: null, usoGenetico: false, usoNutricional: false, usoSanitario: true };
function Montado({ aoMudar = vi.fn(), somenteMeus = false }: { aoMudar?: (v: ProdutoEscolhido | null) => void; somenteMeus?: boolean }) {
  const [valor, setValor] = useState<ProdutoEscolhido | null>({ tipo: "produto", produtoId: local.id, nome: local.nome, produto: local });
  return <SeletorProdutoCatalogo rotulo="Produto do item 1" value={valor} somenteMeus={somenteMeus} onChange={v => { setValor(v); aoMudar(v); }} />;
}
beforeEach(() => { vi.mocked(buscarPaginaProdutos).mockImplementation(async ({ origem }) => ({ itens: origem === "meus" ? [local] : [catalogo], total: 1, pagina: 1, porPagina: 10 })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("confirma explicitamente o catálogo e conserva busca ao trocar de aba", async () => {
  const mudou = vi.fn(); render(<Montado aoMudar={mudou} />); fireEvent.click(screen.getByRole("button", { name: "Produto do item 1" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produto" }), { target: { value: "ref" } });
  fireEvent.click(screen.getByRole("tab", { name: "Catálogo" }));
  expect((screen.getByRole("searchbox", { name: "Buscar produto" }) as HTMLInputElement).value).toBe("ref");
  fireEvent.click(await screen.findByRole("radio", { name: /Referência/ }));
  expect(mudou).not.toHaveBeenCalled();
  expect(screen.getByText(/Medicamento/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar seleção" }));
  expect(mudou).toHaveBeenCalledWith(expect.objectContaining({ tipo: "catalogo", produtoCatalogoId: "c1" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Produto do item 1" })));
});
it("cancelar ou Escape preserva valor e devolve foco", async () => {
  const mudou = vi.fn(); render(<Montado aoMudar={mudou} />); const campo = screen.getByRole("button", { name: "Produto do item 1" });
  fireEvent.click(campo); fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(document.activeElement).toBe(campo));
  fireEvent.click(campo); fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mudou).not.toHaveBeenCalled(); expect(campo.textContent).toContain("Produto local");
});
it("restrição local e mudança de busca não permitem confirmar seleção antiga", async () => {
  render(<Montado somenteMeus />); fireEvent.click(screen.getByRole("button", { name: "Produto do item 1" }));
  expect(screen.queryByRole("tab", { name: "Catálogo" })).toBeNull();
  await screen.findByRole("radio", { name: /Produto local/ });
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar produto" }), { target: { value: "outro" } });
  expect((screen.getByRole("button", { name: "Confirmar seleção" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(screen.getByRole("dialog")).queryByRole("radio")).toBeNull();
});
it("confirmar a mesma identidade não altera a linha de origem", async () => {
  const mudou = vi.fn(); render(<Montado aoMudar={mudou} />);
  fireEvent.click(screen.getByRole("button", { name: "Produto do item 1" }));
  await screen.findByRole("radio", { name: /Produto local/ });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar seleção" }));
  expect(mudou).not.toHaveBeenCalled();
});

it("preserva seleção sem oferecer limpeza ou cadastro quando o fluxo proíbe", async () => {
  vi.mocked(buscarPaginaProdutos).mockResolvedValue({ itens: [], total: 0, pagina: 1, porPagina: 10 });
  const mudou = vi.fn();
  render(<SeletorProdutoCatalogo rotulo="Produto planejado" value={{ tipo: "produto", produtoId: local.id, nome: local.nome, produto: local }} limpavel={false} permitirCadastro={false} onChange={mudou} />);
  fireEvent.click(screen.getByRole("button", { name: "Produto planejado" }));
  expect(await screen.findByText("Nenhum produto encontrado.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Cadastrar produto" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Limpar seleção" })).toBeNull();
  expect(mudou).not.toHaveBeenCalled();
});

it("abre diretamente o catálogo e retorna ao botão externo ao cancelar", async () => {
  function MontadoExterno() {
    const [aberto, setAberto] = useState(false);
    const [gatilho] = useState(() => ({ current: null as HTMLButtonElement | null }));
    return <><button ref={gatilho} onClick={() => setAberto(true)}>Ver catálogo</button>{aberto && <SeletorProdutoCatalogo abertoInicial abaInicial="catalogo" retornoFoco={gatilho} aoFechar={() => setAberto(false)} rotulo="Produto planejado" value={null} onChange={vi.fn()} />}</>;
  }
  render(<MontadoExterno />);
  const botao = screen.getByRole("button", { name: "Ver catálogo" }); fireEvent.click(botao);
  expect(screen.getByRole("tab", { name: "Catálogo" }).getAttribute("aria-selected")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  await waitFor(() => expect(document.activeElement).toBe(botao));
});
