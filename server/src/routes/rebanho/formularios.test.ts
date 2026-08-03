import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  campos: vi.fn(),
  listarModelos: vi.fn(),
  criarModelo: vi.fn(),
  editarModelo: vi.fn(),
  excluirModelo: vi.fn(),
  criarFolha: vi.fn(),
  listarFolhas: vi.fn(),
  obterFolha: vi.fn(),
  salvarLinhas: vi.fn(),
  concluirFolha: vi.fn(),
  cancelarFolha: vi.fn(),
  leitura: vi.fn(),
  escrita: vi.fn(),
}));

vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));
vi.mock("../../services/rebanho/formularios.campos.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/rebanho/formularios.campos.js")>();
  return { ...actual, camposParaTemplate: mocks.campos };
});
vi.mock("../../services/rebanho/formularios.modelos.js", () => ({
  ModeloFormularioError: class extends Error {},
  listarModelosFormulario: mocks.listarModelos,
  criarModeloFormulario: mocks.criarModelo,
  editarModeloFormulario: mocks.editarModelo,
  excluirModeloFormulario: mocks.excluirModelo,
}));
vi.mock("../../services/rebanho/formularios.folhas.js", () => ({
  FormularioFolhaError: class extends Error {},
  criarFolhaCampo: mocks.criarFolha,
  listarFolhasCampo: mocks.listarFolhas,
  obterFolhaCampo: mocks.obterFolha,
  salvarLinhasFolha: mocks.salvarLinhas,
  concluirFolhaCampo: mocks.concluirFolha,
  cancelarFolhaCampo: mocks.cancelarFolha,
}));

import { formulariosRouter } from "./formularios.js";

const config = { colunasSistema: ["animal", "data"], camposPapel: ["resultado_dg", "data_evento"] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leitura.mockResolvedValue(7);
  mocks.escrita.mockResolvedValue(7);
  mocks.campos.mockReturnValue([{ chave: "resultado_dg" }]);
  mocks.listarModelos.mockResolvedValue([]);
  mocks.criarModelo.mockResolvedValue({ id: 1 });
  mocks.criarFolha.mockResolvedValue({ id: 20 });
  mocks.listarFolhas.mockResolvedValue([]);
  mocks.salvarLinhas.mockResolvedValue({ id: 20 });
  mocks.concluirFolha.mockResolvedValue({ id: 20, status: "CONCLUIDA" });
});

describe("rotas dos formulários de campo", () => {
  it("lista campos e modelos no escopo", async () => {
    const campos = await formulariosRouter.request("/rebanho/formularios/campos?templateId=ia-periodo");
    const modelos = await formulariosRouter.request("/rebanho/formularios/modelos?templateId=ia-periodo");

    expect(campos.status).toBe(200);
    expect(modelos.status).toBe(200);
    expect(mocks.listarModelos).toHaveBeenCalledWith(7, "ia-periodo");
  });

  it("cria modelo e folha validando os payloads", async () => {
    const modelo = await formulariosRouter.request("/rebanho/formularios/modelos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: "Toque", templateId: "ia-periodo", config }),
    });
    const folha = await formulariosRouter.request("/rebanho/formularios/folhas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: "Toque julho", filtros: { templateId: "ia-periodo", dataInicio: "2026-07-01", dataFim: "2026-07-31" }, config }),
    });

    expect(modelo.status).toBe(201);
    expect(folha.status).toBe(201);
    expect(mocks.criarModelo).toHaveBeenCalledWith(expect.objectContaining({ nome: "Toque" }), 7);
    expect(mocks.criarFolha).toHaveBeenCalledWith(expect.objectContaining({ filtros: expect.objectContaining({ status: "ATIVO" }) }), 7);
  });

  it("salva rascunho e conclui a folha", async () => {
    const rascunho = await formulariosRouter.request("/rebanho/formularios/folhas/20/linhas", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linhas: [{ id: 1, status: "NAO_REALIZADO", motivoNaoRealizado: "Animal ausente" }] }),
    });
    const concluir = await formulariosRouter.request("/rebanho/formularios/folhas/20/concluir", { method: "POST" });

    expect(rascunho.status).toBe(200);
    expect(concluir.status).toBe(200);
    expect(mocks.salvarLinhas).toHaveBeenCalledWith(20, expect.anything(), 7);
    expect(mocks.concluirFolha).toHaveBeenCalledWith(20, 7);
  });

  it("recusa configuração inválida antes do service", async () => {
    const resposta = await formulariosRouter.request("/rebanho/formularios/modelos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nome: "Livre", templateId: "ia-periodo", config: { colunasSistema: ["animal"], camposPapel: ["inventado"] } }),
    });

    expect(resposta.status).toBe(400);
    expect(mocks.criarModelo).not.toHaveBeenCalled();
  });
});
