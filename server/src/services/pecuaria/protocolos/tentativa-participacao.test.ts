import { describe, expect, it } from "vitest";
import { validarTentativaExterna, vincularTentativaParticipacaoSchema } from "./tentativa-participacao.js";
const d=(s:string)=>new Date(`${s}T00:00:00Z`);
const p={animalId:"a",propriedadeId:1,inicio:d("2026-01-01"),inicioEfetivo:d("2026-01-02"),canceladaEm:null,protocolo:{tipo:"REPRODUTIVO",finalidade:"IATF",modalidadeTentativa:"EXTERNA"}};
const t={animalId:"a",propriedadeId:1,data:d("2026-01-12"),tipo:"IA",status:"VALIDO",tarefaId:null};
describe("vínculo factual externo",()=>{
 it("aceita IA e TE explicitamente compatíveis sem inferir tentativa pelo calendário",()=>{
  expect(()=>validarTentativaExterna(p,t,1)).not.toThrow();
  expect(()=>validarTentativaExterna({...p,protocolo:{...p.protocolo,finalidade:"TETF"}},{...t,tipo:"TE"},1)).not.toThrow();
 });
 it.each([{...t,animalId:"outro"},{...t,propriedadeId:2},{...t,status:"ANULADO"},{...t,tipo:"TE"},{...t,tarefaId:"tarefa"},{...t,data:d("2025-12-31")}])("recusa fato incompatível %j",tentativa=>expect(()=>validarTentativaExterna(p,tentativa,1)).toThrow());
 it("recusa preparo não iniciado, modelo de tentativa interna e serviço após retirada",()=>{
  expect(()=>validarTentativaExterna({...p,inicioEfetivo:null},t,1)).toThrow();
  expect(()=>validarTentativaExterna({...p,protocolo:{...p.protocolo,modalidadeTentativa:"ETAPA"}},t,1)).toThrow();
  expect(()=>validarTentativaExterna({...p,canceladaEm:d("2026-01-10")},t,1)).toThrow();
 });
 it("exige escolha do fato, chave e motivo; não aceita consumo ou custo no vínculo",()=>{
  const i={chave:"00000000-0000-4000-8000-000000000001",tentativaId:"00000000-0000-4000-8000-000000000002",propriedadeId:1,motivo:"Serviço conferido na ficha",revisao:"a".repeat(64)};
  expect(vincularTentativaParticipacaoSchema.safeParse(i).success).toBe(true);
  expect(vincularTentativaParticipacaoSchema.safeParse({...i,valorProdutoAtribuido:100}).success).toBe(false);
  expect(vincularTentativaParticipacaoSchema.safeParse({...i,tentativaId:undefined}).success).toBe(false);
 });
});
