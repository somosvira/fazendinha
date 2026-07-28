import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ criarColeta: vi.fn(), obterColeta: vi.fn(), resolverEscrita: vi.fn(), resolverLeitura: vi.fn() }));
vi.mock("../../services/rebanho/fiv.js", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../services/rebanho/fiv.js")>()), criarColeta: mocks.criarColeta, obterColeta: mocks.obterColeta }));
vi.mock("../../services/propriedade.js", () => ({ resolverEscopoEscrita: mocks.resolverEscrita, resolverEscopoLeitura: mocks.resolverLeitura }));

import { FivError } from "../../services/rebanho/fiv.js";
import { fivRouter } from "./fiv.js";

beforeEach(() => { vi.clearAllMocks(); mocks.resolverEscrita.mockResolvedValue(7); mocks.resolverLeitura.mockResolvedValue(7); mocks.criarColeta.mockResolvedValue({ id: 10 }); });

describe("rotas FIV", () => {
  it("cria coleta com o escopo de escrita", async () => {
    const res = await fivRouter.request("/rebanho/fiv/coletas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doadoraId: 31, data: "2026-07-27", metodo: "FIV", oocitos: [] }) });
    expect(res.status).toBe(201);
    expect(mocks.criarColeta).toHaveBeenCalledWith(expect.objectContaining({ doadoraId: 31 }), 7);
  });

  it("retorna 400 para payload inválido", async () => {
    const res = await fivRouter.request("/rebanho/fiv/coletas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doadoraId: -1 }) });
    expect(res.status).toBe(400);
    expect(mocks.criarColeta).not.toHaveBeenCalled();
  });

  it("mapeia não encontrado para 404", async () => {
    mocks.obterColeta.mockRejectedValue(new FivError("NAO_ENCONTRADO", "coleta não encontrada"));
    const res = await fivRouter.request("/rebanho/fiv/coletas/999");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "coleta não encontrada" });
  });
});
