// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { listarAnimais } from "../api";
import { setPropriedadeAtiva } from "../../../propriedadeScope";
afterEach(()=>{vi.unstubAllGlobals();setPropriedadeAtiva(null)});
it("envia o recorte e o sinal de cancelamento à listagem autorizada",async()=>{
 const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({itens:[],total:0,painel:{}})});vi.stubGlobal("fetch",fetchMock);
 setPropriedadeAtiva(7);const controller=new AbortController();
 await listarAnimais({situacao:"TODOS",busca:"DEV-019",page:2,pageSize:20,comContexto:true},undefined,controller.signal);
 const [url,init]=fetchMock.mock.calls[0];expect(url).toContain("/api/pecuaria/rebanho/animais?");const params=new URL(url,"http://localhost").searchParams;
 expect(params.get("situacao")).toBe("TODOS");expect(params.get("page")).toBe("2");expect(params.get("comContexto")).toBe("true");
 expect(init.signal).toBe(controller.signal);expect(init.headers["X-Propriedade-Id"]).toBe("7");
});
