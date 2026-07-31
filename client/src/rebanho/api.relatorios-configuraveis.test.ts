import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarRelatorioRebanho, listarTemplatesRelatorioRebanho } from "./api";

function stubFetch(body: unknown) {
  const spy = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe("api de relatórios configuráveis", () => {
  it("busca o catálogo no endpoint próprio", async () => {
    const spy = stubFetch([]);
    await listarTemplatesRelatorioRebanho();
    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/relatorios/templates");
  });

  it("serializa somente os filtros preenchidos", async () => {
    const spy = stubFetch({ linhas: [] });
    await gerarRelatorioRebanho({
      templateId: "ia-periodo",
      dataInicio: "2026-06-01",
      dataFim: "2026-06-30",
      status: "ATIVO",
      grupoId: 7,
      setor: "",
      categoria: "VACA",
      reprodutor: "Lance 884",
    });
    expect(spy.mock.calls[0]?.[0]).toBe("/api/rebanho/relatorios?templateId=ia-periodo&dataInicio=2026-06-01&dataFim=2026-06-30&status=ATIVO&grupoId=7&categoria=VACA&reprodutor=Lance+884");
  });
});
