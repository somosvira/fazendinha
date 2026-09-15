import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listar: vi.fn(), obter: vi.fn(), gerar: vi.fn(), baixar: vi.fn(), salvarRascunho: vi.fn(), obterRascunho: vi.fn(), descartarRascunho: vi.fn(),
  leitura: vi.fn(), escrita: vi.fn(),
}));

vi.mock("../services/financeiro/relatorios.js", () => ({
  listarRelatorios: mocks.listar, obterRelatorio: mocks.obter, gerarRelatorio: mocks.gerar, baixarRelatorio: mocks.baixar,
  salvarRascunho: mocks.salvarRascunho, obterRascunho: mocks.obterRascunho, descartarRascunho: mocks.descartarRascunho,
}));
vi.mock("../services/propriedade.js", () => ({ resolverEscopoLeitura: mocks.leitura, resolverEscopoEscrita: mocks.escrita }));

import { relatoriosFinanceirosRouter } from "./relatorios-financeiros.js";

type Usuario = { id: number; nome: string; dono: boolean; abas: string[]; flags: string[] };
const contador: Usuario = { id: 4, nome: "Contadora", dono: false, abas: ["relatorio"], flags: ["exportar"] };
const consulta: Usuario = { id: 5, nome: "Consulta", dono: false, abas: ["relatorio"], flags: [] };

function app(usuario: Usuario | null) {
  return new Hono()
    .use(async (c, next) => { if (usuario) c.set("usuario" as never, usuario as never); await next(); })
    .route("/", relatoriosFinanceirosRouter);
}
const config = { nome: "Setembro", dataInicio: "2026-09-01", dataFim: "2026-09-30", categoriaIds: [3] };
const post = (usuario: Usuario | null, corpo: unknown) => app(usuario).request("/financeiro/relatorios", { method: "POST", body: JSON.stringify(corpo), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.leitura.mockResolvedValue(7);
  mocks.escrita.mockResolvedValue(7);
  mocks.listar.mockResolvedValue([]);
  mocks.gerar.mockResolvedValue({ id: 9 });
});

describe("rotas de relatórios financeiros", () => {
  it("lista o histórico no escopo de leitura para quem tem a aba de relatórios", async () => {
    const res = await app(consulta).request("/financeiro/relatorios");
    expect(res.status).toBe(200);
    expect(mocks.listar).toHaveBeenCalledWith(7);
  });

  it("recusa quem não tem a aba de relatórios", async () => {
    const res = await app({ ...contador, abas: ["dashboard"] }).request("/financeiro/relatorios");
    expect(res.status).toBe(403);
    expect(mocks.listar).not.toHaveBeenCalled();
  });

  it("gerar exige a permissão de exportar", async () => {
    const res = await post(consulta, config);
    expect(res.status).toBe(403);
    expect(mocks.gerar).not.toHaveBeenCalled();
  });

  it("gera com o autor da sessão, ignorando autor enviado pelo cliente", async () => {
    const res = await post(contador, { ...config, autorNome: "Outra pessoa", autorId: 99 });
    expect(res.status).toBe(201);
    expect(mocks.gerar).toHaveBeenCalledWith(7, { id: 4, nome: "Contadora" }, expect.objectContaining({ nome: "Setembro", categoriaIds: [3], regime: "ambos" }));
    expect(mocks.gerar.mock.calls[0][2]).not.toHaveProperty("autorNome");
  });

  it("valida o período antes do service", async () => {
    const res = await post(contador, { ...config, dataFim: "2026-08-01" });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "VALIDACAO", campo: "dataFim" });
    expect(mocks.gerar).not.toHaveBeenCalled();
  });

  it("rascunho exige usuário real", async () => {
    const res = await app({ ...contador, id: 0, dono: true }).request("/financeiro/relatorios/rascunho");
    expect(res.status).toBe(422);
    expect(mocks.obterRascunho).not.toHaveBeenCalled();
  });

  it("download devolve PDF com nome codificado e respeita o escopo", async () => {
    mocks.baixar.mockResolvedValue({ nome: "Relatório setembro.pdf", buffer: Buffer.from("%PDF-1.4") });
    const res = await app(contador).request("/financeiro/relatorios/9/download");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''Relat%C3%B3rio%20setembro.pdf");
    expect(mocks.baixar).toHaveBeenCalledWith(9, 7);
  });

  it("download recusa id inválido e quem não pode exportar", async () => {
    expect((await app(contador).request("/financeiro/relatorios/abc/download")).status).toBe(422);
    expect((await app(consulta).request("/financeiro/relatorios/9/download")).status).toBe(403);
    expect(mocks.baixar).not.toHaveBeenCalled();
  });
});
