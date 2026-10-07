// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnimalResumo } from "../types";
vi.mock("../api", () => ({ obterCatalogos: vi.fn().mockResolvedValue({ propriedades: [{ id: 1, nome: "Sítio A" }] }), buscarFichaAnimal: vi.fn() }));
const mocks = vi.hoisted(() => ({ prever: vi.fn(), criar: vi.fn(), adicionar: vi.fn(), preverAdicao: vi.fn(), rodadas: vi.fn(), rodada: vi.fn(), etapas: vi.fn(), participantes: vi.fn(), tarefas: vi.fn() }));
vi.mock("./rodadas-api", async (original) => ({ ...await original<typeof import("./rodadas-api")>(), preverRodada: mocks.prever, criarRodada: mocks.criar, adicionarParticipantes: mocks.adicionar, preverParticipantes: mocks.preverAdicao, listarRodadas: mocks.rodadas, consultarRodada: mocks.rodada, listarEtapasRodada: mocks.etapas, listarParticipantesRodada: mocks.participantes, listarTarefasEtapa: mocks.tarefas }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), reqSanidade: vi.fn().mockResolvedValue([{ id: "p", nome: "Protocolo publicado", versao: 2, ativo: true, publicadoEm: "2026-10-01" }]) }));
vi.mock("../components/SeletorAnimais", () => ({ SeletorAnimais: ({ onConfirmar }: { onConfirmar: (v: AnimalResumo[]) => void }) => <button onClick={() => onConfirmar([{ id: "a", brinco: "A01", propriedade: { id: 1, nome: "Sítio A" } }, { id: "b", brinco: "A02", propriedade: { id: 1, nome: "Sítio A" } }] as AnimalResumo[])}>Usar animais</button> }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...props }: { value: string; onChange: (v: string) => void }) => <input {...props} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
import { FormRodada } from "./FormRodada";
import { AgendaRodadas } from "./AgendaRodadas";
import type { RodadaSanitaria } from "./rodadas-api";
const rodada: RodadaSanitaria = { id: "r", nome: "Campanha de outubro", propriedadeId: 1, protocoloId: "p", inicioReferencia: "2026-10-06", protocolo: { id: "p", nome: "Protocolo publicado", versao: 2 } };
const previa = { itens: [{ animalId: "a", inicio: "2026-10-06", tarefas: [{ etapaId: "e", previstaPara: "2026-10-06", parametros: { tipo: "EXAME", tipoExameNomeSnapshot: "Coleta" } }] }] };
const pagina = <T,>(itens: T[]) => ({ itens, total: itens.length, pagina: 1, porPagina: 20 });
beforeEach(() => { vi.clearAllMocks(); mocks.prever.mockResolvedValue(previa); mocks.preverAdicao.mockResolvedValue(previa); mocks.criar.mockResolvedValue(rodada); mocks.rodadas.mockResolvedValue(pagina([rodada])); mocks.rodada.mockResolvedValue(rodada); mocks.etapas.mockResolvedValue(pagina([{ id: "e", ordem: 1, diaRelativo: 0, tipo: "EXAME", contagens: { total: 7, pendentes: 5, realizadas: 2, dispensadas: 0, atrasadas: 1 }, contagensFiltradas: { total: 1, pendentes: 1, realizadas: 0, dispensadas: 0, atrasadas: 0 } }])); mocks.participantes.mockResolvedValue(pagina([])); mocks.tarefas.mockResolvedValue(pagina([{ id: "t", etapaId: "e", execucaoId: "x", previstaPara: "2026-10-06", situacao: "PENDENTE", parametros: { tipo: "EXAME" }, execucao: { animalId: "a", propriedadeId: 1, animal: { id: "a", brinco: "A01", nome: null }, protocolo: rodada.protocolo } }])); });
afterEach(cleanup);
async function preparar() { await screen.findByRole("option", { name: "Protocolo publicado · v2" }); fireEvent.change(screen.getByLabelText("Sítio na data de início"), { target: { value: "1" } }); fireEvent.change(screen.getByLabelText("Nome do ciclo"), { target: { value: "Campanha de outubro" } }); fireEvent.change(screen.getByLabelText("Protocolo publicado"), { target: { value: "p" } }); fireEvent.change(screen.getByLabelText("Início de referência"), { target: { value: "2026-10-06" } }); fireEvent.click(screen.getByRole("button", { name: /Selecionar animais/ })); fireEvent.click(screen.getByRole("button", { name: "Usar animais" })); }
describe("ciclos de protocolos", () => {
  it("conferência mostra calendário e edição exige nova prévia; retry mantém chave", async () => {
    mocks.criar.mockRejectedValue(new Error("Tempo de resposta excedido"));
    render(<FormRodada onFechar={vi.fn()} onSalvo={vi.fn()} />); await preparar();
    fireEvent.submit(document.getElementById("form-rodada")!);
    await screen.findByText("Calendário previsto por animal");
    expect(mocks.criar).not.toHaveBeenCalled();
    fireEvent.submit(document.getElementById("form-rodada")!);
    await screen.findAllByText("Tempo de resposta excedido");
    fireEvent.submit(document.getElementById("form-rodada")!);
    await waitFor(() => expect(mocks.criar).toHaveBeenCalledTimes(2));
    expect(mocks.criar.mock.calls[0][0].chave).toBe(mocks.criar.mock.calls[1][0].chave);
    fireEvent.change(screen.getByLabelText("Nome do ciclo"), { target: { value: "Outra campanha" } });
    expect(screen.queryByText("Calendário previsto por animal")).toBeNull();
    fireEvent.submit(document.getElementById("form-rodada")!);
    await waitFor(() => expect(mocks.prever).toHaveBeenCalledTimes(2));
    expect(mocks.prever.mock.calls[1][0].chave).not.toBe(mocks.criar.mock.calls[0][0].chave);
  });
  it("adição mantém versão e datas próprias e usa prévia do ciclo", async () => {
    render(<FormRodada rodada={rodada} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar animais/ })); fireEvent.click(screen.getByRole("button", { name: "Usar animais" }));
    expect(screen.getByLabelText("Protocolo publicado")).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Início de A02"), { target: { value: "2026-10-08" } });
    fireEvent.change(screen.getByLabelText("Motivo da data diferente"), { target: { value: "Animal entrou dois dias depois" } });
    fireEvent.submit(document.getElementById("form-rodada")!);
    await screen.findByText("Calendário previsto por animal");
    expect(mocks.prever).not.toHaveBeenCalled();
    expect(mocks.preverAdicao).toHaveBeenCalledWith("r", expect.objectContaining({ propriedadeId: 1, itens: expect.arrayContaining([{ animalId: "b", inicio: "2026-10-08", justificativaInicio: "Animal entrou dois dias depois" }]) }));
  });
  it("não envia justificativa vazia ao iniciar um ciclo sem sobreposição", async () => {
    render(<FormRodada onFechar={vi.fn()} onSalvo={vi.fn()} />); await preparar();
    fireEvent.submit(document.getElementById("form-rodada")!);
    await waitFor(() => expect(mocks.prever).toHaveBeenCalled());
    const itens = mocks.prever.mock.calls[0][0].itens;
    expect(itens).toEqual(expect.arrayContaining([expect.objectContaining({ animalId: "a" })]));
    expect(itens[0]).not.toHaveProperty("justificativaSobreposicao");
    expect(itens[0]).not.toHaveProperty("confirmarSobreposicao");
  });
  it("etapas separam contagens e ações de cada tarefa independem do filtro de animal", async () => {
    const executar = vi.fn(), acao = vi.fn();
    render(<AgendaRodadas filtros={{ pagina: 1, animalId: "" }} podeLancar rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={executar} onAcao={acao} />);
    await screen.findAllByText("7 previstas · 5 pendentes · 2 realizadas · 0 dispensadas · 1 atrasadas · 0 canceladas");
    expect(screen.getAllByText("1 previstas · 1 pendentes · 0 realizadas · 0 dispensadas · 0 atrasadas · 0 canceladas").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Abrir tarefas da etapa" })[0]);
    fireEvent.click((await screen.findAllByRole("button", { name: "Executar tarefa" }))[0]);
    expect(executar.mock.calls[0][0][0].execucao.animalId).toBe("a");
    fireEvent.click(screen.getAllByRole("button", { name: "Adiar" })[0]);
    expect(acao).toHaveBeenCalledWith("adiar", expect.objectContaining({ id: "t", execucao: expect.objectContaining({ propriedadeId: 1 }) }));
  });
});
