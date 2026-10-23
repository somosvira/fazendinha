// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AjusteIndividualAplicacao, type AjusteEtapaAplicacao } from "./AjusteIndividualAplicacao";
import { alterarControle } from "../../../lib/controles.fixture";
vi.mock("../nutricao/api",()=>({listarPartidasNutricionais:vi.fn().mockResolvedValue([])}));
afterEach(cleanup);
function Excecao() {
  const [ajuste,setAjuste]=useState<AjusteEtapaAplicacao>({});
  return <><AjusteIndividualAplicacao brinco="RN01" ajuste={ajuste} comum={{propriedadeId:1,data:"2026-10-01",hora:"10:00",produtoId:"",tipoAplicacaoId:"tipo",unidadeDose:"ML",via:"",responsavel:"",partidaId:"",origemInsumo:"BAIXA_ESTOQUE",estadoCarenciaLeite:"NAO_INFORMADO",estadoCarenciaCarne:"NAO_INFORMADO",carenciaLeiteHoras:null,carenciaCarneHoras:null}} produtos={[]} tipos={[]} compras={[{id:"compra",produtoId:"produto",disponivel:"10",unidade:"ML",produto:{nome:"Medicamento da compra"},operacao:{numero:1,data:"2026-10-01"}}]} servicos={[{id:"servico",numero:2,data:"2026-10-01",descricao:"Atendimento",parceiro:null}]} onChange={p=>setAjuste(v=>({...v,...p}))}/><output>{JSON.stringify(ajuste)}</output></>;
}
describe("exceção de origem por animal",()=>{
  it("permite Serviço, compra direta e justificativa sem reutilizar vínculos incompatíveis",async()=>{
    render(<Excecao/>);
    await alterarControle(screen.getByLabelText("Origem individual"),{target:{value:"INCLUSO_SERVICO"}});
    await alterarControle(screen.getByLabelText(/Serviço individual/),{target:{value:"servico"}});
    expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({origemInsumo:"INCLUSO_SERVICO",operacaoServicoId:"servico"});
    await alterarControle(screen.getByLabelText("Origem individual"),{target:{value:"COMPRA_CONSUMO_DIRETO"}});
    await alterarControle(screen.getByLabelText("Compra direta individual"),{target:{value:"compra"}});
    expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({origemInsumo:"COMPRA_CONSUMO_DIRETO",itemCompraDiretaId:"compra",produtoId:"produto",nomeProdutoAplicado:"Medicamento da compra",operacaoServicoId:""});
    await alterarControle(screen.getByLabelText("Origem individual"),{target:{value:"SEM_ORIGEM_JUSTIFICADA"}});
    fireEvent.change(screen.getByLabelText("Justificativa da origem individual"),{target:{value:"Fato documentado pelo responsável"}});
    expect(JSON.parse(screen.getByRole("status").textContent!)).toMatchObject({origemInsumo:"SEM_ORIGEM_JUSTIFICADA",itemCompraDiretaId:"",operacaoServicoId:"",justificativaSemOrigem:"Fato documentado pelo responsável"});
  });
  it("apagar a hora individual conserva precisão DIA em vez de restaurar a hora comum",()=>{
    render(<Excecao/>);
    expect(screen.getByLabelText("Hora individual")).toHaveProperty("value","10:00");
    fireEvent.change(screen.getByLabelText("Hora individual"),{target:{value:""}});
    expect(screen.getByLabelText("Hora individual")).toHaveProperty("value","");
    expect(JSON.parse(screen.getByRole("status").textContent!)).not.toHaveProperty("aplicadaEm");
  });

});
