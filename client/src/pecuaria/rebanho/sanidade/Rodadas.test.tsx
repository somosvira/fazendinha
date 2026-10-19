// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
beforeEach(() => { window.history.replaceState(null, "", "/pecuaria/sanidade?aba=agenda&rodadaId=r"); vi.clearAllMocks(); mocks.prever.mockResolvedValue(previa); mocks.preverAdicao.mockResolvedValue(previa); mocks.criar.mockResolvedValue(rodada); mocks.rodadas.mockResolvedValue(pagina([rodada])); mocks.rodada.mockResolvedValue(rodada); mocks.etapas.mockResolvedValue(pagina([{ id: "e", ordem: 1, diaRelativo: 0, tipo: "EXAME", contagens: { total: 7, pendentes: 5, realizadas: 2, dispensadas: 0, atrasadas: 1 }, contagensFiltradas: { total: 1, pendentes: 1, realizadas: 0, dispensadas: 0, atrasadas: 0 } }])); mocks.participantes.mockResolvedValue(pagina([])); mocks.tarefas.mockResolvedValue(pagina([{ id: "t", etapaId: "e", execucaoId: "x", previstaPara: "2026-10-06", situacao: "PENDENTE", parametros: { tipo: "EXAME" }, execucao: { animalId: "a", propriedadeId: 1, animal: { id: "a", brinco: "A01", nome: null }, protocolo: rodada.protocolo } }])); });
afterEach(cleanup);
async function preparar() { await screen.findByRole("option", { hidden: true,  name: "Protocolo publicado · v2" }); await alterarControle(screen.getByLabelText("Sítio na data de início"), { target: { value: "1" } }); await alterarControle(screen.getByLabelText("Nome do ciclo"), { target: { value: "Campanha de outubro" } }); await alterarControle(screen.getByLabelText("Protocolo publicado"), { target: { value: "p" } }); await alterarControle(screen.getByLabelText("Início de referência"), { target: { value: "2026-10-06" } }); fireEvent.click(screen.getByRole("button", { name: /Selecionar animais/ })); fireEvent.click(screen.getByRole("button", { name: "Usar animais" })); }
describe("ciclos de protocolos", () => {
  it("agrupa contagens iguais e não renderiza indicadores zerados", async () => {
    const contagens = { total: 2, pendentes: 2, realizadas: 0, dispensadas: 0, atrasadas: 0, canceladas: 0 };
    mocks.etapas.mockResolvedValue(pagina([{ id: "e", ordem: 1, diaRelativo: 0, tipo: "EXAME", contagens, contagensFiltradas: { ...contagens } }]));
    render(<AgendaRodadas filtros={{}} podeLancar={false} rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={vi.fn()} onAcao={vi.fn()} />);
    await screen.findByRole("button", { name: /Dia 0 · Exame/ });
    expect(screen.queryByRole("columnheader", { name: "Filtro atual" })).toBeNull();
    expect(screen.queryByText(/Comparar com/)).toBeNull();
    expect(screen.queryByText("realizadas", { exact: true })).toBeNull();
    expect(screen.queryByText("canceladas", { exact: true })).toBeNull();
  });
  it("abre o ciclo como página sem a lista ou controles de expansão", async () => {
    const abrir = vi.fn();
    const props = { filtros: { pagina: 1 }, podeLancar: false, recarregarToken: 0, onAbrir: abrir, onExecutar: vi.fn(), onAcao: vi.fn() };
    const tela = render(<AgendaRodadas {...props} rodadaId="" />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ciclo" }));
    expect(abrir).toHaveBeenCalledWith("r");
    expect(screen.getByRole("button", { name: "Campanha de outubro" }).hasAttribute("aria-expanded")).toBe(false);
    tela.rerender(<AgendaRodadas {...props} rodadaId="r" />);
    await screen.findByRole("heading", { name: "Campanha de outubro" });
    expect(screen.queryByRole("heading", { name: "Ciclos de protocolos" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Abrir ciclo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para ciclos" }));
    expect(abrir).toHaveBeenLastCalledWith("");
  });
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
    await alterarControle(screen.getByLabelText("Nome do ciclo"), { target: { value: "Outra campanha" } });
    expect(screen.queryByText("Calendário previsto por animal")).toBeNull();
    fireEvent.submit(document.getElementById("form-rodada")!);
    await waitFor(() => expect(mocks.prever).toHaveBeenCalledTimes(2));
    expect(mocks.prever.mock.calls[1][0].chave).not.toBe(mocks.criar.mock.calls[0][0].chave);
  });
  it("adição mantém versão e datas próprias e usa prévia do ciclo", async () => {
    render(<FormRodada rodada={rodada} onFechar={vi.fn()} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar animais/ })); fireEvent.click(screen.getByRole("button", { name: "Usar animais" }));
    expect(screen.getByLabelText("Protocolo publicado")).toHaveProperty("disabled", true);
    await alterarControle(screen.getByLabelText("Início de A02"), { target: { value: "2026-10-08" } });
    await alterarControle(screen.getByLabelText("Motivo da data diferente"), { target: { value: "Animal entrou dois dias depois" } });
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
  it("distingue filtro sem resultados e falha de consulta, sem sugerir cadastro ao leitor", async () => {
    mocks.rodadas.mockResolvedValue(pagina([]));
    const props = { podeLancar: false, rodadaId: "", recarregarToken: 0, onAbrir: vi.fn(), onExecutar: vi.fn(), onAcao: vi.fn() };
    const tela = render(<AgendaRodadas {...props} filtros={{ animalId: "ausente" }} />);
    await screen.findByText("Nenhum ciclo corresponde aos filtros. Ajuste os critérios acima para consultar outros ciclos.");
    expect(screen.queryByText(/Use Novo ciclo/)).toBeNull();
    mocks.rodadas.mockRejectedValueOnce(new Error("Falha ao consultar ciclos"));
    tela.rerender(<AgendaRodadas {...props} filtros={{ animalId: "outro" }} />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/Nenhum ciclo/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/Nenhum ciclo corresponde/);
  });
  it("etapas separam contagens e ações de cada tarefa independem do filtro de animal", async () => {
    const executar = vi.fn(), acao = vi.fn();
    render(<AgendaRodadas filtros={{ pagina: 1, animalId: "" }} podeLancar rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={executar} onAcao={acao} />);
    await screen.findAllByLabelText("7 previstas · 5 pendentes · 2 realizadas · 1 atrasada");
    expect(screen.queryByLabelText("Resumo da página sanitária")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Andamento das tarefas" })).toBeNull();
    expect(screen.getAllByLabelText("1 prevista · 1 pendente").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Dia 0 · Exame/ }));
    fireEvent.click((await screen.findAllByRole("button", { name: "Executar tarefa" }))[0]);
    expect(executar.mock.calls[0][0][0].execucao.animalId).toBe("a");
    fireEvent.pointerDown(screen.getAllByRole("button", { name: "Mais ações de A01" })[0], { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Adiar" }));
    expect(acao).toHaveBeenCalledWith("adiar", expect.objectContaining({ id: "t", execucao: expect.objectContaining({ propriedadeId: 1 }) }));
  });
  it("separa participantes, identifica etapa e conserva permissão de consulta", async () => {
    render(<AgendaRodadas filtros={{}} podeLancar={false} rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={vi.fn()} onAcao={vi.fn()} />);
    await screen.findByRole("heading", { name: "Tarefas · Dia 0 · Exame" });
    expect(screen.getByRole("button", { name: /Dia 0 · Exame/ }).getAttribute("aria-pressed")).toBe("true");
    expect(within(await screen.findByRole("table", { name: "Tarefas da etapa" })).getAllByRole("columnheader")).toHaveLength(6);
    expect(screen.queryByRole("table", { name: "Participantes do ciclo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Executar tarefa" })).toBeNull();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Participantes e histórico" }), { button: 0 });
    await screen.findByRole("table", { name: "Participantes do ciclo" });
    expect(screen.queryByRole("table", { name: "Tarefas da etapa" })).toBeNull();
    expect(new URLSearchParams(window.location.search).get("abaCiclo")).toBe("participantes");
  });
  it("nomeia e limpa animal sem apagar ciclo e demais filtros", async () => {
    window.history.replaceState(null, "", "/pecuaria/sanidade?aba=agenda&rodadaId=r&animalId=a&situacao=PENDENTE");
    mocks.participantes.mockResolvedValue(pagina([{ id: "x", animalId: "a", animal: { id: "a", brinco: "A01", nome: "Aurora" }, inicio: "2026-10-01", canceladaEm: null }]));
    render(<AgendaRodadas filtros={{ animalId: "a", situacao: "PENDENTE" }} podeLancar={false} rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={vi.fn()} onAcao={vi.fn()} />);
    await screen.findByText("A01 · Aurora");
    fireEvent.click(screen.getByRole("button", { name: "Limpar filtro de animal" }));
    const p = new URLSearchParams(window.location.search);
    expect(p.has("animalId")).toBe(false);
    expect(p.get("rodadaId")).toBe("r");
    expect(p.get("situacao")).toBe("PENDENTE");
  });
  it("abre gestão do ciclo por menu e mantém edição de nome", async () => {
    render(<AgendaRodadas filtros={{}} podeLancar rodadaId="r" recarregarToken={0} onAbrir={vi.fn()} onExecutar={vi.fn()} onAcao={vi.fn()} />);
    fireEvent.pointerDown(await screen.findByRole("button", { name: "Gerenciar ciclo" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Renomear ciclo" }));
    expect(screen.getByLabelText("Novo nome do ciclo")).toHaveProperty("value", rodada.nome);
  });
});
