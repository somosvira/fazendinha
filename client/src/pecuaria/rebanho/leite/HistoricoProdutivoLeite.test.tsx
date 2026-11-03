// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { HistoricoProdutivoLeite } from "./HistoricoProdutivoLeite";
import { consultarLeite } from "./operacoes-api";
import type { HistoricoProdutivo } from "./historico-types";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(cleanup);
const resumo = { litros: 0, esperadas: 2, medidas: 1, naoOrdenhadas: 0, pendentes: 1, resolvidas: 1, completa: false };
const dados: HistoricoProdutivo = { propriedadeId: 1, animal: { id: "animal", brinco: "123", nome: null }, periodo: { inicio: "2026-10-01", fim: "2026-10-03" },
  itens: [{ participanteId: "p", dataOperacional: "2026-10-01", finalidade: { estado: "COMPROVADA", finalidadeId: "f", aptidao: "LEITE", dataOperacional: "2026-10-01", regra: "FINALIDADE_LEITE_V1" }, lactacao: { id: "l", inicio: "2026-10-01", encerradaEm: null }, del: 0, convencaoDel: "D0", excluidoEm: null, motivoExclusao: null, totais: resumo,
    medicoes: [{ id: "m", posicaoId: "manha", nomeOrdenha: "Manhã", estado: "MEDIDO", litros: 0, motivo: null }, { id: null, posicaoId: "noite", nomeOrdenha: "Noite", estado: "PENDENTE", litros: null, motivo: null }] }],
  total: 1, pagina: 1, tamanho: 20, totaisPeriodo: resumo, coberturaPeriodo: { diasCalendario: 3, diasComRegistro: 1, diasSemRegistro: 2 },
  carenciaLeite: { disponibilidade: "DISPONIVEL", dataReferencia: "2026-10-03", leite: { estado: "NAO_INFORMADO" }, revisaoLeitePendente: true, revisaoAdministracaoPendente: false } };
beforeEach(() => { window.history.replaceState(null, "", "/"); localStorage.clear(); localStorage.setItem("terrano:leite:sessao:animalProducaoVisualizacao", "tabela"); vi.clearAllMocks(); vi.mocked(consultarLeite).mockResolvedValue(dados); });
it("preserva zero, D0, pendências e carência em revisão nos detalhes", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Detalhes" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByText("0 dias em lactação")).toBeTruthy();
  expect(within(dialog).getAllByText("0 L").length).toBeGreaterThan(0);
  expect(within(dialog).getByText("Medição pendente")).toBeTruthy();
  expect(screen.getByText("Carência em revisão — confira os registros sanitários.")).toBeTruthy();
  expect(screen.queryByText("Leite liberado")).toBeNull();
});
it("ausência não vira produção zero ou secagem", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, itens: [], total: 0, totaisPeriodo: { ...resumo, litros: null } });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  await screen.findByText("Nenhuma aferição no período");
  expect(screen.queryByRole("region", { name: "Volume conhecido" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Sobre ausência de aferições" }));
  expect(await screen.findByText("Sem registros não significa produção zero nem secagem.")).toBeTruthy();
});
it("recolhe produção inteira, incluindo a carência, e esconde suas ações", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, controleIndividual: { quantidade: 1, unidade: "MESES", ultimaAfericao: null, proximaAfericao: null } });
  const { container } = render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  await screen.findByText("A cada 1 mês");
  fireEvent.click(screen.getByRole("button", { name: "Produção individual" }));
  expect(container.querySelector("#historico-produtivo-leite-conteudo")!.hasAttribute("hidden")).toBe(true);
  expect(screen.queryByRole("button", { name: "Abrir controle individual" })).toBeNull();
  expect(screen.queryByRole("region", { name: "Carência do leite" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Produção individual" }));
  expect(screen.getByRole("region", { name: "Carência do leite" })).toBeTruthy();
  expect(screen.getByText("1 de 3 dias")).toBeTruthy();
});
it("falha não aparece como ausência e permite tentar novamente", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Consulta indisponível"));
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  await screen.findByText("Consulta indisponível");
  expect(screen.queryByText("Nenhuma aferição no período")).toBeNull();
  fireEvent.click(screen.getByText("Tentar novamente"));
  await screen.findByRole("button", { name: "Detalhes" });
});
it("aplica período somente após confirmação e conserva o sítio", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={7}/>);
  await screen.findByRole("button", { name: "Detalhes" });
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: /Período da produção/ }));
  fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-03" } });
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
  await screen.findByRole("button", { name: "Detalhes" });
  expect(consultarLeite).toHaveBeenLastCalledWith("/animais/animal?inicio=2026-10-01&fim=2026-10-03&pagina=1&tamanho=100", 7);
});
it("busca em todas as páginas, sem incluir excluídas nos indicadores", async () => {
  const excluida = { ...dados.itens[0], participanteId: "ex", dataOperacional: "2026-10-02", excluidoEm: "2026-10-03", totais: { ...resumo, litros: 999 } };
  vi.mocked(consultarLeite).mockImplementation(async url => ({ ...dados, total: 2, tamanho: 1, itens: url.includes("pagina=2") ? [excluida] : dados.itens, seriePeriodo: [
    { participanteId: "p", data: "2026-10-01", litros: 0, completa: false, excluido: false, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
    { participanteId: "ex", data: "2026-10-02", litros: 999, completa: false, excluido: true, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
  ] }));
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  await screen.findByText("999 L");
  expect(within(screen.getByRole("region", { name: "Última aferição" })).getByText("0 L")).toBeTruthy();
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar aferição" }), { target: { value: "02/10" } });
  expect(screen.getAllByRole("button", { name: "Detalhes" })).toHaveLength(1);
  expect(screen.getByText("Excluída")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Gráfico" }));
  expect(screen.getByText(/Nenhum volume conhecido para o gráfico/)).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
});
it("descarta resposta antiga ao trocar o animal", async () => {
  let concluir!: (r: HistoricoProdutivo) => void;
  vi.mocked(consultarLeite).mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  const { rerender } = render(<HistoricoProdutivoLeite animalId="antigo" propriedadeId={1}/>);
  rerender(<HistoricoProdutivoLeite animalId="novo" propriedadeId={1}/>);
  await screen.findByRole("button", { name: "Detalhes" });
  concluir({ ...dados, itens: [], total: 0 });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(screen.getByRole("button", { name: "Detalhes" })).toBeTruthy();
});
it("mantém a evidência de finalidade pendente dentro do detalhe", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, itens: dados.itens.map(d => ({ ...d, finalidade: { ...d.finalidade, estado: "PENDENTE_CONCILIACAO" }, totais: { ...d.totais, litros: 18.5 } })) });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Detalhes" }));
  expect(within(screen.getByRole("dialog")).getByText("18,5 L")).toBeTruthy();
  expect(screen.getByText("Finalidade histórica a conciliar")).toBeTruthy();
});
