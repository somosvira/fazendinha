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
it("deixa histórico, ordenhas e carência visíveis e agrupa a rotina com a cobertura", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ ...dados, controleIndividual: { quantidade: 1, unidade: "MESES", ultimaAfericao: null, proximaAfericao: null } });
  const { container } = render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("0 dias em lactação");
  expect(screen.getByRole("heading", { name: "Histórico produtivo" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Histórico produtivo" })).toBeNull();
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
it("edita datas em português no rascunho e consulta em ISO mantendo o sítio explícito", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={7} />);
  await screen.findByText("0 dias em lactação");
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.change(screen.getByLabelText("Produção desde"), { target: { value: "01/10/2026" } });
  fireEvent.change(screen.getByLabelText("Produção até"), { target: { value: "03/10/2026" } });
  expect((screen.getByLabelText("Produção desde") as HTMLInputElement).value).toBe("01/10/2026");
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  fireEvent.click(screen.getByText("Consultar período"));
  await screen.findByText("0 dias em lactação");
  expect(consultarLeite).toHaveBeenLastCalledWith("/animais/animal?inicio=2026-10-01&fim=2026-10-03&pagina=1&tamanho=20", 7);
});
it("não consulta um período invertido nem reutiliza a data anterior quando o texto é inválido", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={7} />);
  await screen.findByText("0 dias em lactação");
  const chamadas = vi.mocked(consultarLeite).mock.calls.length;
  fireEvent.change(screen.getByLabelText("Produção desde"), { target: { value: "03/10/2026" } });
  fireEvent.change(screen.getByLabelText("Produção até"), { target: { value: "01/10/2026" } });
  fireEvent.click(screen.getByText("Consultar período"));
  expect(screen.getByText("Informe um período válido, com o fim posterior ao início.")).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
  const fim = screen.getByLabelText("Produção até") as HTMLInputElement;
  fireEvent.change(fim, { target: { value: "31/02/2026" } });
  fireEvent.click(screen.getByText("Consultar período"));
  expect(fim.validity.valid).toBe(false);
  expect(fim.value).toBe("31/02/2026");
  expect(consultarLeite).toHaveBeenCalledTimes(chamadas);
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
