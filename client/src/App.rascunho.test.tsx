import { preferirTabelas } from "@/lib/visualizacao.fixture";
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App } from "./App";
import { setSessao, type UsuarioSessao } from "./lib/auth";
import { setPropriedadeAtiva } from "./propriedadeScope";
import { limparRascunhoAtivo } from "./financeiro/rascunhoAtivo";

const usuarioBase: UsuarioSessao = {
  id: 7, nome: "Ana", email: "ana@exemplo.com", papel: "personalizado", status: "ATIVO", dono: false,
  abas: ["dashboard", "lancar", "gastos"], areas: ["financeiro"], flags: ["lancar", "verValores"],
};

let chamadasRascunho: { propriedade: string | null }[] = [];
// Descrição do rascunho da sede; `null` = sem rascunho. `segurarRascunho` atrasa o GET.
let descricaoRascunho: string | null = "Compra de ração";
let segurarRascunho: Promise<void> | null = null;
let segurarGravacao: Promise<void> | null = null;
let falharGravacao = false;
let falharExclusao = false;
let exclusoes = 0;

const rascunhoCom = (descricao: string) => ({
  id: 8, versao: 1, updatedAt: new Date().toISOString(), documentos: [],
  dados: { operacao: { tipo: "COMPRA_ESTOQUE", descricao, itens: [] } },
});

// Servidor mínimo: sessão, dois sítios e um rascunho diferente em cada sítio.
function servidor(usuario: UsuarioSessao) {
  return vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(entrada), "http://localhost");
    const json = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    if (pathname === "/api/auth/me") return json({ usuario });
    if (pathname === "/api/propriedades") return json([
      { id: 1, nome: "Sede", ativo: true, principal: true },
      { id: 2, nome: "Retiro", ativo: true, principal: false },
    ]);
    if (pathname === "/api/financeiro/configuracoes") return json({ contas: [], parceiros: [], categorias: [], centrosCusto: [], produtos: [] });
    if (pathname === "/api/financeiro/operacoes/rascunho") {
      const propriedade = new Headers(init?.headers).get("X-Propriedade-Id");
      const metodo = init?.method ?? "GET";
      if (metodo === "DELETE") {
        exclusoes++;
        if (falharExclusao) return new Response(JSON.stringify({ error: "Falha ao excluir rascunho" }), { status: 503 });
        descricaoRascunho = null;
        return new Response(null, { status: 204 });
      }
      if (metodo === "PUT") {
        const payload = JSON.parse(String(init?.body));
        if (segurarGravacao) await segurarGravacao;
        if (falharGravacao) return new Response(JSON.stringify({ error: "Falha temporária ao salvar" }), { status: 503 });
        descricaoRascunho = payload.dados.formulario.descricao;
        return json({ ...rascunhoCom(descricaoRascunho ?? ""), dados: payload.dados, versao: 2 });
      }
      if (metodo !== "GET") return json(rascunhoCom(""));
      chamadasRascunho.push({ propriedade });
      if (segurarRascunho) await segurarRascunho;
      if (propriedade === "2") return json(rascunhoCom("Vacinas do retiro"));
      return json(descricaoRascunho == null ? null : rascunhoCom(descricaoRascunho));
    }
    return json([]);
  });
}

function entrarComo(usuario: UsuarioSessao) {
  vi.stubGlobal("fetch", servidor(usuario));
  setSessao("token-de-teste", usuario);
  render(<App />);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState(null, "", "/financeiro/compromissos");
  chamadasRascunho = [];
  descricaoRascunho = "Compra de ração";
  segurarRascunho = null; segurarGravacao = null; falharGravacao = false; falharExclusao = false; exclusoes = 0;
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  if (!("ResizeObserver" in globalThis)) vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  limparRascunhoAtivo(); cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setPropriedadeAtiva(null);
  limparRascunhoAtivo();
});

