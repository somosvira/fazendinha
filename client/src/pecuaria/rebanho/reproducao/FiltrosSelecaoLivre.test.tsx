// @vitest-environment jsdom
import "@/lib/controles.fixture";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FiltrosSelecaoLivre } from "./FiltrosSelecaoLivre";
import type { CriteriosSelecao } from "./planner-api";

afterEach(cleanup);

describe("atalho de aptidão nos filtros livres", () => {
  it("seleciona finalidade Reprodução mantendo a chave APTIDAO", () => {
    const onMudar = vi.fn();
    const criterios: CriteriosSelecao = { versao: 2, todas: [], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" };
    render(<FiltrosSelecaoLivre criterios={criterios} onMudar={onMudar} opcoes={{ lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] }} data="2026-10-15" sitio="Fazenda" />);
    fireEvent.click(screen.getByText("Mais características · idade, raça, peso, RP e identificação"));
    fireEvent.click(screen.getByRole("button", { name: "Finalidade" }));
    fireEvent.click(screen.getByRole("option", { name: "Reprodução" }));
    expect(onMudar).toHaveBeenLastCalledWith(expect.objectContaining({ todas: [{ tipo: "VALORES", campo: "APTIDAO", valores: ["REPRODUCAO"] }] }));
  });

  it("cria um critério estrito para APTA e VAZIA com limite de dias editável", () => {
    const onMudar = vi.fn();
    const criterios: CriteriosSelecao = { versao: 2, todas: [], qualquer: [], ordenacao: [{ campo: "BRINCO", direcao: "ASC" }], politicaDesconhecidos: "EXCLUIR" };
    const props = { onMudar, opcoes: { lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] }, data: "2026-10-15", sitio: "Fazenda" };
    const { rerender } = render(<FiltrosSelecaoLivre criterios={criterios} {...props}/>);

    expect(screen.getByText("Não gestantes após aptidão reprodutiva (aptas ou vazias)")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Não gestantes após aptidão reprodutiva (aptas ou vazias)" }));
    const ativado = onMudar.mock.calls.at(-1)?.[0] as CriteriosSelecao;
    expect(ativado.qualquer.find(v => v.id === "aptidao")?.todas).toEqual([
      { tipo: "VALORES", campo: "SITUACAO", valores: ["APTA", "VAZIA"] },
      { tipo: "FAIXA", campo: "DIAS_APTIDAO", min: 0, incluirMin: false, incluirMax: true },
    ]);

    rerender(<FiltrosSelecaoLivre criterios={ativado} {...props}/>);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Dias: Não gestantes após aptidão reprodutiva (aptas ou vazias)" }), { target: { value: "10" } });
    const alterado = onMudar.mock.calls.at(-1)?.[0] as CriteriosSelecao;
    expect(alterado.qualquer.find(v => v.id === "aptidao")?.todas[1]).toMatchObject({ tipo: "FAIXA", campo: "DIAS_APTIDAO", min: 10, incluirMin: false });
  });
});
