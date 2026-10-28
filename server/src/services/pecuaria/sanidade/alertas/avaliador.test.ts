import { describe,it,expect,vi,afterEach } from "vitest";
import type { AvaliacaoAlertas } from "@prisma/client";
import { prisma } from "../../../../db.js";
import { avaliarAlertasTemporais,marcarReavaliacaoDestinoTx } from "./avaliador.js";
const controle=(extra:Partial<AvaliacaoAlertas>={}):AvaliacaoAlertas=>({id:"sanidade",produtor:"sanidade",estado:"NAO_AVALIADO",diaCoberto:null,ultimaConclusao:null,erro:null,cursor:null,posse:null,posseAte:null,versao:0,atualizadoEm:new Date(),...extra});
function preparar(extra:Partial<AvaliacaoAlertas>={}){
 const row=controle(extra);
 vi.spyOn(prisma,"$transaction").mockImplementation(async operacao=>{if(typeof operacao!=="function")throw new Error("Apenas callback esperado");return operacao(prisma);});
 vi.spyOn(prisma,"$executeRaw").mockResolvedValue(1);
 vi.spyOn(prisma.avaliacaoAlertas,"upsert").mockResolvedValue(row);
 vi.spyOn(prisma.avaliacaoAlertas,"update").mockResolvedValue(row);
 vi.spyOn(prisma.avaliacaoAlertas,"updateMany").mockResolvedValue({count:1});
 vi.spyOn(prisma.regraAlertaSanitario,"findFirst").mockResolvedValue(null);
 vi.spyOn(prisma.programacaoSanitaria,"findFirst").mockResolvedValue(null);
 return row;
}
afterEach(()=>vi.restoreAllMocks());
describe("processamento temporal limitado",()=>{
 it("não assume a execução enquanto outra posse é válida",async()=>{preparar({posse:"outra",posseAte:new Date(Date.now()+60000)});expect((await avaliarAlertasTemporais(prisma,new Date("2026-10-28T12:00:00Z")))).toEqual({estado:"OCUPADO",lotes:1});expect(prisma.regraAlertaSanitario.findFirst).not.toHaveBeenCalled();});
 it("checkpoint só confirma cobertura depois das fases de geração e reconciliação",async()=>{const row=preparar();vi.mocked(prisma.avaliacaoAlertas.upsert).mockResolvedValueOnce(row).mockResolvedValueOnce({...row,cursor:JSON.stringify({dia:"2026-10-28",fase:"RECONCILIAR_PROGRAMACOES",origemId:null,animalId:null})}).mockResolvedValueOnce({...row,cursor:JSON.stringify({dia:"2026-10-28",fase:"PROGRAMACOES",origemId:null,animalId:null})});const r=await avaliarAlertasTemporais(prisma,new Date("2026-10-28T12:00:00Z"));expect(r.estado).toBe("CONCLUIDO");expect(r.lotes).toBe(3);expect(prisma.avaliacaoAlertas.update).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({diaCoberto:new Date("2026-10-28"),cursor:null,estado:"CONCLUIDO"})}));});
 it("falha conserva cursor e comunica cobertura incompleta",async()=>{preparar({cursor:JSON.stringify({dia:"2026-10-27",fase:"REGRAS",origemId:null,animalId:null})});vi.mocked(prisma.regraAlertaSanitario.findFirst).mockRejectedValueOnce(new Error("falha de lote"));await expect(avaliarAlertasTemporais(prisma)).rejects.toThrow("falha de lote");expect(prisma.avaliacaoAlertas.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({estado:"FALHA",posse:null})}));});
 it("sinal de destino usa trava do lote e invalida cobertura sem varrer animais",async()=>{preparar();await marcarReavaliacaoDestinoTx(prisma,{produtoId:"produto"},1);expect(prisma.$executeRaw).toHaveBeenCalledOnce();expect(prisma.avaliacaoAlertas.upsert).toHaveBeenLastCalledWith(expect.objectContaining({update:expect.objectContaining({diaCoberto:null,cursor:null,versao:{increment:1}})}));expect(prisma.regraAlertaSanitario.findFirst).not.toHaveBeenCalled();});
});
