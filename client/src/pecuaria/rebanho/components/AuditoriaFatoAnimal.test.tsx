// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Target } from "lucide-react";
import { AuditoriaAnimal, type FatoHistoricoAnimal } from "./AuditoriaAnimal";
import { buscarAuditoriaAnimal } from "../api";
import type { EntradaAuditoria, ResultadoAuditoriaAnimal } from "../types";
import { setPropriedadeAtiva } from "@/propriedadeScope";

vi.mock("../api", async original => ({ ...await original<typeof import("../api")>(), buscarAuditoriaAnimal: vi.fn() }));
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); setPropriedadeAtiva(null); });
const fato: FatoHistoricoAnimal = { id: "finalidade-f1", entidade: "FinalidadeAnimal", entidadeId: "f1", eixo: "REBANHO", titulo: "Finalidade", data: "2026-10-01", detalhe: "Leite → Corte", textoBusca: "Leite Corte", Icone: Target };
const entrada = (id: string, entidade: string, entidadeId: string, acao: string): EntradaAuditoria => ({ id, entidade, entidadeId, acao, em: "2026-10-01T12:00:00Z", usuarioNome: "Ana", resumo: `${acao} do registro`, eixo: "REBANHO", registro: id, alteracoes: [] });
const resposta = (itens: EntradaAuditoria[], total = itens.length): ResultadoAuditoriaAnimal => ({ itens, total });

describe("histórico integrado e auditoria por identidade", () => {
  it("reúne alias inicial sem duplicar fato e conserva correção, cadastro e exclusão sem fato vigente", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue(resposta([
      entrada("original", "DestinoAnimal", "f1", "MUDANCA_DESTINO"),
      entrada("correcao", "FinalidadeAnimal", "f1", "CORRECAO"),
      entrada("cadastro", "Animal", "animal-1", "EDICAO"),
      entrada("desfeito", "LocalizacaoAnimal", "inexistente", "DESFAZER"),
    ]));
    const { rerender } = render(<AuditoriaAnimal id="animal-1" fatos={[fato]} modo="visual" />);
    await screen.findByText("Alteração · correcao");
    expect(screen.getAllByText("Leite → Corte")).toHaveLength(1);
    expect(screen.queryByText("Alteração · original")).toBeNull();
    expect(screen.getByText("Alteração · cadastro")).toBeTruthy();
    expect(screen.getByText("Alteração · desfeito")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Ver auditoria" })).toHaveLength(4);
    rerender(<AuditoriaAnimal id="animal-1" fatos={[fato]} modo="tabela" />);
    expect(screen.getAllByRole("button", { name: "Ver auditoria" })).toHaveLength(4);
    expect(screen.getByText("Leite → Corte")).toBeTruthy();
    expect(vi.mocked(buscarAuditoriaAnimal).mock.calls.filter(([, q]) => q?.entidade)).toHaveLength(0);
  });
  it("consulta todas as páginas do fato sob demanda sem filtrar a página geral", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockImplementation(async (_id, query) => query?.entidade
      ? resposta([entrada(query.page === 2 ? "correcao-antiga" : "correcao-recente", "FinalidadeAnimal", "f1", "CORRECAO")], 21)
      : resposta([]));
    render(<AuditoriaAnimal id="animal-1" fatos={[fato]} modo="visual" />);
    await screen.findByText("Leite → Corte");
    expect(buscarAuditoriaAnimal).not.toHaveBeenCalledWith("animal-1", expect.objectContaining({ entidade: "FinalidadeAnimal" }));
    screen.getByRole("button", { name: "Ver auditoria" }).focus();
    fireEvent.click(screen.getByRole("button", { name: "Ver auditoria" }));
    const modal = await screen.findByRole("dialog");
    await within(modal).findByText("21 registros · Página 1 de 2");
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", { entidade: "FinalidadeAnimal", entidadeId: "f1", page: 1, pageSize: 20 });
    expect(within(modal).getByText("Leite → Corte")).toBeTruthy();
    fireEvent.click(within(modal).getByRole("button", { name: "Próxima" }));
    await within(modal).findByText("21 registros · Página 2 de 2");
    expect(buscarAuditoriaAnimal).toHaveBeenLastCalledWith("animal-1", { entidade: "FinalidadeAnimal", entidadeId: "f1", page: 2, pageSize: 20 });
    fireEvent.keyDown(modal, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver auditoria" })));
  });
  it("resumo utiliza a projeção original independente da página de alterações", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockResolvedValue({ ...resposta([]), transicoes: [{ entidade: "DestinoAnimal", entidadeId: "f1", antes: { aptidao: "LEITE" }, depois: { aptidao: "CORTE" } }] });
    render(<AuditoriaAnimal id="animal-1" fatos={[{ ...fato, detalhe: "Reprodução", projetarTransicao: t => ({ detalhe: `${t.antes?.aptidao} → ${t.depois?.aptidao}`, textoBusca: "Leite Corte" }) }]} modo="visual" />);
    await screen.findByText("LEITE → CORTE");
    expect(within(screen.getByRole("list", { name: "Fatos e alterações do animal" })).queryByText("Reprodução")).toBeNull();
  });
  it("falha na auditoria conserva fatos e informa indisponibilidade", async () => {
    vi.mocked(buscarAuditoriaAnimal).mockRejectedValue(new Error("Sem permissão de consulta"));
    render(<AuditoriaAnimal id="animal-1" fatos={[fato]} modo="visual" />);
    await screen.findByRole("alert");
    expect(screen.getByText("Leite → Corte")).toBeTruthy();
    expect(screen.queryByText(/Nenhum registro de auditoria/)).toBeNull();
  });
});
