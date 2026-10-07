import { afterEach, describe, expect, it, vi } from "vitest";
import { consultarCarencia, consultarHistoricoExame, listarComprasDiretas, listarServicos, reqSanidade, SanidadeApiError } from "./api";
import { getPropriedadeAtiva, setPropriedadeAtiva } from "../../../propriedadeScope";
import { listarPartidasNutricionais } from "../nutricao/api";

afterEach(() => { vi.unstubAllGlobals(); setPropriedadeAtiva(null); });
describe("erros da API sanitária", () => {
  it("consulta a página de auditoria no sítio histórico sem alterar o sítio ativo", async () => {
    setPropriedadeAtiva(2);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ itens: [], total: 0, pagina: 2, tamanho: 20 }) });
    vi.stubGlobal("fetch", fetchMock);
    await consultarHistoricoExame("exame", 1, 2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/sanidade/exames/exame/historico?pagina=2&tamanho=20&propriedadeId=1");
    expect(getPropriedadeAtiva()).toBe(2);
  });
  it("consulta carência na data da baixa", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await consultarCarencia("animal", "2026-10-06");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/pecuaria/rebanho/sanidade/animais/animal/carencia?dataReferencia=2026-10-06");
  });
  it("preserva o sítio histórico explícito no corpo com outro sítio ativo", async () => {
    setPropriedadeAtiva(2);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ chave: "chave", propriedadeId: 1, itens: [{ propriedadeId: 1 }] });
    await reqSanidade("/aplicacoes/coletivas", { method: "POST", body });
    expect(fetchMock).toHaveBeenCalledWith("/api/pecuaria/rebanho/sanidade/aplicacoes/coletivas", expect.objectContaining({ method: "POST", body, headers: expect.objectContaining({ "X-Propriedade-Id": "2", "content-type": "application/json" }) }));
    expect(getPropriedadeAtiva()).toBe(2);
  });
  it("consulta Serviços, compra direta e lotes no sítio explícito sem mudar o global", async () => {
    setPropriedadeAtiva(2);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await listarServicos(1);
    await listarComprasDiretas(1);
    await listarPartidasNutricionais("produto", 1);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/pecuaria/rebanho/sanidade/servicos?propriedadeId=1",
      "/api/pecuaria/rebanho/sanidade/compras-diretas?propriedadeId=1",
      "/api/estoque/partidas?produtoId=produto&propriedadeId=1",
    ]);
    expect(getPropriedadeAtiva()).toBe(2);
  });
  it("preserva mensagem, código e caminho completo da linha em uma exceção Error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "Saldo do lote insuficiente", code: "VALIDACAO", campo: "itens.1.partidaId" }) }));
    const erro = await reqSanidade("/aplicacoes/coletivas").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toBeInstanceOf(SanidadeApiError);
    expect(erro).toMatchObject({ message: "Saldo do lote insuficiente", code: "VALIDACAO", campo: "itens.1.partidaId" });
  });
  it("mantém erro legível quando a resposta não traz JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => { throw new SyntaxError("resposta vazia"); } }));
    await expect(reqSanidade("/aplicacoes/coletivas")).rejects.toMatchObject({ message: "Erro HTTP 503", code: undefined, campo: undefined });
  });
});
