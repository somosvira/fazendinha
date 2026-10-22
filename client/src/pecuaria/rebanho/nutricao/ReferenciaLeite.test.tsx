// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReferenciaLeite } from "./ReferenciaLeite";
import { listarReferenciasLeite, revisarReferenciaLeite, type FornecimentoLeiteNutricional } from "./api";
vi.mock("./api", () => ({ listarReferenciasLeite: vi.fn(), revisarReferenciaLeite: vi.fn() }));
const referencia = {id:"r1",versao:1,fechamentoId:"anterior",precoUnitario:"2.5000",valorTotal:"150.00",provisoria:true,periodoInicio:"2026-09-01",periodoFim:"2026-09-30",motivo:"Preço anterior provisório",criadoEm:"2026-10-01",criadoPorId:1};
const leite: FornecimentoLeiteNutricional = {id:"f",status:"CONFIRMADO",quantidadeLitros:"60.000",custoProducao:"84.00",referencia,referencias:[referencia],movimentos:[{movimentoId:"nc",entradaId:"nc",natureza:"NAO_COMERCIAL",quantidadeLitros:"40.000"},{movimentoId:"com",entradaId:"com",natureza:"COMERCIAL",quantidadeLitros:"20.000"}],parcelas:[{animalId:"a",dias:1,baseQuantidade:"ATRIBUIDA",quantidadeLitros:"60.000",valorGerencial:"150.00"}]};
const props = {leite,propriedadeId:1,verValores:true,verReferenciasComerciais:true,animais:[{animalId:"a",brinco:"B01"}],podeLancar:true};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(listarReferenciasLeite).mockResolvedValue({itens:[]});vi.mocked(revisarReferenciaLeite).mockResolvedValue({});});
afterEach(cleanup);
describe("leite da dieta e referência",()=>{
 it("mostra 60 L, custo84 e referência150 separados, sem fabricar gasto234",()=>{
  render(<ReferenciaLeite {...props}/>);
  expect(screen.getByText(/60 L fornecidos/)).toBeTruthy();expect(screen.getByText(/40 L não comerciais \+ 20 L comerciais/)).toBeTruthy();
  expect(screen.getByText(/Custo de produção:/)).toBeTruthy();expect(screen.getByText(/R\$\s*84,00/)).toBeTruthy();expect(screen.getAllByText(/R\$\s*150,00/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/234/)).toBeNull();expect(screen.getByText(/Animal B01: 60 L atribuídos/)).toBeTruthy();
 });
 it("preserva litros e custo operacional sem exibir preço ou comando ao leitor sem gate financeiro",()=>{
  render(<ReferenciaLeite {...props} verReferenciasComerciais={false}/>);
  expect(screen.getByText(/60 L fornecidos/)).toBeTruthy();expect(screen.getByText(/R\$\s*84,00/)).toBeTruthy();expect(screen.queryByText(/150/)).toBeNull();expect(screen.queryByText("Conferir preço de referência")).toBeNull();
 });
 it("sem fonte informa pendência, sem zero fictício",()=>{
  render(<ReferenciaLeite {...props} leite={{...leite,referencia:null,referencias:[],custoProducao:null}}/>);
  expect(screen.getByText("Pendente — sem preço comprovado")).toBeTruthy();expect(screen.queryByText(/R\$\s*0,00/)).toBeNull();
 });
 it("revisão exige escolha explícita e motivo, mantém chave no retry e envia versão conferida",async()=>{
  vi.mocked(listarReferenciasLeite).mockResolvedValue({itens:[{fechamentoId:"outubro",versao:1,comprador:"Comprador",periodoInicio:"2026-10-01",periodoFim:"2026-10-31",precoUnitario:"2.70",provisoria:false}]});
  const recarregar=vi.fn().mockResolvedValue(undefined);render(<ReferenciaLeite {...props} onRecarregar={recarregar}/>);
  fireEvent.click(screen.getByText("Conferir preço de referência"));await screen.findByLabelText("Fechamento usado como referência");
  expect(screen.getByLabelText("Fechamento usado como referência")).toHaveProperty("value","");
  fireEvent.change(screen.getByLabelText("Fechamento usado como referência"),{target:{value:"outubro"}});fireEvent.change(screen.getByLabelText("Motivo da referência ou revisão"),{target:{value:"Fechamento do período concluído"}});
  fireEvent.click(screen.getByText("Confirmar referência"));await waitFor(()=>expect(recarregar).toHaveBeenCalledOnce());
  expect(revisarReferenciaLeite).toHaveBeenCalledWith("f",expect.objectContaining({chave:expect.any(String),propriedadeId:1,fechamentoId:"outubro",versaoEsperada:1,motivo:"Fechamento do período concluído"}));
 });
});
