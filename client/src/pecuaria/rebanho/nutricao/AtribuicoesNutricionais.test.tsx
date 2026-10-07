// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AtribuicoesNutricionais } from "./AtribuicoesNutricionais";
import * as api from "./api";
vi.mock("./api", async (original) => ({ ...await original<typeof import("./api")>(), listarDietas: vi.fn(), listarVigencias: vi.fn(), atribuirDieta: vi.fn(), previaCorrecaoVigencia: vi.fn(), previaAnulacaoVigencia: vi.fn(), corrigirVigencia: vi.fn(), anularVigencia: vi.fn() }));
vi.mock("../api", () => ({ listarLotes: vi.fn().mockResolvedValue([{ id: "lote", nome: "Recria", ativo: true, propriedadeId: 2, propriedade: { nome: "Sítio B" } }]) }));
vi.mock("../../../components/DatePicker", () => ({ DatePicker: ({ value, onChange, ...props }: { value: string; onChange: (v: string) => void }) => <input {...props} type="date" value={value} onChange={(e) => onChange(e.target.value)} /> }));
const vigencia: api.Vigencia = { id: "v1", propriedadeId: 2, status: "VALIDO", desde: "2026-09-01", ate: null, lote: { id: "lote", nome: "Recria", propriedadeId: 2 }, dieta: { id: "d1", nome: "Dieta recria", versao: 1 } };
const previa: api.PreviaVigencia = { original: vigencia, proposta: { desde: "2026-09-02", dietaId: "d2" }, anterior: null, fechamentosAfetados: [], bloqueada: false, revisao: "revisao-1" };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.listarVigencias).mockResolvedValue({ itens: [vigencia], total: 1, pagina: 1, limite: 25, vigente: vigencia, programada: null }); vi.mocked(api.listarDietas).mockResolvedValue([{ id: "d1", nome: "Dieta recria", versao: 1, publicadaEm: "2026-08-01", itens: [] }, { id: "d2", nome: "Dieta crescimento", versao: 1, publicadaEm: "2026-08-01", itens: [] }]); vi.mocked(api.previaCorrecaoVigencia).mockResolvedValue(previa); vi.mocked(api.previaAnulacaoVigencia).mockResolvedValue(previa); });
afterEach(cleanup);
describe("atribuições nutricionais", () => {
  it("lista histórico global sem selecionar lote", async () => {
    render(<AtribuicoesNutricionais podeLancar={false} />);
    await screen.findAllByText("Dieta recria · v1");
    expect(api.listarVigencias).toHaveBeenCalledWith(undefined, 1);
    expect(screen.queryByRole("button", { name: "Corrigir vigência" })).toBeNull();
  });
  it("exige prévia humana com dieta, início e revisão antes de corrigir", async () => {
    render(<AtribuicoesNutricionais podeLancar />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Corrigir vigência" }))[0]);
    fireEvent.change(screen.getByLabelText("Versão publicada"), { target: { value: "d2" } });
    fireEvent.change(screen.getByLabelText("Início da vigência"), { target: { value: "2026-09-02" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Correção conferida no caderno" } });
    fireEvent.submit(document.getElementById("form-atribuicao")!);
    await screen.findByText("Confira a alteração");
    expect(api.corrigirVigencia).not.toHaveBeenCalled();
    fireEvent.submit(document.getElementById("form-atribuicao")!);
    await waitFor(() => expect(api.corrigirVigencia).toHaveBeenCalledWith("v1", { propriedadeId: 2, dietaId: "d2", desde: "2026-09-02", motivo: "Correção conferida no caderno", revisao: "revisao-1" }));
  });
  it("bloqueia alteração que afetaria consumo confirmado e mantém link do fato", async () => {
    vi.mocked(api.previaAnulacaoVigencia).mockResolvedValue({ ...previa, bloqueada: true, fechamentosAfetados: [{ id: "f1", inicio: "2026-09-01", fim: "2026-09-02" }] });
    render(<AtribuicoesNutricionais podeLancar />);
    fireEvent.click((await screen.findAllByRole("button", { name: "Anular com motivo" }))[0]);
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Atribuição incorreta no caderno" } });
    fireEvent.submit(document.getElementById("form-atribuicao")!);
    await screen.findByText("Alteração bloqueada pelos consumos confirmados.");
    expect(api.previaAnulacaoVigencia).toHaveBeenCalledWith("v1", { propriedadeId: 2, motivo: "Atribuição incorreta no caderno" });
    expect(screen.getByRole("button", { name: "Confirmar com motivo" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("link", { name: "01/09/2026 – 02/09/2026" }).getAttribute("href")).toContain("fechamentoId=f1");
    expect(api.anularVigencia).not.toHaveBeenCalled();
  });
});
