// @vitest-environment jsdom
import { alterarControle } from "../../../lib/controles.fixture";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Scale } from "lucide-react";
import { AuditoriaAnimal } from "./AuditoriaAnimal";
import { buscarAuditoriaAnimal } from "../api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
import type { EntradaAuditoria, ResultadoAuditoriaAnimal } from "../types";

vi.mock("../api", async (original) => ({ ...await original<typeof import("../api")>(), buscarAuditoriaAnimal: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); setPropriedadeAtiva(null); });
const entrada = (indice = 1): EntradaAuditoria => ({
  id: `auditoria-${indice}`, em: "2026-10-18T14:32:00.000Z", acao: "EDICAO", acaoRotulo: "Alteração", eixo: "REBANHO",
  entidade: "Animal", entidadeId: `animal-${indice}`, registro: `Identificação ${indice}`, usuarioNome: "Ana", resumo: `Alteração ${indice}`,
  alteracoes: [{ campo: "pesoKg", rotulo: "Peso", antes: "300", depois: "310" }],
});
const resposta = (itens = [entrada()], total = itens.length): ResultadoAuditoriaAnimal => ({
  itens, total, filtros: { acoes: [{ valor: "EDICAO", rotulo: "Alteração" }, { valor: "ESTORNO", rotulo: "Estorno" }], responsaveis: [{ id: 7, nome: "Ana" }, { id: 8, nome: "Joana" }], semResponsavel: true },
});
function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((resolve) => { resolver = resolve; });
  return { promessa, resolver };
}

