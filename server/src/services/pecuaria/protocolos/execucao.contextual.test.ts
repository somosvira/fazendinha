import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
const mocks=vi.hoisted(()=>({ executar:vi.fn() }));
vi.mock("./execucao.clinica.js",()=>({executarExecucaoClinicaTx:mocks.executar,prepararExecucaoClinicaTx:vi.fn(),travarOrigensExecucaoClinicaTx:vi.fn(),conferirConsumosExecucaoClinicaTx:vi.fn()}));
import { executarItensPreparadosProtocoloTx, type prepararExecucaoProtocoloTx } from "./execucao.js";
it("usa a revisão contextual da prévia validada na realização da mesma tarefa",async()=>{
 const item={tipo:"AVALIACAO",tarefaId:"t",animalId:"a",avaliacaoContextual:{catalogoId:"c"}};
 const previa={input:{itens:[item]},tarefas:[{id:"t",execucao:{protocolo:{tipo:"REPRODUTIVO"}}}],itens:[{tarefaId:"t",avaliacaoContextual:{revisao:"abc"}}] } as unknown as Awaited<ReturnType<typeof prepararExecucaoProtocoloTx>>;
 mocks.executar.mockResolvedValue({id:"exame"});
 const tx={} as Prisma.TransactionClient;
 expect(await executarItensPreparadosProtocoloTx(tx,previa,7)).toEqual([{tarefaId:"t",animalId:"a",tipo:"AVALIACAO",id:"exame"}]);
 expect(mocks.executar).toHaveBeenCalledWith(tx,expect.objectContaining({revisaoContextual:"abc"}),7);
});
