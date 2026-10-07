// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GerenciarProcedimentosServico } from "./GerenciarProcedimentosServico";
import { ProcedimentosAtendimento } from "../../../financeiro/ProcedimentosAtendimento";
import { SanidadeApiError } from "./api";
import type { ConsultaProcedimentosServico, ProcedimentoServico } from "../../../financeiro/novo-api";
const { listar, confirmar, usuario } = vi.hoisted(() => ({ listar: vi.fn(), confirmar: vi.fn(), usuario: vi.fn() }));
vi.mock("../../../financeiro/novo-api", async (original) => ({ ...await original<typeof import("../../../financeiro/novo-api")>(), listarProcedimentosServico: listar, confirmarProcedimentosServico: confirmar }));
vi.mock("../../../lib/auth", () => ({ getUsuario: usuario }));
const item = (patch: Partial<ProcedimentoServico> = {}): ProcedimentoServico => ({ id: "fato-a", tipo: "EXAME", animalId: "animal-a", animal: { id: "animal-a", brinco: "GV3-1", nome: "Bela" }, propriedade: { id: 1, nome: "Principal" }, nome: "Exame histórico", dataHora: "2026-10-01T00:00:00.000Z", status: "VALIDO", origem: "MANUAL", valor: "25", vinculado: true, podeEditar: true, execucaoId: null, operacaoServicoId: "op-a", ...patch });
const dados = (itens = [item()]): ConsultaProcedimentosServico => ({ servico: { id: "op-a", numero: 1, descricao: "Atendimento veterinário", status: "CONFIRMADA", propriedadeId: 1, propriedade: { id: 1, nome: "Principal" }, data: "2026-10-01", valorConfirmado: "100", totalAtribuido: "25", disponivel: "75" }, itens, total: itens.length, pagina: 1, limite: 20, paginas: 1 });
beforeEach(() => { usuario.mockReturnValue(null); listar.mockResolvedValue(dados()); confirmar.mockResolvedValue({ servicoId: "op-a", quantidade: 1, salvo: true }); });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function montar(onSalvo?: () => Promise<void>) { return render(<GerenciarProcedimentosServico servicoId="op-a" propriedadeId={1} onFechar={vi.fn()} onSalvo={onSalvo} />); }
async function selecionar() { fireEvent.click(await screen.findByRole("checkbox", { name: "Selecionar Exame histórico · GV3-1" })); fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Conferir atendimento realizado" } }); }
async function enviar() { fireEvent.click(screen.getByRole("button", { name: "Confirmar procedimentos" })); }
describe("gerenciar procedimentos de Serviço", () => {
  it("mostra brinco/nome, data correta de coleta, sítio e links exatos sem UUID aparente", async () => {
    montar(); await screen.findByText("Exame · Exame histórico");
    expect(screen.getByText(/GV3-1 · Bela · 01\/10\/2026/)).toBeTruthy();
    expect(screen.queryByText(/30\/09\/2026/)).toBeNull();
    expect(screen.getByRole("link", { name: "Ver procedimento" }).getAttribute("href")).toContain("detalheTipo=exame&detalheId=fato-a");
    expect(screen.queryByText("animal-a")).toBeNull();
  });
  it("sem valores pode vincular e omite a atribuição existente no POST", async () => {
    usuario.mockReturnValue({ areas: ["pecuaria", "financeiro"], flags: ["lancar"], dono: false });
    montar(); await selecionar(); expect(screen.queryByLabelText("Valor individual (R$)")).toBeNull(); expect(screen.queryByText(/R\$/)).toBeNull();
    await enviar(); await screen.findByText("Procedimentos salvos");
    expect(confirmar.mock.calls[0][1].itens).toEqual([{ id: "fato-a", tipo: "EXAME" }]);
  });
  it("apagar valor envia null e successcard informa o procedimento salvo", async () => {
    montar(); await selecionar(); fireEvent.change(screen.getByLabelText("Valor individual (R$)"), { target: { value: "" } });
    await enviar(); await screen.findByText("Procedimentos salvos");
    expect(confirmar.mock.calls[0][1].itens[0]).toEqual({ id: "fato-a", tipo: "EXAME", valor: null });
    expect(screen.getByText("GV3-1 · Exame histórico · Sem valor individual")).toBeTruthy(); expect(screen.queryByRole("checkbox")).toBeNull();
  });
  it("falha na atualização após sucesso informa salvo e não oferece reenviar", async () => {
    montar(async () => { throw new Error("Consulta indisponível"); }); await selecionar(); await enviar();
    await screen.findByText("Salvo. A consulta não atualizou; feche e abra novamente para conferir.");
    expect(screen.queryByRole("button", { name: "Confirmar procedimentos" })).toBeNull(); expect(confirmar).toHaveBeenCalledTimes(1);
  });
  it("reenvio após falha reutiliza chave e mostra erro junto ao valor e no rodapé", async () => {
    confirmar.mockRejectedValueOnce(new SanidadeApiError("Valor acima do atendimento", "CONFLITO", "itens.0.valor"));
    montar(); await selecionar(); await enviar(); await waitFor(() => expect(screen.getAllByText("Valor acima do atendimento").length).toBeGreaterThan(1));
    expect(screen.getByLabelText("Valor individual (R$)").getAttribute("aria-invalid")).toBe("true");
    const chave = confirmar.mock.calls[0][1].chaveIdempotencia;
    await enviar(); await screen.findByText("Procedimentos salvos"); expect(confirmar.mock.calls[1][1].chaveIdempotencia).toBe(chave);
  });
  it("anulados só aparecem no histórico e a consulta filtra antes da paginação", async () => {
    listar.mockResolvedValue(dados([item({ status: "ANULADO", podeEditar: false })])); montar();
    expect((await screen.findByRole("checkbox")).hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText("Animal"), { target: { value: "GV3" } });
    await waitFor(() => expect(listar.mock.calls.at(-1)?.[2]).toMatchObject({ animalBusca: "GV3", pagina: 1 }));
  });
  it("resposta antiga não substitui a consulta do filtro atual", async () => {
    let resolver!: (valor: ConsultaProcedimentosServico) => void;
    listar.mockResolvedValueOnce(dados()).mockImplementationOnce(() => new Promise<ConsultaProcedimentosServico>((r) => { resolver = r; })).mockResolvedValueOnce(dados([item({ nome: "Atual" })]));
    montar(); await screen.findByText("Exame · Exame histórico");
    fireEvent.change(screen.getByLabelText("Animal"), { target: { value: "antigo" } }); await waitFor(() => expect(listar).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText("Animal"), { target: { value: "novo" } }); await screen.findByText("Exame · Atual");
    await act(async () => resolver(dados([item({ nome: "Antigo" })]))); expect(screen.queryByText("Exame · Antigo")).toBeNull();
  });
  it("detalhe financeiro usa R$ simples e conserva anulado com links exatos", () => {
    render(<ProcedimentosAtendimento itens={[item({ status: "ANULADO", podeEditar: false })]} />);
    expect(screen.getByText(/Principal · Coleta de exame · Anulado/)).toBeTruthy();
    expect(screen.queryByText(/rateio/i)).toBeNull(); expect(screen.queryByText(/Válido/)).toBeNull();
    expect(screen.getByRole("link", { name: "Ver procedimento" }).getAttribute("href")).toContain("detalheId=fato-a");
  });
});
