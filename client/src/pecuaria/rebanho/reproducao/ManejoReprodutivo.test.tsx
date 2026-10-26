// @vitest-environment jsdom
import { abrirFiltrosConsulta, aplicarFiltrosConsulta, alterarControle } from "@/lib/controles.fixture";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ManejoReprodutivo } from "./ManejoReprodutivo";
import { obterReproducao, type AnimalReprodutivo, type PainelReprodutivo } from "./api";
import { consultarIndicadores, type FiltrosIndicadores, type SnapshotIndicadoresReprodutivos } from "./indicadores-api";
import { listarAnimais } from "../api";
import type { AnimalResumo, ListarResultado } from "../types";
import type { AcompanhamentoIndicadores } from "./IndicadoresAcompanhamento";
import { navegarConsultaComSitio } from "./contexto-consulta";
vi.mock("./api", () => ({ obterReproducao: vi.fn() }));
vi.mock("../api", () => ({ listarAnimais: vi.fn() }));
vi.mock("./indicadores-api", () => ({ consultarIndicadores: vi.fn() }));
vi.mock("./contexto-consulta", async original => ({ ...await original<typeof import("./contexto-consulta")>(), navegarConsultaComSitio: vi.fn() }));
vi.mock("../../../lib/hoje", async original => ({ ...await original<typeof import("../../../lib/hoje")>(), getHojeISO: () => "2026-10-17" }));
const hoje = "2026-10-17";
function animal(id: string, lote = "l1"): AnimalResumo {
  return { id, brinco: `V4-${id}`, nome: `Animal ${id}`, sexo: "F", categoria: null, categoriaOrigem: "SEM_CATEGORIA", categoriaCalculada: null, idadeMeses: 36, idadeNaBaixa: false, dataNascimento: "2023-01-01", dataEntrada: "2024-01-01", origem: "NASCIDO", propriedade: { id: 7, nome: "Escola" }, lote: { id: lote, nome: lote === "l1" ? "Matrizes" : "Novilhas" }, aptidao: "LEITE", papelReprodutivo: null, composicaoRotulo: "", ultimoPeso: null, situacao: "ATIVO", gmdRecente: null, noLocalDesde: null, baixa: null };
}
function estado(id: string, situacao = "VAZIA"): AnimalReprodutivo {
  return { animalId: id, brinco: `V4-${id}`, nome: `Animal ${id}`, situacao, partos: 1, tentativasCiclo: 0, gestacao: null, restricoes: [], ...(situacao === "AGUARDANDO_DIAGNOSTICO" ? { ultimaTentativa: { id: `t-${id}`, animalId: id, data: "2026-10-10", tipo: "TE" } } : {}) };
}
function espera(id: string, data = "2026-10-01"): AcompanhamentoIndicadores["espera"]["filaAtual"][number] {
  return { animalId: id, cicloId: `c-${id}`, inicio: "2026-08-01", primeiraLiberacao: { data }, primeiroServico: null, diasPartoServico: null, diasFimPevServico: null, diasLiberacaoServico: null, diasEsperaObservada: 16, esperaObservadaAte: hoje, repeticoes: 0, restricoesIntermediarias: [], pendencias: [], saidaEm: null, antecipacoes: [] };
}
function acompanhamento(): AcompanhamentoIndicadores {
  return { versao: 2, versaoMetodologia: "v2", pendenciasOrigemCiclo: [{ animalId: "9", motivo: "CICLO_DESCONHECIDO" }], espera: { coorte: [], filaAtual: [espera("1"), espera("2", "2026-10-17"), espera("3", "2026-11-01")], pendenciasFila: [{ motivo: "LIBERACAO_NAO_COMPROVADA", linha: espera("9") }], resumoCoorte: { ciclos: 0, comServico: 0, semServico: 0, saidas: 0, repeticoes: 0, mediaDiasLiberacaoServico: null } }, perdas: { janelaDias: null, numerador: null, denominador: null, percentual: null, contagens: { gestacoes: 0, perdasAteCorte: 0, perdasRegistradas: 0, abortos: 0, incompletos: 0, semPrimeiroDg: 0, encerramentosNaoIdentificados: 0 }, composicaoNumerador: { perdasRegistradas: 0, abortos: 0 }, coorte: [] }, iep: { modo: "VIVOS_NATIMORTOS", mediaDias: null, pares: [], abortos: [], pendencias: [], semAnterior: [] }, tentativasPorConcepcao: { estado: "CALCULADO" } };
}
function snapshot(filtros: FiltrosIndicadores): SnapshotIndicadoresReprodutivos {
  return { versao: 2, versaoMetodologia: "v2", acompanhamento: acompanhamento(), filtros, metodologia: { rotulo: "Metodologia", fontes: [], regras: [], deslocamentoTeDias: 7, concepcaoEstimada: null }, sobraInicial: null, periodos: [], totais: { contagens: { vaziasAptasInicio: 0, negativasAnteriores: 0, anterioresSemDiagnostico: 0, estimativaVaziasAnteriores: null, saidasPev: 0, contribuicaoPev: 0, elegiveisConhecidas: 0, elegiveis: null, matrizesServidas: 0, tentativas: 0, positivas: 0, negativas: 0, abertas: 0, naoClassificaveis: 0, denominadorConcepcao: 0, animaisComPendenciaElegibilidade: 0 }, taxas: { servico: null, concepcao: null, prenhez: null }, animaisUnicos: 0, participacoesAnimalPeriodo: 0 }, pendencias: [] };
}
function resultado(itens: AnimalResumo[], total = itens.length): ListarResultado {
  return { itens, total, painel: { totalAtivos: total, porCategoria: [], porSitio: [], femeasAtivas: total, receptorasAtivas: 0 } };
}
let painel: PainelReprodutivo;
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=ciclos&sitio=7");
  painel = { animais: [estado("1"), estado("2"), estado("3"), estado("4", "AGUARDANDO_DIAGNOSTICO"), estado("9", "DESCONHECIDA")], tentativas: [], avaliacoes: [], partos: [], restricoes: [] };
  vi.mocked(obterReproducao).mockResolvedValue(painel);
  vi.mocked(consultarIndicadores).mockImplementation(async f => snapshot(f));
  vi.mocked(listarAnimais).mockResolvedValue(resultado([animal("1"), animal("2", "l2"), animal("3"), animal("4"), animal("9")]));
});
afterEach(cleanup);
it("separa liberação comprovada de diagnóstico e pendências, sem projetar data futura ou exigir lançamento", async () => {
  const historico = vi.fn(); const registrar = vi.fn();
  render(<ManejoReprodutivo propriedadeId={7} podeLancar={false} onConsultarHistorico={historico} onRegistrarEvento={registrar}/>);
  await screen.findAllByText("V4-1");
  expect(screen.queryByRole("button", { name: /^Liberadas sem serviço/ })).toBeNull();
  expect(screen.queryByText("V4-3")).toBeNull(); expect(screen.getAllByText("V4-4")[0]).toBeTruthy();
  expect(screen.getAllByText("0 dias sem serviço")[0]).toBeTruthy(); expect(screen.queryByText("Registrar evento")).toBeNull();
  expect(consultarIndicadores).toHaveBeenCalledWith({ propriedadeId: 7, inicio: hoje, fim: hoje, corte: hoje, deslocamentoTeDias: 7 });
  fireEvent.click(screen.getAllByRole("link", { name: "Abrir ficha" })[0]);
  expect(navegarConsultaComSitio).toHaveBeenCalledWith("/pecuaria/rebanho/animais/1#reproducao", 7);
  await abrirFiltrosConsulta();
  await alterarControle(screen.getByLabelText("Filtrar situação do manejo"), { target: { value: "diagnostico" } });
  await aplicarFiltrosConsulta();
  expect(screen.getAllByText("V4-4")[0]).toBeTruthy(); expect(screen.getAllByText("7 dias desde a tentativa")[0]).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Revisar pendências" }));
  expect(screen.getAllByText("V4-9")[0]).toBeTruthy(); expect(screen.getAllByText("Não há parto ou situação inicial que comprove o início do acompanhamento.")[0]).toBeTruthy();
  expect(screen.queryByText("V4-1")).toBeNull();
  expect(screen.queryByText("Consultar todos os animais e ciclos")).toBeNull(); expect(historico).not.toHaveBeenCalled();
});
it("filtra contagens globais antes de paginar, muda ordem e preserva URL e tamanho da página", async () => {
  const ids = ["1", "2", "5", "6", "7", "8"];
  vi.mocked(listarAnimais).mockResolvedValue(resultado(ids.map(id => animal(id, id === "2" ? "l2" : "l1"))));
  vi.mocked(consultarIndicadores).mockImplementation(async f => { const s = snapshot(f); s.acompanhamento!.espera.filaAtual = ids.map((id,i) => espera(id, `2026-10-${String(i + 1).padStart(2,"0")}`)); return s; });
  render(<ManejoReprodutivo propriedadeId={7} podeLancar/>);
  await screen.findByText("1–4 de 6 animais");
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("5–6 de 6 animais")).toBeTruthy();
  await abrirFiltrosConsulta();
  await alterarControle(screen.getByLabelText("Filtrar lote"), { target: { value: "l2" } });
  await aplicarFiltrosConsulta();
  expect(screen.getByText("1–1 de 1 animais")).toBeTruthy(); expect(screen.queryByRole("button", { name: /^Liberadas sem serviço/ })).toBeNull();
  expect(screen.queryByText("V4-1")).toBeNull(); expect(screen.getAllByText("V4-2")[0]).toBeTruthy();
  expect(new URLSearchParams(window.location.search).get("pagina")).toBe("1");
  await abrirFiltrosConsulta();
  await alterarControle(screen.getByLabelText("Filtrar lote"), { target: { value: "" } });
  await alterarControle(screen.getByLabelText("Ordenar animais"), { target: { value: "menor-espera" } });
  await aplicarFiltrosConsulta();
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  const tabela = screen.getByRole("table", { name: "Animais e acompanhamentos" });
  expect(within(tabela).getAllByRole("row")[1].textContent).toContain("V4-8");
  await alterarControle(screen.getByLabelText("Animais por página"), { target: { value: "10" } });
  expect(screen.getByText("1–6 de 6 animais")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Buscar animal"), { target: { value: "Animal 5" } });
  expect(screen.queryByRole("button", { name: /^Liberadas sem serviço/ })).toBeNull();
  expect(window.location.search).toContain("sitio=7"); expect(window.location.search).toContain("porPagina=10");
});
it("percorre todas as páginas da lista autorizada e restaura filtros ao voltar", async () => {
  vi.mocked(listarAnimais).mockResolvedValueOnce(resultado([animal("1")], 2)).mockResolvedValueOnce(resultado([animal("2", "l2")], 2));
  render(<ManejoReprodutivo propriedadeId={7} podeLancar={false}/>);
  await screen.findAllByText("V4-2");
  expect(listarAnimais).toHaveBeenNthCalledWith(2, expect.objectContaining({ propriedadeId: 7, page: 2, pageSize: 100 }), 7);
  window.history.pushState(null, "", "/pecuaria/reproducao?rotina=ciclos&fila=liberadas&lote=l2&pagina=999&porPagina=10");
  fireEvent(window, new PopStateEvent("popstate"));
  expect(screen.queryByText("V4-1")).toBeNull(); expect(screen.getByText("1–1 de 1 animais")).toBeTruthy();
});
it("ignora respostas do sítio anterior e permite repetir leitura após falha", async () => {
  let resolver!: (p: PainelReprodutivo) => void;
  vi.mocked(obterReproducao).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; })).mockRejectedValueOnce(new Error("Falha de conexão"));
  const { rerender } = render(<ManejoReprodutivo propriedadeId={7} podeLancar={false}/>);
  await waitFor(() => expect(resolver).toBeTypeOf("function"));
  rerender(<ManejoReprodutivo propriedadeId={8} podeLancar={false}/>);
  await screen.findByText("Falha de conexão");
  resolver(painel);
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findAllByText("V4-1");
  expect(obterReproducao).toHaveBeenLastCalledWith(undefined, 8);
  expect(consultarIndicadores).toHaveBeenLastCalledWith(expect.objectContaining({ propriedadeId: 8, corte: hoje }));
});
it("não faz consulta consolidada implícita e mantém ação de registro quando autorizada", async () => {
  const registrar = vi.fn();
  const { rerender } = render(<ManejoReprodutivo podeLancar onRegistrarEvento={registrar}/>);
  expect(obterReproducao).not.toHaveBeenCalled();
  expect(screen.getByText("Selecione um sítio para consultar as filas de manejo.")).toBeTruthy();
  rerender(<ManejoReprodutivo propriedadeId={7} podeLancar onRegistrarEvento={registrar}/>);
  await screen.findAllByText("V4-1");
  fireEvent.click(screen.getByRole("button", { name: "Registrar evento" })); expect(registrar).toHaveBeenCalledOnce();
});
it("exclui baixadas, servidas e gestantes e mantém pendências de escopo da fila fora das liberadas", async () => {
  painel.animais = [estado("1"), estado("2", "GESTANTE"), estado("3"), estado("4"), estado("9")];
  vi.mocked(listarAnimais).mockResolvedValue(resultado([animal("1"), animal("2"), { ...animal("3"), situacao: "BAIXADO" }, animal("4"), animal("9")]));
  vi.mocked(consultarIndicadores).mockImplementation(async f => {
    const s = snapshot(f); const a = s.acompanhamento!;
    a.espera.filaAtual = [espera("1"), espera("1"), espera("2"), espera("3"), { ...espera("4"), primeiroServico: { id: "t4", data: "2026-10-12", tipo: "IA" } }];
    a.exclusoesEscopo = [{ animalId: "9", populacao: "FILA_ATUAL", referenciaId: "c9", motivos: ["PAPEL_DESCONHECIDO"] }];
    return s;
  });
  render(<ManejoReprodutivo propriedadeId={7} podeLancar={false}/>);
  await screen.findAllByText("V4-1");
  expect(screen.queryByRole("button", { name: /^Liberadas sem serviço/ })).toBeNull();
  for (const id of ["2","3","4"]) expect(screen.queryByText(`V4-${id}`)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Revisar pendências" }));
  expect(screen.getAllByText("Papel reprodutivo não informado.").length).toBeGreaterThan(0);
});

it("alterna cartões e tabela preservando recorte, ordem, página e lista autorizada", async () => {
  window.history.replaceState(null, "", "/pecuaria/reproducao?rotina=ciclos&sitio=7&fila=diagnostico&q=Animal&porPagina=10");
  render(<ManejoReprodutivo propriedadeId={7} podeLancar={false}/>);
  await screen.findByText("V4-4");
  expect(screen.getByRole("button", { name: "Cartões" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getAllByRole("link", { name: "Abrir ficha" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getByRole("table", { name: "Aguardando diagnóstico" })).toBeTruthy();
  expect(screen.getByText("1–1 de 1 animais")).toBeTruthy();
  expect(window.location.search).toContain("fila=diagnostico");
  expect(window.location.search).toContain("q=Animal");
  expect(window.location.search).toContain("porPagina=10");
  expect(window.location.search).toContain("visualAnimaisReproducao=tabela");
  fireEvent.click(screen.getByRole("button", { name: "Cartões" }));
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getAllByRole("link", { name: "Abrir ficha" })).toHaveLength(1);
  expect(obterReproducao).toHaveBeenCalledTimes(1);
});
