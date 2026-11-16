// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SelecaoAnimaisProgramacao } from "./SelecaoAnimaisProgramacao";
import { obterOpcoesSelecao, previaGrupo, type PreviaPlanner, type AnimalPlanner } from "./planner-api";
import { criteriosVazios } from "./EditorSelecaoVisita";
const previa = (animais: AnimalPlanner[], total: number): PreviaPlanner => ({ animais, total, pagina: 1, tamanhoPagina: 10, fingerprint: "teste", grupo: { grupo: { origem: "LIVRE", nome: "Seleção", criterios: criteriosVazios(), tipo: "INICIAR_IATF", incluidosManualmente: [] }, nome: "Seleção", secao: "REPRODUCAO", janela: "EXTRA", tipo: "INICIAR_IATF", protocolo: null, turma: null, etapa: null, previstaPara: null, precisaoTemporal: null, criterios: criteriosVazios(), totalAnimais: total, totalProcedimentos: total, emVisitaAberta: 0 } });
vi.mock("./planner-api", async original => ({ ...await original<typeof import("./planner-api")>(), obterOpcoesSelecao: vi.fn(), previaGrupo: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("consulta critérios no servidor e conserva a seleção ao mudar a busca", async () => {
  vi.mocked(obterOpcoesSelecao).mockResolvedValue({ lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] });
  vi.mocked(previaGrupo).mockResolvedValue(previa([{ animalId: "a", brinco: "123", nome: "Aurora", motivos: [], tarefaId: null, visitasAbertas: [] }], 1));
  const selecionar = vi.fn(), identificar = vi.fn();
  render(<SelecaoAnimaisProgramacao propriedadeId={1} data="2026-11-07" selecionados={["fora-do-filtro"]} onSelecionados={selecionar} onIdentificados={identificar} />);
  await screen.findAllByText("123");
  expect(screen.getByRole("columnheader", {name:"Categoria"})).toBeTruthy();
  expect(screen.getByRole("columnheader", {name:"Situação reprodutiva"})).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Aurora" } });
  await waitFor(() => expect(previaGrupo).toHaveBeenLastCalledWith(1, "2026-11-07", expect.objectContaining({ criterios: expect.objectContaining({ todas: expect.arrayContaining([{ tipo: "VALORES", campo: "BUSCA", valores: ["Aurora"] }]) }) }), 1, 10));
  expect(selecionar).not.toHaveBeenCalled();
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  expect(selecionar).toHaveBeenCalledWith(["fora-do-filtro", "a"]);
});
it("volta à primeira página ao mudar a data preservando os IDs selecionados", async () => {
  vi.mocked(obterOpcoesSelecao).mockResolvedValue({ lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] });
  vi.mocked(previaGrupo).mockImplementation(async (_sitio, data, _grupo, pagina) => previa([{ animalId: `a-${pagina}`, brinco: `Animal ${pagina}`, nome: null, motivos: [], tarefaId: null, visitasAbertas: [] }], data === "2026-11-07" ? 201 : 1));
  const selecionar = vi.fn(), identificar = vi.fn();
  const view = render(<SelecaoAnimaisProgramacao propriedadeId={1} data="2026-11-07" selecionados={["conservar"]} onSelecionados={selecionar} onIdentificados={identificar} />);
  await screen.findAllByText(/Animal 1/);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  await screen.findAllByText(/Animal 2/);
  view.rerender(<SelecaoAnimaisProgramacao propriedadeId={1} data="2026-11-08" selecionados={["conservar"]} onSelecionados={selecionar} onIdentificados={identificar} />);
  await waitFor(() => expect(previaGrupo).toHaveBeenLastCalledWith(1, "2026-11-08", expect.anything(), 1, 10));
  await screen.findAllByText(/Animal 1/);
  expect(selecionar).not.toHaveBeenCalled();
  expect(screen.getByText("1/100 selecionados")).toBeTruthy();
});

it("permite selecionar com aviso de aptidão", async () => {
  vi.mocked(obterOpcoesSelecao).mockResolvedValue({ lotes: [], categorias: [], racas: [], protocolos: [], tiposExame: [] });
  vi.mocked(previaGrupo).mockResolvedValue(previa([{
    animalId: "a", brinco: "DEV-001", nome: "Aurora", motivos: [], tarefaId: null, visitasAbertas: [],
    impedimentoProgramacao: "Animal sem aptidão confirmada nesta data: EXAME_APTIDAO_NECESSARIO; CONDICAO_IMPEDITIVA_VIGENTE. Bloqueios vigentes: Condição sanitária: Retenção de placenta",
  }], 1));
  const selecionar = vi.fn();
  render(<SelecaoAnimaisProgramacao propriedadeId={1} data="2026-11-07" inicio="2026-11-07"
    selecionados={[]} onSelecionados={selecionar} onIdentificados={vi.fn()} />);
  const checkbox = await screen.findByRole("checkbox", { name: "Selecionar DEV-001" });
  expect(checkbox).toHaveProperty("disabled", false);
  const linha = within(screen.getByRole("row", { name: /DEV-001/ }));
  const motivo = linha.getByRole("button", { name: "Aviso de aptidão de DEV-001" });
  expect(linha.queryByText(/Aguarda exame para definir aptidão/)).toBeNull();
  fireEvent.click(motivo);
  expect(screen.getByText(/Aguarda exame para definir aptidão/)).toBeTruthy();
  expect(screen.getByText(/Condição sanitária: Retenção de placenta/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ver condição" }).getAttribute("href"))
    .toBe("/pecuaria/rebanho/animais/a?sitio=1#sanidade");
  expect(screen.queryByText(/Há restrição ou condição sanitária impeditiva/)).toBeNull();
  expect(selecionar).not.toHaveBeenCalled();
  fireEvent.click(checkbox);
  expect(selecionar).toHaveBeenCalledWith(["a"]);
});