describe("App — trabalho ativo", () => {
  it("mostra o rascunho no topo da sidebar e o atalho abre o formulário", async () => {
    entrarComo(usuarioBase);

    fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" }));

    await waitFor(() => expect(location.pathname).toBe("/financeiro/operacoes/nova"));
    // Mantém o clique durante a importação fria para cobrir a corrida da URL.
    // Aguarda a transformação real do módulo, sem confundir seu tempo com o
    // prazo de atualização do formulário e sem ampliar o timeout do findBy.
    await act(async () => { await import("./financeiro/FinanceiroContent"); });
    expect(await screen.findByRole("heading", { name: "Nova operação" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Rascunho em edição: Compra de ração" })).toBeTruthy();
  });

  it("sem rascunho, não cria trabalho fictício e inicia operação pela lista", async () => {
    descricaoRascunho = null;
    entrarComo(usuarioBase);

    fireEvent.click(await screen.findByRole("button", { name: "Operações" }));
    await screen.findByRole("heading", { name: "Operações" });
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nova operação" }));

    await waitFor(() => expect(location.pathname).toBe("/financeiro/operacoes/nova"));
    expect(await screen.findByRole("heading", { name: "Nova operação" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
  });

  it("não mostra o + enquanto ainda não sabe se há rascunho", async () => {
    let liberar!: () => void;
    segurarRascunho = new Promise<void>((resolve) => { liberar = resolve; });
    entrarComo(usuarioBase);

    expect(await screen.findByRole("heading", { name: "Compromissos" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();

    liberar();
    expect(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" })).toBeTruthy();
  });

  it("não consulta o rascunho de quem não vê a aba Operações", async () => {
    entrarComo({ ...usuarioBase, abas: ["dashboard", "gastos"] });

    expect(await screen.findByRole("heading", { name: "Compromissos" })).toBeTruthy();
    expect(chamadasRascunho).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
  });

  it.each([["lancar"], ["verValores"]])("sem a combinação lancar/verValores não consulta nem oferece rascunho (%j)", async (...flags) => {
    history.replaceState(null, "", "/financeiro/operacoes");
    entrarComo({ ...usuarioBase, flags });
    expect(await screen.findByRole("heading", { name: "Operações" })).toBeTruthy();
    expect(chamadasRascunho).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Continuar rascunho|Rascunho em edição/ })).toBeNull();
  });

  it("busca o rascunho do novo sítio ao trocar de sítio", async () => {
    entrarComo(usuarioBase);
    await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" });

    fireEvent.keyDown(screen.getByRole("button", { name: "Propriedade / sítio ativo" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /Retiro/ }));

    expect(await screen.findByRole("button", { name: "Continuar rascunho: Vacinas do retiro" })).toBeTruthy();
    expect(chamadasRascunho.at(-1)).toEqual({ propriedade: "2" });
  });

  it("recarrega ao voltar para a aba do navegador, no máximo a cada 30 segundos", async () => {
    entrarComo(usuarioBase);
    await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" });
    expect(chamadasRascunho).toHaveLength(1);

    document.dispatchEvent(new Event("visibilitychange"));
    expect(chamadasRascunho).toHaveLength(1);

    const depois = Date.now() + 31_000;
    vi.spyOn(Date, "now").mockReturnValue(depois);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(chamadasRascunho).toHaveLength(2);
  });
});


it("Operações na sidebar volta à lista dentro da mesma aba e o trabalho recupera a última edição", async () => {
  entrarComo(usuarioBase);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" }));
  await screen.findByRole("heading", { name: "Nova operação" });
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Compra alterada antes de 800 ms" } });
  fireEvent.click(screen.getByRole("button", { name: "Operações" }));
  expect(await screen.findByRole("heading", { name: "Operações" })).toBeTruthy();
  expect(location.pathname).toBe("/financeiro/operacoes");
  expect(screen.queryByRole("heading", { name: "Nova operação" })).toBeNull();
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra alterada antes de 800 ms" }));
  expect((await screen.findByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Compra alterada antes de 800 ms");
});


it.each(["pendente", "falha"])("retoma o trabalho com gravação %s e permite voltar/avançar", async (estado) => {
  let liberar!: () => void;
  if (estado === "pendente") segurarGravacao = new Promise<void>(r => { liberar = r; });
  else falharGravacao = true;
  entrarComo(usuarioBase);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" }));
  await screen.findByRole("heading", { name: "Nova operação" });
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Edição final recuperável" } });
  fireEvent.click(screen.getByRole("button", { name: "Operações" }));
  await screen.findByRole("heading", { name: "Operações" });
  if (estado === "falha") await screen.findByText(/Não foi possível salvar:/);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Edição final recuperável" }));
  expect((await screen.findByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Edição final recuperável");
  history.back();
  await screen.findByRole("heading", { name: "Operações" });
  history.forward();
  expect((await screen.findByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Edição final recuperável");
  if (estado === "pendente") liberar();
});


it("exclui o trabalho aberto após o PUT em curso, fecha o editor e não recria o rascunho", async () => {
  let liberar!: () => void;
  segurarGravacao = new Promise<void>(resolve => { liberar = resolve; });
  entrarComo(usuarioBase);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" }));
  await screen.findByRole("heading", { name: "Nova operação" });
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Edição a descartar" } });
  await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true), { timeout: 2000 });
  fireEvent.click(await screen.findByRole("button", { name: "Excluir trabalho ativo: Edição a descartar" }));
  fireEvent.click(screen.getByRole("button", { name: "Excluir trabalho" }));
  expect(exclusoes).toBe(0);
  await act(async () => { liberar(); });
  await waitFor(() => expect(location.pathname).toBe("/financeiro/operacoes"));
  expect(await screen.findByRole("heading", { name: "Operações" })).toBeTruthy();
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 900)); });
  expect(exclusoes).toBe(1); expect(descricaoRascunho).toBeNull();
  expect(screen.queryByRole("group", { name: "Trabalhos ativos" })).toBeNull();
});

it("preserva a edição e o atalho se a exclusão falhar", async () => {
  falharExclusao = true;
  entrarComo(usuarioBase);
  fireEvent.click(await screen.findByRole("button", { name: "Continuar rascunho: Compra de ração" }));
  await screen.findByRole("heading", { name: "Nova operação" });
  fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Edição preservada" } });
  fireEvent.click(await screen.findByRole("button", { name: "Excluir trabalho ativo: Edição preservada" }));
  fireEvent.click(screen.getByRole("button", { name: "Excluir trabalho" }));
  expect(await screen.findByText("Falha ao excluir rascunho")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Manter trabalho" }));
  expect((screen.getByLabelText("Descrição") as HTMLTextAreaElement).value).toBe("Edição preservada");
  expect(screen.getByRole("button", { name: "Rascunho em edição: Edição preservada" })).toBeTruthy();
  expect(location.pathname).toBe("/financeiro/operacoes/nova");
});


it("não exclui em outro sítio se o contexto mudou depois de abrir a confirmação", async () => {
  entrarComo(usuarioBase);
  fireEvent.click(await screen.findByRole("button", { name: "Excluir trabalho ativo: Compra de ração" }));
  setPropriedadeAtiva(2);
  fireEvent.click(screen.getByRole("button", { name: "Excluir trabalho" }));
  expect(await screen.findByText("O sítio ou a sessão mudou. Reabra o trabalho antes de excluir.")).toBeTruthy();
  expect(exclusoes).toBe(0);
});

// A consulta continua disponível em tabela; estes cenários verificam suas colunas e comandos.
beforeEach(preferirTabelas);
