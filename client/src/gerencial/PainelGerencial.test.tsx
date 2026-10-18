// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consulta: vi.fn() }));
vi.mock("./api", async original => ({ ...await original<typeof import("./api")>(), consultarResumo: mocks.consulta }));
import { PainelGerencial } from "./PainelGerencial";
import type { ResumoGerencial } from "./api";
import { resumoGerencial, resumoRestrito } from "./PainelGerencial.fixtures";

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/gerencial?inicio=2026-10-01&fim=2026-10-17&propriedadeId=1");
});

describe("painel gerencial", () => {
  it("preserva o mascaramento monetário dos blocos e mantém acompanhamentos autorizados", async () => {
    mocks.consulta.mockResolvedValue(resumoRestrito());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByText(/2 acompanhamentos/);
    expect(screen.getAllByText("Sem permissão monetária").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.queryByText(/10,00|45,00|Sal mineral|Centro aberto/)).toBeNull();
  });

  it("falha de rede não aparece como total zero e permite tentar novamente", async () => {
    mocks.consulta.mockRejectedValueOnce(new Error("Conexão interrompida")).mockResolvedValue(resumoRestrito());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByText("Conexão interrompida");
    fireEvent.click(screen.getByText("Tentar novamente"));
    await screen.findByText(/2 acompanhamentos/);
    expect(mocks.consulta).toHaveBeenCalledTimes(2);
  });

  it("troca de sítio invalida a resposta antiga mesmo quando o transporte ignora o abort", async () => {
    let antiga!: (v: ResumoGerencial) => void;
    mocks.consulta.mockImplementationOnce(() => new Promise<ResumoGerencial>(resolve => { antiga = resolve; }))
      .mockResolvedValue({ ...resumoRestrito(), escopo: { propriedadeId: 2, sitios: [{ id: 2, nome: "Sítio B" }] } });
    const tela = render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    tela.rerender(<PainelGerencial propriedadeId={2} onPeriodo={() => {}} />);
    await screen.findByText(/Sítio B/);
    await act(async () => { antiga({ ...resumoRestrito(), escopo: { propriedadeId: 1, sitios: [{ id: 1, nome: "Resposta antiga" }] } }); });
    expect(screen.getByText(/Sítio B/)).toBeTruthy();
    expect(screen.queryByText(/Resposta antiga/)).toBeNull();
  });

  it("aplica o período da URL e publica alteração para a navegação", async () => {
    mocks.consulta.mockResolvedValue(resumoRestrito());
    const onPeriodo = vi.fn();
    render(<PainelGerencial propriedadeId={1} onPeriodo={onPeriodo} />);
    await waitFor(() => expect(mocks.consulta).toHaveBeenCalledWith("2026-10-01", "2026-10-17", expect.any(AbortSignal)));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-10-05" } });
    fireEvent.click(screen.getByText("Aplicar período"));
    expect(onPeriodo).toHaveBeenCalledWith({ inicio: "2026-10-05", fim: "2026-10-17" });
  });

  it("mostra os três gráficos com valores acessíveis e preserva os resumos", async () => {
    mocks.consulta.mockResolvedValue(resumoGerencial());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("heading", { name: "Quando vence o saldo a pagar" });
    expect(screen.getByRole("heading", { name: "Caixa no período" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ainda a pagar" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Recebido e pago por mês" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pagamentos por centro de custo" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nutrição registrada" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Custos diretos registrados" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Estoque atual em/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Pontos de atenção" })).toBeTruthy();
    const compromissos = screen.getByRole("region", { name: "Ainda a pagar" });
    expect(within(compromissos).getByText("R$ 45,00")).toBeTruthy();
    expect(within(compromissos).getByText("R$ 10,00")).toBeTruthy();
    expect(within(compromissos).getByText("R$ 35,00")).toBeTruthy();
    const caixa = screen.getByRole("table", { name: "Caixa por mês · * mês parcial" });
    expect(within(caixa).getByRole("row", { name: /2026/ })).toBeTruthy();
    expect(within(caixa).getAllByText("R$ 10,00")).toHaveLength(2);
    const centros = within(screen.getByRole("region", { name: "Pagamentos por centro de custo" })).getByLabelText("Pagamentos por centro de custo");
    expect(within(centros).getByText("Centro aberto A")).toBeTruthy();
    expect(within(centros).getByText("R$ 4,00")).toBeTruthy();
    const vencimentos = within(screen.getByRole("region", { name: "Quando vence o saldo a pagar" })).getByLabelText("Saldo a pagar por vencimento");
    expect(within(vencimentos).getByText("Vencido")).toBeTruthy();
    expect(within(vencimentos).getByText("Até 7 dias")).toBeTruthy();
    expect(within(vencimentos).getByText("De 8 a 30 dias")).toBeTruthy();
    expect(within(vencimentos).getAllByText("R$ 10,00").length).toBeGreaterThanOrEqual(1);
    expect(within(vencimentos).getByText("R$ 15,00")).toBeTruthy();
    expect(within(vencimentos).getByText("R$ 20,00")).toBeTruthy();
    expect(document.querySelector("details")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Seções do painel" })).toBeNull();
  });

  it("não converte estoque desconhecido em zero e mantém textos de estado parcial", async () => {
    const resumo = resumoGerencial();
    if (resumo.estoque.estado !== "DISPONIVEL") throw new Error("Fixture inválida");
    resumo.estoque.dados.valorConhecido = null;
    resumo.estoque.dados.situacao = "DESCONHECIDO";
    resumo.estoque.dados.gruposPendentes = 2;
    mocks.consulta.mockResolvedValue(resumo);
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    const estoque = await screen.findByRole("region", { name: /Estoque atual em/ });
    expect(within(estoque).getByText("Não apurado")).toBeTruthy();
    expect(within(estoque).queryByText("R$ 0,00")).toBeNull();
    expect(within(estoque).getByText(/parcial|pendente/i)).toBeTruthy();
  });

  it("mostra estados vazios dos três gráficos sem fabricar valores", async () => {
    const resumo = resumoGerencial();
    if (resumo.caixa.estado !== "DISPONIVEL" || resumo.compromissos.estado !== "DISPONIVEL") throw new Error("Fixture inválida");
    resumo.caixa.dados.mensal = [];
    resumo.caixa.dados.centros = [];
    resumo.compromissos.dados.faixas = [];
    mocks.consulta.mockResolvedValue(resumo);
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("heading", { name: "Quando vence o saldo a pagar" });
    expect(screen.getAllByText(/Sem (recebimentos|movimentos|saldo)/i).length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("R$ NaN")).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("mantém os destinos e o escopo dos links operacionais, sem filtro histórico em compromissos", async () => {
    mocks.consulta.mockResolvedValue(resumoGerencial());
    render(<PainelGerencial propriedadeId={1} onPeriodo={() => {}} />);
    await screen.findByRole("heading", { name: "Quando vence o saldo a pagar" });
    const link = (name: string, scope?: HTMLElement) => within(scope ?? document.body).getByRole("link", { name }).getAttribute("href")!;
    const caixa = screen.getByRole("region", { name: "Caixa no período" });
    const contas = new URL(link("Ver contas", caixa), location.origin);
    expect(contas.pathname).toBe("/financeiro/contas");
    expect(contas.searchParams.get("inicio")).toBe("2026-10-01");
    expect(contas.searchParams.get("fim")).toBe("2026-10-17");
    expect(contas.searchParams.get("propriedadeId")).toBe("1");
    const compromissos = new URL(link("Ver compromissos"), location.origin);
    expect(compromissos.pathname).toBe("/financeiro/compromissos");
    expect(compromissos.searchParams.get("situacao")).toBe("pagar");
    expect(compromissos.searchParams.get("propriedadeId")).toBe("1");
    expect(compromissos.searchParams.has("inicio")).toBe(false);
    expect(compromissos.searchParams.has("fim")).toBe(false);
    expect(new URL(link("Ver nutrição"), location.origin).searchParams.get("propriedadeId")).toBe("1");
    const estoque = new URL(link("Ver estoque"), location.origin);
    expect(estoque.pathname).toBe("/estoque");
    expect(estoque.searchParams.get("propriedadeId")).toBe("1");
    expect(estoque.searchParams.has("inicio")).toBe(false);
    expect(estoque.searchParams.has("fim")).toBe(false);
    expect(new URL(link("Ver reprodução"), location.origin).searchParams.get("propriedadeId")).toBe("1");
  });
});
