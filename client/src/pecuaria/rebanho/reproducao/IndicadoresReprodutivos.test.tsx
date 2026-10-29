// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  IndicadoresReprodutivos,
  numeroIndicador,
  taxaIndicador,
} from "./IndicadoresReprodutivos";
import {
  consultarIndicadores,
  emitirIndicadores,
  listarEmissoesIndicadores,
  abrirEmissaoIndicadores,
  type SnapshotIndicadoresReprodutivos,
} from "./indicadores-api";
vi.mock("../../relatorios/ControlesRelatorio",()=>({ControleRelatorio:({children}:{children:import('react').ReactNode})=><>{children}</>}));
vi.mock("@/financeiro/SelectCampo",()=>({SelectCampo:({children,value,onValueChange,...props}:{children:import('react').ReactNode;value:string;onValueChange:(v:string)=>void})=><select {...props} value={value} onChange={e=>onValueChange(e.target.value)}>{children}</select>}));
beforeEach(()=>{vi.mocked(consultarIndicadores).mockResolvedValue(snapshot());vi.mocked(listarEmissoesIndicadores).mockResolvedValue([])});
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue([]) }));
vi.mock("./indicadores-api", async (original) => ({
  ...(await original<typeof import("./indicadores-api")>()),
  consultarIndicadores: vi.fn(),
  listarEmissoesIndicadores: vi.fn(),
  abrirEmissaoIndicadores: vi.fn(),
  emitirIndicadores: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function snapshot(propriedadeId = 1): SnapshotIndicadoresReprodutivos {
  const contagens = {
    vaziasAptasInicio: 0,
    negativasAnteriores: 0,
    anterioresSemDiagnostico: 1,
    estimativaVaziasAnteriores: null,
    saidasPev: 0,
    contribuicaoPev: 0,
    elegiveisConhecidas: 0,
    elegiveis: null,
    matrizesServidas: 0,
    tentativas: 1,
    positivas: 0,
    negativas: 0,
    abertas: 1,
    naoClassificaveis: 0,
    denominadorConcepcao: 0,
    animaisComPendenciaElegibilidade: 0,
  };
  const taxas = { servico: null, concepcao: null, prenhez: null };
  return {
    versao: 1,
    versaoMetodologia: "v1",
    metodologia: {
      rotulo: "Base IDEAGRI/IILB — metodologia Fazendinha v1",
      fontes: [],
      regras: ["Totais recalculados"],
      deslocamentoTeDias: 7,
      concepcaoEstimada: null,
    },
    filtros: {
      propriedadeId,
      inicio: "2026-09-01",
      fim: "2026-09-21",
      corte: "2026-09-22",
      deslocamentoTeDias: 7,
    },
    sobraInicial: null,
    periodos: [
      {
        id: "p",
        inicio: "2026-09-01",
        fim: "2026-09-21",
        contagens,
        taxas,
        pendencias: ["CONCEPCAO_ESTIMADA_NAO_INFORMADA"],
        maturidade: {
          corte: "2026-09-22",
          diasAposFim: 1,
          tentativasAbertas: 1,
        },
        detalhamento: [],
      },
    ],
    totais: {
      contagens,
      taxas,
      animaisUnicos: 1,
      participacoesAnimalPeriodo: 1,
    },
    pendencias: ["CONCEPCAO_ESTIMADA_NAO_INFORMADA"],
  };
}
it("conserva zero, null e precisão de apresentação distintos", () => {
  expect(numeroIndicador(0)).toBe("0");
  expect(taxaIndicador(0)).toBe("0%");
  expect(taxaIndicador(null)).toBe("Não calculável");
  expect(numeroIndicador(2 / 3)).toBe("0,67");
});
it("consulta sem inventar concepção estimada e mostra pendências em vez de zero", async () => {
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([]);
  vi.mocked(consultarIndicadores).mockResolvedValue(snapshot());
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false} />);
  fireEvent.change(screen.getByLabelText("Início"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("Fim"), {
    target: { value: "2026-09-21" },
  });
  fireEvent.change(screen.getByLabelText("Corte dos resultados"), {
    target: { value: "2026-09-22" },
  });
  fireEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
  await screen.findByRole("tab",{name:"Bases e contagens"});
  fireEvent.click(screen.getByRole("tab",{name:"Bases e contagens"}));
  await screen.findByText("Total recalculado");
  expect(consultarIndicadores).toHaveBeenCalledWith({
    propriedadeId: 1,
    inicio: "2026-09-01",
    fim: "2026-09-21",
    corte: "2026-09-22",
    deslocamentoTeDias: 7,
    iepModo: "VIVOS_NATIMORTOS",
  });
  fireEvent.click(screen.getByRole("button",{name:"Tabela"}));
  expect(screen.getAllByText("Não calculável").length).toBeGreaterThan(1);
  fireEvent.click(screen.getByRole("button", {name:"Sobre a base parcial"}));
  expect(screen.getByRole("dialog").textContent).toContain("concepção estimada");
  fireEvent.keyDown(screen.getByRole("dialog"), {key:"Escape"});
  expect(
    screen.queryByRole("button", { name: "Preservar emissão" }),
  ).toBeNull();
});
it("abre a emissão preservada sem reprocessar os fatos atuais e limpa ao trocar sítio", async () => {
  const e = {
    id: "antiga",
    criadoEm: "2026-09-23T12:00:00Z",
    snapshot: snapshot(),
  };
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([e]);
  vi.mocked(abrirEmissaoIndicadores).mockResolvedValue(e);
  const { rerender } = render(
    <IndicadoresReprodutivos propriedadeId={1} podeLancar={true} />,
  );
  await waitFor(() =>
    expect(screen.getByRole("option", { name: /23\/09\/2026/ })).toBeTruthy(),
  );
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), {
    target: { value: "antiga" },
  });
  await screen.findByText(/Emissão preservada em/);
  expect(screen.getByLabelText("Início")).toHaveProperty("value", "01/09/2026");
  expect(screen.getByLabelText("Fim")).toHaveProperty("value", "21/09/2026");
  expect(screen.getByLabelText("Corte dos resultados")).toHaveProperty(
    "value",
    "22/09/2026",
  );
  expect(abrirEmissaoIndicadores).toHaveBeenCalledWith("antiga", 1);
  expect(consultarIndicadores).toHaveBeenCalledTimes(1);
  rerender(<IndicadoresReprodutivos propriedadeId={2} podeLancar={true} />);
  expect(screen.queryByText("Total recalculado")).toBeNull();
});
it("retry de abertura repete a mesma emissão e não consulta fatos atuais", async () => {
  const e = {
    id: "antiga",
    criadoEm: "2026-09-23T12:00:00Z",
    snapshot: snapshot(),
  };
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([e]);
  vi.mocked(abrirEmissaoIndicadores)
    .mockRejectedValueOnce(new Error("Falha transitória ao abrir"))
    .mockResolvedValueOnce(e);
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar />);
  await screen.findByRole("option", { name: /23\/09\/2026/ });
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), {
    target: { value: "antiga" },
  });
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Emissão preservada em/);
  expect(abrirEmissaoIndicadores).toHaveBeenNthCalledWith(1, "antiga", 1);
  expect(abrirEmissaoIndicadores).toHaveBeenNthCalledWith(2, "antiga", 1);
  expect(consultarIndicadores).toHaveBeenCalledTimes(1);
});
it("retry da listagem não inicia consulta live e invalida abertura ao trocar sítio", async () => {
  const e = {
    id: "antiga",
    criadoEm: "2026-09-23T12:00:00Z",
    snapshot: snapshot(),
  };
  vi.mocked(listarEmissoesIndicadores)
    .mockRejectedValueOnce(new Error("Falha na listagem"))
    .mockResolvedValue([e]);
  let resolver!: (v: typeof e) => void;
  vi.mocked(abrirEmissaoIndicadores).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolver = resolve;
      }),
  );
  const { rerender } = render(
    <IndicadoresReprodutivos propriedadeId={1} podeLancar />,
  );
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar carregar emissões" }));
  await screen.findByRole("option", { name: /23\/09\/2026/ });
  expect(listarEmissoesIndicadores).toHaveBeenCalledTimes(2);
  expect(consultarIndicadores).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), {
    target: { value: "antiga" },
  });
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<IndicadoresReprodutivos propriedadeId={2} podeLancar />);
  resolver(e);
  await waitFor(() =>
    expect(screen.queryByText(/Emissão preservada em/)).toBeNull(),
  );
  expect(screen.queryByText("Total recalculado")).toBeNull();
});

