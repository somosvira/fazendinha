// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Cadastros } from "./Cadastros";
import {
  criarCategoria, criarRaca, editarMotivoSaida, editarRaca, listarCategorias, listarMotivosSaida, listarRacas,
  reordenarCategorias, restaurarPadroesCategorias, simularCategorias,
} from "../api";
import type { CategoriaDTO, Raca } from "../types";

/* Mantém RebanhoApiError real (os forms usam instanceof) e substitui só as chamadas. */
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarRacas: vi.fn(),
  criarRaca: vi.fn(),
  editarRaca: vi.fn(),
  listarMotivosSaida: vi.fn(),
  criarMotivoSaida: vi.fn(),
  editarMotivoSaida: vi.fn(),
  listarCategorias: vi.fn(),
  criarCategoria: vi.fn(),
  editarCategoria: vi.fn(),
  reordenarCategorias: vi.fn(),
  simularCategorias: vi.fn(),
  restaurarPadroesCategorias: vi.fn(),
}));

const racasMock: Raca[] = [
  { id: "r1", nome: "Holandesa", sigla: "HOL", base: true, ativo: true },
  { id: "r2", nome: "Gir", sigla: "GIR", base: false, ativo: false },
];

const categoriasMock: CategoriaDTO[] = [
  { id: "c-vaca", nome: "Vaca", sexo: "F", automatica: true, ativo: true, ordem: 10, idadeMinMeses: null, idadeMaxMeses: null, partos: "COM", ideagriId: 7, padrao: true, regra: "com parto", animaisAtivos: 5, manuaisAbertas: 0 },
  { id: "c-crescimento-f", nome: "Em crescimento", sexo: "F", automatica: true, ativo: true, ordem: 20, idadeMinMeses: null, idadeMaxMeses: 12, partos: "SEM", ideagriId: 5, padrao: true, regra: "menos de 12 meses · sem parto", animaisAtivos: 2, manuaisAbertas: 0 },
  { id: "c-reprodutor", nome: "Reprodutor", sexo: "M", automatica: false, ativo: false, ordem: 50, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER", ideagriId: 2, padrao: true, regra: "só manual", animaisAtivos: 0, manuaisAbertas: 0 },
];

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência (mesma convenção de
 * ConfiguracoesFinanceiras.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarRacas).mockResolvedValue(racasMock);
  vi.mocked(listarMotivosSaida).mockResolvedValue([]);
  vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 0 });
  vi.mocked(simularCategorias).mockResolvedValue({ afetados: 0, mudancas: [], semCategoria: 0 });
  vi.mocked(editarRaca).mockImplementation((id, patch) => Promise.resolve({ ...racasMock.find((r) => r.id === id)!, ...patch }));
});
afterEach(cleanup);

async function montarCategorias() {
  render(<Cadastros />);
  await screen.findAllByText("Vaca");
}

async function montarRacas() {
  render(<Cadastros />);
  await screen.findAllByText("Vaca");
  fireEvent.click(screen.getByRole("button", { name: "Raças" }));
  await screen.findAllByText("Holandesa");
}

