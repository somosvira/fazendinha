import {describe,it,expect} from "vitest";
import {avaliarOrientacaoTemporal,compararExecucaoIatf,snapshotIatf} from "./iatf.calc.js";
import {etapaIatfSchema,partoSchema,perdaSchema} from "./schemas.js";
const etapa={nome:"Revisão",tipo:"MANEJO" as const,intervalo:1,unidade:"DIAS" as const};
const instante=new Date("2026-10-01T12:00:00Z");
const regra={versao:1 as const,referencia:"ETAPA_ANTERIOR" as const,intervaloHoras:16,toleranciaAntesMinutos:30,toleranciaDepoisMinutos:60,efeito:"ALERTA" as const};
const plano=()=>({...snapshotIatf({...etapa,orientacaoTemporal:regra},{},instante,instante,instante),referenciaTemporalEfetiva:{data:instante.toISOString(),precisao:"HORA" as const,fatoId:"anterior-valida"}});
describe("orientação temporal optativa por etapa",()=>{
 it("etapa sem orientação não compara horas nem cria desvio por sua ausência",()=>{
  const p=snapshotIatf(etapa,{},instante,instante,instante);
  expect(compararExecucaoIatf(p,"2026-10-01",{})).toMatchObject({diferencas:[],horarioAferido:false,orientacaoTemporal:{estado:"NAO_CONFIGURADA"}});
  expect(compararExecucaoIatf(p,"2026-10-01T20:00:00Z",{}).diferencas).toEqual([]);
 });
 it("horários incompletos ou referência sem lastro são não aferíveis",()=>{
  expect(avaliarOrientacaoTemporal({...plano(),referenciaTemporalEfetiva:null},"2026-10-02T04:00:00Z").estado).toBe("NAO_AFERIVEL");
  expect(avaliarOrientacaoTemporal({...plano(),referenciaTemporalEfetiva:{data:"2026-10-01",precisao:"DIA",fatoId:"sem-hora"}},"2026-10-02T04:00:00Z").estado).toBe("NAO_AFERIVEL");
  expect(avaliarOrientacaoTemporal(plano(),"2026-10-02").estado).toBe("NAO_AFERIVEL");
 });
 it.each(["2026-10-02T03:30:00Z","2026-10-02T04:00:00Z","2026-10-02T05:00:00Z"])("inclui as bordas de tolerância: %s",data=>expect(avaliarOrientacaoTemporal(plano(),data).estado).toBe("DENTRO"));
 it.each(["2026-10-02T03:29:00Z","2026-10-02T05:01:00Z"])("fora da janela é alerta sem alterar parâmetros: %s",data=>{
  const p=plano(),antes=JSON.stringify(p);
  expect(avaliarOrientacaoTemporal(p,data)).toMatchObject({estado:"FORA",efeito:"ALERTA",referencia:{fatoId:"anterior-valida"}});
  expect(JSON.stringify(p)).toBe(antes);
 });
 it("não aceita orientação de bloqueio ou campos clínicos implícitos",()=>{
  expect(etapaIatfSchema.safeParse({...etapa,orientacaoTemporal:{...regra,efeito:"BLOQUEAR"}}).success).toBe(false);
  expect(etapaIatfSchema.safeParse({...etapa,orientacaoTemporal:{versao:1,efeito:"ALERTA"}}).success).toBe(false);
 });
});
describe("explicação obrigatória e causa desconhecida",()=>{
 const id="00000000-0000-4000-8000-000000000001",base={chave:id,animalId:id,propriedadeId:1,data:"2026-10-01"};
 it("perda vazia é recusada; observação contextual e causa desconhecida são aceitas",()=>{
  expect(perdaSchema.safeParse({...base,gestacaoId:id,motivo:" "}).success).toBe(false);
  expect(perdaSchema.safeParse({...base,gestacaoId:id,motivo:"Perda observada no atendimento; causa desconhecida",causaClinica:{estado:"DESCONHECIDA"}}).success).toBe(true);
 });
 it("aborto exige explicação de observação, sem exigir diagnóstico clínico",()=>{
  expect(partoSchema.safeParse({...base,desfecho:"ABORTO",crias:[]}).success).toBe(false);
  expect(partoSchema.safeParse({...base,desfecho:"ABORTO",crias:[],observacao:"Aborto observado; causa desconhecida"}).success).toBe(true);
 });
});
