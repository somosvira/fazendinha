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
beforeEach(() => { window.history.replaceState(null, "", "/"); localStorage.clear(); vi.clearAllMocks(); vi.mocked(consultarLeite).mockResolvedValue(dados); });
it("preserva zero/D0, ordenha pendente e carência em revisão sem prescrever descarte", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("0 dias em lactação");
  expect(screen.getAllByText("0 L").length).toBeGreaterThan(0);
  expect(screen.getByText("Carência em revisão — confira os registros sanitários.")).toBeTruthy();
  expect(screen.getByText("Medição pendente")).toBeTruthy();
  expect(screen.queryByText("Leite liberado")).toBeNull();
});
it("estado vazio não comprova zero/segagem e histórico sem lactação permanece desconhecido", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, itens: [], total: 0, totaisPeriodo: { ...resumo, litros: null } });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  expect(await screen.findByText("Nenhuma aferição no período")).toBeTruthy();
  expect(screen.queryByText("Sem registros não significa produção zero nem secagem.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Sobre ausência de aferições" }));
  expect(await screen.findByText("Sem registros não significa produção zero nem secagem.")).toBeTruthy();
  expect(screen.queryByText("Litros registrados no período")).toBeNull();
});
it("preserva conteúdo ao recolher histórico e agrupa a rotina com a cobertura", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, controleIndividual: { quantidade: 1, unidade: "MESES", ultimaAfericao: null, proximaAfericao: null } });
  const { container } = render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("0 dias em lactação");
  expect(screen.getByRole("heading", { name: "Histórico produtivo" })).toBeTruthy();
  const recolher = screen.getByRole("button", { name: "Histórico produtivo" });
  const conteudo = container.querySelector("#historico-produtivo-leite-conteudo")!;
  expect(recolher.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(recolher);
  expect(conteudo.hasAttribute("hidden")).toBe(true);
  expect(conteudo.textContent).toContain("0 dias em lactação");
  fireEvent.click(recolher);
  expect(conteudo.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector("details")).toBeNull();
  const rotina = screen.getByRole("group", { name: "Rotina e cobertura do controle individual" });
  expect(within(rotina).getByText("A cada 1 mês")).toBeTruthy();
  expect(within(rotina).getByText("Não registrada")).toBeTruthy();
  expect(within(rotina).getByText("Aguarda a primeira aferição")).toBeTruthy();
  expect(within(rotina).getByText("1 de 3 dias")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Carência do leite" })).toBeTruthy();
});
it("erro de leitura não aparece como ausência e permite nova tentativa", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Consulta indisponível"));
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("Consulta indisponível");
  expect(screen.queryByText(/Nenhum registro de produção/)).toBeNull();
  fireEvent.click(screen.getByText("Tentar novamente"));
  await screen.findByText("0 dias em lactação");
});
it("aplica período personalizado em ISO preservando o sítio", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={7} />);
  await screen.findByText("0 dias em lactação");
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: /Período da produção/ }));
  fireEvent.click(screen.getByRole("button", { name: "Período personalizado" }));
  fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-03" } });
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  fireEvent.click(screen.getByRole("button", { name: "Aplicar período" }));
  await screen.findByText("0 dias em lactação");
  expect(consultarLeite).toHaveBeenLastCalledWith("/animais/animal?inicio=2026-10-01&fim=2026-10-03&pagina=1&tamanho=20", 7);
});
it("mantém litros históricos quando a finalidade aguarda conciliação", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados,
    itens: dados.itens.map(d => ({ ...d, finalidade: { ...d.finalidade, estado: "PENDENTE_CONCILIACAO", aptidao: null, regra: null }, totais: { ...d.totais, litros: 18.5 } })),
    totaisPeriodo: { ...resumo, litros: 18.5 },
  });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("Finalidade histórica a conciliar");
  expect(within(screen.getByRole("article")).getByText("18,5 L")).toBeTruthy();
  expect(screen.getByText("Litros registrados preservados; finalidade ainda não comprovada.")).toBeTruthy();
});
it("resume o período completo antes da página e alterna cartões/tabela sem nova consulta", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, total: 30, seriePeriodo: [
    { participanteId: "anterior", data: "2026-10-01", litros: 30, completa: true, excluido: false, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
    { participanteId: "ultima", data: "2026-10-03", litros: 24, completa: true, excluido: false, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
  ] });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  const ultima = await screen.findByRole("region", { name: "Última aferição" });
  expect(within(ultima).getByText("24 L")).toBeTruthy();
  expect(within(ultima).getByText(/−6 L frente à anterior/)).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Média dos dias medidos" })).getByText("27 L")).toBeTruthy();
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  expect(screen.getByRole("article")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
  expect(screen.getByRole("table")).toBeTruthy();
  expect(screen.queryByRole("article")).toBeNull();
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  expect(screen.getByText("Página 1 · 30 registros")).toBeTruthy();
});
it("descarta resposta antiga ao trocar o animal e não apresenta queda para subtotal parcial", async () => {
  let concluir!: (r: HistoricoProdutivo) => void;
  vi.mocked(consultarLeite).mockImplementationOnce(() => new Promise<HistoricoProdutivo>(resolve => { concluir = resolve; }));
  vi.mocked(consultarLeite).mockResolvedValueOnce({ ...dados, seriePeriodo: [
    { participanteId: "ant", data: "2026-10-01", litros: 30, completa: true, excluido: false, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
    { participanteId: "ult", data: "2026-10-03", litros: 10, completa: false, excluido: false, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
    { participanteId: "ex", data: "2026-10-04", litros: 999, completa: true, excluido: true, lactacaoId: "l", comparabilidade: "manha:MEDIDO", finalidade: "COMPROVADA" },
  ] });
  const { rerender } = render(<HistoricoProdutivoLeite animalId="antigo" propriedadeId={1}/>);
  rerender(<HistoricoProdutivoLeite animalId="novo" propriedadeId={1}/>);
  const ultima = await screen.findByRole("region", { name: "Última aferição" });
  expect(within(ultima).getByText("10 L")).toBeTruthy();
  expect(within(ultima).getByText("Sem comparação equivalente")).toBeTruthy();
  concluir({ ...dados, itens: [] });
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(within(screen.getByRole("region", { name: "Última aferição" })).getByText("10 L")).toBeTruthy();
  expect(screen.queryByText("999 L")).toBeNull();
});

it("ficha com apenas controles documentais mostra o histórico sem criar aferições, totais ou curva", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, itens: [], total: 0, seriePeriodo: [], totaisPeriodo: { ...resumo, litros: null }, controlesDocumentais: [{
    id: "doc", tipo: "CONTROLE_PERIODICO", inicio: "2026-10-02", fim: "2026-10-02", total: "22.4", unidade: "L",
    referenciaUnidade: "Litros declarados pelo usuário, sem conversão", parcelas: [{ rotulo: "Manhã", hora: null, quantidade: 12.1 }],
    lactacaoId: null, origemColetiva: null, versao: 1, contexto: "INTERNO", semEfeitoEstoqueFinanceiro: true,
    origem: { banco: "IDEAGRI", chave: "CONTROLE:0001", evidencia: "Documento original conferido" },
  }] });
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  expect(await screen.findByText("22,4 L")).toBeTruthy();
  expect(screen.getByText("Litros declarados pelo usuário, sem conversão")).toBeTruthy();
  expect(screen.getByText("Nenhuma aferição no período")).toBeTruthy();
  expect(screen.queryByText("Litros registrados no período")).toBeNull();
  expect(screen.queryByRole("region", { name: "Última aferição" })).toBeNull();
});