it("retry de preservar repete a mesma chave idempotente e filtros", async () => {
  const s = snapshot();
  const e = { id: "nova", criadoEm: "2026-09-23T12:00:00Z", snapshot: s };
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([]);
  vi.mocked(consultarIndicadores).mockResolvedValue(s);
  vi.mocked(emitirIndicadores)
    .mockRejectedValueOnce(new Error("Falha ao preservar"))
    .mockResolvedValueOnce(e);
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar />);
  fireEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
  await screen.findByRole("tab",{name:"Bases e contagens"});
  fireEvent.click(screen.getByRole("tab",{name:"Bases e contagens"}));
  await screen.findByText("Total recalculado");
  fireEvent.click(screen.getByRole("button", { name: "Preservar emissão" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText(/Emissão preservada em/);
  const chamadas = vi.mocked(emitirIndicadores).mock.calls;
  expect(chamadas).toHaveLength(2);
  expect(chamadas[1]).toEqual(chamadas[0]);
  expect(chamadas[0][0]).toEqual(s.filtros);
  expect(consultarIndicadores).toHaveBeenCalledTimes(2);
});
it("separa filtros editados da emissão preservada e mantém seus dados sem nova consulta", async () => {
  const e = { id: "antiga", criadoEm: "2026-09-23T12:00:00Z", snapshot: snapshot() };
  vi.mocked(listarEmissoesIndicadores).mockResolvedValue([e]);
  vi.mocked(abrirEmissaoIndicadores).mockResolvedValue(e);
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false}/>);
  expect(await screen.findByRole("button", { name: "Aplicar" })).toBeTruthy();
  expect(screen.queryByText(/O período inicial já está preenchido/)).toBeNull();
  await screen.findByRole("option", { name: /23\/09\/2026/ });
  fireEvent.change(screen.getByLabelText("Emissões preservadas"), { target: { value: "antiga" } });
  await screen.findByText(/Emissão preservada em/);
  expect(screen.queryByText(/Os filtros editados ainda/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-01" } });
  fireEvent.click(screen.getByRole("button", {name:"Filtros ainda não aplicados"}));
  expect(screen.getByRole("dialog").textContent).toContain("Há filtros editados ainda não aplicados");
  fireEvent.keyDown(screen.getByRole("dialog"), {key:"Escape"});
  expect(screen.getAllByText(/01\/09\/2026 a 21\/09\/2026/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Emissão preservada em/)).toBeTruthy();
  expect(screen.getByRole("heading",{name:"Resultado do período consultado"})).toBeTruthy();
  expect(consultarIndicadores).toHaveBeenCalledTimes(1);
  expect(emitirIndicadores).not.toHaveBeenCalled();
});
it("conserva o histórico que termina depois da consulta explícita", async () => {
  const e = { id: "antiga", criadoEm: "2026-09-23T12:00:00Z", snapshot: snapshot() };
  let resolver!: (v: typeof e[]) => void;
  vi.mocked(listarEmissoesIndicadores).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }));
  vi.mocked(consultarIndicadores).mockResolvedValue(snapshot());
  render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false}/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  fireEvent.click(await screen.findByRole("button", { name: "Aplicar" }));
  await screen.findByRole("tab",{name:"Bases e contagens"});
  fireEvent.click(screen.getByRole("tab",{name:"Bases e contagens"}));
  await screen.findByText("Total recalculado");
  await act(async () => { resolver([e]); });
  await screen.findByRole("option", { name: /23\/09\/2026/ });
  expect(consultarIndicadores).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Total recalculado")).toBeTruthy();
});
it("ignora histórico atrasado de outro sítio sem perder a lista do sítio atual", async () => {
  const e = { id: "anterior", criadoEm: "2026-09-23T12:00:00Z", snapshot: snapshot() };
  const atual = { id: "atual", criadoEm: "2026-09-24T12:00:00Z", snapshot: snapshot(2) };
  let resolver!: (v: typeof e[]) => void;
  vi.mocked(listarEmissoesIndicadores).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockResolvedValue([atual]);
  const { rerender } = render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false}/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<IndicadoresReprodutivos propriedadeId={2} podeLancar={false}/>);
  await screen.findByRole("option", { name: /24\/09\/2026/ });
  await act(async () => { resolver([e]); });
  await waitFor(() => expect(screen.queryByRole("option", { name: /23\/09\/2026/ })).toBeNull());
  expect(screen.getByRole("option", { name: /24\/09\/2026/ })).toBeTruthy();
});
it("mantém o resultado consolidado antes das abas ao consultar bases e acompanhamento", async()=>{
 render(<IndicadoresReprodutivos propriedadeId={1} podeLancar={false}/>);
 const resultado=await screen.findByRole('heading',{name:'Resultado do período consultado'});
 const abas=screen.getByRole('tablist',{name:'Conteúdo do relatório'});
 expect(resultado.compareDocumentPosition(abas)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 fireEvent.click(screen.getByRole('tab',{name:'Bases e contagens'}));
 expect(screen.getAllByRole('heading',{name:'Resultado do período consultado'})).toHaveLength(1);
 expect(screen.getByRole('button',{name:'Sobre a base parcial'})).toBeTruthy();
 expect(screen.queryByText(/dias fora das janelas/)).toBeNull();
 expect(consultarIndicadores).toHaveBeenCalledTimes(1);
});
