import { describe, expect, it, vi } from "vitest";
vi.mock("../protocolos/execucao.js",()=>({prepararExecucaoProtocoloTx:vi.fn(),travarOrigensExecucaoProtocoloTx:vi.fn(),executarItensPreparadosProtocoloTx:vi.fn()}));
import { itemProtocoloDaVisita } from "./visitas-protocolos.js";
const uid=(n:number)=>`c0000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const tarefa=(tipo:string)=>({id:uid(1),etapaId:uid(2),etapa:{tipo:tipo==="AVALIACAO"?"EXAME":tipo,configuracao:{tipo}},execucaoId:uid(3),execucao:{rodadaId:uid(4),animalId:uid(5),propriedadeId:7}});
const linha=(dados:Record<string,unknown>)=>({participanteId:uid(6),animalId:uid(5),tarefaId:uid(1),dados});
describe("envelopes de protocolo nas visitas",()=>{
 it("mapeia a tentativa legada sem transformar IA em gestação e conserva cobertura sem insumo",()=>{
  const item=itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados:{tipo:"COBERTURA",origem:"DOCUMENTADA",touroExternoId:uid(7),justificativaSemOrigem:"Cobertura observada no pasto"}}),tarefa("TENTATIVA"),7,"2026-10-20");
  expect(item).toMatchObject({tipo:"TENTATIVA",tipoTentativa:"COBERTURA",realizadaEm:"2026-10-20",data:"2026-10-20"});
  expect("materialId" in item).toBe(false);
 });
 it("preserva DIA sem fabricar horário e HORA com offset para aplicação",()=>{
  const dados={nomeProdutoAplicado:"Produto",dose:"2",unidadeDose:"ML",origemInsumo:"SEM_ORIGEM_JUSTIFICADA",justificativaSemOrigem:"Fato documentado pelo responsável"};
  const dia=itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados}),tarefa("APLICACAO"),7,"2026-10-20");
  expect("aplicadaEm" in dia).toBe(false);
  const hora=itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20T14:00:00-03:00",dados}),tarefa("APLICACAO"),7,"2026-10-20");
  expect(hora).toMatchObject({data:"2026-10-20",aplicadaEm:"2026-10-20T14:00:00-03:00"});
 });
 it("tipo AVALIACAO é determinado pela configuração comum e exige conclusão explícita",()=>{
  expect(itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados:{resultado:"INCONCLUSIVO",tipoExameId:uid(8)}}),tarefa("AVALIACAO"),7,"2026-10-20")).toMatchObject({tipo:"AVALIACAO",resultado:"INCONCLUSIVO"});
  expect(()=>itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados:{resultado:"NAO_AVALIADO"}}),tarefa("AVALIACAO"),7,"2026-10-20")).toThrow();
 });
 it("coleta sanitária ligada usa o mesmo schema sem resultado presumido",()=>{
  expect(itemProtocoloDaVisita("EXAME_SANITARIO",linha({tipoExameId:uid(8),data:"2026-10-20",observacao:"Aguardando resultado"}),tarefa("EXAME"),7,"2026-10-20")).toMatchObject({tipo:"EXAME",observacao:"Aguardando resultado"});
 });
 it("rejeita identidade trocada e procedimento diferente da tarefa",()=>{
  expect(()=>itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados:{animalId:uid(9)}}),tarefa("MANEJO"),7,"2026-10-20")).toThrow(/não pertencem/);
  expect(()=>itemProtocoloDaVisita("TAREFA_IATF",linha({realizadaEm:"2026-10-20",dados:{tipo:"APLICACAO"}}),tarefa("EXAME"),7,"2026-10-20")).toThrow(/diverge/);
 });
});
