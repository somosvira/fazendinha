// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ req: vi.fn(), consultar: vi.fn(), listar: vi.fn(), abrir: vi.fn(), emitir: vi.fn() }));
vi.mock("./api", () => ({ reqV4: mocks.req }));
vi.mock("./indicadores-api", async original => ({ ...await original<typeof import("./indicadores-api")>(), consultarIndicadores: mocks.consultar, listarEmissoesIndicadores: mocks.listar, abrirEmissaoIndicadores: mocks.abrir, emitirIndicadores: mocks.emitir }));
// A compatibilidade dos snapshots é testada separadamente dos diálogos de navegação.
vi.mock("../../relatorios/ControlesRelatorio",()=>({ControleRelatorio:({children}:{children:import('react').ReactNode})=><>{children}</>}));
vi.mock("@/financeiro/SelectCampo",()=>({SelectCampo:({children,value,onValueChange,...props}:{children:import('react').ReactNode;value:string;onValueChange:(v:string)=>void})=><select {...props} value={value} onChange={e=>onValueChange(e.target.value)}>{children}</select>}));
import { IndicadoresReprodutivos } from "./IndicadoresReprodutivos";
import { exportarIndicadoresCsv, type SnapshotIndicadoresReprodutivos } from "./indicadores-api";
import type { AcompanhamentoIndicadores } from "./IndicadoresAcompanhamento";
function snapshot(): SnapshotIndicadoresReprodutivos {
 const contagens = { vaziasAptasInicio: 0, negativasAnteriores: 0, anterioresSemDiagnostico: 0, estimativaVaziasAnteriores: null, saidasPev: 0, contribuicaoPev: 0, elegiveisConhecidas: 0, elegiveis: null, matrizesServidas: 0, tentativas: 0, positivas: 0, negativas: 0, abertas: 0, naoClassificaveis: 0, denominadorConcepcao: 0, animaisComPendenciaElegibilidade: 0 };
 return { versao: 1, versaoMetodologia: "METODOLOGIA_PRESERVADA_V1", metodologia: { rotulo: "Metodologia preservada", fontes: [], regras: ["Regra original"], deslocamentoTeDias: 7, concepcaoEstimada: null }, filtros: { propriedadeId: 7, inicio: "2026-01-01", fim: "2026-01-21", corte: "2026-02-01", deslocamentoTeDias: 7 }, sobraInicial: null, periodos: [], totais: { contagens, taxas: { servico: null, concepcao: null, prenhez: null }, animaisUnicos: 0, participacoesAnimalPeriodo: 0 }, pendencias: [] };
}
function acompanhamento(): AcompanhamentoIndicadores { return { versao: 2, versaoMetodologia: "ACOMPANHAMENTO_PRESERVADO_V1", identificacoes: [], pendenciasOrigemCiclo: [],
 espera: { coorte: [], filaAtual: [], pendenciasFila: [], resumoCoorte: { ciclos: 0, comServico: 0, semServico: 0, saidas: 0, repeticoes: 0, mediaDiasLiberacaoServico: null } },
 perdas: { janelaDias: null, numerador: null, denominador: null, percentual: null, contagens: { gestacoes: 0, perdasAteCorte: 0, perdasRegistradas: 0, abortos: 0, incompletos: 0, semPrimeiroDg: 0, encerramentosNaoIdentificados: 0 }, composicaoNumerador: { perdasRegistradas: 0, abortos: 0 }, coorte: [] },
 iep: { modo: "VIVOS_NATIMORTOS", mediaDias: null, pares: [], abortos: [], pendencias: [], semAnterior: [] }, tentativasPorConcepcao: { estado: "NAO_CARREGADO" } }; }
