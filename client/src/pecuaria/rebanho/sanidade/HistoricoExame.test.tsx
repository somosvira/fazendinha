// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { HistoricoExame } from "./HistoricoExame";
import { consultarHistoricoExame } from "./api";
vi.mock("./api", () => ({ consultarHistoricoExame: vi.fn() }));
afterEach(cleanup);
it("separa vínculo de Serviço do resultado e respeita valores mascarados", async () => {
  vi.mocked(consultarHistoricoExame).mockResolvedValue({ exameId: "e", pagina: 1, tamanho: 20, total: 1, itens: [{ id: "h", acao: "PROCEDIMENTO_SERVICO", criadoEm: "2026-10-06T13:00:00Z", usuarioId: 1, autor: { id: 1, nome: "Maria" }, motivo: "Vínculo conferido", antes: null, depois: { servicoId: "servico" } }] });
  render(<HistoricoExame exameId="e" propriedadeId={1} formato={{ tipoResultado: "NUMERO", unidade: "kg" }} />);
  await screen.findByText("Vínculo ao Serviço atualizado");
  expect(screen.getByText("Depois: Serviço vinculado")).toBeTruthy();
  expect(screen.getByText("Antes: Não registrado")).toBeTruthy();
  expect(screen.queryByText(/Aguardando resultado/)).toBeNull();
  expect(screen.queryByText(/R\$/)).toBeNull();
  expect(screen.getByText(/Maria/)).toBeTruthy();
});
it("distingue coleta, anulação e atribuição legada sem inventar resultados ausentes", async () => {
  const base = { criadoEm: "2026-10-06T13:00:00Z", usuarioId: null, autor: null, motivo: null, antes: null };
  vi.mocked(consultarHistoricoExame).mockResolvedValue({ exameId: "e", pagina: 1, tamanho: 20, total: 3, itens: [
    { ...base, id: "coleta", acao: "REGISTRO", depois: { resultadoNumero: 0 } },
    { ...base, id: "anulacao", acao: "ANULACAO", depois: { status: "ANULADO" } },
    { ...base, id: "servico", acao: "RATEIO_SERVICO", depois: { servicoId: "servico", valor: null } },
  ] });
  render(<HistoricoExame exameId="e" propriedadeId={1} formato={{ tipoResultado: "NUMERO", unidade: "kg" }} />);
  await screen.findByText("Coleta registrada");
  expect(screen.getByText("Depois: 0 kg")).toBeTruthy();
  expect(screen.getByText("Exame anulado")).toBeTruthy();
  expect(screen.getByText("Depois: Anulado — resultado não registrado nesta alteração")).toBeTruthy();
  expect(screen.getByText("Valor atribuído ao Serviço atualizado")).toBeTruthy();
  expect(screen.queryByText(/Aguardando resultado/)).toBeNull();
});
