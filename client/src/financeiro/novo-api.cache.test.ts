// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setSessao, clearSessao } from "../lib/auth";
import { setPropriedadeAtiva } from "../propriedadeScope";
import { prepararPublicacaoRascunho, limparRascunhoAtivo } from "./rascunhoAtivo";
import { chaveCacheAnimal, contextoCacheAnimal, gravarCacheAnimal, lerCacheAnimal } from "./cacheCadastroAnimal";
import { formAnimalInicial } from "../pecuaria/rebanho/forms/CadastroAnimal";
import { descartarRascunhoOperacao, confirmarRascunhoOperacao } from "./novo-api";
const usuario = { id: 7, nome: "Ana", email: "a@x.test", papel: "proprietario", status: "ATIVO", dono: true, abas: [], areas: ["financeiro", "pecuaria"], flags: ["lancar", "verValores"] };
beforeEach(() => { sessionStorage.clear(); setSessao("teste", usuario); setPropriedadeAtiva(1); limparRascunhoAtivo(); prepararPublicacaoRascunho("escrita")({ id: "draft-1", dados: {}, versao: 1, documentos: [], updatedAt: "" }); });
afterEach(() => { vi.unstubAllGlobals(); clearSessao(); sessionStorage.clear(); limparRascunhoAtivo(); });
it.each(["descarte", "confirmação"])("%s remove apenas cache do rascunho confirmado pelo servidor", async acao => {
  const ctx = contextoCacheAnimal(1, true)!; const alvo = chaveCacheAnimal(ctx, "draft-1", "novo"); const outro = chaveCacheAnimal(ctx, "draft-2", "novo");
  gravarCacheAnimal(alvo, "novo", formAnimalInicial(), "2026-01-01"); gravarCacheAnimal(outro, "novo", formAnimalInicial(), "2026-01-01");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  if (acao === "descarte") await descartarRascunhoOperacao(); else await confirmarRascunhoOperacao(1, "chave");
  expect(lerCacheAnimal(alvo, "novo", "2026-01-01")).toBeNull(); expect(lerCacheAnimal(outro, "novo", "2026-01-01")).not.toBeNull();
});
it("falha de descarte preserva cache", async () => {
  const alvo = chaveCacheAnimal(contextoCacheAnimal(1, true)!, "draft-1", "novo"); gravarCacheAnimal(alvo, "novo", formAnimalInicial(), "2026-01-01");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
  await expect(descartarRascunhoOperacao()).rejects.toBeTruthy(); expect(lerCacheAnimal(alvo, "novo", "2026-01-01")).not.toBeNull();
});
