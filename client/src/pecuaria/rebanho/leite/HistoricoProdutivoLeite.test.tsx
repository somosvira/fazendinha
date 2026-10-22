// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
beforeEach(() => { vi.clearAllMocks(); vi.mocked(consultarLeite).mockResolvedValue(dados); });
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
  expect(await screen.findByText("Nenhum registro de produção neste período. A ausência de registros não confirma produção zero nem secagem.")).toBeTruthy();
});
it("erro de leitura não aparece como ausência e permite nova tentativa", async () => {
  vi.mocked(consultarLeite).mockRejectedValueOnce(new Error("Consulta indisponível"));
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={1} />);
  await screen.findByText("Consulta indisponível");
  expect(screen.queryByText(/Nenhum registro de produção/)).toBeNull();
  fireEvent.click(screen.getByText("Tentar novamente"));
  await screen.findByText("0 dias em lactação");
});
it("filtro usa o mesmo endpoint de leitura e mantém sítio explícito", async () => {
  render(<HistoricoProdutivoLeite animalId="animal" propriedadeId={7} />);
  await screen.findByText("0 dias em lactação");
  fireEvent.change(screen.getByLabelText("Produção desde"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Produção até"), { target: { value: "2026-10-03" } });
  fireEvent.click(screen.getByText("Consultar período"));
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
  expect(screen.getAllByText("18,5 L").length).toBe(2);
  expect(screen.getByText("Litros registrados preservados; finalidade ainda não comprovada.")).toBeTruthy();
});
