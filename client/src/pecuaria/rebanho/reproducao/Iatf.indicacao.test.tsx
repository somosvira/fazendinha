// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Iatf } from "./Iatf";
import { reqV4, type AnimalReprodutivo } from "./api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";

vi.mock("./api", () => ({ reqV4: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));

const animal = (i: number): AnimalReprodutivo => ({
  animalId: `a${i}`, brinco: String(100 + i), nome: null, situacao: "VAZIA",
  partos: 0, tentativasCiclo: 0, gestacao: null, restricoes: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/pecuaria/visitas/v");
  setPropriedadeAtiva(99);
  vi.mocked(reqV4).mockImplementation(async (path, body) => path.includes("/protocolos")
    ? [{ id: "protocolo", nome: "Protocolo publicado", versao: 2, publicado: true, ativo: true, etapas: [] }]
    : body ? {} : []);
});
afterEach(() => { cleanup(); setPropriedadeAtiva(null); });

it("abre programação com indicados, permite editar a seleção e grava no sítio explícito", async () => {
  render(<Iatf animais={[animal(0), animal(1)]} animaisIndicadosInicialmente={["a0", "a1"]}
    propriedadeId={7} podeLancar />);
  await screen.findByRole("dialog", { name: "Nova programação IATF" });
  expect(screen.getByRole("checkbox", { name: "100" })).toHaveProperty("checked", true);
  expect(screen.getByRole("checkbox", { name: "101" })).toHaveProperty("checked", true);
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => !body)).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { name: "101" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Turma após visita" } });
  await screen.findByRole("option", { name: "Protocolo publicado · v2" });
  fireEvent.change(screen.getByRole("combobox", { name: "Versão publicada" }), { target: { value: "protocolo" } });
  fireEvent.change(screen.getByLabelText("Início previsto"), { target: { value: "2026-10-18" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/programacoes", expect.objectContaining({
    propriedadeId: 7, nome: "Turma após visita", protocoloId: "protocolo", inicioPrevisto: "2026-10-18",
    animais: [{ animalId: "a0" }],
  }), "POST", 7));
  expect(reqV4).toHaveBeenCalledWith("/reproducao/programacoes?propriedadeId=7", undefined, "POST", 7);
  expect(vi.mocked(reqV4).mock.calls.filter(([, body]) => body)).toHaveLength(1);
});

it("limita a primeira programação a 100 e mantém todos os indicados disponíveis", async () => {
  const animais = Array.from({ length: 101 }, (_, i) => animal(i));
  render(<Iatf animais={animais} animaisIndicadosInicialmente={animais.map(a => a.animalId)} propriedadeId={7} podeLancar />);
  await screen.findByRole("dialog", { name: "Nova programação IATF" });
  expect(screen.getByText("Participantes: 100/100")).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: "200" })).toHaveProperty("checked", false);
  expect(screen.getByText(/os demais indicados continuam disponíveis/)).toBeTruthy();
  expect(vi.mocked(reqV4).mock.calls.every(([, body]) => !body)).toBe(true);
});