const emissao = (id: string, v2 = false) => ({ id, criadoEm: id === "v1" ? "2026-01-22T12:00:00Z" : "2026-01-23T12:00:00Z", snapshot: { ...snapshot(), ...(v2 ? { versao: 2 as const, acompanhamento: acompanhamento() } : {}) } });
beforeEach(() => { vi.resetAllMocks(); mocks.req.mockResolvedValue([]); mocks.consultar.mockResolvedValue(snapshot()); mocks.listar.mockResolvedValue([emissao("v1"), emissao("v2", true)]); mocks.abrir.mockImplementation(async id => emissao(id, id === "v2")); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("indicadores preservados — compatibilidade independente V1/V2", () => {
 it("abrir emissão V1 conserva snapshot sem recalcular ou inventar bloco novo", async () => {
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar/>); await screen.findByRole("option", { name: /22\/01\/2026/ }); await waitFor(()=>expect(mocks.consultar).toHaveBeenCalled()); mocks.consultar.mockClear();
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), { target: { value: "v1" } }); await screen.findByText(/Emissão preservada em/);
  expect(mocks.abrir).toHaveBeenCalledWith("v1", 7); expect(mocks.consultar).not.toHaveBeenCalled(); expect(mocks.emitir).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: "Espera, perdas e intervalos" })).toBeNull(); expect(screen.queryByRole("tab",{name:"Critérios de cálculo"})).toBeNull(); expect(exportarIndicadoresCsv((await mocks.abrir.mock.results[0].value).snapshot)).toContain("Metodologia preservada");
 });
 it("emissão V2 mostra bloco preservado e voltar à V1 o remove sem consulta atual", async () => {
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar/>); await screen.findByRole("option", { name: /23\/01\/2026/ }); await waitFor(()=>expect(mocks.consultar).toHaveBeenCalled()); mocks.consultar.mockClear();
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), { target: { value: "v2" } }); await screen.findByRole("tab", {name:"Acompanhamento"}); fireEvent.click(screen.getByRole("tab", {name:"Acompanhamento"})); await screen.findAllByRole("heading", { name: "Espera, perdas e intervalos" });
  await waitFor(() => expect(screen.getByLabelText("Emissões preservadas")).toHaveProperty("disabled", false));
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), { target: { value: "v1" } }); await waitFor(() => expect(screen.queryByRole("heading", { name: "Espera, perdas e intervalos" })).toBeNull());
  expect(mocks.consultar).not.toHaveBeenCalled(); expect(mocks.emitir).not.toHaveBeenCalled(); expect(mocks.abrir).toHaveBeenCalledTimes(2);
 });
 it("CSV V1 conserva linhas originais e não ganha seção analítica presumida", () => {
  const csv = exportarIndicadoresCsv(snapshot());
  expect(csv.startsWith('\uFEFF"Metodologia";"Metodologia preservada"\r\n')).toBe(true);
  expect(csv.split("\r\n")).toContain('"TOTAL";"";"";"0";"0";"0";"0";"0";"";"";"";""');
  expect(csv).not.toContain("Acompanhamento gerencial"); expect(csv).not.toContain("Janela de perdas");
 });
 it("botão Exportar usa snapshot V2 preservado com método, janela, denominador e exclusões", async () => {
  const e = emissao("v2", true); e.snapshot.acompanhamento!.perdas = { ...e.snapshot.acompanhamento!.perdas, janelaDias: 17, numerador: 2, denominador: 3, percentual: 200 / 3 };
  e.snapshot.acompanhamento!.exclusoesEscopo = [{ animalId: "animal-excluido", populacao: "PERDAS", referenciaId: "gestacao-sem-local", motivos: ["ESCOPO_HISTORICO_NAO_COMPROVADO"] }];
  mocks.abrir.mockResolvedValue(e); let blob: Blob | undefined;
  const URLoriginal = URL;
  vi.stubGlobal("URL", class extends URLoriginal { static createObjectURL = vi.fn((b: Blob | MediaSource) => { if (b instanceof Blob) blob = b; return "blob:exportacao-preservada"; }); static revokeObjectURL = vi.fn(); });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<IndicadoresReprodutivos propriedadeId={7} podeLancar/>); await screen.findByRole("option", { name: /23\/01\/2026/ }); await waitFor(()=>expect(mocks.consultar).toHaveBeenCalled()); mocks.consultar.mockClear();
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), { target: { value: "v2" } }); await screen.findByRole("tab", {name:"Acompanhamento"}); fireEvent.click(screen.getByRole("tab", {name:"Acompanhamento"})); await screen.findAllByRole("heading", { name: "Espera, perdas e intervalos" });
  fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" })); expect(blob).toBeDefined();
  const csv = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsText(blob!); });
  expect(csv).toContain('"Acompanhamento gerencial";"ACOMPANHAMENTO_PRESERVADO_V1"');
  expect(csv).toContain('"Janela de perdas (dias)";"17"'); expect(csv).toContain('"Perdas denominador demonstrável";"3"');
  expect(csv).toContain('"Exclusões por escopo histórico não comprovado";"1"'); expect(csv).toContain('"PERDAS";"animal-excluido";"gestacao-sem-local";"ESCOPO_HISTORICO_NAO_COMPROVADO"');
  expect(mocks.consultar).not.toHaveBeenCalled(); expect(mocks.emitir).not.toHaveBeenCalled();
 });

});
