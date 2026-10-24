// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { LeiteModulo } from "./LeiteModulo";

vi.mock("./Leite", () => ({ Leite: () => <h1>Folha de ordenha</h1> }));
vi.mock("./ConsultasProducaoLeite", () => ({
  ConsultasProducaoLeite: ({ podeExportar }: { podeExportar: boolean }) =>
    <h1>Consulta de produção {podeExportar ? "com exportação" : "sem exportação"}</h1>,
}));
vi.mock("./ConsultasComerciaisLeite", () => ({ ConsultasComerciaisLeite: ({ tipo }: { tipo: string }) => <h1>Consulta independente de {tipo}</h1> }));
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

beforeEach(() => history.replaceState(null, "", "/pecuaria/leite?leiteSecao=producao&producaoVisao=mes&producaoData=2026-10-01"));
afterEach(cleanup);

describe("Consultas independentes no módulo Leite", () => {
  it("mantém seis consultas e acesso por teclado às rotinas sem apagar o recorte", async () => {
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    const nav = screen.getByRole("navigation", { name: "Produção de leite" });
    expect([...within(nav).getAllByRole("tab"), within(nav).getByRole("button", { name: "Mais rotinas" })].map(b => b.textContent)).toEqual([
      "Ordenhas", "Produção", "Estoque", "Coletas", "Qualidade", "Vendas", "Mais rotinas",
    ]);
    fireEvent.keyDown(within(nav).getByRole("button", { name: "Mais rotinas" }), { key: "ArrowDown" });
    const item = await screen.findByRole("menuitem", { name: "Operações de venda" });
    fireEvent.click(item);
    expect(screen.getByRole("heading", { name: "Operações por comprador e período" })).toBeTruthy();
    expect(new URLSearchParams(location.search).get("producaoData")).toBe("2026-10-01");
    expect(new URLSearchParams(location.search).get("leiteSecao")).toBe("operacoes");
  });
  it("abre produção diretamente sem permissão de lançar ou ver valores", () => {
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} podeExportar={false} />);
    expect(screen.getByRole("heading", { name: "Consulta de produção sem exportação" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Folha de ordenha" })).toBeNull();
  });

  it("abre operações de venda diretamente e preserva acesso às entregas anteriores", async () => {
    history.replaceState(null, "", "/pecuaria/leite?leiteSecao=operacoes");
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    expect(screen.getByRole("heading", { name: "Operações por comprador e período" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("button", { name: "Operações de venda" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Entregas e demonstrativos" }));
    expect(screen.getByRole("heading", { name: "Entregas anteriores" })).toBeTruthy();
  });

  it.each(["coletas", "vendas"])("abre %s diretamente sem exigir fluxo de ordenha ou fechamento", tipo => {
    history.replaceState(null, "", `/pecuaria/leite?leiteSecao=${tipo}`);
    render(<LeiteModulo podeLancar={false} podeFinanceiro={false} />);
    expect(screen.getByRole("heading", { name: `Consulta independente de ${tipo}` })).toBeTruthy();
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
