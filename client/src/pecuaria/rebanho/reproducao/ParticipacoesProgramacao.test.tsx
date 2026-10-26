// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParticipacoesProgramacao } from "./ParticipacoesProgramacao";
import { reqProtocolo, obterTarefasProtocolo, type TarefaOperacional } from "../protocolos/api";
vi.mock("../protocolos/api", async original => ({ ...await original<typeof import("../protocolos/api")>(), reqProtocolo: vi.fn(), obterTarefasProtocolo: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("consulta timeline somente ao expandir e percorre todas as páginas da participação, preservando precisão e realização", async () => {
  vi.mocked(reqProtocolo).mockResolvedValue({ itens: [{ id: "p", animalId: "a", inicioPrevisto: "2026-10-01", inicioEfetivo: "2026-10-02", precisaoInicioEfetivo: "DIA", animal: { brinco: "Matriz 1" } }], pagina: 1, total: 1, porPagina: 10 });
  function tarefa(id: string, data: string, realizada: string | null): TarefaOperacional {
    return { id, previstaPara: data, realizadaEm: realizada, precisaoTemporal: "DIA", precisaoRealizacao: "DIA", previsaoPendente: false, tarefaOrigem: { id, nome: `Etapa ${id}`, tipo: "MANEJO", previstaEm: data, status: realizada ? "REALIZADA" : "PENDENTE" } } as TarefaOperacional;
  }
  vi.mocked(obterTarefasProtocolo).mockResolvedValueOnce({ itens: [tarefa("1", "2026-10-03", "2026-10-04")], pagina: 1, porPagina: 1, total: 2 }).mockResolvedValueOnce({ itens: [tarefa("2", "2026-10-05", null)], pagina: 2, porPagina: 1, total: 2 });
  render(<ParticipacoesProgramacao id="grupo" propriedadeId={7} revisao={0}/>);
  await screen.findByText("Matriz 1");
  expect(obterTarefasProtocolo).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Consultar etapas individuais" }));
  await screen.findByText("Etapa 2");
  expect(obterTarefasProtocolo).toHaveBeenNthCalledWith(2, { participacaoId: "p" }, { pagina: 2 }, 7);
  expect(screen.getByText("04/10/2026 · horário não informado")).toBeTruthy();
  expect(screen.getByText("Previsto: 05/10/2026 · horário não informado")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ficha do animal" }).getAttribute("href")).toContain("sitio=7");
});
