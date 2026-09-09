import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  gerar: vi.fn(),
  escopo: vi.fn(),
}));

vi.mock("../../services/rebanho/relatorios.catalogo.js", () => ({
  IDS_TEMPLATE_RELATORIO: ["ia-periodo", "gestantes-atual"],
  listarTemplatesRelatorio: mocks.listar,
}));
vi.mock("../../services/rebanho/relatorios.js", () => ({ gerarRelatorio: mocks.gerar }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.escopo }));

import { relatoriosRouter } from "./relatorios.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listar.mockReturnValue([{ id: "ia-periodo" }]);
  mocks.escopo.mockResolvedValue(7);
  mocks.gerar.mockResolvedValue({ templateId: "ia-periodo", linhas: [] });
});

describe("rotas de relatórios configuráveis", () => {
  it("lista o catálogo", async () => {
    const res = await relatoriosRouter.request("/rebanho/relatorios/templates");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "ia-periodo" }]);
  });

  it("valida e consulta no escopo ativo", async () => {
    const res = await relatoriosRouter.request("/rebanho/relatorios?templateId=ia-periodo&dataInicio=2026-06-01&dataFim=2026-06-30");
    expect(res.status).toBe(200);
    expect(mocks.gerar).toHaveBeenCalledWith(expect.objectContaining({ templateId: "ia-periodo", status: "ATIVO" }), 7);
  });

  it("recusa query inválida antes do service", async () => {
    const res = await relatoriosRouter.request("/rebanho/relatorios?templateId=ia-periodo");
    expect(res.status).toBe(400);
    expect(mocks.gerar).not.toHaveBeenCalled();
  });
});
