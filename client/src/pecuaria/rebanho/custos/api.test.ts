import { beforeEach,it,expect,vi } from "vitest";
import { reqV4 } from "../reproducao/api";
import { obterCustos } from "./api";
vi.mock("../reproducao/api",()=>({reqV4:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(reqV4).mockResolvedValue({componentes:[]});});
it("consulta a rota Hono canônica sem barra final e mantém sítio e recorte",async()=>{
 await obterCustos({animalId:"a"},7,"2026-01-01","2026-01-31",2,"REPRODUCAO");
 const [url,,method,sitio]=vi.mocked(reqV4).mock.calls[0];const [path,query]=url.split("?");
 expect(path).toBe("/custos");expect(new URLSearchParams(query).get("finalidade")).toBe("REPRODUCAO");expect(new URLSearchParams(query).get("animalId")).toBe("a");expect(method).toBe("GET");expect(sitio).toBe(7);
});
