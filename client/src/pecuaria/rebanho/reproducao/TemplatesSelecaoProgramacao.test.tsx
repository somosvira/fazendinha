// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { criteriosVazios } from "./EditorSelecaoVisita";
import { TemplatesSelecaoProgramacao } from "./TemplatesSelecaoProgramacao";
import { listarSelecoes, salvarSelecao, type CriteriosSelecao } from "./planner-api";

vi.mock("./planner-api", async importar => ({
  ...await importar<typeof import("./planner-api")>(),
  listarSelecoes: vi.fn(),
  salvarSelecao: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("salva os filtros atuais no sítio e exige conferir a prévia antes de aplicar", async () => {
  const criterios: CriteriosSelecao = {
    ...criteriosVazios(),
    todas: [
      { tipo: "VALORES", campo: "LOTE", valores: ["lote-a"] },
      { tipo: "FAIXA", campo: "DEL", min: 60, max: 120, incluirMin: true, incluirMax: true },
    ],
  };
  const onAplicar = vi.fn();
  vi.mocked(listarSelecoes).mockResolvedValue({ selecoes: [] });
  vi.mocked(salvarSelecao).mockResolvedValue({
    id: "template", nome: "Lactantes", ativo: true,
    versaoAtual: { id: "versao", numero: 1, criterios },
  });
  render(<TemplatesSelecaoProgramacao propriedadeId={2}
    criteriosAtuais={criterios} onFechar={vi.fn()} onAplicar={onAplicar}
    opcoes={{ lotes: [{ id: "lote-a", nome: "Lote A" }], categorias: [], racas: [], protocolos: [], tiposExame: [] }} />);

  await screen.findByText("Nenhum filtro salvo nesta fazenda.");
  fireEvent.click(screen.getByRole("button", { name: "Novo filtro" }));
  fireEvent.change(screen.getByLabelText("Nome do filtro"), { target: { value: "Lactantes" } });
  fireEvent.click(screen.getByRole("button", { name: "Usar filtros atuais" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar filtro" }));

  await screen.findByText("Filtros que serão aplicados");
  expect(listarSelecoes).toHaveBeenCalledWith(2);
  expect(salvarSelecao).toHaveBeenCalledWith(2, "Lactantes", criterios, undefined);
  expect(within(screen.getByRole("dialog")).getByText("Lote A")).toBeTruthy();
  expect(screen.getByText(/A partir de 60.*até 120/)).toBeTruthy();
  expect(onAplicar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro salvo" }));
  expect(onAplicar).toHaveBeenCalledWith(criterios, "Lactantes");
});
