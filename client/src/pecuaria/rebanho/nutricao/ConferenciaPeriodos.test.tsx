// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConferenciaPeriodos } from "./ConferenciaPeriodos";
import { previaPeriodos, confirmarPeriodos, type Previa } from "./api";
vi.mock("./api", () => ({ previaPeriodos: vi.fn(), confirmarPeriodos: vi.fn() }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => <input type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
vi.mock("../../../estoque/SelecaoPartidas", () => ({ SelecaoPartidas: () => <p>Distribuição por partida</p> }));
const previa: Previa = { loteId: "lote", vigenciaId: "vigencia", inicio: "2026-09-01", fim: "2026-09-10", centroCustoId: "centro", dieta: { nome: "Dieta V3", versao: 1 }, animalDias: 110, participantes: [{ animalId: "animal", brinco: "RN01", dias: 10 }], materiaSecaConhecidaKg: "297", coberturaMateriaSecaCompleta: false, itens: [{ produtoId: "produto", nome: "Ração V3", unidade: "KG", quantidadePrevista: "330", saldo: "400", materiaSecaKg: "297", custoPrevisto: null, rastrearPartidas: false }] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [previa], lacunas: [] }); vi.mocked(confirmarPeriodos).mockResolvedValue({}); });
afterEach(cleanup);
describe("conferência nutricional dividida", () => {
  it("atualiza MS e custo conferidos quando a quantidade e a origem mudam", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [{ ...previa, itens: [{ ...previa.itens[0], custoPrevisto: "660" }] }], lacunas: [] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText("Ração V3: previsto 330 KG");
    fireEvent.change(screen.getByLabelText("Quantidade conferida (KG)"), { target: { value: "320" } });
    expect(screen.getByText(/MS conferida conhecida ≈ 288.000 kg/)).toBeTruthy();
    expect(screen.getByText(/Custo conferido estimado: ≈ R\$\s640,00/)).toBeTruthy();
    expect(screen.getByText(/custo previsto R\$\s660/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Origem"), { target: { value: "SEM_BAIXA_JUSTIFICADA" } });
    expect(screen.getByText(/Custo conferido estimado: não apurado/)).toBeTruthy();
  });
  it("mostra previsão, participantes e cobertura incompleta; exige motivo até para consumo zero", async () => {
    const onSalvo = vi.fn().mockResolvedValue(undefined);
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={onSalvo} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText("Ração V3: previsto 330 KG");
    expect(screen.getByText(/110 animal-dias/)).toBeTruthy();
    expect(screen.getByText(/cobertura incompleta/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Quantidade conferida (KG)"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Confirmar conjunto conferido"));
    await screen.findByText(/justifique a diferença/);
    expect(confirmarPeriodos).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Motivo da diferença"), { target: { value: "Consumo real conferido em zero" } });
    fireEvent.click(screen.getByText("Confirmar conjunto conferido"));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledOnce());
    expect(confirmarPeriodos).toHaveBeenCalledWith(expect.objectContaining({ chave: expect.any(String), revisao: "r".repeat(64), periodos: [expect.objectContaining({ inicio: "2026-09-01", fim: "2026-09-10", itens: [expect.objectContaining({ quantidadeConfirmada: 0, motivoAjuste: "Consumo real conferido em zero" })] })] }));
  });
  it("informa lacuna sem dieta e bloqueia a confirmação do conjunto", async () => {
    vi.mocked(previaPeriodos).mockResolvedValue({ revisao: "r".repeat(64), periodos: [previa], lacunas: [{ inicio: "2026-08-30", fim: "2026-08-31" }] });
    render(<ConferenciaPeriodos loteId="lote" propriedadeId={1} centros={[]} onSalvo={vi.fn()} />);
    fireEvent.click(screen.getByText("Conferir período"));
    await screen.findByText(/Sem dieta de 30\/08\/2026/);
    expect(screen.getByText("Confirmar conjunto conferido").hasAttribute("disabled")).toBe(true);
    expect(confirmarPeriodos).not.toHaveBeenCalled();
  });
});
