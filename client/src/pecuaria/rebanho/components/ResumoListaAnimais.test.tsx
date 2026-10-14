// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { distribuirCategoriasLista, ResumoListaAnimais, TooltipComposicaoLista } from "./ResumoListaAnimais";
import type { CategoriaDTO, PainelServidor } from "../types";

afterEach(cleanup);
const painel: PainelServidor = {
  totalAtivos: 42, femeasAtivas: 31, receptorasAtivas: 1, porSitio: [],
  porCategoria: [{ categoria: { id: "vaca", nome: "Vaca" }, total: 30 }, { categoria: null, total: 12 }],
};
describe("Resumo visual da lista de animais", () => {
  it("tooltip mostra só a categoria do segmento, sem índice interno ou lista completa", () => {
    render(<TooltipComposicaoLista active payload={[{ dataKey: "categoria1" }]} fatias={distribuirCategoriasLista(painel, [])} total={42} />);
    expect(screen.getByRole("tooltip").textContent).toContain("Sem categoria");
    expect(screen.getByRole("tooltip").textContent).toContain("12 animais ativos");
    expect(screen.getByText("· 28,6% do efetivo")).toBeTruthy();
    expect(screen.queryByText("Vaca")).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
  });
  it("todos os indicadores são botões e acionam o filtro correspondente", () => {
    const onIndicador = vi.fn();
    render(<ResumoListaAnimais painel={painel} categorias={[]} lotesDisponiveis={2} onCategoria={vi.fn()} onIndicador={onIndicador} onOutras={vi.fn()} />);
    for (const nome of ["Filtrar animais ativos", "Filtrar fêmeas ativas", "Filtrar receptoras", "Filtrar por lote"]) fireEvent.click(screen.getByRole("button", { name: nome }));
    expect(onIndicador.mock.calls.map(c => c[0])).toEqual(["ativos", "femeas", "receptoras", "lotes"]);
    expect(screen.getByRole("button", { name: "Filtrar animais ativos" }).querySelector("svg path")).toBeTruthy();
  });
  it("usa o agregado completo e conserva o filtro Sem categoria", () => {
    const onCategoria = vi.fn();
    render(<ResumoListaAnimais onIndicador={() => {}} onOutras={() => {}} painel={painel} categorias={[]} lotesDisponiveis={2} onCategoria={onCategoria} />);
    expect(screen.getByLabelText("Resumo da consulta de animais").textContent).toContain("42 animais ativos");
    expect(screen.getByText("71,4%")).toBeTruthy();
    expect(screen.getByLabelText("Resumo da consulta de animais").textContent).toContain("1 receptora");
    fireEvent.click(screen.getByRole("button", { name: "Filtrar categoria: Sem categoria — 12 animais ativos" }));
    expect(onCategoria).toHaveBeenCalledWith(null);
  });
  it("distingue IDs de categorias homônimas por sexo", () => {
    const p = { ...painel, porCategoria: [{ categoria: { id: "f", nome: "Em crescimento" }, total: 4 }, { categoria: { id: "m", nome: "Em crescimento" }, total: 2 }] };
    const cs = [{ id: "f", sexo: "F" }, { id: "m", sexo: "M" }] as CategoriaDTO[];
    expect(distribuirCategoriasLista(p, cs).map(c => c.nome)).toEqual(["Em crescimento · fêmeas", "Em crescimento · machos"]);
  });
  it("agrupa excedentes sem perder animais no total do gráfico", () => {
    const p = { ...painel, porCategoria: Array.from({ length: 8 }, (_, i) => ({ categoria: { id: String(i), nome: `Categoria ${i}` }, total: i + 1 })) };
    const fatias = distribuirCategoriasLista(p, []);
    expect(fatias).toHaveLength(6);
    expect(fatias.reduce((s, c) => s + c.total, 0)).toBe(36);
    expect(fatias.at(-1)).toMatchObject({ nome: "Outras categorias", total: 6, outras: true });
  });
  it("não desenha efetivo fictício quando não há ativos", () => {
    render(<ResumoListaAnimais onIndicador={() => {}} onOutras={() => {}} painel={{ ...painel, totalAtivos: 0, porCategoria: [] }} categorias={[]} lotesDisponiveis={0} onCategoria={vi.fn()} />);
    expect(screen.getByText("Não há animais ativos neste recorte.")).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("identifica a atualização e bloqueia cliques no agregado anterior", () => {
    const callback = vi.fn();
    render(<ResumoListaAnimais onIndicador={() => {}} onOutras={() => {}} painel={painel} categorias={[]} lotesDisponiveis={2} onCategoria={callback} atualizando />);
    expect(screen.getByText("Atualizando recorte…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Filtrar categoria: Vaca — 30 animais ativos" }));
    expect(callback).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Resumo da consulta de animais").getAttribute("aria-busy")).toBe("true");
  });
});
