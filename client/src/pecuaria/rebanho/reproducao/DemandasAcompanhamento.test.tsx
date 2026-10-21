// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DemandasAcompanhamento } from "./DemandasAcompanhamento";
vi.mock("./api", () => ({ reqV4: vi.fn().mockResolvedValue({ itens: [{ id: "d", tarefaId: "t", finalidade: "SEXAGEM", ocorrencia: 1, tentativaId: null, gestacaoId: null, previstaPara: null, estado: "PENDENTE", motivoEncerramento: null, regraSnapshot: {}, exameResolucaoId: null }], total: 1, pagina: 1, porPagina: 10, resumo: { total: 1, pendentes: 1, resolvidas: 0, encerradas: 0, semData: 1 } }) }));
afterEach(cleanup);
it("mostra acompanhamento sem prazo configurado sem inventar data ou regra", async () => {
  render(<DemandasAcompanhamento animalId="a" propriedadeId={7} painel={{ animais: [], tentativas: [], avaliacoes: [], partos: [], restricoes: [] }} podeLancar={false} onAvaliar={vi.fn()} atualizacao={1} />);
  expect(await screen.findByText("Sem data definida")).toBeTruthy();
  expect(screen.getByRole("cell", { name: "Sexagem" })).toBeTruthy();
  expect(screen.getByText("Acompanhamento do exame")).toBeTruthy();
  expect(screen.queryByText(/Regra versão/)).toBeNull();
});
