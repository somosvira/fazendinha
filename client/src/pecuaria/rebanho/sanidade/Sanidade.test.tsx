// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ req: vi.fn() }));
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), reqSanidade: mocks.req, listarServicos: vi.fn().mockResolvedValue([]) }));
vi.mock("../api", () => ({ listarAnimais: vi.fn().mockResolvedValue({ itens: [] }), listarLotes: vi.fn().mockResolvedValue([]), buscarFichaAnimal: vi.fn() }));
vi.mock("./SanidadeAnimal", () => ({ SanidadeAnimal: ({ onMudou }: { onMudou?: (id?: string) => void }) => <button onClick={() => onMudou?.("salva")}>Salvar aplicação de teste</button> }));
vi.mock("./RateioServico", () => ({ RateioServico: () => <p>Gerenciador aberto</p> }));
import { Sanidade } from "./Sanidade";
import { FormFatoSanitario } from "./FormFatoSanitario";
import { listarAnimais, buscarFichaAnimal } from "../api";

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.mocked(listarAnimais).mockResolvedValue({ itens: [] } as unknown as Awaited<ReturnType<typeof listarAnimais>>); window.history.replaceState(null, "", "/"); });
describe("busca e atualização da Sanidade", () => {
  it("abre gerenciador sem filtro de animal e sem permissão de valores", async () => {
    localStorage.setItem("rionovo:usuario", JSON.stringify({ id: 1, nome: "Operador", dono: false, areas: ["pecuaria", "financeiro"], flags: ["lancar"] }));
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?aba=agenda");
    render(<Sanidade podeLancar />);
    fireEvent.click(screen.getByRole("button", { name: "Gerenciar procedimentos" }));
    await screen.findByText("Gerenciador aberto");
    expect(screen.getByRole("button", { name: "Animal" })).toHaveProperty("textContent", "Todos os animais");
    localStorage.removeItem("rionovo:usuario");
  });
  it("exige nova ciência quando troca o protocolo após conflito confirmado", async () => {
    vi.mocked(buscarFichaAnimal).mockResolvedValue({ id: "animal", brinco: "GV3", nome: "Mimosa", historicoLocalizacoes: [{ desde: "2026-01-01", ate: null, propriedade: { id: 2, nome: "Sítio B" } }] } as Awaited<ReturnType<typeof buscarFichaAnimal>>);
    vi.mocked(listarAnimais).mockResolvedValue({ itens: [{ id: "animal", brinco: "GV3", nome: "Mimosa", propriedade: { id: 2 } }] } as Awaited<ReturnType<typeof listarAnimais>>);
    mocks.req.mockImplementation((caminho: string) => {
      if (caminho === "/protocolos") return Promise.resolve(["A", "B"].map((id) => ({ id, nome: `Protocolo ${id}`, ativo: true, publicadoEm: "2026-10-01", versao: 1 })));
      if (caminho === "/execucoes/coletivas") return Promise.reject(new Error("Sobreposição: protocolo pendente"));
      return Promise.resolve([]);
    });
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?aba=agenda");
    render(<FormFatoSanitario tipo="protocolo" animalInicial="animal" fixo onFechar={vi.fn()} onSalvo={vi.fn()} />);
    await screen.findByText(/Sítio na data: Sítio B/);
    fireEvent.change(screen.getByLabelText(/Protocolo publicado/), { target: { value: "A" } });
    fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
    const ciencia = await screen.findByRole("switch", { name: /Confirmo iniciar outro protocolo/ });
    fireEvent.click(ciencia);
    fireEvent.change(screen.getByLabelText(/Motivo da sobreposição/), { target: { value: "Sobreposição revisada com responsável" } });
    expect((ciencia as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText(/Protocolo publicado/), { target: { value: "B" } });
    expect(screen.queryByRole("switch", { name: /Confirmo iniciar outro protocolo/ })).toBeNull();
    fireEvent.submit(document.getElementById("novo-fato-sanitario")!);
    await screen.findByRole("switch", { name: /Confirmo iniciar outro protocolo/ });
    const requests = mocks.req.mock.calls.filter(([caminho]) => caminho === "/execucoes/coletivas");
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[1][1].body).itens[0]).toMatchObject({ protocoloId: "B" });
    expect(JSON.parse(requests[1][1].body).itens[0]).not.toHaveProperty("confirmarSobreposicao");
    expect((screen.getByRole("switch", { name: /Confirmo iniciar outro protocolo/ }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText(/Motivo da sobreposição/) as HTMLTextAreaElement).value).toBe("Sobreposição revisada com responsável");
  });
  it("restaura busca da URL, reinicia a página e conserva filtros próprios ao trocar tabela", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?aba=agenda&buscaAnimal=Mimosa&pagina=3");
    render(<Sanidade podeLancar={false} />);
    const busca = screen.getByPlaceholderText("Brinco ou nome");
    expect((busca as HTMLInputElement).value).toBe("Mimosa");
    await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(/tarefas.*pagina=3.*buscaAnimal=Mimosa/)));
    fireEvent.change(busca, { target: { value: "GV3" } });
    await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(/tarefas.*pagina=1.*buscaAnimal=GV3/)));
    for (const [rotulo, recurso] of [["Ocorrências", "ocorrencias"], ["Aplicações", "aplicacoes"], ["Exames", "exames"], ["Carências", "carencias"]]) {
      if (rotulo === "Ocorrências") fireEvent.click(screen.getByText("Mais consultas"));
      fireEvent.click(screen.getByRole("button", { name: rotulo }));
      await waitFor(() => expect(mocks.req).toHaveBeenCalledWith(expect.stringMatching(`${recurso}.*pagina=1`)));
      expect(screen.getByPlaceholderText("Brinco ou nome")).toHaveProperty("value", "");
    }
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByPlaceholderText("Brinco ou nome")).toHaveProperty("value", "GV3");
    expect(new URLSearchParams(window.location.search).get("buscaAnimal")).toBe("GV3");
    expect(new URLSearchParams(window.location.search).get("pagina")).toBeNull();
  });
  it("informa escrita salva mesmo quando a atualização da consulta falha", async () => {
    mocks.req.mockResolvedValue([]);
    window.history.replaceState(null, "", "/pecuaria/rebanho/sanidade?aba=aplicacoes&buscaAnimal=GV3");
    render(<Sanidade podeLancar />);
    const salvar = await screen.findByRole("button", { name: "Salvar aplicação de teste" });
    mocks.req.mockImplementation((caminho: string) => caminho.startsWith("/aplicacoes?") ? Promise.reject(new Error("Consulta indisponível")) : Promise.resolve([]));
    fireEvent.click(salvar);
    expect(await screen.findByRole("button", { name: "Ver aplicação salva" })).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/Aplicação salva\. Não conseguimos atualizar a consulta/)).toBeTruthy());
    expect(new URLSearchParams(window.location.search).get("buscaAnimal")).toBe("GV3");
    expect(new URLSearchParams(window.location.search).get("aplicacaoId")).toBeNull();
  });
});
