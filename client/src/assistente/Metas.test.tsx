// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import Metas from "./Metas";
const mocks = vi.hoisted(() => ({
  lista: vi.fn(),
  catalogo: vi.fn(),
  registrar: vi.fn(),
}));
vi.mock("./metas-api", () => ({
  obterMetas: mocks.lista,
  obterCatalogoMetas: mocks.catalogo,
  salvarMeta: vi.fn(),
  registrarMedicao: mocks.registrar,
}));
afterEach(cleanup);
const indicador = {
  id: "leite_volume",
  versao: 1,
  nome: "Produção de leite",
  unidade: "L",
  dominio: "pecuaria",
  formula: "Volume diário",
  fonte: "automatica",
  motivoManual: "Cobertura completa necessária",
};
describe("Metas", () => {
  it("não preenche metas reais ou evolução com os referenciais do desenho", async () => {
    mocks.lista.mockResolvedValue({ metas: [], podeEditar: true, limite: 100 });
    mocks.catalogo.mockResolvedValue({
      indicadores: [indicador],
      podeEditar: true,
    });
    render(<Metas propriedadeId={1} />);
    await screen.findByText("Nenhuma meta cadastrada");
    expect(screen.queryByText(/3.600/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Nova meta" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      (screen.getByLabelText("Nome da meta") as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByRole("button", { name: "Salvar meta" })).toBeTruthy();
  });
  it("leitor não recebe ação de criação", async () => {
    mocks.lista.mockResolvedValue({
      metas: [],
      podeEditar: false,
      limite: 100,
    });
    mocks.catalogo.mockResolvedValue({
      indicadores: [indicador],
      podeEditar: false,
    });
    render(<Metas propriedadeId={1} />);
    await screen.findByText("Nenhuma meta cadastrada");
    expect(screen.queryByRole("button", { name: "Nova meta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar a primeira meta" })).toBeNull();
  });
  it("abre fonte da meta consolidada pelo callback com a fazenda correta", async () => {
    const fonte =
      "/pecuaria/leite?propriedadeId=7&ordenhasInicio=2026-11-03&ordenhasFim=2026-11-03";
    mocks.lista.mockResolvedValue({
      metas: [
        {
          id: "meta-1",
          propriedadeId: 7,
          revisao: 2,
          definicao: {
            titulo: "Marco",
            indicadorId: "marco_operacional",
            indicadorVersao: 1,
            tipo: "marco",
            minimo: null,
            maximo: null,
            periodo: "ciclo",
            prazo: "2027-01-01",
            fonte: "manual",
            observacao: "",
          },
          medicoes: [
            {
              data: "2026-11-03",
              valor: null,
              concluido: true,
              observacao: "Registro",
              revisao: 2,
              usuarioId: 1,
              criadoEm: "2026-11-03T12:00:00Z",
              proveniencia: { url: fonte, adaptador: "TESTE" },
            },
          ],
          situacao: "concluido",
          historico: [],
        },
      ],
      podeEditar: false,
      limite: 100,
    });
    mocks.catalogo.mockResolvedValue({
      indicadores: [
        {
          ...indicador,
          id: "marco_operacional",
          nome: "Marco",
          unidade: "marco",
        },
      ],
      podeEditar: false,
    });
    const abrir = vi.fn();
    render(<Metas propriedadeId={null} onAbrirFonte={abrir} />);
    const link = await screen.findByRole("link", {
      name: "Conferir ordenhas da medição",
    });
    const clique = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, clique);
    expect(clique.defaultPrevented).toBe(true);
    expect(abrir).toHaveBeenCalledOnce();
    expect(abrir).toHaveBeenCalledWith(fonte, 7);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Metas da fazenda",
    );
  });
  it("etapas têm contagem sem percentual e mudanças protegem o rascunho", async () => {
    const meta = {
      id: "meta-etapas",
      propriedadeId: 1,
      revisao: 1,
      definicao: {
        titulo: "Ordenha",
        indicadorId: "marco_operacional",
        indicadorVersao: 1,
        tipo: "marco",
        minimo: null,
        maximo: null,
        periodo: "ciclo",
        prazo: "2027-01-01",
        fonte: "manual",
        observacao: "",
        etapas: [
          { id: "30000000-0000-4000-8000-000000000001", titulo: "Equipamento" },
          { id: "30000000-0000-4000-8000-000000000002", titulo: "Instalação" },
        ],
      },
      medicoes: [],
      situacao: "sem_medicao",
      historico: [],
    };
    mocks.lista.mockResolvedValue({
      metas: [meta],
      podeEditar: true,
      limite: 100,
    });
    mocks.catalogo.mockResolvedValue({
      indicadores: [
        {
          ...indicador,
          id: "marco_operacional",
          nome: "Marco",
          unidade: "marco",
        },
      ],
      podeEditar: true,
    });
    const confirmar = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Metas propriedadeId={1} />);
    await screen.findByText("0 de 2 etapas concluídas");
    fireEvent.click(screen.getByRole("button", { name: "Editar Ordenha" }));
    fireEvent.change(screen.getByLabelText(/Etapas, uma por linha/), {
      target: { value: "Equipamento\nInstalação\nTeste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(confirmar).toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      (screen.getByLabelText(/Etapas, uma por linha/) as HTMLTextAreaElement)
        .value,
    ).toContain("Teste");
    confirmar.mockRestore();
  });
  it("erro deixa tentar novamente e não apresenta um falso estado vazio", async () => {
    mocks.lista.mockRejectedValue(new Error("Falha de conexão"));
    mocks.catalogo.mockResolvedValue({ indicadores: [], podeEditar: false });
    render(<Metas propriedadeId={1} />);
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Falha de conexão",
      ),
    );
    expect(screen.queryByText("Nenhuma meta cadastrada")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeTruthy();
  });
});