describe("AuditoriaAnimal", () => {
  it("mostra tabela com data/hora, eixo com nome, ação, registro e autoria real", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta());
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    const tabela = screen.getByRole("table", { name: "Auditoria dos registros do animal" });
    for (const coluna of ["Data e hora", "Eixo", "Ação", "Registro afetado", "Responsável", "Detalhes"]) expect(within(tabela).getByRole("columnheader", { name: coluna })).toBeTruthy();
    expect(within(tabela).getByText("Rebanho")).toBeTruthy();
    expect(within(tabela).getByText("Ana")).toBeTruthy();
    expect(within(tabela).getByText(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/)).toBeTruthy();
  });

  it("inicia com os últimos30dias completos, incluindo o fim do dia", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta());
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    const parametros = vi.mocked(buscarAuditoriaAnimal).mock.calls[0][1]!;
    const fim = new Date(parametros.fim!); const inicio = new Date(parametros.inicio!);
    const esperado = new Date(); esperado.setHours(0, 0, 0, 0); esperado.setDate(esperado.getDate() - 29);
    expect(parametros).toMatchObject({ page: 1, pageSize: 20 });
    expect(inicio.toISOString()).toBe(esperado.toISOString());
    expect(fim.getHours()).toBe(23); expect(fim.getMilliseconds()).toBe(999);
    expect((screen.getByLabelText("Período") as HTMLSelectElement).value).toBe("30");
  });

  it("abre somente a entrada selecionada em modal com Campo/Antes/Depois e preserva null", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([{ ...entrada(), alteracoes: [{ campo: "observacao", rotulo: "Observação", antes: null, depois: "Nova nota" }] }, entrada(2)]));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    const botoes = screen.getAllByRole("button", { name: "Ver auditoria" });
    fireEvent.click(botoes[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getAllByRole("columnheader", { name: "Antes" })).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "Antes" })).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy(); expect(screen.getByText("Nova nota")).toBeTruthy();
  });

  it("autoria ausente não inventa Sistema e registro sem diff explica a limitação", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([{ ...entrada(), usuarioNome: null, alteracoes: [] }]));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    expect(screen.queryByText("Sistema")).toBeNull();
    expect(within(screen.getByRole("table")).getByText("Não informado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ver auditoria" }));
    expect(screen.getByText("Sem detalhes de campos disponíveis nesta consulta.")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("usa opções completas do servidor e envia filtros ao conjunto completo", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta());
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    await alterarControle(screen.getByLabelText("Período"), { target: { value: "todos" } });
    fireEvent.click(screen.getByRole("button", { name: "Mais filtros" }));
    await alterarControle(screen.getByLabelText("Eixo"), { target: { value: "NUTRICAO" } });
    await alterarControle(screen.getByLabelText("Ação"), { target: { value: "ESTORNO" } });
    await alterarControle(screen.getByLabelText("Responsável"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await alterarControle(screen.getByLabelText("Buscar registro"), { target: { value: "Consumo" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar registros" }));
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", { page: 1, pageSize: 20, eixo: "NUTRICAO", acao: "ESTORNO", responsavel: 8, busca: "Consumo" }));
  });

  it("troca de página sem acumular registros e mantém filtros", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValueOnce(resposta([entrada()], 25)).mockResolvedValueOnce(resposta([entrada(2)], 25));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Identificação 2");
    expect(screen.queryByText("Identificação 1")).toBeNull();
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 2, pageSize: 20, inicio: expect.any(String), fim: expect.any(String) }));
    expect(screen.getByText("21–25 de 25 registros")).toBeTruthy();
  });

  it("permite consultar registros sem eixo classificado usando filtro do servidor", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([{ ...entrada(), eixo: null, registro: "Classificação de custo" }]));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Classificação de custo");
    fireEvent.click(screen.getByRole("button", { name: "Mais filtros" }));
    await alterarControle(screen.getByLabelText("Eixo"), { target: { value: "NAO_CLASSIFICADO" } });
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 1, eixo: "NAO_CLASSIFICADO" })));
  });

  it("ignora página antiga que resolve após filtro e recomeça da página1", async () => {
    const antiga = pendente<ResultadoAuditoriaAnimal>();
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValueOnce(resposta([entrada()], 25)).mockReturnValueOnce(antiga.promessa).mockResolvedValue(resposta([entrada(3)], 1));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    fireEvent.click(screen.getByRole("button", { name: "Mais filtros" }));
    await alterarControle(screen.getByLabelText("Eixo"), { target: { value: "SANIDADE" } });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await screen.findByText("Identificação 3");
    await act(async () => antiga.resolver(resposta([entrada(2)], 25)));
    expect(screen.queryByText("Identificação 2")).toBeNull();
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 1, eixo: "SANIDADE" }));
    expect(screen.getByText("1–1 de 1 registros")).toBeTruthy();
  });

  it("reconsulta a última página existente quando o total diminui entre páginas", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValueOnce(resposta([entrada()], 25))
      .mockResolvedValueOnce(resposta([], 15)).mockResolvedValueOnce(resposta([entrada(3)], 15));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await screen.findByText("Identificação 3");
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 1 }));
    await waitFor(() => expect(screen.getByText((_, elemento) => elemento?.tagName === "SPAN" && elemento.textContent === "1–15 de 15 registros")).toBeTruthy());
  });

  it("ignora consulta de outro animal e sítio após a troca de ficha", async () => {
    const antiga = pendente<ResultadoAuditoriaAnimal>();
    vi.mocked(buscarAuditoriaAnimal).mockReturnValueOnce(antiga.promessa).mockResolvedValue(resposta([entrada(2)]));
    const { rerender } = render(<AuditoriaAnimal id="animal-1" />);
    setPropriedadeAtiva(2); rerender(<AuditoriaAnimal id="animal-2" />);
    await screen.findByText("Identificação 2");
    await act(async () => antiga.resolver(resposta()));
    expect(screen.queryByText("Identificação 1")).toBeNull();
  });

  it("erro permite tentar novamente, sem afirmar ausência de registros", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockRejectedValueOnce(new Error("Consulta indisponível")).mockResolvedValue(resposta());
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByRole("alert");
    expect(screen.queryByText(/Nenhum registro de auditoria/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Identificação 1");
  });

  it("estado vazio conserva filtros para ampliar período e consultar novamente", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([]));
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText(/Nenhum registro de auditoria neste período/);
    expect(screen.getByLabelText("Período")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Próxima" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("mudança no token após escrita volta à página1", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([entrada()], 25));
    const { rerender } = render(<AuditoriaAnimal id="animal-1" recarregarToken={0} />);
    await screen.findByText("Identificação 1");
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 2 })));
    rerender(<AuditoriaAnimal id="animal-1" recarregarToken={1} />);
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ page: 1 })));
  });

  it("período personalizado impede intervalo invertido sem enviar ao servidor", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta());
    render(<AuditoriaAnimal id="animal-1" />);
    await screen.findByText("Identificação 1");
    await alterarControle(screen.getByLabelText("Período"), { target: { value: "personalizado" } });
    await alterarControle(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    await alterarControle(screen.getByLabelText("Até"), { target: { value: "2026-01-02" } });
    await waitFor(() => expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", expect.objectContaining({ inicio: new Date("2026-01-01T00:00:00").toISOString(), fim: new Date("2026-01-02T23:59:59.999").toISOString() })));
    const chamadas = vi.mocked(buscarAuditoriaAnimal).mock.calls.length;
    await alterarControle(screen.getByLabelText("De"), { target: { value: "2026-02-01" } });
    await screen.findByRole("alert");
    expect(buscarAuditoriaAnimal).toHaveBeenCalledTimes(chamadas);
  });
});

it("mantém data civil do fato e ordena correções do mesmo dia pelo instante", async () => {
  vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([
    { ...entrada(1), em: "2026-10-18T09:00:00.000Z", registro: "Correção cedo" },
    { ...entrada(2), em: "2026-10-18T15:00:00.000Z", registro: "Correção tarde" },
  ]));
  render(<AuditoriaAnimal id="animal-1" fatos={[{ id: "peso-p1", entidade: "Pesagem", entidadeId: "p1", eixo: "REBANHO", data: "2026-10-18", titulo: "Pesagem", detalhe: "310 kg", textoBusca: "310", Icone: Scale }]} />);
  await screen.findByText("Correção tarde");
  const linhas = within(screen.getByRole("table")).getAllByRole("row");
  expect(linhas[1].textContent).toContain("18/10/2026");
  expect(linhas[2].textContent).toContain("Correção tarde");
  expect(linhas[3].textContent).toContain("Correção cedo");
});
