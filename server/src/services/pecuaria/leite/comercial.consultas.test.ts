import { Prisma } from "@prisma/client";
import { beforeEach,expect,it,vi } from "vitest";
const f=vi.hoisted(()=>({transaction:vi.fn(),count:vi.fn(),lista:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:f.transaction}}));
import { consultarVendasVinculaveisLeite } from "./comercial.js";
import { consultaComercialLeiteSchema } from "./comercial.schemas.js";
const id="00000000-0000-4000-8000-000000000001";
const v={retiradaId:id,retirada:{produtoId:id,quantidade:new Prisma.Decimal(100),status:"CONFIRMADO",entregaLeite:null}};
const venda={id,numero:42,data:new Date("2026-10-19"),parceiroId:id,parceiro:{nome:"Laticínio"},valorTotal:new Prisma.Decimal(225),versaoComercialLeite:v};
beforeEach(()=>{vi.clearAllMocks();f.count.mockResolvedValue(1);f.lista.mockResolvedValue([venda]);f.transaction.mockImplementation((fn:(tx:unknown)=>unknown)=>fn({operacao:{count:f.count,findMany:f.lista}}));});
it("candidatas operacionais não expõem dinheiro; financeiro explícito vê o valor",async()=>{
 const ctx={propriedadeId:7,usuarioId:9},filtro=consultaComercialLeiteSchema.parse({});
 const operacional=await consultarVendasVinculaveisLeite(filtro,ctx);
 expect(operacional).toMatchObject({propriedadeId:7,itens:[{valorTotal:null,quantidadeLitros:"100",podeVincular:true}]});
 expect(operacional.itens[0]).not.toHaveProperty("operacao");
 expect((await consultarVendasVinculaveisLeite(filtro,ctx,true)).itens[0].valorTotal).toBe("225.00");
 expect(f.lista).toHaveBeenCalledWith(expect.objectContaining({where:{propriedadeId:7,tipo:"VENDA",status:"CONFIRMADA"}}));
});
it("legado sem lastro ou retirada já vinculada recebe impedimento explícito",async()=>{
 f.lista.mockResolvedValueOnce([{...venda,versaoComercialLeite:null}]);
 let r=await consultarVendasVinculaveisLeite(consultaComercialLeiteSchema.parse({}),{propriedadeId:7,usuarioId:9});expect(r.itens[0]).toMatchObject({podeVincular:false,quantidadeLitros:null});expect(r.itens[0].impedimento).toMatch(/reconciliação/);
 f.lista.mockResolvedValueOnce([{...venda,versaoComercialLeite:{...v,retirada:{...v.retirada,entregaLeite:{id}}}}]);
 r=await consultarVendasVinculaveisLeite(consultaComercialLeiteSchema.parse({}),{propriedadeId:7,usuarioId:9});expect(r.itens[0].impedimento).toMatch(/já vinculada/);
});
