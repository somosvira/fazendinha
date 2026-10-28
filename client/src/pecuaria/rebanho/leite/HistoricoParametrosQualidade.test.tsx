import { selecionarCampoLeite } from "./select-campo-teste";
// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { HistoricoParametrosQualidade } from "./HistoricoParametrosQualidade";
import { consultarLeite } from "./operacoes-api";
const tela = { ...screen,
  getByRole: (...args: Parameters<typeof screen.getByRole>) => screen.getAllByRole(...args)[0],
  findByRole: async (...args: Parameters<typeof screen.findByRole>) => (await screen.findAllByRole(...args))[0],
  getByText: (...args: Parameters<typeof screen.getByText>) => screen.getAllByText(...args)[0],
  findByText: async (...args: Parameters<typeof screen.findByText>) => (await screen.findAllByText(...args))[0],
  getByLabelText: (...args: Parameters<typeof screen.getByLabelText>) => screen.getAllByLabelText(...args)[0],
  findByLabelText: async (...args: Parameters<typeof screen.findByLabelText>) => (await screen.findAllByLabelText(...args))[0],
};
vi.mock("./operacoes-api", () => ({ consultarLeite: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const formatos = [{ id: "f", nome: "Laudo", ativo: false, versaoFormato: 1, versaoAnteriorId: null, formatoExameHash: "a", formatoBloqueado: true, campos: [{ codigo: "NU", rotulo: "NU conforme laudo", tipo: "NUMERO" as const, obrigatorio: false }] }];
it("consulta independente por período e parâmetro, preserva zero e distingue datas", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ itens: [{ amostraId: "a", dataAmostra: "2026-10-01", registradoEm: "2026-10-03T12:00:00Z", valor: 0, unidade: null, sujeito: { tipo: "COLETIVO", origem: "Tanque A" }, formato: { nome: "Laudo", versao: 1 }, versaoAmostra: 2 }], total: 21, tamanho: 20, pagina: 1 });
  render(<HistoricoParametrosQualidade sitio={2} formatos={formatos} data="2026-10-21" revisao={0} />);
  expect(consultarLeite).not.toHaveBeenCalled();
  await selecionarCampoLeite("Parâmetro do laudo", "NU");
  await tela.findByText("Tanque A");
  expect(tela.getByText("0 (unidade não informada)")).toBeTruthy();
  fireEvent.click(tela.getByRole("button", { name: "Ver resultado" }));
  expect(tela.getByText("Resultado laboratorial: Não informado")).toBeTruthy();
  fireEvent.click(tela.getByRole("button", { name: "Fechar" }));
  expect(consultarLeite).toHaveBeenCalledWith("/qualidade/parametros?campo=NU&inicio=2026-10-01&fim=2026-10-21&pagina=1&tamanho=20&incluirSerie=true", 2);
  fireEvent.click(tela.getByRole("button", { name: "Próxima" }));
  await waitFor(() => expect(consultarLeite).toHaveBeenLastCalledWith(expect.stringContaining("pagina=2"), 2));
});
it("mostra falha e permite consultar outro parâmetro sem resultados antigos", async () => {
  vi.mocked(consultarLeite).mockRejectedValue(new Error("Serviço indisponível"));
  render(<HistoricoParametrosQualidade sitio={2} formatos={formatos} data="2026-10-21" revisao={0} />);
  await selecionarCampoLeite("Parâmetro do laudo", "NU");
  await tela.findByRole("alert");
  expect(tela.getByText("Serviço indisponível")).toBeTruthy();
});

it("exibe resultado laboratorial e recebimento separados do registro no sistema", async () => {
  vi.mocked(consultarLeite).mockResolvedValue({ itens: [{ amostraId: "a", dataAmostra: "2026-10-10", dataResultadoLaboratorial: "2026-10-15", dataRecebimentoLaudo: "2026-10-16", registradoEm: "2026-10-23T12:00:00Z", valor: 1, unidade: "%", sujeito: { tipo: "COLETIVO", origem: "Tanque A" }, formato: { nome: "Laudo", versao: 1 }, versaoAmostra: 2 }], total: 1, tamanho: 20, pagina: 1 });
  render(<HistoricoParametrosQualidade sitio={2} formatos={formatos} data="2026-10-23" revisao={0} />);
  await selecionarCampoLeite("Parâmetro do laudo", "NU");
  await tela.findByText("Tanque A");
  fireEvent.click(tela.getByRole("button", { name: "Ver resultado" }));
  expect(await tela.findByText("Resultado laboratorial: 15/10/2026")).toBeTruthy();
  expect(tela.getByText("Recebimento do laudo: 16/10/2026")).toBeTruthy();
  expect(tela.getByText(/23\/10\/2026, 09:00:00/)).toBeTruthy();
});
