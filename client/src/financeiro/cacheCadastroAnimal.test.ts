// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSessao, clearSessao } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
import { formAnimalInicial } from "../pecuaria/rebanho/forms/CadastroAnimal";
import { limparCachePendenteContexto, assinaturaCadastroAnimal, chaveCacheAnimal, contextoCacheAnimal, gravarCacheAnimal, lerCacheAnimal, removerCachesAnimal, vincularCachesAnimal } from "./cacheCadastroAnimal";
const usuario = { id: 7, nome: "Teste", email: "t@x.test", papel: "proprietario", status: "ATIVO", dono: true, abas: [], areas: ["financeiro"], flags: ["verValores"] };
beforeEach(() => { sessionStorage.clear(); setSessao("teste", usuario); setPropriedadeAtiva(1); });
afterEach(() => { setPropriedadeAtiva(null); clearSessao(); vi.restoreAllMocks(); sessionStorage.clear(); });
describe("cache do cadastro de animal na compra", () => {
  it("isola usuário, sítio, rascunho e slot; vincula pendente sem sobrescrever remoto", () => {
    const contexto = contextoCacheAnimal(1, true)!; const outroSitio = contextoCacheAnimal(2, true)!;
    const form = { ...formAnimalInicial("2026-01-01"), brinco: "101" };
    const pendente = chaveCacheAnimal(contexto, null, "novo");
    gravarCacheAnimal(pendente, "novo", form, "2026-01-01");
    expect(lerCacheAnimal(chaveCacheAnimal(outroSitio, null, "novo"), "novo", "2026-01-01")).toBeNull();
    setSessao("outra", { ...usuario, id: 8 }); expect(lerCacheAnimal(chaveCacheAnimal(contextoCacheAnimal(1, true)!, null, "novo"), "novo", "2026-01-01")).toBeNull(); setSessao("teste", usuario);
    expect(lerCacheAnimal(pendente, "outra-base", "2026-01-01")).toBeNull();
    vincularCachesAnimal(contexto, "id-1");
    expect(lerCacheAnimal(pendente, "novo", "2026-01-01")).toBeNull();
    expect(lerCacheAnimal(chaveCacheAnimal(contexto, "id-1", "novo"), "novo", "2026-01-02")?.dataEntrada).toBe("2026-01-02");
    expect(lerCacheAnimal(chaveCacheAnimal(contexto, "id-2", "novo"), "novo", "2026-01-02")).toBeNull();
    removerCachesAnimal(contexto, "id-1");
    expect(lerCacheAnimal(chaveCacheAnimal(contexto, "id-1", "novo"), "novo", "2026-01-02")).toBeNull();
  });
  it("nova operação limpa apenas pendentes do contexto atual", () => {
    const aqui = chaveCacheAnimal(contextoCacheAnimal(1, true)!, null, "novo");
    const remoto = chaveCacheAnimal(contextoCacheAnimal(1, true)!, "salvo", "novo");
    gravarCacheAnimal(aqui, "novo", formAnimalInicial(), "2026-01-01"); gravarCacheAnimal(remoto, "novo", formAnimalInicial(), "2026-01-01");
    setPropriedadeAtiva(2); const outro = chaveCacheAnimal(contextoCacheAnimal(2, true)!, null, "novo"); gravarCacheAnimal(outro, "novo", formAnimalInicial(), "2026-01-01");
    setPropriedadeAtiva(1); limparCachePendenteContexto();
    expect(lerCacheAnimal(aqui, "novo", "2026-01-01")).toBeNull();
    expect(lerCacheAnimal(outro, "novo", "2026-01-01")).not.toBeNull();
    expect(lerCacheAnimal(remoto, "novo", "2026-01-01")).not.toBeNull();
  });
  it("reconhece o mesmo cadastro após JSONB ordenar objetos, sem reordenar arrays", () => {
    const original = { mae: { tipo: "ANIMAL", id: "a", brinco: "9", nome: null }, composicao: [{ racaId: "r", fracao64: 16 }], brinco: "10" };
    const reordenado = { brinco: "10", composicao: [{ fracao64: 16, racaId: "r" }], mae: { nome: null, brinco: "9", id: "a", tipo: "ANIMAL" } };
    expect(assinaturaCadastroAnimal(original)).toBe(assinaturaCadastroAnimal(reordenado));
    expect(assinaturaCadastroAnimal([1, 2])).not.toBe(assinaturaCadastroAnimal([2, 1]));
  });
  it("recusa anônimo, falta de permissão, JSON inválido e storage indisponível", () => {
    expect(contextoCacheAnimal(1, false)).toBeNull();
    setSessao("teste", { ...usuario, dono: false, flags: ["lancar"], areas: ["financeiro", "pecuaria"] }); expect(contextoCacheAnimal(1, true)).toBeNull();
    clearSessao(); expect(contextoCacheAnimal(1, true)).toBeNull();
    setSessao("teste", usuario); const chave = chaveCacheAnimal(contextoCacheAnimal(1, true)!, null, "novo");
    sessionStorage.setItem(chave, '{"base":"novo","form":{"brinco":5}}'); expect(lerCacheAnimal(chave, "novo", "2026-01-01")).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("indisponível"); });
    expect(lerCacheAnimal(chave, "novo", "2026-01-01")).toBeNull();
    expect(() => gravarCacheAnimal(chave, "novo", formAnimalInicial(), "2026-01-01")).not.toThrow();
  });
});
