// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
vi.mock("../../../router",()=>({navegarPara:vi.fn()}));
import { navegarPara } from "../../../router";
import { abrirPreparacaoIatf } from "./preparar-iatf";
it("leva apenas IDs explícitos únicos, sítio e retorno sem executar atendimento",()=>{window.history.replaceState(null,"","/pecuaria/reproducao/programacoes/p1?sitio=7&etapaId=e1");abrirPreparacaoIatf(["a1","a1","a3"],7);const url=new URL(vi.mocked(navegarPara).mock.calls.at(-1)![0],window.location.origin);expect(url.searchParams.getAll("animalIndicado")).toEqual(["a1","a3"]);expect(url.searchParams.get("sitio")).toBe("7");expect(url.searchParams.get("retorno")).toBe("/pecuaria/reproducao/programacoes/p1?sitio=7&etapaId=e1");expect(url.searchParams.get("pedidoPreparacao")).toBeTruthy();});
it("não navega sem animal ou sítio",()=>{vi.clearAllMocks();expect(()=>abrirPreparacaoIatf([],7)).toThrow();expect(()=>abrirPreparacaoIatf(["a1"],0)).toThrow();expect(navegarPara).not.toHaveBeenCalled();});
