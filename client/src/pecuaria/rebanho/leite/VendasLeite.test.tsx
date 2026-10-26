// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { VendasLeite } from "./VendasLeite";
import { consultarLeite } from "./operacoes-api";
import { obterConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn(), registrarLeite: vi.fn() }));
vi.mock("../../../financeiro/novo-api", () => ({ obterConfiguracoesFinanceiras: vi.fn() }));
vi.mock("../../../propriedadeScope", () => ({ getPropriedadeAtiva: () => 2 }));
vi.mock("./OperacoesComerciaisLeite", () => ({ OperacoesComerciaisLeite: ({ operacaoId }: {operacaoId?: string}) => <p>Detalhe {operacaoId}</p> }));
vi.mock("./HistoricoVendasLeite", () => ({ HistoricoVendasLeite: () => <p>Histórico de versões</p> }));
const itens = [
  {id:"aberta",modalidade:"PERIODO",comercialId:"aberta",operacaoId:null,referencia:"Outubro aberto",inicio:"2026-10-01",fim:"2026-10-31",data:"2026-10-01",parceiroId:"p",parceiroNome:"Laticínio",quantidadeLitros:"200",valorTotal:null,situacao:"ABERTA",versaoComercial:null},
  {id:"fechada",modalidade:"PERIODO",comercialId:"fechada",operacaoId:"fin",referencia:"Outubro fechado",inicio:"2026-10-01",fim:"2026-10-15",data:"2026-10-15",parceiroId:"p",parceiroNome:"Laticínio",quantidadeLitros:"300",valorTotal:null,situacao:"FECHADA",versaoComercial:1},
  {id:"avulsa",modalidade:"AVULSA",comercialId:null,operacaoId:"avulsa-fin",referencia:"Venda #7",inicio:"2026-10-05",fim:"2026-10-05",data:"2026-10-05",parceiroId:"p",parceiroNome:"Laticínio",quantidadeLitros:"10",valorTotal:null,situacao:"CANCELADA",versaoComercial:2},
];
beforeEach(() => {
  history.replaceState(null,"","/?leiteSecao=vendas&vendasDe=2026-10-01&vendasAte=2026-10-31");
  vi.mocked(consultarLeite).mockImplementation(async path => path.includes("cadastros") ? {parceiros:[{id:"p",nome:"Laticínio"}],produtos:[]} : {propriedadeId:2,itens,total:3,pagina:1,porPagina:20,resumo:{totalLitros:"500",valorTotal:null,vendas:3,precoPendente:1}});
});
afterEach(() => { cleanup(); vi.resetAllMocks(); history.replaceState(null,"","/"); });
it("reúne períodos abertos, fechados e avulsa cancelada sem consultar dinheiro", async () => {
  render(<VendasLeite podeLancar={false} podeFinanceiro={false} />);
  await screen.findAllByText("Outubro aberto");
  expect(screen.getAllByText("Outubro fechado")[0]).toBeTruthy(); expect(screen.getAllByText("Venda #7")[0]).toBeTruthy(); expect(screen.getAllByText("Cancelada")[0]).toBeTruthy();
  expect(obterConfiguracoesFinanceiras).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"Venda avulsa"})).toBeNull();
  fireEvent.click(screen.getAllByRole("button",{name:"Abrir operação"})[2]);
  expect(await screen.findByText("Valores e correções comerciais exigem acesso ao Financeiro.")).toBeTruthy();
  expect(vi.mocked(consultarLeite).mock.calls.some(([p]) => p.includes("/estoque/vendas"))).toBe(false);
});
it("descarta rascunho de filtros ao cancelar e aplica somente ao confirmar", async () => {
  render(<VendasLeite podeLancar={false} podeFinanceiro={false} />); await screen.findAllByText("Outubro aberto");
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.click(screen.getByRole("button",{name:"Filtros"}));
  fireEvent.change(screen.getByLabelText("Desde"),{target:{value:"2026-09-01"}});
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  fireEvent.click(screen.getByRole("button",{name:"Filtros"}));
  expect((screen.getByLabelText("Desde") as HTMLInputElement).value).toBe("2026-10-01");
  fireEvent.change(screen.getByLabelText("Desde"),{target:{value:"2026-09-01"}});
  fireEvent.click(screen.getByRole("button",{name:"Aplicar filtros"}));
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("de=2026-09-01"),2));
});
it("reabre operação indicada pelo alias de URL sem exigir que esteja na página", async () => {
  history.replaceState(null,"","/?leiteSecao=operacoes&operacaoLeiteId=fora&operacoesDe=2026-09-01&operacoesAte=2026-09-30");
  render(<VendasLeite podeLancar={false} podeFinanceiro={false} />);
  expect(await screen.findByText("Detalhe fora")).toBeTruthy();
  await waitFor(() => expect(consultarLeite).toHaveBeenCalledWith(expect.stringContaining("de=2026-09-01&ate=2026-09-30"),2));
});
