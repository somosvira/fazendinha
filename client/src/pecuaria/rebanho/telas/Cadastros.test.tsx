// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Cadastros } from "./Cadastros";
import { RebanhoApiError, criarLote, criarRaca, editarLote, editarRaca, listarLotes, listarMotivosSaida, listarRacas } from "../api";
import type { Lote, Raca } from "../types";

/* Mantém RebanhoApiError real (os forms usam instanceof) e substitui só as chamadas. */
vi.mock("../api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api")>()),
  listarLotes: vi.fn(),
  criarLote: vi.fn(),
  editarLote: vi.fn(),
  listarRacas: vi.fn(),
  criarRaca: vi.fn(),
  editarRaca: vi.fn(),
  listarMotivosSaida: vi.fn(),
  criarMotivoSaida: vi.fn(),
  editarMotivoSaida: vi.fn(),
}));

vi.mock("../../../api/propriedades", () => ({
  usePropriedades: () => ({
    data: [{ id: 1, nome: "Sede", apelido: null, cidade: null, uf: null, principal: true, ativo: true, ordem: 0 }],
    loading: false,
    recarregar: vi.fn(),
  }),
  criarPropriedade: vi.fn(),
  editarPropriedade: vi.fn(),
}));

const lotesMock: Lote[] = [
  { id: "l1", nome: "Lote 1", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: true, observacao: null, animaisAtivos: 3 },
  { id: "l2", nome: "Lote 2", propriedadeId: 1, propriedade: { id: 1, nome: "Sede" }, ativo: false, observacao: null, animaisAtivos: 0 },
];
const racasMock: Raca[] = [
  { id: "r1", nome: "Holandesa", sigla: "HOL", base: true, ativo: true },
  { id: "r2", nome: "Gir", sigla: "GIR", base: false, ativo: false },
];

/* A tabela responsiva renderiza tabela E cartões; no jsdom os dois existem,
 * então pegamos sempre a primeira ocorrência (mesma convenção de
 * ConfiguracoesFinanceiras.test.tsx). */
const primeiro = (role: string, name: string | RegExp) => screen.getAllByRole(role, { name })[0];

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(listarLotes).mockResolvedValue(lotesMock);
  vi.mocked(listarRacas).mockResolvedValue(racasMock);
  vi.mocked(listarMotivosSaida).mockResolvedValue([]);
  vi.mocked(editarLote).mockImplementation((id, patch) => Promise.resolve({ ...lotesMock.find((l) => l.id === id)!, ...patch }));
  vi.mocked(editarRaca).mockImplementation((id, patch) => Promise.resolve({ ...racasMock.find((r) => r.id === id)!, ...patch }));
});
afterEach(cleanup);

async function montar(aba: "lotes" | "racas" = "lotes") {
  render(<Cadastros />);
  await screen.findAllByText("Lote 1");
  if (aba === "racas") {
    fireEvent.click(screen.getByRole("button", { name: /^Raças$/ }));
    await screen.findAllByText("Holandesa");
  }
}

