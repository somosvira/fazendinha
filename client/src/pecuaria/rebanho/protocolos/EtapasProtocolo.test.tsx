// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EtapasProtocolo } from "./EtapasProtocolo";
afterEach(cleanup);
const etapa = { id: "e1", nome: "Retirada", referencia: "Dia 7", previsao: "19/10/2026", resumo: "10 atendidos · 1 pendente" };
const tarefa = { id: "t1", identificacao: "123 · Mimosa", href: "/pecuaria/rebanho/animais/a1?aba=reproducao&participacaoId=p1", situacao: "Não atendido", realizada: "—" };
function props() { return { referencia: "Hoje: 19/10/2026", etapas: { itens: [etapa], total: 1, pagina: 1, porPagina: 10 }, etapaId: "e1", aoSelecionarEtapa: vi.fn(), aoPaginarEtapas: vi.fn(), tarefas: { itens: [tarefa], total: 11, pagina: 1, porPagina: 10 }, aoPaginar: vi.fn(), busca: "", aoBuscar: vi.fn(), pendentes: false, aoFiltrarPendentes: vi.fn(), aoTentarNovamente: vi.fn(), acoesLinha: () => <button>Ver motivo</button>, detalhesLinha: () => <label>Rascunho<input defaultValue="Motivo preservado" /></label> }; }
describe("composição operacional de protocolos", () => {
  it("mantém uma tabela, detalhe imediatamente abaixo da origem e link semântico", () => {
    render(<EtapasProtocolo {...props()} expandida="t1" />);
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const link = screen.getByRole("link", { name: "123 · Mimosa" });
    expect(link.getAttribute("href")).toContain("participacaoId=p1");
    expect(link.closest("tr")?.nextElementSibling?.textContent).toContain("Rascunho");
    const campo = screen.getByLabelText("Rascunho");
    fireEvent.change(campo, { target: { value: "Nova justificativa" } });
    fireEvent.click(screen.getByRole("button", { name: "Etapas e animais" }));
    fireEvent.click(screen.getByRole("button", { name: "Etapas e animais" }));
    expect((screen.getByLabelText("Rascunho") as HTMLInputElement).value).toBe("Nova justificativa");
  });
  it("consulta outra etapa e filtra pendentes na mesma tabela; pagina com teto recebido de dez", () => {
    const p = props(); const tela = render(<EtapasProtocolo {...p} />);
    expect(screen.getByRole("button", { name: "Todos" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Pendentes" }).className).not.toContain("bg-primary");
    fireEvent.click(screen.getByRole("button", { name: /Dia 7 Retirada/ }));
    expect(p.aoSelecionarEtapa).toHaveBeenCalledWith("e1");
    fireEvent.click(screen.getByRole("button", { name: "Pendentes" }));
    expect(p.aoFiltrarPendentes).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(p.aoPaginar).toHaveBeenCalledWith(2);
    expect(screen.getByText("1–10 de 11 animais")).toBeTruthy();
    tela.rerender(<EtapasProtocolo {...p} pendentes />);
    expect(screen.getByRole("button", { name: "Pendentes" }).className).toContain("bg-primary");
    expect(screen.getByRole("button", { name: "Todos" }).className).not.toContain("bg-primary");
  });
  it("individual usa etapas da participação e ações de cabeçalho não recolhem conteúdo", () => {
    const p = props(); render(<EtapasProtocolo {...p} individual acoes={<button>Atender etapa</button>} />);
    expect(screen.getByRole("table", { name: "Tarefas da participação" })).toBeTruthy();
    expect(screen.queryByLabelText("Buscar animal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Atender etapa" }));
    const recolher = screen.getByRole("button", { name: "Etapas desta participação" });
    expect(recolher.getAttribute("aria-expanded")).toBe("true");
    expect(recolher.closest("header")?.lastElementChild).toBe(recolher);
  });
});
