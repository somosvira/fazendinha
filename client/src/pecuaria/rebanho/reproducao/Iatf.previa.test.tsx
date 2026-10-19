// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExecucaoIatf } from "./Iatf";
import { reqV4 } from "./api";
import { reqProtocolo } from "../protocolos/api";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue({}) }));
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn() }));
vi.mock("../../../estoque/api", () => ({ listarProdutos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarMaterialGenetico: vi.fn().mockResolvedValue([]) }));
const props = { propriedadeId: 1, tarefa: { id: "t1", tipo: "MANEJO", nome: "Manejo", previstaEm: "2026-10-01", precisaoTemporal: "DIA" as const, status: "PENDENTE" }, animalId: "a1", painel: { animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] }, onFechar: vi.fn(), onSalvo: vi.fn() };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("primeira execução legada mostra impactos paginados e exige ciência antes de transmitir", async () => {
  vi.mocked(reqProtocolo).mockImplementation(async path => { const pagina = Number(new URL(`https://local${path}`).searchParams.get("pagina")); return { exigeCiencia: true, modoLegado: true, itens: Array.from({ length: pagina === 3 ? 1 : 10 }, (_, i) => ({ id: `t${(pagina - 1) * 10 + i + 1}`, nome: `Etapa ${(pagina - 1) * 10 + i + 1}`, previstaAnterior: "2026-10-01", previstaNova: "2026-10-02", precisaoAnterior: "DIA", precisaoNova: "DIA", previsaoPendente: false, previsaoPendenteAnterior: false })), total: 21, pagina, porPagina: 10 }; });
  render(<ExecucaoIatf {...props} />);
  fireEvent.change(screen.getByLabelText("Data realizada"), { target: { value: "2026-10-02" } });
  await screen.findByText("Etapa 1");
  expect(screen.queryByText("Etapa 11")).toBeNull();
  expect(screen.getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await screen.findByText("Etapa 11");
  fireEvent.click(screen.getByRole("checkbox", { name: /Conferi e autorizo/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalledWith("/reproducao/tarefas-iatf/t1/execucao", expect.objectContaining({ cienciaRecalendarioLegado: true, realizadaEm: "2026-10-02" }), "POST", 1));
});
it("nova origem preserva calendário e não exige ciência legada", async () => {
  vi.mocked(reqProtocolo).mockResolvedValue({ exigeCiencia: false, modoLegado: false, itens: [], total: 0, pagina: 1, porPagina: 10 });
  render(<ExecucaoIatf {...props} />);
  fireEvent.change(screen.getByLabelText("Data realizada"), { target: { value: "2026-10-02" } });
  await screen.findByText("Esta execução preserva as previsões das demais tarefas.");
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  await waitFor(() => expect(reqV4).toHaveBeenCalled());
  expect(vi.mocked(reqV4).mock.calls[0][1]).not.toHaveProperty("cienciaRecalendarioLegado");
});
