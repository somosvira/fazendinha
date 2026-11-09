import {describe,it,expect} from "vitest";
import {composicaoSchema,informacoesNutricionaisSchema} from "./composicao.schemas.js";
import {normalizarNomeCatalogo,payloadCanonico} from "./cadastro-reenvio.js";
import {uid} from "../../lib/uid.fixture.js";
const base={situacao:"INFORMADA",referencia:"Rótulo consultado",versaoEsperada:null,itens:[{principioAtivoId:uid(1),concentracaoValor:"1.123456",concentracaoUnidade:"MG_ML"}]};
describe("cadastro ampliado de produtos",()=>{
 it("normaliza caixa, espaços e acentos conservando sais e pontuação",()=>{
  expect(normalizarNomeCatalogo("  Ácido\t FÓLICO — sódico (Zn)  ")).toBe("acido folico — sodico (zn)");
  expect(normalizarNomeCatalogo("Cloreto de sódio")).not.toBe(normalizarNomeCatalogo("Cloreto"));
 });
 it("hash canônico independe da ordem das propriedades sem perder listas ou null",()=>{
  expect(payloadCanonico({b:[null,{x:1,y:2}],a:"x"})).toBe('{"a":"x","b":[null,{"x":1,"y":2}]}');
  expect(payloadCanonico({a:1,b:undefined})).toBe(payloadCanonico({a:1}));
  expect(payloadCanonico({a:null})).not.toBe(payloadCanonico({}));
 });
 it.each(["abc","","1,5","Infinity","-1","0","1000000000000","0.1234567"])("rejeita concentração inválida sem exceção: %s",valor=>{
  const input={...base,itens:[{...base.itens[0],concentracaoValor:valor}]};
  expect(()=>composicaoSchema.safeParse(input)).not.toThrow();
  expect(composicaoSchema.safeParse(input).success).toBe(false);
 });
 it("aceita precisão máxima, exige referência e par valor/unidade",()=>{
  expect(composicaoSchema.safeParse({...base,itens:[{...base.itens[0],concentracaoValor:"999999999999.999999"}]}).success).toBe(true);
  expect(composicaoSchema.safeParse({...base,referencia:null}).success).toBe(false);
  expect(composicaoSchema.safeParse({...base,itens:[{...base.itens[0],concentracaoUnidade:null}]}).success).toBe(false);
  expect(composicaoSchema.safeParse({...base,referencia:null,itens:[{...base.itens[0],concentracaoValor:null,concentracaoUnidade:null}]}).success).toBe(true);
 });
 it("normaliza UUIDs para preservar correspondência com catálogos PostgreSQL",()=>{
  const id="ABCDEFAB-ABCD-4ABC-8ABC-ABCDEFABCDEF";
  const parsed=composicaoSchema.parse({...base,versaoEsperada:id,itens:[{...base.itens[0],principioAtivoId:id}]});
  expect(parsed.versaoEsperada).toBe(id.toLowerCase());
  expect(parsed.itens[0].principioAtivoId).toBe(id.toLowerCase());
 });
 it("percentual tem base explícita e limite 100",()=>{
  expect(composicaoSchema.safeParse({...base,itens:[{...base.itens[0],concentracaoValor:"100.000001",concentracaoUnidade:"PERCENTUAL_MASSA_VOLUME"}]}).success).toBe(false);
 });
 it("distingue composição desconhecida e impede ingredientes duplicados",()=>{
  expect(composicaoSchema.safeParse({...base,situacao:"NAO_INFORMADA",itens:[]}).success).toBe(true);
  expect(composicaoSchema.safeParse({...base,situacao:"NAO_INFORMADA"}).success).toBe(false);
  expect(composicaoSchema.safeParse({...base,itens:[...base.itens,...base.itens]}).success).toBe(false);
 });
 it("nutrição conserva zero documentado e exige base/referência",()=>{
  const input={situacao:"INFORMADA",referencia:"Análise",versaoEsperada:null,itens:[{nutrienteId:uid(2),valor:"0",base:"MATERIA_SECA"}]};
  expect(informacoesNutricionaisSchema.safeParse(input).success).toBe(true);
  expect(informacoesNutricionaisSchema.safeParse({...input,referencia:null}).success).toBe(false);
  expect(informacoesNutricionaisSchema.safeParse({...input,itens:[{...input.itens[0],base:"NAO_INFORMADA"}]}).success).toBe(false);
  expect(informacoesNutricionaisSchema.safeParse({...input,referencia:null,itens:[{...input.itens[0],valor:null,base:"NAO_INFORMADA"}]}).success).toBe(true);
 });
});
