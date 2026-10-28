import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OrdenhasGerais } from "./OrdenhasGerais";
import { consultarParcelas, contextoParcelas, salvarParcelas } from "./parcelas-api";
import type { ConsultaParcelas, ContextoParcelas } from "./parcelas-types";
import { chaveRascunhoOrdenha } from "./RegistroOrdenha";
vi.mock("./parcelas-api", () => ({ consultarParcelas: vi.fn(), contextoParcelas: vi.fn(), salvarParcelas: vi.fn(), confirmarParcelas: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 1 }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn(async () => []) }));
vi.mock("@/components/DatePicker", () => ({ DatePicker: ({ onChange, ...props }: { onChange: (v: string) => void }) => <input type="date" {...props} onChange={e => onChange(e.target.value)} /> }));
const contexto: ContextoParcelas = {
  configuracao: { id: "c", propriedadeId: 1, vigenteDesde: "2026-10-01", inicial: false, fonteProducao: "GERAL", ordenhas: [{ posicaoId: "manha", nome: "Manhã", ordem: 1 }] },
  sessoes: [{ id: null, posicaoId: "manha", nome: "Manhã", ordem: 1 }], medicoes: [], tanques: [], animais: [], origensAutomaticas: [],
  contexto: { carencias: [], partos: [], origensColostro: [], criterioColostro: null },
};
const lista: ConsultaParcelas = {
  propriedadeId: 1, periodo: { inicio: "2026-10-01", fim: "2026-10-24" }, pagina: 1, porPagina: 20, total: 1,
  itens: [{ id: "s1", diaId: "d1", dataOperacional: "2026-10-24", posicaoId: "manha", nome: "Manhã", ordem: 1, fonteProducao: "GERAL", litros: 0, situacao: "PENDENTE_ESTOQUE", porNatureza: [{ natureza: "COMERCIAL", litros: 0 }], parcelas: [] }],
  resumo: { totalLitros: 0, sessoes: 1, semAfericao: 0, pendentesEstoque: 1, porNatureza: [] },
};
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  history.replaceState(null, "", "/pecuaria/rebanho/leite?leiteModo=geral&ordenhasInicio=2026-10-01&ordenhasFim=2026-10-24");
  vi.mocked(consultarParcelas).mockImplementation(async (_sitio, q) => ({ ...lista, pagina: Number(q.get("pagina")), porPagina: Number(q.get("porPagina")) }));
  vi.mocked(contextoParcelas).mockResolvedValue(contexto);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("abre na consulta, distingue zero de ausência e mantém o período ao abrir e voltar", async () => {
  render(<OrdenhasGerais podeLancar />);
  await screen.findAllByText("Manhã");
  expect(screen.queryByLabelText("Data da ordenha")).toBeNull();
  expect(screen.getAllByText("0 L").length).toBeGreaterThan(0);
  fireEvent.click(screen.getAllByRole("button", { name: "Continuar confirmação" })[0]);
  await screen.findByLabelText("Data da ordenha");
  expect(new URLSearchParams(location.search).get("registroId")).toBe("s1");
  fireEvent.click(screen.getByRole("button", { name: "Voltar à consulta" }));
  await screen.findByText("Histórico de ordenhas");
  expect(new URLSearchParams(location.search).get("ordenhasInicio")).toBe("2026-10-01");
});
it("régua não preenche litros e a mudança de data preserva o volume do rascunho", async () => {
  history.replaceState(null, "", "/?leiteModo=registro&rascunhoOrdenha=r1&dataOperacional=2026-10-24");
  render(<OrdenhasGerais podeLancar />);
  const litros = await screen.findByLabelText("Litros informados manualmente");
  fireEvent.change(screen.getByLabelText("Régua (mm) · opcional"), { target: { value: "100" } });
  expect((litros as HTMLInputElement).value).toBe("");
  fireEvent.change(litros, { target: { value: "25" } });
  fireEvent.change(screen.getByLabelText("Data da ordenha"), { target: { value: "2026-10-23" } });
  await waitFor(() => expect(contextoParcelas).toHaveBeenLastCalledWith(1, "2026-10-23"));
  expect((await screen.findByLabelText("Litros informados manualmente") as HTMLInputElement).value).toBe("25");
  const salvo = JSON.parse(sessionStorage.getItem(chaveRascunhoOrdenha(1, "r1"))!);
  expect(salvo).toMatchObject({ data: "2026-10-23", parcelas: [expect.objectContaining({ litros: "25", regua: "100" })] });
});
it("conflito de versão conserva os campos e não confirma estoque", async () => {
  history.replaceState(null, "", "/?leiteModo=registro&rascunhoOrdenha=r1&dataOperacional=2026-10-24");
  vi.mocked(salvarParcelas).mockRejectedValue(new Error("A parcela foi alterada por outra pessoa. Confira a versão."));
  render(<OrdenhasGerais podeLancar />);
  fireEvent.change(await screen.findByLabelText("Litros informados manualmente"), { target: { value: "25" } });
  fireEvent.change(screen.getByLabelText("Responsável"), { target: { value: "Maria" } });
  fireEvent.change(screen.getByLabelText("Identificação do recipiente"), { target: { value: "Balde segregado" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ordenha" }));
  await screen.findByText("A parcela foi alterada por outra pessoa. Confira a versão.");
  expect((screen.getByLabelText("Litros informados manualmente") as HTMLInputElement).value).toBe("25");
  expect((screen.getByLabelText("Responsável") as HTMLInputElement).value).toBe("Maria");
});
it("permite parcelas adicionais da mesma natureza e não abre restrições sem contexto", async () => {
  history.replaceState(null, "", "/?leiteModo=registro&rascunhoOrdenha=r1&dataOperacional=2026-10-24");
  render(<OrdenhasGerais podeLancar />);
  await screen.findByLabelText("Litros informados manualmente");
  expect(screen.queryByRole("region", { name: "Parcelas de Colostro" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Incluir outra origem" }));
  expect(screen.getAllByLabelText("Litros informados manualmente")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Colostro" }));
  expect(screen.getByLabelText("Justificativa do registro direto")).toBeTruthy();
  await act(async () => {});
});
it("consulta classificação pendente como estado separado das três naturezas", async () => {
  render(<OrdenhasGerais podeLancar />);
  await screen.findAllByText("Manhã");
  fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
  fireEvent.click(screen.getByLabelText("Somente classificação pendente"));
  expect((screen.getByRole("combobox", { name: "Natureza do leite" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
  await waitFor(() => expect(consultarParcelas).toHaveBeenLastCalledWith(1, expect.any(URLSearchParams)));
  await waitFor(() => expect(vi.mocked(consultarParcelas).mock.lastCall?.[1].get("natureza")).toBe("A_CLASSIFICAR"));
});

it("encaminha sessão individual ao controle individual preservando data, ordenha e filtros", async () => {
  vi.mocked(consultarParcelas).mockResolvedValue({ ...lista, itens: [{ ...lista.itens[0], fonteProducao: "INDIVIDUAL", litros: 117 }] });
  render(<OrdenhasGerais podeLancar />);
  fireEvent.click((await screen.findAllByRole("button", { name: "Continuar confirmação" }))[0]);
  const params = new URLSearchParams(location.search);
  expect(params.get("leiteModo")).toBe("individual");
  expect(params.get("dataOperacional")).toBe("2026-10-24");
  expect(params.get("ordenha")).toBe("manha");
  expect(params.get("ordenhasInicio")).toBe("2026-10-01");
  expect(params.has("registroId")).toBe(false);
  expect(params.has("rascunhoOrdenha")).toBe(false);
  expect(contextoParcelas).not.toHaveBeenCalled();
});

function paginarFixtures(total = 30) {
  vi.mocked(consultarParcelas).mockImplementation(async (_sitio, q) => {
    const pagina = Number(q.get("pagina")), porPagina = Number(q.get("porPagina"));
    const todos = Array.from({ length: total }, (_, i) => ({ ...lista.itens[0], id: `s${i + 1}`, nome: `Ordenha ${i + 1}` }));
    return { ...lista, total, pagina, porPagina, itens: todos.slice((pagina - 1) * porPagina, pagina * porPagina) };
  });
}
it("consulta seis por padrão e muda tamanho explicitamente sem perder filtros ou alternância", async () => {
  paginarFixtures();
  history.replaceState(null, "", "/pecuaria/leite?ordenhasInicio=2026-10-01&ordenhasFim=2026-10-24&ordenhasBusca=manhã&ordenhasNatureza=COMERCIAL");
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findByText("1–6 de 30 ordenhas");
  expect(vi.mocked(consultarParcelas).mock.lastCall?.[1].get("porPagina")).toBe("6");
  expect(screen.getAllByRole("listitem")).toHaveLength(6);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await screen.findByText("7–12 de 30 ordenhas");
  await selecionarCampoLeite("Ordenhas por página", "12");
  await screen.findByText("1–12 de 30 ordenhas");
  const query = vi.mocked(consultarParcelas).mock.lastCall?.[1];
  expect(query?.get("pagina")).toBe("1");
  expect(query?.get("porPagina")).toBe("12");
  expect(query?.get("busca")).toBe("manhã");
  expect(query?.get("natureza")).toBe("COMERCIAL");
  expect(new URLSearchParams(location.search).get("ordenhasTamanho")).toBe("12");
  expect(new URLSearchParams(location.search).get("paginaOrdenhas")).toBeNull();
  const chamadas = vi.mocked(consultarParcelas).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getByRole("table", { name: "Ordenhas registradas" })).toBeTruthy();
  expect(vi.mocked(consultarParcelas)).toHaveBeenCalledTimes(chamadas);
  expect(new URLSearchParams(location.search).get("ordenhasTamanho")).toBe("12");
  fireEvent.click(screen.getByRole("button", { name: "Cartões" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(12);
});
it.each(["6", "12", "20", "0", "7", "abc"])("valida tamanho vindo da URL: %s", async tamanho => {
  paginarFixtures();
  history.replaceState(null, "", `/?ordenhasTamanho=${tamanho}`);
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findByRole("list", { name: "Ordenhas registradas" });
  const esperado = ["6", "12", "20"].includes(tamanho) ? tamanho : "6";
  expect(vi.mocked(consultarParcelas).mock.lastCall?.[1].get("porPagina")).toBe(esperado);
  expect(screen.getByRole("combobox", { name: "Ordenhas por página" }).textContent).toContain(esperado);
});
it("retoma página e tamanho ao abrir e voltar de um registro", async () => {
  paginarFixtures();
  history.replaceState(null, "", "/?leiteModo=geral&ordenhasInicio=2026-10-01&ordenhasFim=2026-10-24&ordenhasTamanho=12&paginaOrdenhas=2");
  render(<OrdenhasGerais podeLancar />);
  await screen.findByText("13–24 de 30 ordenhas");
  fireEvent.click(screen.getAllByRole("button", { name: "Continuar confirmação" })[0]);
  await screen.findByLabelText("Data da ordenha");
  fireEvent.click(screen.getByRole("button", { name: "Voltar à consulta" }));
  await screen.findByText("13–24 de 30 ordenhas");
  expect(new URLSearchParams(location.search).get("ordenhasTamanho")).toBe("12");
  expect(new URLSearchParams(location.search).get("paginaOrdenhas")).toBe("2");
  expect(new URLSearchParams(location.search).get("ordenhasInicio")).toBe("2026-10-01");
});
it("reconsulta a última página válida quando a página da URL excede os resultados", async () => {
  paginarFixtures(13);
  history.replaceState(null, "", "/?ordenhasTamanho=6&paginaOrdenhas=9");
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findByText("13–13 de 13 ordenhas");
  expect(new URLSearchParams(location.search).get("paginaOrdenhas")).toBe("3");
  expect(vi.mocked(consultarParcelas).mock.lastCall?.[1].get("pagina")).toBe("3");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
});

it("mostra o mês atual como período padrão sem fingir que é um filtro removível", async () => {
  history.replaceState(null, "", "/?leiteSecao=ordenhas");
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findAllByText("Manhã");
  expect(screen.queryByRole("button", { name: /^Remover filtro:/ })).toBeNull();
  expect(screen.getByText(/^Mês atual ·/)).toBeTruthy();
});
it("remover período personalizado volta ao mês atual e retira o chip", async () => {
  render(<OrdenhasGerais podeLancar={false} />);
  await screen.findAllByText("Manhã");
  fireEvent.click(screen.getByRole("button", { name: "Remover filtro: 01/10/2026 a 24/10/2026" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Remover filtro:/ })).toBeNull());
  expect(screen.getByText(/^Mês atual ·/)).toBeTruthy();
  expect(new URLSearchParams(location.search).has("ordenhasInicio")).toBe(false);
});
