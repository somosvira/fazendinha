// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Visitas } from "./Visitas";
import { obterVisita, type Visita } from "./visitas-api";
import { carregarPreviaCompleta, listarSelecoes, obterOpcoesSelecao, previaGrupo, type GrupoPlannerInput, type PreviaPlanner } from "./planner-api";

vi.mock("../../../api/propriedades", () => ({ usePropriedades: () => ({ data: [{ id: 1, nome: "Principal", ativo: true }] }) }));
vi.mock("./visitas-api", async original => ({ ...await original<typeof import("./visitas-api")>(), obterVisita: vi.fn() }));
vi.mock("./planner-api", async original => ({ ...await original<typeof import("./planner-api")>(), previaGrupo: vi.fn(), carregarPreviaCompleta: vi.fn(), obterOpcoesSelecao: vi.fn(), listarSelecoes: vi.fn() }));
vi.mock("./FolhaVisita", () => ({ FolhaVisita: () => null }));

const visita: Visita = { id: "visita", propriedadeId: 1, data: "2026-10-14", nome: "Visita", status: "ABERTA", atividades: [], impressoes: [] };
function resposta(grupo: GrupoPlannerInput): PreviaPlanner {
  return {
    grupo: { grupo, nome: "Grupo montado por filtros", secao: "REPRODUCAO", janela: "EXTRA", tipo: "AVALIACAO_REPRODUTIVA", protocolo: null, turma: null, etapa: null, previstaPara: null, precisaoTemporal: null, criterios: grupo.origem === "LIVRE" ? grupo.criterios : null, totalAnimais: 2, totalProcedimentos: 2, emVisitaAberta: 0 },
    animais: ["a", "b"].map((animalId, i) => ({ animalId, brinco: String(i + 1), sexo: "F", tarefaId: null, motivos: [], visitasAbertas: [] })),
    total: 2, pagina: 1, tamanhoPagina: 200, fingerprint: "assinatura-estavel",
  };
}
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
  window.history.replaceState({}, "", "/pecuaria/visitas/visita?etapa=selecao&modo=livre");
  vi.mocked(obterVisita).mockResolvedValue(visita);
  vi.mocked(listarSelecoes).mockResolvedValue({ selecoes: [] });
  vi.mocked(obterOpcoesSelecao).mockResolvedValue({ lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] });
  vi.mocked(previaGrupo).mockImplementation(async (_propriedadeId, _data, grupo) => resposta(grupo));
  vi.mocked(carregarPreviaCompleta).mockImplementation(async (_propriedadeId, _data, grupo) => resposta(grupo));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function montarSelecao() {
  // Controla somente o debounce de 350 ms. A carga da visita e as respostas
  // da API continuam usando promessas reais, resolvidas antes de avançar o timer.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const tela = render(<Visitas podeLancar/>);
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  vi.useRealTimers();
  return tela;
}

async function abrirRevisao() {
  const botao = screen.getByRole("button", { name: "Revisar 2 animais" });
  expect((botao as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(botao);
}

it("mantém exclusão no fluxo real de Visitas após ajustar, recarregar e refazer a revisão", async () => {
  const chave = "fazendinha:visitas:livre:sessao:1:visita";
  const { unmount } = await montarSelecao();
  await abrirRevisao();
  const incluir = await screen.findByRole("checkbox", { name: "Incluir 1" }) as HTMLInputElement;
  fireEvent.click(incluir);
  expect(incluir.checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Ajustar filtros" }));
  await screen.findByRole("heading", { name: "Selecionar animais por filtros" });
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem(chave)!).revisoesPendentes?.at(-1)?.excluidos).toEqual(["a"]));
  unmount();
  await montarSelecao();
  const consultasAntes = vi.mocked(obterVisita).mock.calls.length;
  await abrirRevisao();
  expect((await screen.findByRole("checkbox", { name: "Incluir 1" }) as HTMLInputElement).checked).toBe(false);
  await waitFor(() => expect(JSON.parse(sessionStorage.getItem(chave)!).revisao?.excluidos).toEqual(["a"]));
  await waitFor(() => expect(vi.mocked(obterVisita).mock.calls.length).toBeGreaterThan(consultasAntes));
});
