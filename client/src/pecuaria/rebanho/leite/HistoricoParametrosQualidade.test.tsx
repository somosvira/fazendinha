// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoricoParametrosQualidade } from "./HistoricoParametrosQualidade";
import { consultarLeite } from "./operacoes-api";
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const formatos = [{ id: "f", nome: "Laudo", ativo: false, versaoFormato: 1, versaoAnteriorId: null, formatoExameHash: "a", formatoBloqueado: true, campos: [{ codigo: "NU", rotulo: "NU conforme laudo", tipo: "NUMERO" as const, obrigatorio: false }] }];
it("consulta independente por período e parâmetro, preserva zero e distingue datas", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ itens: [{ amostraId: "a", dataAmostra: "2026-10-01", registradoEm: "2026-10-03T12:00:00Z", valor: 0, unidade: null, sujeito: { tipo: "COLETIVO", origem: "Tanque A" }, formato: { nome: "Laudo", versao: 1 }, versaoAmostra: 2 }], total: 21, tamanho: 20, pagina: 1 });
  render(<HistoricoParametrosQualidade sitio={2} formatos={formatos} data="2026-10-21" revisao={0} />);
  expect(consultarLeite).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Parâmetro do laudo"), { target: { value: "NU" } });
  await screen.findByText("Tanque A");
  expect(screen.getByText("0 (unidade não informada)")).toBeTruthy();
  expect(screen.getByText("Data laboratorial não informada")).toBeTruthy();
  expect(consultarLeite).toHaveBeenCalledWith("/qualidade/parametros?campo=NU&inicio=2026-10-01&fim=2026-10-21&pagina=1&tamanho=20", 2);
  fireEvent.click(screen.getByRole("button", { name: "Próximos resultados" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenLastCalledWith(expect.stringContaining("pagina=2"), 2));
});
it("mostra falha e permite consultar outro parâmetro sem resultados antigos", async () => {
  vi.mocked(consultarLeite).mockRejectedValue(new Error("Serviço indisponível"));
  render(<HistoricoParametrosQualidade sitio={2} formatos={formatos} data="2026-10-21" revisao={0} />);
  fireEvent.change(screen.getByLabelText("Parâmetro do laudo"), { target: { value: "NU" } });
  await screen.findByRole("alert");
  expect(screen.getByText("Serviço indisponível")).toBeTruthy();
});
