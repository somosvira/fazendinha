// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LeiteModulo } from "./LeiteModulo";

const {escopoModulo}=vi.hoisted(()=>({escopoModulo:{id:1 as number|null}}));
vi.mock("../../../propriedadeScope", () => ({getPropriedadeAtiva:()=>escopoModulo.id}));
vi.mock("../../../api/propriedades",()=>({listarPropriedades:vi.fn(async()=>[{id:7,nome:"Principal",principal:true,ativo:true}])}));
vi.mock("./Leite", () => ({ Leite: () => <h1>Folha de ordenha</h1> }));
vi.mock("./ConsultasProducaoLeite", () => ({
  ConsultasProducaoLeite: ({ podeExportar }: { podeExportar: boolean }) =>
    <h1>Consulta de produção {podeExportar ? "com exportação" : "sem exportação"}</h1>,
}));
vi.mock("./ConsultasComerciaisLeite", () => ({ ConsultasComerciaisLeite: ({ tipo }: { tipo: string }) => <h1>Consulta independente de {tipo}</h1> }));
vi.mock("./ConfiguracoesProducaoLeite", () => ({ ConfiguracoesProducaoLeite: () => <h1>Configuração do leite</h1> }));
vi.mock("./VendasLeite", () => ({ VendasLeite: () => <h1>Vendas unificadas do leite</h1> }));
vi.mock("./EstoqueLeite", () => ({ EstoqueLeite: () => null }));
vi.mock("./OperacoesComerciaisLeite", () => ({ OperacoesComerciaisLeite: () => <h1>Operações por comprador e período</h1> }));
vi.mock("./ComercialLeite", () => ({ ComercialLeite: () => <h1>Entregas anteriores</h1> }));
vi.mock("./QualidadeLeite", () => ({ QualidadeLeite: () => <h1>Consulta de qualidade</h1> }));
vi.mock("./CustosLeite", () => ({ CustosLeite: () => null }));
vi.mock("./RelatoriosLeite", () => ({ RelatoriosLeite: () => null }));
vi.mock("./UIProgramacaoRetirada", () => ({ ProgramacaoRetirada: () => null }));
vi.mock("./DescarteLeite", () => ({ DescarteLeite: () => null }));
vi.mock("./UIDestinosLeite", () => ({ DestinosLeite: () => null }));
vi.mock("./PreviaHistoricaLeite", () => ({ PreviaHistoricaLeite: () => null }));

beforeEach(() => {escopoModulo.id=1;history.replaceState(null, "", "/pecuaria/leite?leiteSecao=producao&producaoVisao=mes&producaoData=2026-10-01");});
afterEach(cleanup);

describe("Consultas independentes no módulo Leite", () => {
  it("mantém alimentação entre as consultas e conserva o recorte ao navegar", async () => {
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    const nav = screen.getByRole("navigation", { name: "Produção de leite" });
    expect(within(nav).getByRole("tab", { name: "Alimentação e descarte" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mais rotinas" })).toBeNull();
    fireEvent.click(within(nav).getByRole("tab", { name: "Vendas" }));
    expect(screen.getByRole("heading", { name: "Vendas unificadas do leite" })).toBeTruthy();
    expect(new URLSearchParams(location.search).get("producaoData")).toBe("2026-10-01");
    expect(new URLSearchParams(location.search).get("leiteSecao")).toBe("vendas");
  });
  it("abre produção diretamente sem permissão de lançar ou ver valores", () => {
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} podeExportar={false} />);
    expect(screen.getByRole("heading", { name: "Consulta de produção sem exportação" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Folha de ordenha" })).toBeNull();
  });

  it.each(["operacoes", "comercial"])("preserva a URL antiga %s na entrada unificada de vendas", secao => {
    history.replaceState(null, "", `/pecuaria/leite?leiteSecao=${secao}&operacaoLeiteId=operacao-historica`);
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    expect(screen.getByRole("heading", { name: "Vendas unificadas do leite" })).toBeTruthy();
    expect(new URLSearchParams(location.search).get("operacaoLeiteId")).toBe("operacao-historica");
  });
  it.each(["coletas", "vendas"])("abre %s diretamente sem exigir fluxo de ordenha ou fechamento", tipo => {
    history.replaceState(null, "", `/pecuaria/leite?leiteSecao=${tipo}`);
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    expect(screen.getByRole("heading", { name: tipo === "vendas" ? "Vendas unificadas do leite" : `Consulta independente de ${tipo}` })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Folha de ordenha" })).toBeNull();
  });

  it("navega para qualidade e responde ao histórico sem perder filtros de produção", () => {
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} podeExportar />);
    fireEvent.click(screen.getByRole("tab", { name: "Qualidade" }));
    expect(screen.getByRole("heading", { name: "Consulta de qualidade" })).toBeTruthy();
    expect(new URLSearchParams(location.search).get("producaoVisao")).toBe("mes");
    history.replaceState(null, "", "/pecuaria/leite?leiteSecao=producao&producaoVisao=mes");
    fireEvent(window, new PopStateEvent("popstate"));
    expect(screen.getByRole("heading", { name: "Consulta de produção com exportação" })).toBeTruthy();
  });
});

it("no consolidado oferece escolha direta e não monta consultas de leite sem sítio",async()=>{
 escopoModulo.id=null;const selecionar=vi.fn();render(<LeiteModulo podeLancar podeFinanceiro onSelecionarSitio={selecionar}/>);
 expect(screen.queryByText(/Consulta de produção com/)).toBeNull();expect(screen.getByRole("heading",{name:"Em qual sítio você quer trabalhar?"})).toBeTruthy();
 fireEvent.click(await screen.findByRole("button",{name:/Principal/}));expect(selecionar).toHaveBeenCalledWith(7);expect(screen.queryByRole("alert")).toBeNull();
});
