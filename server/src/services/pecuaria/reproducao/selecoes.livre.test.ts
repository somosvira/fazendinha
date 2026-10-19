import { describe, expect, it } from "vitest";
import { criteriosSelecaoSchema } from "./selecoes.schemas.js";
import { avaliarSelecaoAnimal } from "./selecoes.calc.js";
const base={versao:2,todas:[],qualquer:[],ordenacao:[{campo:"BRINCO",direcao:"ASC"}],politicaDesconhecidos:"EXCLUIR"};
const avaliar=(animal:Record<string,unknown>,todas:unknown[],qualquer:unknown[]=[])=>avaliarSelecaoAnimal({animalId:"a",...animal},criteriosSelecaoSchema.parse({...base,todas,qualquer}));
describe("seleção livre: critérios versionados e combinação",()=>{
 it("mantém V1 e exige V2 para atributos novos e peso decimal",()=>{
  expect(criteriosSelecaoSchema.safeParse({...base,versao:1}).success).toBe(true);
  const f={tipo:"FAIXA",campo:"PESO_KG",min:400.25,max:450.5};
  expect(criteriosSelecaoSchema.safeParse({...base,todas:[f]}).success).toBe(true);
  expect(criteriosSelecaoSchema.safeParse({...base,versao:1,todas:[f]}).success).toBe(false);
  expect(criteriosSelecaoSchema.safeParse({...base,todas:[{...f,campo:"DEL"}]}).success).toBe(false);
 });
 it("não confunde ausências com zero e sinaliza a política de desconhecidos",()=>{
  const todas=[{tipo:"FAIXA",campo:"PESO_KG",min:0,max:10}];
  expect(avaliar({pesoKg:null},todas).incluido).toBe(false);
  expect(avaliar({pesoKg:0},todas).incluido).toBe(true);
  const r=avaliarSelecaoAnimal({animalId:"a",pesoKg:null},criteriosSelecaoSchema.parse({...base,todas,politicaDesconhecidos:"INCLUIR"}));
  expect(r.incluido).toBe(true);expect(r.motivos.join()).toContain("política de desconhecidos");
 });
 it("combina E geral, OU entre opções e blocos alternativos, sem obrigar manejo",()=>{
  const todas=[{tipo:"VALORES",campo:"SEXO",valores:["F"]},{tipo:"VALORES",campo:"LOTE",valores:["A","B"]}];
  const animal={sexo:"F",lote:{id:"B"},situacao:"GESTANTE",idadeGestacionalDias:140};
  expect(avaliar(animal,todas).incluido).toBe(true);
  const qualquer=[{id:"vazias",todas:[{tipo:"VALORES",campo:"SITUACAO",valores:["VAZIA"]}]},{id:"gestantes",todas:[{tipo:"VALORES",campo:"SITUACAO",valores:["GESTANTE"]},{tipo:"FAIXA",campo:"IDADE_GESTACIONAL",min:135,max:150}]}];
  expect(avaliar(animal,todas,qualquer).incluido).toBe(true);
  expect(avaliar({...animal,sexo:"M"},todas,qualquer).incluido).toBe(false);
 });
 it("considera qualquer raça da composição e busca persistida sem distinguir maiúsculas",()=>{
  expect(avaliar({racas:["HOL","GIR"],identificacao:"042 Aurora"},[{tipo:"VALORES",campo:"RACA",valores:["GIR"]},{tipo:"VALORES",campo:"BUSCA",valores:["AURORA"]}]).incluido).toBe(true);
  expect(avaliar({racas:null},[{tipo:"VALORES",campo:"RACA",valores:["GIR"]}]).incluido).toBe(false);
 });
 it("distingue ativo em ambos os domínios, nenhum e protocolo específico",()=>{
  expect(avaliar({dominiosAtivos:["QUALQUER","REPRODUTIVO","SANITARIO","AMBOS"],protocolosAtivos:["p1","p2"]},[{tipo:"VALORES",campo:"PROTOCOLO_ATIVO",valores:["AMBOS"]},{tipo:"VALORES",campo:"PROTOCOLO",valores:["p2"]}]).incluido).toBe(true);
  expect(avaliar({dominiosAtivos:["NENHUM"]},[{tipo:"VALORES",campo:"PROTOCOLO_ATIVO",valores:["REPRODUTIVO"]}]).incluido).toBe(false);
 });
 it("aceita retorno atrasado negativo e rejeita contadores negativos",()=>{
  expect(criteriosSelecaoSchema.safeParse({...base,todas:[{tipo:"FAIXA",campo:"DIAS_ATE_RETORNO",max:-1}]}).success).toBe(true);
  expect(criteriosSelecaoSchema.safeParse({...base,todas:[{tipo:"FAIXA",campo:"PARTOS",min:-1}]}).success).toBe(false);
 });
});