describe("Cadastros do rebanho — categorias", () => {
  it("lista categorias ativas na ordem, com regra e selo Padrão; inativas só aparecem com o filtro", async () => {
    await montarCategorias();
    const tabela = screen.getByRole("table", { name: "Categorias" });
    expect(within(tabela).getByText("Vaca")).toBeTruthy();
    expect(within(tabela).getByText("Em crescimento")).toBeTruthy();
    expect(within(tabela).getByText(/com parto/)).toBeTruthy();
    expect(within(tabela).getAllByText("Padrão").length).toBeGreaterThan(0);
    expect(within(tabela).queryByText("Reprodutor")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativas" }));
    await waitFor(() => expect(within(screen.getByRole("table", { name: "Categorias" })).getByText("Reprodutor")).toBeTruthy());
  });

  it("avisa quando há animais ativos sem categoria", async () => {
    vi.mocked(listarCategorias).mockResolvedValue({ itens: categoriasMock, semCategoria: 3 });
    await montarCategorias();
    expect(screen.getByText(/3 animais ativos sem categoria — nenhuma regra casou/)).toBeTruthy();
  });

  it("criar categoria sem impacto aplica direto, sem diálogo de confirmação", async () => {
    vi.mocked(criarCategoria).mockResolvedValue({ id: "nova", nome: "Nova" });
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Nova" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalledWith({ nome: "Nova", sexo: "F", automatica: true, idadeMinMeses: null, idadeMaxMeses: null, partos: "QUALQUER" }));
    expect(screen.queryByRole("dialog", { name: "Aplicar esta mudança?" })).toBeNull();
    await waitFor(() => expect(listarCategorias).toHaveBeenCalledTimes(2));
  });

  it("criar categoria com impacto mostra a lista de mudanças e só aplica ao confirmar", async () => {
    vi.mocked(simularCategorias).mockResolvedValue({
      afetados: 8,
      mudancas: [{ de: { id: "c-crescimento-f", nome: "Em crescimento" }, para: { id: "nova", nome: "Nova" }, total: 8 }],
      semCategoria: 0,
    });
    vi.mocked(criarCategoria).mockResolvedValue({ id: "nova", nome: "Nova" });
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/ }));
    const painel = await screen.findByRole("dialog");
    fireEvent.change(within(painel).getByLabelText("Nome da categoria"), { target: { value: "Nova" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar categoria" }));

    const confirmacao = await screen.findByRole("dialog", { name: "Aplicar esta mudança?" });
    expect(within(confirmacao).getByText(/8 animais: Em crescimento → Nova/)).toBeTruthy();
    expect(criarCategoria).not.toHaveBeenCalled();
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Aplicar mudança" }));
    await waitFor(() => expect(criarCategoria).toHaveBeenCalled());
  });

  it("subir/descer move a categoria e chama reordenarCategorias com a nova ordem", async () => {
    vi.mocked(reordenarCategorias).mockResolvedValue({ ok: true });
    await montarCategorias();
    fireEvent.click(primeiro("button", "Mover Vaca para baixo"));
    await waitFor(() => expect(reordenarCategorias).toHaveBeenCalledWith(["c-crescimento-f", "c-vaca"]));
  });

  it("restaurar padrões simula primeiro e só aplica depois de confirmado", async () => {
    vi.mocked(restaurarPadroesCategorias).mockImplementation((opts) => Promise.resolve(
      opts?.simular
        ? { afetados: 2, mudancas: [{ de: { id: "x", nome: "Antiga" }, para: { id: "c-vaca", nome: "Vaca" }, total: 2 }], semCategoria: 0 }
        : { afetados: 0, mudancas: [], semCategoria: 0 },
    ));
    await montarCategorias();
    fireEvent.click(screen.getByRole("button", { name: "Restaurar padrões" }));
    const confirmacao = await screen.findByRole("dialog", { name: "Aplicar esta mudança?" });
    expect(within(confirmacao).getByText(/2 animais: Antiga → Vaca/)).toBeTruthy();
    expect(restaurarPadroesCategorias).toHaveBeenCalledWith({ simular: true });
    fireEvent.click(within(confirmacao).getByRole("button", { name: "Aplicar mudança" }));
    await waitFor(() => expect(restaurarPadroesCategorias).toHaveBeenCalledWith({ simular: false }));
  });
});

describe("Cadastros do rebanho — raças", () => {
  it("lista raças com sigla, tipo e situação", async () => {
    await montarRacas();
    const tabela = screen.getByRole("table", { name: "Raças" });
    const linha1 = within(tabela).getByText("Holandesa").closest("tr")!;
    expect(within(linha1).getByText("HOL")).toBeTruthy();
    expect(within(linha1).getByText("Base")).toBeTruthy();
    const linha2 = within(tabela).getByText("Gir").closest("tr")!;
    expect(within(linha2).getByText("Composta")).toBeTruthy();
    expect(within(linha2).getByText("Inativa")).toBeTruthy();
  });

  it("cria raça com sigla em maiúsculas e base marcada por padrão", async () => {
    vi.mocked(criarRaca).mockResolvedValue(racasMock[0]);
    await montarRacas();
    fireEvent.click(screen.getByRole("button", { name: /Nova raça/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText(/Raça base/) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome da raça"), { target: { value: "Girolando" } });
    fireEvent.change(within(painel).getByLabelText("Sigla"), { target: { value: "gir" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar raça" }));
    await waitFor(() => expect(criarRaca).toHaveBeenCalledWith({ nome: "Girolando", sigla: "GIR", base: true }));
  });

  it("editar carrega os valores atuais da raça", async () => {
    await montarRacas();
    fireEvent.click(primeiro("button", "Editar Holandesa"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sigla") as HTMLInputElement).value).toBe("HOL");
    fireEvent.click(within(painel).getByLabelText(/Raça base/));
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar raça" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { nome: "Holandesa", sigla: "HOL", base: false }));
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montarRacas();
    fireEvent.click(primeiro("button", "Reativar Gir"));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r2", { ativo: true }));

    fireEvent.click(primeiro("button", "Desativar Holandesa"));
    expect(await screen.findByRole("heading", { name: "Desativar Holandesa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { ativo: false }));
  });
});
