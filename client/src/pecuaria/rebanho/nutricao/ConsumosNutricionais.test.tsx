// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConsumosNutricionais } from "./ConsumosNutricionais";
import * as api from "./api";
import { ontemConsumo } from "./datasConsumo";

vi.mock("./api", () => ({ listarFechamentos: vi.fn(), listarCentrosNutricionais: vi.fn(), consultarResumoMensal: vi.fn(), estornarConsumo: vi.fn() }));
vi.mock("../api", () => ({ listarLotes: vi.fn(async () => [{ id: "lote", nome: "Lote atual", propriedadeId: 2, propriedade: { nome: "Fazenda" }, ativo: true }]) }));
vi.mock("../../../components/MultiSelect", () => ({ MultiSelect: ({ label, value, onValueChange, options }: { label: string; value: string[]; onValueChange: (v: string[]) => void; options: Array<{ value: string; label: string }> }) => <label>{label}<select multiple value={value} onChange={(e) => onValueChange(Array.from(e.target.selectedOptions, (o) => o.value))}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label> }));
vi.mock("./ConferenciaPeriodos", () => ({ ConferenciaPeriodos: ({ diario, propriedadeId }: { diario: boolean; propriedadeId: number }) => <p>Prévia {diario ? "diária" : "por período"} na propriedade {propriedadeId}</p> }));
const fechamento = { id: "f1", inicio: "2026-09-01", fim: "2026-09-02", animalDias: 4, status: "CONFIRMADO", propriedadeId: 9, lote: { id: "historico", nome: "Lote histórico" }, verValores: false, custoConhecido: "123.45", coberturaCustoCompleta: true, centroCusto: { nome: "Centro" }, vigencia: { dieta: { nome: "Dieta anterior", versao: 1 } }, participacoes: [], itens: [{ produtoId: "p", quantidadePrevista: "4", quantidadeConfirmada: "5", unidade: "kg", situacaoCusto: "CONHECIDO", produto: { nome: "Milho" }, movimentoEstoque: { quantidade: "5", valorTotal: "123.45", custoUnitario: "24.69", alocacaoPartidaEstoques: [{ quantidade: "5", partida: { codigo: "PARTIDA-1", validade: null } }] } }] } satisfies api.Fechamento;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listarFechamentos).mockResolvedValue({ itens: [fechamento], total: 1, pagina: 1, limite: 25 });
  vi.mocked(api.listarCentrosNutricionais).mockResolvedValue([]);
  vi.mocked(api.consultarResumoMensal).mockResolvedValue({ mes: "2026-09", verValores: false, fechamentos: 1, animalDias: 4, custoConhecido: "123.45", coberturaCustoCompleta: true, itens: [{ produtoId: "p", nome: "Milho", unidade: "kg", quantidadeConfirmada: "5" }] });
  vi.mocked(api.estornarConsumo).mockResolvedValue({});
});
afterEach(cleanup);
describe("consumos nutricionais", () => {
  it("consulta histórico global sem lote e aplica filtros antes da paginação", async () => {
    render(<ConsumosNutricionais podeLancar={false} />);
    await screen.findAllByText("Dieta anterior · v1");
    expect(api.listarFechamentos).toHaveBeenCalledWith(undefined, 1);
    expect(screen.queryByText("Conferir novo consumo")).toBeNull();
    expect(screen.queryByText(/123,45/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "ESTORNADO" } });
    await waitFor(() => expect(api.listarFechamentos).toHaveBeenLastCalledWith(undefined, 1, { status: "ESTORNADO" }));
  });
  it("consolida mês sem criar consumo ou movimentar estoque", async () => {
    render(<ConsumosNutricionais loteId="historico" propriedadeId={9} podeLancar={false} />);
    await screen.findAllByText("Dieta anterior · v1");
    fireEvent.click(screen.getByText("Consolidação mensal"));
    await screen.findAllByText("5 kg");
    expect(api.consultarResumoMensal).toHaveBeenCalledWith(ontemConsumo().slice(0, 7), ["historico"]);
    expect(screen.getByText(/sem nova baixa/)).toBeTruthy();
    expect(screen.queryByText(/123,45/)).toBeNull();
    expect(api.estornarConsumo).not.toHaveBeenCalled();
  });
  it("conferencia em painel exige lote e permite alternar diária e período", async () => {
    render(<ConsumosNutricionais podeLancar />);
    await screen.findAllByText("Dieta anterior · v1");
    fireEvent.click(screen.getByText("Conferir novo consumo"));
    expect(screen.queryByText(/Prévia diária/)).toBeNull();
    fireEvent.change(screen.getByLabelText("Lote", { selector: "select" }), { target: { value: "lote" } });
    expect(screen.getByText("Prévia diária na propriedade 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Conferência"), { target: { value: "periodo" } });
    expect(screen.getByText("Prévia por período na propriedade 2")).toBeTruthy();
  });
  it("confere devoluções e estorna na propriedade histórica, preservando erro e motivo", async () => {
    vi.mocked(api.estornarConsumo).mockRejectedValueOnce(new Error("Estorno indisponível"));
    render(<ConsumosNutricionais podeLancar />);
    fireEvent.click((await screen.findAllByText("Conferir estorno"))[0]);
    expect(screen.getByText("Partida PARTIDA-1: 5 kg")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Motivo do estorno"), { target: { value: "Quantidade incorreta" } });
    fireEvent.submit(document.getElementById("form-estorno-consumo")!);
    await screen.findByText("Estorno indisponível");
    expect((screen.getByLabelText("Motivo do estorno") as HTMLTextAreaElement).value).toBe("Quantidade incorreta");
    fireEvent.submit(document.getElementById("form-estorno-consumo")!);
    await waitFor(() => expect(screen.queryByText("Conferir estorno do consumo")).toBeNull());
    expect(api.estornarConsumo).toHaveBeenLastCalledWith("f1", { propriedadeId: 9, motivo: "Quantidade incorreta" });
    expect(api.listarFechamentos).toHaveBeenCalledTimes(2);
  });
  it("calcula ontem nas viradas de mês, ano e ano bissexto", () => {
    expect(ontemConsumo("2026-01-01")).toBe("2025-12-31");
    expect(ontemConsumo("2024-03-01")).toBe("2024-02-29");
    expect(ontemConsumo("2026-03-01")).toBe("2026-02-28");
  });
});
