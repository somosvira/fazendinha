import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({publicar:vi.fn(),auditar:vi.fn(),conferir:vi.fn(),vincular:vi.fn(),obter:vi.fn(),tx:{necessidadeSanitaria:{update:vi.fn(),findUniqueOrThrow:vi.fn()},aplicacaoProduto:{findUnique:vi.fn()}}}));
vi.mock("./produtor.js",()=>({publicarNecessidadeTx:m.publicar}));
vi.mock("./atendimento.js",()=>({conferirDestinoAtivoTx:vi.fn(),exigirAutorDecisao:(id:number)=>{if(id<1)throw new Error("pessoa")},obterNecessidadeAtendimentoTx:m.obter,vincularAplicacaoAlertaTx:m.vincular}));
vi.mock("../../rebanho/regras.js",async original=>({...await original<typeof import("../../rebanho/regras.js")>(),auditar:m.auditar}));
vi.mock("../../fatos.js",()=>({conferirAnimalNoFato:m.conferir}));
import { decidirNecessidadeTx, decisaoNecessidadeSchema } from "./decisoes.js";
const n={id:"necessidade",animalId:"animal",propriedadeId:1,situacao:"CONFERENCIA_INICIAL",dataTeorica:new Date("2025-01-01"),adocao:new Date("2026-10-28"),revisao:1};
const tx=()=>m.tx as unknown as Prisma.TransactionClient;
const input={chave:"a1000000-0000-4000-8000-000000000001",animalId:"animal",propriedadeId:1,alertaId:"alerta",revisao:1,motivo:"Conferência feita pelo operador",acao:"CONFIRMAR_NECESSIDADE" as const};
beforeEach(()=>{vi.clearAllMocks();m.obter.mockResolvedValue(n);m.tx.necessidadeSanitaria.findUniqueOrThrow.mockResolvedValue(n);});
describe("decisões sanitárias com motivo",()=>{
 it("confirma necessidade a partir da data civil atual, preservando data teórica",async()=>{await decidirNecessidadeTx(tx(),input,7,new Date("2026-10-28"));expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"PENDENTE",dataAtencao:new Date("2026-10-28"),motivo:input.motivo})});expect(m.tx.necessidadeSanitaria.update.mock.calls[0][0].data).not.toHaveProperty("dataTeorica");});
 it("dispensa encerra com motivo e não inventa aplicação",async()=>{await decidirNecessidadeTx(tx(),{...input,acao:"DISPENSAR"},7);expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"ENCERRAR");expect(m.vincular).not.toHaveBeenCalled();});
 it("adiar conserva a evidência, sem encerrar",async()=>{m.obter.mockResolvedValue({...n,situacao:"PENDENTE"});await decidirNecessidadeTx(tx(),{...input,acao:"ADIAR",novaData:"2026-11-05"},7,new Date("2026-10-28"));expect(m.tx.necessidadeSanitaria.update).toHaveBeenCalledWith({where:{id:n.id},data:expect.objectContaining({situacao:"ADIADO",dataAtencao:new Date("2026-11-05")})});expect(m.publicar).toHaveBeenCalledWith(m.tx,n.id,{usuarioId:7},"PUBLICAR");});
 it("recusa decisão sem motivo e adiar sem data no contrato público",()=>{expect(decisaoNecessidadeSchema.safeParse({...input,motivo:""}).success).toBe(false);expect(decisaoNecessidadeSchema.safeParse({...input,acao:"ADIAR"}).success).toBe(false)});
});
