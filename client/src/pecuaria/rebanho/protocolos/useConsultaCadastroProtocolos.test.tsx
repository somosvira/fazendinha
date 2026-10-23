// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useConsultaCadastroProtocolos } from "./useConsultaCadastroProtocolos";
afterEach(cleanup);
it.each(["RASCUNHO","PUBLICADA","INATIVA","TODAS"])("preserva filtro legado %s no link e no retorno",async situacao=>{
  window.history.replaceState(null,"",`/configuracoes/pecuaria/reproducao/protocolos?cadastroSituacao=${situacao}&cadastroBusca=IATF&cadastroPagina=2&visualCadastroProtocolos=tabela`);
  const {result}=renderHook(()=>useConsultaCadastroProtocolos());
  expect(result.current.situacao).toBe(situacao);expect(result.current.pagina).toBe(2);
  act(()=>result.current.setBusca("Preparo"));
  await waitFor(()=>expect(new URLSearchParams(location.search).get("cadastroBusca")).toBe("Preparo"));
  expect(new URLSearchParams(location.search).get("cadastroSituacao")).toBe(situacao);
  expect(new URLSearchParams(location.search).get("visualCadastroProtocolos")).toBe("tabela");
});
it("abre ativos por padrão e explicita inclusão de inativos na URL",async()=>{
  window.history.replaceState(null,"","/configuracoes/pecuaria/sanidade/protocolos");
  const {result}=renderHook(()=>useConsultaCadastroProtocolos());expect(result.current.situacao).toBe("ATIVA");
  act(()=>result.current.setSituacao("TODAS"));await waitFor(()=>expect(new URLSearchParams(location.search).get("cadastroSituacao")).toBe("TODAS"));
});
