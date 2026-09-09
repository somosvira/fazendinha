import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigFormularioCampo } from "./api";
import {
  concluirFolhaCampo,
  criarFolhaCampo,
  criarModeloFormularioCampo,
  listarCamposFormulario,
  listarFolhasCampo,
  listarModelosFormularioCampo,
  salvarLinhasFolhaCampo,
} from "./api";

function stubFetch(body: unknown) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

const config: ConfigFormularioCampo = { colunasSistema: ["animal", "data", "reprodutor"], camposPapel: ["resultado_dg", "data_evento"] };

describe("api de formulários de campo", () => {
  it("lista catálogo, modelos e folhas", async () => {
    const spy = stubFetch([]);

    await listarCamposFormulario("ia-periodo");
    await listarModelosFormularioCampo("ia-periodo");
    await listarFolhasCampo("EM_CAMPO");

    expect(spy.mock.calls.map(([url]) => url)).toEqual([
      "/api/rebanho/formularios/campos?templateId=ia-periodo",
      "/api/rebanho/formularios/modelos?templateId=ia-periodo",
      "/api/rebanho/formularios/folhas?status=EM_CAMPO",
    ]);
  });

  it("cria modelo e folha usando os contratos do relatório", async () => {
    const spy = stubFetch({ id: 20 });
    await criarModeloFormularioCampo({ nome: "Folha de toque", templateId: "ia-periodo", config });
    await criarFolhaCampo({
      nome: "Toque julho",
      filtros: { templateId: "ia-periodo", dataInicio: "2026-07-01", dataFim: "2026-07-31", status: "ATIVO" },
      config,
      modeloId: 4,
    });

    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/formularios/modelos");
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify({ nome: "Folha de toque", templateId: "ia-periodo", config }) });
    expect(spy.mock.calls[1]?.[0]).toBe("/api/rebanho/formularios/folhas");
  });

  it("salva a grade e conclui a atividade", async () => {
    const spy = stubFetch({ id: 20 });
    await salvarLinhasFolhaCampo(20, [{ id: 1, status: "PREENCHIDA", respostas: { resultado_dg: "positivo" } }]);
    await concluirFolhaCampo(20);

    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/formularios/folhas/20/linhas");
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
    expect(spy.mock.calls[1]?.[0]).toBe("/api/rebanho/formularios/folhas/20/concluir");
    expect(spy.mock.calls[1]?.[1]).toMatchObject({ method: "POST" });
  });
});
