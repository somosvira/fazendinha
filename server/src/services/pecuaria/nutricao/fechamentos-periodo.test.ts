import { describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({listar:vi.fn(),contar:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:(fn:(tx:unknown)=>unknown)=>fn({fechamentoConsumo:{findMany:mocks.listar,count:mocks.contar}})}}));
import { consultaFechamentosSchema } from "./schemas.js";
import { listarFechamentos } from "./consumo.js";
describe("consulta dos períodos de nutrição",()=>{
 it("rejeita datas inexistentes e intervalos invertidos",()=>{
  expect(consultaFechamentosSchema.safeParse({de:"2026-02-30"}).success).toBe(false);expect(consultaFechamentosSchema.safeParse({de:"2026-10-21",ate:"2026-10-01"}).success).toBe(false);expect(consultaFechamentosSchema.safeParse({de:"2024-02-29"}).success).toBe(true);
 });
 it("filtra a sobreposição inteira no banco preservando sítio, situação e paginação",async()=>{
  mocks.listar.mockResolvedValue([]);mocks.contar.mockResolvedValue(51);const p=await listarFechamentos("l",7,{pagina:2,limite:25},false,undefined,"CONFIRMADO",{de:"2026-10-01",ate:"2026-10-31"});
  expect(mocks.listar).toHaveBeenCalledWith(expect.objectContaining({where:{loteId:"l",propriedadeId:7,status:"CONFIRMADO",fim:{gte:new Date("2026-10-01T00:00:00Z")},inicio:{lte:new Date("2026-10-31T00:00:00Z")}},skip:25,take:25}));expect(mocks.contar.mock.calls[0][0].where).toEqual(mocks.listar.mock.calls[0][0].where);expect(p.total).toBe(51);expect(p.itens).toEqual([]);
 });
});
