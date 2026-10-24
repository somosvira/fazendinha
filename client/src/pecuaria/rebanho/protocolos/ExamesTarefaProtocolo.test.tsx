// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExamesTarefaProtocolo } from "./ExamesTarefaProtocolo";
import { reqProtocolo, type TarefaOperacional } from "./api";
import { reqSanidade } from "../sanidade/api";
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), reqProtocolo: vi.fn() }));
vi.mock("../sanidade/api", async original => ({ ...await original<typeof import("../sanidade/api")>(), reqSanidade: vi.fn().mockResolvedValue({ id: "exame" }) }));
const animal = { id: "a", brinco: "Animal", nome: null };
const tarefa: TarefaOperacional = { id: "t", tarefaId: "t", participacaoId: "p", etapaId: "etapa", animal, propriedadeId: 7, situacao: "ATENDIDO", previstaPara: "2026-10-21", previsaoOriginal: null, previsaoIndividual: false, precisaoTemporal: "DIA", realizadaEm: "2026-10-21", precisaoRealizacao: "DIA", previsaoPendente: false, ultimoEvento: null, vinculoAtual: { tipo: "EXAME", id: "exame", origem: "PROTOCOLO" }, acoes: { atender: false, justificar: false, adiar: false, retificar: false, regularizar: false }, tarefaOrigem: { id: "t", etapaId: "etapa", execucaoId: "p", tipo: "EXAME", previstaEm: "2026-10-21", previstaPara: "2026-10-21", status: "REALIZADO", situacao: "ATENDIDO", parametros: { tipo: "EXAME" }, execucao: { animalId: "a", propriedadeId: 7, animal, protocolo: { nome: "Exames", versao: 1 } } } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("completa resultado no exame existente, sem executar outra coleta", async () => {
  vi.mocked(reqProtocolo).mockResolvedValue({ itens: [{ id: "exame", data: "2026-10-21", status: "VALIDO", realizacao: "COLETA_REGISTRADA", formatoSnapshot: { tipoResultado: "NUMERO", unidade: "células" }, resultadoTexto: null, resultadoNumero: null, resultadoOpcao: null, resultados: [], observacao: null, responsavel: null, demandaAcompanhamentoId: null }], total: 1, pagina: 1, porPagina: 10 });
  const salvo = vi.fn(); render(<ExamesTarefaProtocolo tarefa={tarefa} podeLancar onSalvo={salvo} />);
  fireEvent.click(await screen.findByRole("button", { name: "Informar resultado" }));
  fireEvent.change(screen.getByLabelText("Resultado células"), { target: { value: "250" } });
  fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Laudo recebido e conferido" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar com motivo" }));
  await waitFor(() => expect(reqSanidade).toHaveBeenCalledWith("/exames/exame/correcao", expect.objectContaining({ method: "POST", body: expect.stringContaining('"resultadoNumero":250') })));
  expect(salvo).toHaveBeenCalledTimes(1);
  expect(vi.mocked(reqProtocolo).mock.calls.every(([path]) => path.startsWith("/tarefas/t/exames?"))).toBe(true);
});