describe("Cadastros do rebanho — lotes", () => {
  it("lista lotes com sítio, animais ativos e situação", async () => {
    await montar();
    const tabela = screen.getByRole("table", { name: "Lotes" });
    const linha1 = within(tabela).getByText("Lote 1").closest("tr")!;
    expect(within(linha1).getByText("Sede")).toBeTruthy();
    expect(within(linha1).getByText("3")).toBeTruthy();
    expect(within(linha1).getByText("Ativo")).toBeTruthy();
    const linha2 = within(tabela).getByText("Lote 2").closest("tr")!;
    expect(within(linha2).getByText("Inativo")).toBeTruthy();
  });

  it("mostrar inativos refaz a listagem pedindo incluirInativos", async () => {
    await montar();
    expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: false });
    fireEvent.click(screen.getByRole("checkbox", { name: "Mostrar inativos" }));
    await waitFor(() => expect(listarLotes).toHaveBeenCalledWith({ incluirInativos: true }));
  });

  it("cria lote com o sítio já pré-selecionado", async () => {
    vi.mocked(criarLote).mockResolvedValue(lotesMock[0]);
    await montar();
    fireEvent.click(screen.getByRole("button", { name: /Novo lote/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sítio") as HTMLSelectElement).value).toBe("1");
    fireEvent.change(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote novo" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar lote" }));
    await waitFor(() => expect(criarLote).toHaveBeenCalledWith({ nome: "Lote novo", propriedadeId: 1, observacao: null }));
    await waitFor(() => expect(listarLotes).toHaveBeenCalledTimes(2));
  });

  it("editar carrega os valores atuais e trava o sítio", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Editar Lote 1"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Nome do lote") as HTMLInputElement).value).toBe("Lote 1");
    expect((within(painel).getByLabelText("Sítio") as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome do lote"), { target: { value: "Lote 1 — renomeado" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar lote" }));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l1", { nome: "Lote 1 — renomeado", observacao: null }));
  });

  it("desativar avisa os animais ativos e pede confirmação; reativar não pede", async () => {
    await montar();
    fireEvent.click(primeiro("button", "Reativar Lote 2"));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l2", { ativo: true }));
    expect(screen.queryByRole("heading", { name: /Desativar/ })).toBeNull();

    fireEvent.click(primeiro("button", "Desativar Lote 1"));
    expect(await screen.findByRole("heading", { name: "Desativar Lote 1?" })).toBeTruthy();
    expect(screen.getByText(/tem 3 animais ativos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarLote).toHaveBeenCalledWith("l1", { ativo: false }));
  });

  it("erro 409 do servidor (lote com animais) aparece no ErrorBox sem esconder o botão", async () => {
    vi.mocked(editarLote).mockRejectedValueOnce(new RebanhoApiError("Mova os 3 animais antes de desativar o lote", 409, "CONFLITO", "ativo"));
    await montar();
    fireEvent.click(primeiro("button", "Desativar Lote 1"));
    await screen.findByRole("heading", { name: "Desativar Lote 1?" });
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(await screen.findByText("Mova os 3 animais antes de desativar o lote")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(primeiro("button", "Desativar Lote 1")).toBeTruthy();
  });
});

describe("Cadastros do rebanho — raças", () => {
  it("lista raças com sigla, tipo e situação", async () => {
    await montar("racas");
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
    await montar("racas");
    fireEvent.click(screen.getByRole("button", { name: /Nova raça/ }));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText(/Raça base/) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(within(painel).getByLabelText("Nome da raça"), { target: { value: "Girolando" } });
    fireEvent.change(within(painel).getByLabelText("Sigla"), { target: { value: "gir" } });
    fireEvent.click(within(painel).getByRole("button", { name: "Criar raça" }));
    await waitFor(() => expect(criarRaca).toHaveBeenCalledWith({ nome: "Girolando", sigla: "GIR", base: true }));
  });

  it("editar carrega os valores atuais da raça", async () => {
    await montar("racas");
    fireEvent.click(primeiro("button", "Editar Holandesa"));
    const painel = await screen.findByRole("dialog");
    expect((within(painel).getByLabelText("Sigla") as HTMLInputElement).value).toBe("HOL");
    fireEvent.click(within(painel).getByLabelText(/Raça base/));
    fireEvent.click(within(painel).getByRole("button", { name: "Salvar raça" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { nome: "Holandesa", sigla: "HOL", base: false }));
  });

  it("desativar pede confirmação e reativar não", async () => {
    await montar("racas");
    fireEvent.click(primeiro("button", "Reativar Gir"));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r2", { ativo: true }));

    fireEvent.click(primeiro("button", "Desativar Holandesa"));
    expect(await screen.findByRole("heading", { name: "Desativar Holandesa?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(editarRaca).toHaveBeenCalledWith("r1", { ativo: false }));
  });
});
