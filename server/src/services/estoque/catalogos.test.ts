import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const catalogo = () => ({ count: vi.fn(), findMany: vi.fn() });
  const tx = { fabricanteProduto: catalogo(), classificacaoTecnicaProduto: catalogo(), principioAtivo: catalogo() };
  return { tx, transaction: vi.fn(async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx)) };
});
vi.mock("../../db.js", () => ({ prisma: { $transaction: mocks.transaction } }));
import { listarClassificacoesTecnicas, listarFabricantes, listarPrincipiosAtivos, normalizarNomeCatalogo } from "./catalogos.js";
import { consultaCatalogoSchema } from "./catalogos.schemas.js";
import { uid } from "../../lib/uid.fixture.js";

const registro = { id: uid(1), codigoOrigem: "10", nome: "Ivermectina", nomeNormalizado: "ivermectina", ativo: true };
beforeEach(() => {
  vi.clearAllMocks();
  for (const cat of [mocks.tx.fabricanteProduto, mocks.tx.classificacaoTecnicaProduto, mocks.tx.principioAtivo]) {
    cat.count.mockResolvedValue(1);
    cat.findMany.mockResolvedValue([registro]);
  }
});

describe("catálogos do sistema (somente leitura)", () => {
  it("normaliza como a função do banco", () => {
    expect(normalizarNomeCatalogo("  Cálcio   Ácido ")).toBe("calcio acido");
  });
  it.each([
    ["fabricantes", listarFabricantes, () => mocks.tx.fabricanteProduto],
    ["classificações", listarClassificacoesTecnicas, () => mocks.tx.classificacaoTecnicaProduto],
    ["princípios ativos", listarPrincipiosAtivos, () => mocks.tx.principioAtivo],
  ])("lista %s sem expor o nome normalizado", async (_nome, listar, delegado) => {
    const entrada = consultaCatalogoSchema.parse({ busca: "Ivermectína" });
    const resposta = await listar(entrada);
    expect(resposta).toEqual({ itens: [{ id: uid(1), codigoOrigem: "10", nome: "Ivermectina", ativo: true }], total: 1, pagina: 1, porPagina: 10 });
    // Termo normalizado (sem acento, minúsculo) e busca por início de palavra, não por trecho qualquer.
    const { OR } = delegado().findMany.mock.calls[0][0].where as { OR: Array<{ nomeNormalizado: { startsWith?: string; contains?: string } }> };
    expect(OR[0]).toEqual({ nomeNormalizado: { startsWith: "ivermectina" } });
    expect(OR.slice(1).map(c => c.nomeNormalizado.contains)).toContain(" ivermectina");
    expect(OR.some(c => c.nomeNormalizado.contains === "ivermectina")).toBe(false);
  });
  it("filtra por situação e mantém o item selecionado", async () => {
    await listarFabricantes(consultaCatalogoSchema.parse({ ativo: "true" }));
    expect(mocks.tx.fabricanteProduto.findMany.mock.calls[0][0].where).toMatchObject({ ativo: true });
    await listarFabricantes(consultaCatalogoSchema.parse({ selecionadoId: uid(5) }));
    expect(mocks.tx.fabricanteProduto.findMany.mock.calls[1][0].where).toMatchObject({ id: uid(5) });
  });
});
