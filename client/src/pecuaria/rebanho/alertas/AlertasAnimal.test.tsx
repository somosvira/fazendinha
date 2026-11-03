// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AlertasAnimal } from "./AlertasAnimal";
import { consultarAlertas, consultarParticipantes, type ConsultaAlertas, type ParticipanteAlerta } from "./api";
vi.mock("./api", () => ({ consultarAlertas: vi.fn(), consultarParticipantes: vi.fn() }));
vi.mock("./DetalheAlerta", () => ({ DetalheAlerta: ({ id, animalIdAtual, onFechar }: { id: string; animalIdAtual: string; onFechar: () => void }) => <div role="dialog" aria-label="Detalhe real">{id} · {animalIdAtual}<button onClick={onFechar}>Fechar detalhe</button></div> }));
const consultar = vi.mocked(consultarAlertas), participantes = vi.mocked(consultarParticipantes);
const grupo = { chave: "regra-vacina", titulo: "Vacinação", motivo: "Idade prevista atingida", produtor: "sanidade", tipo: "IDADE", propriedadeId: 2, produtoId: null, produtoNome: null, necessidades: 1, animais: 1, situacoes: { PENDENTE: 1 }, primeiraData: "2026-10-30" };
const resposta: ConsultaAlertas = { itens: [grupo], total: 11, pagina: 1, tamanho: 10, totaisGerais: { cuidados: 11, necessidades: 11, animais: 1 }, totaisFiltrados: { cuidados: 11, necessidades: 11, animais: 1 }, cobertura: { estado: "ATUALIZADA", diaCoberto: "2026-10-31", ultimaConclusao: null, erro: null }, tiposDisponiveis: [] };
const item: ParticipanteAlerta = { id: "alerta-1", necessidadeId: "necessidade-1", animalId: "animal-1", brinco: "123", nome: null, loteId: null, loteNome: null, titulo: grupo.titulo, motivo: grupo.motivo, situacao: "PENDENTE", dataReferencia: "2026-10-30", dataAtencao: null, revisao: 1, chaveAgrupamento: grupo.chave, propriedadeId: 2 };
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/pecuaria/rebanho/animais/animal-1"); consultar.mockResolvedValue(resposta); });
afterEach(cleanup);
describe("alertas na ficha do animal", () => {
  it("consulta somente o animal e sítio, pagina em dez e mantém filtros nas duas apresentações", async () => {
    render(<AlertasAnimal animalId="animal-1" propriedadeId={2} podeLancar={false} />);
    await screen.findByText("Vacinação");
    expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ animalId: "animal-1", propriedadeId: 2, tamanho: 10, pagina: 1, disposicao: "ATENCAO" }), expect.any(AbortSignal));
    expect(participantes).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }), expect.any(AbortSignal)));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vacina" } });
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ busca: "vacina", pagina: 1 }), expect.any(AbortSignal)));
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(screen.getByRole("table", { name: "Alertas deste animal" })).toBeTruthy();
    for (const [name, disposicao] of [["Próximos", "PROXIMOS"], ["Programados", "PROGRAMADOS"], ["Histórico", "HISTORICO"]]) {
      fireEvent.click(screen.getByRole("button", { name }));
      await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ disposicao, animalId: "animal-1", busca: "vacina", pagina: 1 }), expect.any(AbortSignal)));
    }
  });
  it("abre o detalhe factual sem navegar quando há uma necessidade e conserva o contexto", async () => {
    participantes.mockResolvedValue({ itens: [item], total: 1, pagina: 1, tamanho: 10, totaisGerais: resposta.totaisGerais, totaisFiltrados: resposta.totaisFiltrados });
    render(<AlertasAnimal animalId="animal-1" propriedadeId={2} />);
    await screen.findByRole("button", { name: "Ver cuidado" });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vacina" } });
    fireEvent.click(await screen.findByRole("button", { name: "Ver cuidado" }));
    await screen.findByRole("dialog", { name: "Detalhe real" });
    expect(screen.getByText("alerta-1 · animal-1")).toBeTruthy();
    expect(participantes).toHaveBeenCalledWith(grupo.chave, expect.objectContaining({ animalId: "animal-1", propriedadeId: 2, tamanho: 10 }), expect.any(AbortSignal));
    expect(participantes.mock.calls[0][1].busca).toBeUndefined();
    expect(window.location.pathname).toBe("/pecuaria/rebanho/animais/animal-1");
  });
  it("não descarta necessidades de um mesmo cuidado: oferece seleção e paginação próprias", async () => {
    participantes.mockResolvedValue({ itens: [item, { ...item, id: "alerta-2", dataReferencia: "2026-11-30" }], total: 12, pagina: 1, tamanho: 10, totaisGerais: resposta.totaisGerais, totaisFiltrados: resposta.totaisFiltrados });
    render(<AlertasAnimal animalId="animal-1" propriedadeId={2} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver cuidado" }));
    await screen.findByRole("navigation", { name: "Paginação dos registros do cuidado" });
    expect(screen.queryByRole("dialog", { name: "Detalhe real" })).toBeNull();
    const { within } = await import("@testing-library/react");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Paginação dos registros do cuidado" })).getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(participantes).toHaveBeenLastCalledWith(grupo.chave, expect.objectContaining({ pagina: 2, animalId: "animal-1" }), expect.any(AbortSignal)));
    participantes.mockImplementation(async (_chave, filtros) => ({ itens: filtros.pagina === 2 ? [] : [item], total: 10, pagina: filtros.pagina ?? 1, tamanho: 10, totaisGerais: resposta.totaisGerais, totaisFiltrados: resposta.totaisFiltrados }));
    window.dispatchEvent(new Event("pecuaria:alertas-atualizados"));
    await waitFor(() => expect(participantes).toHaveBeenLastCalledWith(grupo.chave, expect.objectContaining({ pagina: 1, animalId: "animal-1" }), expect.any(AbortSignal)));
  });
  it("retorna à última página existente quando uma atualização remove o último cuidado", async () => {
    consultar.mockImplementation(async filtros => ({ ...resposta, pagina: filtros.pagina ?? 1 }));
    render(<AlertasAnimal animalId="animal-1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 2 }), expect.any(AbortSignal)));
    consultar.mockImplementation(async filtros => ({ ...resposta, total: 10, pagina: filtros.pagina ?? 1, itens: filtros.pagina === 2 ? [] : [grupo] }));
    window.dispatchEvent(new Event("pecuaria:alertas-atualizados"));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 }), expect.any(AbortSignal)));
    await screen.findByText("Vacinação");
    expect(screen.queryByText("Nenhum cuidado encontrado nesta consulta.")).toBeNull();
  });
  it("separa cobertura ausente e falha de consulta de um vazio avaliado e atualiza pelo evento", async () => {
    consultar.mockRejectedValueOnce(new Error("Falha de conexão")).mockResolvedValueOnce({ ...resposta, itens: [], total: 0, cobertura: { ...resposta.cobertura, estado: "NAO_AVALIADO" } }).mockResolvedValue({ ...resposta, itens: [], total: 0 });
    render(<AlertasAnimal animalId="animal-1" />);
    await screen.findByText("Falha de conexão");
    expect(screen.queryByText(/Nenhum cuidado/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("As regras ainda não foram avaliadas.");
    expect(screen.queryByText("Nenhum cuidado encontrado nesta consulta.")).toBeNull();
    window.dispatchEvent(new Event("pecuaria:alertas-atualizados"));
    await screen.findByText("Nenhum cuidado encontrado nesta consulta.");
    expect(consultar).toHaveBeenCalledTimes(3);
  });
});
