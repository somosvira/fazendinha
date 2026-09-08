import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  gerar: vi.fn(),
  escopo: vi.fn(),
  usuario: { id: 1, abas: ["relatorio"] } as { id: number; abas: string[] } | null,
}));

vi.mock("../services/relatorio-gerencial.js", () => ({ gerarRelatorioGerencial: mocks.gerar }));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.escopo }));
vi.mock("../middleware/permissao.js", () => ({
  exigeAba: (flag: string) => async (c: { json: (b: unknown, s: number) => Response }, next: () => Promise<void>) => {
    if (!mocks.usuario) return c.json({ error: "não autenticado" }, 401);
    if (!mocks.usuario.abas.includes(flag)) return c.json({ error: "sem permissão" }, 403);
    return next();
  },
}));

import { relatorioGerencialRouter } from "./relatorio-gerencial.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.usuario = { id: 1, abas: ["relatorio"] };
  mocks.escopo.mockResolvedValue(3);
  mocks.gerar.mockResolvedValue({ meta: { regime: "ambos" } });
});

describe("GET /financeiro/relatorio-gerencial", () => {
  it("valida a query e gera no escopo ativo", async () => {
    const res = await relatorioGerencialRouter.request("/financeiro/relatorio-gerencial?inicio=2026-03-01&fim=2026-03-31&regime=realizado");
    expect(res.status).toBe(200);
    expect(mocks.gerar).toHaveBeenCalledWith({ inicio: "2026-03-01", fim: "2026-03-31", regime: "realizado" }, 3);
  });

  it("recusa query inválida antes do service", async () => {
    const res = await relatorioGerencialRouter.request("/financeiro/relatorio-gerencial?inicio=2026-03-01");
    expect(res.status).toBe(400);
    expect(mocks.gerar).not.toHaveBeenCalled();
  });

  it("exige a permissão de relatórios", async () => {
    mocks.usuario = { id: 1, abas: ["dashboard"] };
    const res = await relatorioGerencialRouter.request("/financeiro/relatorio-gerencial?inicio=2026-03-01&fim=2026-03-31");
    expect(res.status).toBe(403);
    expect(mocks.gerar).not.toHaveBeenCalled();
  });

  it("devolve 500 em PT-BR quando o service falha", async () => {
    mocks.gerar.mockRejectedValue(new Error("boom"));
    const res = await relatorioGerencialRouter.request("/financeiro/relatorio-gerencial?inicio=2026-03-01&fim=2026-03-31");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Erro inesperado ao gerar relatório. Tente novamente." });
  });
});
