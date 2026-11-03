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
  expect(screen.getByText("Serviço vinculado")).toBeTruthy();
  expect(screen.getByText("Não registrado")).toBeTruthy();
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
  expect(screen.getByText("0 kg")).toBeTruthy();
  expect(screen.getByText("Exame anulado")).toBeTruthy();
  expect(screen.getByText("Anulado — resultado não registrado nesta alteração")).toBeTruthy();
  expect(screen.getByText("Valor atribuído ao Serviço atualizado")).toBeTruthy();
  expect(screen.queryByText(/Aguardando resultado/)).toBeNull();
});
it("recupera resultados múltiplos dos snapshots antes e depois, incluindo zero e falso", async () => {
  vi.mocked(consultarHistoricoExame).mockResolvedValue({ exameId: "e", pagina: 1, tamanho: 20, total: 1, itens: [{ id: "multi", acao: "RESULTADO_CORRIGIDO", criadoEm: "2026-10-26T13:00:00Z", usuarioId: null, autor: null, motivo: "Resultado revisto", antes: { resultadoNumero: null, resultados: [{ campo: "ESCORE", valor: 0 }, { campo: "REAGENTE", valor: false }] }, depois: { resultadoNumero: null, resultados: [{ campo: "ESCORE", valor: 3 }, { campo: "REAGENTE", valor: true }] } }] });
  render(<HistoricoExame exameId="e" formato={{ tipoResultado: "MULTIPLO", campos: [{ codigo: "ESCORE", rotulo: "Escore", tipo: "NUMERO" }, { codigo: "REAGENTE", rotulo: "Reagente", tipo: "BOOLEANO" }] }} />);
  expect(await screen.findByText(/Escore: 0 · Reagente: Não/)).toBeTruthy();
  expect(screen.getByText(/Escore: 3 · Reagente: Sim/)).toBeTruthy();
  expect(screen.queryByText(/Aguardando resultado/)).toBeNull();
});
it("não preenche um snapshot múltiplo ausente com o resultado de outra alteração", async () => {
  vi.mocked(consultarHistoricoExame).mockResolvedValue({ exameId: "e", pagina: 1, tamanho: 20, total: 1, itens: [{ id: "ausente", acao: "RESULTADO_CORRIGIDO", criadoEm: "2026-10-26T13:00:00Z", usuarioId: null, autor: null, motivo: null, antes: { resultadoNumero: null }, depois: { resultados: [{ campo: "DADOS", valor: { valor: 0, reagente: false } }] } }] });
  render(<HistoricoExame exameId="e" formato={{ tipoResultado: "MULTIPLO", campos: [{ codigo: "DADOS", rotulo: "Dados", tipo: "TEXTO" }] }} />);
  expect(await screen.findByText(/Dados: \{"valor":0,"reagente":false\}/)).toBeTruthy();
  expect(screen.queryByText(/Aguardando resultado/)).toBeNull();
  expect(screen.queryByRole("button", { name: "Anterior" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
});
