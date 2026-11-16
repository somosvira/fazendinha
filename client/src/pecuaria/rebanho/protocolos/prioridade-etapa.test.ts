import { expect,it } from "vitest";
import { etapaPrioritaria } from "./prioridade-etapa";
import type { EtapaProtocolo } from "./api";
const etapa=(id:string,data:string,pendentes=0,previstos=0)=>({id,ordem:Number(id),previstaPara:data,contagens:{pendentes,previstos,atendidos:pendentes+previstos ? 0 : 2}} as EtapaProtocolo);
const hoje=new Date("2026-11-06T15:00:00Z");
it("pula D0 e D5 atendidas e escolhe a próxima previsão aberta",()=>expect(etapaPrioritaria([etapa("0","2026-10-29"),etapa("5","2026-11-03"),etapa("10","2026-11-08",0,2),etapa("40","2026-12-08",0,2)],hoje)?.id).toBe("10"));
it("prioriza pendência vencida antes de previsão futura",()=>expect(etapaPrioritaria([etapa("10","2026-11-08",0,2),etapa("5","2026-11-03",1)],hoje)?.id).toBe("5"));
it("mantém histórico acessível quando tudo foi atendido",()=>expect(etapaPrioritaria([etapa("0","2026-10-29"),etapa("5","2026-11-03")],hoje)?.id).toBe("0"));
