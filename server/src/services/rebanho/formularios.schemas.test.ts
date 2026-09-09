import { describe, expect, it } from "vitest";
import {
  atualizarLinhasFolhaSchema,
  criarFolhaCampoSchema,
  criarModeloFormularioSchema,
} from "./formularios.schemas.js";

const config = {
  colunasSistema: ["animal", "data", "reprodutor"],
  camposPapel: ["resultado_dg", "data_evento", "metodo_dg"],
};

describe("schemas dos formulários de campo", () => {
  it("aceita um modelo estruturado e recusa chaves livres", () => {
    expect(criarModeloFormularioSchema.parse({
      nome: "Folha de toque mensal",
      templateId: "ia-periodo",
      config,
    })).toMatchObject({ templateId: "ia-periodo", config });

    expect(() => criarModeloFormularioSchema.parse({
      nome: "Livre",
      templateId: "ia-periodo",
      config: { ...config, camposPapel: ["campo_inventado"] },
    })).toThrow();
  });

  it("cria folha com os filtros que serão reexecutados no backend", () => {
    expect(criarFolhaCampoSchema.parse({
      nome: "Toque · julho/2026",
      filtros: {
        templateId: "ia-periodo",
        dataInicio: "2026-07-01",
        dataFim: "2026-07-31",
        status: "ATIVO",
      },
      config,
    })).toMatchObject({
      nome: "Toque · julho/2026",
      filtros: { templateId: "ia-periodo" },
    });
  });

  it("exige motivo para não realizado e respostas para preenchida", () => {
    expect(atualizarLinhasFolhaSchema.safeParse({ linhas: [{
      id: 1,
      status: "NAO_REALIZADO",
      motivoNaoRealizado: "Animal ausente",
    }] }).success).toBe(true);
    expect(atualizarLinhasFolhaSchema.safeParse({ linhas: [{
      id: 1,
      status: "NAO_REALIZADO",
    }] }).success).toBe(false);
    expect(atualizarLinhasFolhaSchema.safeParse({ linhas: [{
      id: 1,
      status: "PENDENTE",
      respostas: { resultado_dg: "positivo" },
    }] }).success).toBe(true);
    expect(atualizarLinhasFolhaSchema.safeParse({ linhas: [{
      id: 1,
      status: "PREENCHIDA",
      respostas: {},
    }] }).success).toBe(true);
    expect(atualizarLinhasFolhaSchema.safeParse({ linhas: [{
      id: 1,
      status: "PREENCHIDA",
    }] }).success).toBe(false);
  });
});
