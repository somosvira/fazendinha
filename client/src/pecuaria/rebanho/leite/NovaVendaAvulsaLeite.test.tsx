// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NovaVendaAvulsaLeite } from "./NovaVendaAvulsaLeite";
import { consultarLeite,registrarLeite } from "./operacoes-api";
import type { ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
vi.mock("./operacoes-api", () => ({consultarLeite:vi.fn(),registrarLeite:vi.fn()}));
const config: ConfiguracoesFinanceiras={parceiros:[{id:"p",nome:"Comprador",ativo:true,documento:null,tipo:"CLIENTE",telefone:null,email:null,referencias:0}],contas:[],categorias:[],centrosCusto:[],produtos:[]};
afterEach(() => {cleanup();vi.resetAllMocks();});
async function escolher(label: string, opcao: string) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  fireEvent.keyDown(screen.getByLabelText(label), {key:"ArrowDown"});
  fireEvent.click(await screen.findByRole("option", {name:opcao}));
}
it("registra avulsa pelo executor existente com retirada e parcela únicas", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({comercial:{confiavel:true,quantidadeLitros:"100",motivoNaoAferivel:null}});
  vi.mocked(registrarLeite).mockResolvedValue({});const onSalvar=vi.fn();
  render(<NovaVendaAvulsaLeite sitio={2} config={config} produtos={[{id:"leite",nome:"Leite"}]} onSalvar={onSalvar} onCancelar={vi.fn()} />);
  await escolher("Produto de leite", "Leite");
  await escolher("Comprador", "Comprador");
  fireEvent.change(screen.getByLabelText("Data da retirada"),{target:{value:"2026-10-01"}});
  fireEvent.change(screen.getByLabelText("Litros retirados"),{target:{value:"10,5"}});
  fireEvent.change(screen.getByLabelText("Valor total acordado (R$)"),{target:{value:"25,00"}});
  fireEvent.change(screen.getByLabelText("Vencimento"),{target:{value:"2026-11-01"}});
  await screen.findByText("Disponível para venda: 100 L.");fireEvent.click(screen.getByRole("button",{name:"Confirmar retirada e venda"}));
  await vi.waitFor(() => expect(registrarLeite).toHaveBeenCalledWith("/estoque/vendas",2,{produtoId:"leite",data:"2026-10-01",quantidadeLitros:10.5,descricao:"Retirada de leite",parceiroId:"p",valorTotal:25,financeiro:{condicao:"A_PRAZO",parcelas:[{valor:25,dataVencimento:"2026-11-01"}]}}));
  expect(onSalvar).toHaveBeenCalledOnce();
});
it("mantém confirmação indisponível enquanto saldo comercial não é confiável", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({comercial:{confiavel:false,quantidadeLitros:null,motivoNaoAferivel:"Origem pendente"}});
  render(<NovaVendaAvulsaLeite sitio={2} config={config} produtos={[{id:"leite",nome:"Leite"}]} onSalvar={vi.fn()} onCancelar={vi.fn()} />);
  await escolher("Produto de leite", "Leite");await screen.findByText("Origem pendente");
  expect((screen.getByRole("button",{name:"Confirmar retirada e venda"}) as HTMLButtonElement).disabled).toBe(true);expect(registrarLeite).not.toHaveBeenCalled();
});
