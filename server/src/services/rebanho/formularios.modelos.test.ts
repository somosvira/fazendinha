import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../db.js", () => ({
  prisma: { modeloFormularioCampo: mocks },
}));

import {
  criarModeloFormulario,
  editarModeloFormulario,
  excluirModeloFormulario,
  listarModelosFormulario,
  ModeloFormularioError,
} from "./formularios.modelos.js";

const config = {
  colunasSistema: ["animal", "data", "reprodutor"],
  camposPapel: ["resultado_dg", "data_evento"],
} satisfies import("./formularios.schemas.js").ConfigFormulario;
const row = {
  id: 4,
  nome: "Folha de toque",
  templateId: "ia-periodo",
  config,
  propriedadeId: 7,
  createdAt: new Date("2026-08-01T10:00:00Z"),
  updatedAt: new Date("2026-08-02T10:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([row]);
  mocks.findFirst.mockResolvedValue(row);
  mocks.create.mockResolvedValue(row);
  mocks.update.mockResolvedValue(row);
  mocks.delete.mockResolvedValue(row);
});

describe("modelos de formulário por propriedade", () => {
  it("lista somente modelos do escopo e template pedido", async () => {
    const resultado = await listarModelosFormulario(7, "ia-periodo");

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { propriedadeId: 7, templateId: "ia-periodo" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    expect(resultado[0]).toMatchObject({ id: 4, config, propriedadeId: 7 });
  });

  it("cria e edita mantendo o escopo", async () => {
    await criarModeloFormulario({ nome: row.nome, templateId: "ia-periodo", config }, 7);
    expect(mocks.create).toHaveBeenCalledWith({ data: {
      nome: row.nome,
      templateId: "ia-periodo",
      config,
      propriedadeId: 7,
    } });

    await editarModeloFormulario(4, { nome: "Toque mensal" }, 7);
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: 4, propriedadeId: 7 } });
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { nome: "Toque mensal" } });
  });

  it("não altera nem exclui modelo de outra propriedade", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(editarModeloFormulario(4, { nome: "Outro" }, 8)).rejects.toBeInstanceOf(ModeloFormularioError);
    await expect(excluirModeloFormulario(4, 8)).rejects.toMatchObject({ code: "NAO_ENCONTRADO" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.delete).not.toHaveBeenCalled();
  });
});
