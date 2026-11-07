import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { avaliacaoSchema } from "./schemas.js";
import { prepararContextoAvaliacaoTx, revisaoAvaliacaoContextual } from "./avaliacao-contextual.js";

const id = "10000000-0000-4000-8000-000000000001", tipo = "10000000-0000-4000-8000-000000000002";
const catalogo = { id, versao: 1, tipoExameId: tipo, itens: [
 { codigo: "DG", rotulo: "Diagnóstico", tipo: "DIAGNOSTICO", contextos: ["APOS_TENTATIVA"] },
 { codigo: "UTERO", rotulo: "Útero", tipo: "UTERO", campo: "UTERO_ACHADO", contextos: ["NOVILHA"] },
 { codigo: "APTIDAO", rotulo: "Aptidão", tipo: "APTIDAO", contextos: ["NOVILHA"] },
], condutas: [{ codigo: "RETORNO", rotulo: "Retorno", tipo: "RETORNO", exigeRevisao: false }, { codigo: "SUSPENDER", rotulo: "Não prosseguir", tipo: "NAO_PROSSEGUIR", exigeRevisao: true }] };
function tx() { return { $executeRaw: vi.fn(), catalogoAvaliacaoReprodutiva: { findFirst: vi.fn().mockResolvedValue(catalogo) } } as unknown as Prisma.TransactionClient; }
function entrada() { return avaliacaoSchema.parse({ chave:id, animalId:id, propriedadeId:7, data:"2026-11-01", tipoExameId:tipo, resultado:"NEGATIVO", avaliacaoContextual:{ catalogoId:id, itens:[{codigo:"DG",estado:"CONCLUSIVO"},{codigo:"UTERO",estado:"INCONCLUSIVO",observacao:"Não foi possível concluir"}], condutas:[{codigo:"RETORNO",retornoEm:"2026-11-10"}] } }); }
describe("avaliação contextual", () => {
 it("preserva itens não avaliados e inconclusivos e separa conduta da conclusão", async () => {
  const p = await prepararContextoAvaliacaoTx(tx(), entrada());
  expect(p?.itens.map(i=>[i.codigo,i.estado])).toEqual([["DG","CONCLUSIVO"],["UTERO","INCONCLUSIVO"],["APTIDAO","NAO_AVALIADO"]]);
  expect(p?.condutas).toEqual([expect.objectContaining({tipo:"RETORNO",retornoEm:"2026-11-10"})]);
 });
 it("não infere aptidão a partir de DG negativo e rejeita estado contrário ao dado", async () => {
  const input = entrada(); input.avaliacaoContextual!.itens.push({ codigo:"APTIDAO", estado:"CONCLUSIVO" });
  await expect(prepararContextoAvaliacaoTx(tx(), input)).rejects.toThrow(/diverge/);
 });
 it("exige destino e revisão futura para a conduta configurada", async () => {
  const input = entrada(); input.avaliacaoContextual!.condutas = [{ codigo:"SUSPENDER", destino:"Manter em avaliação" }];
  await expect(prepararContextoAvaliacaoTx(tx(), input)).rejects.toThrow(/revisão/);
  input.avaliacaoContextual!.condutas[0].revisaoEm = "2026-11-20";
  expect((await prepararContextoAvaliacaoTx(tx(), input))?.condutas[0]).toMatchObject({ tipo:"NAO_PROSSEGUIR", revisaoEm:"2026-11-20" });
 });
 it("preserva zero e falso como observações conclusivas", async () => {
  const input = entrada(); input.resultados = [{ campo:"UTERO_ACHADO", valor:false }];
  input.avaliacaoContextual!.itens[1].estado="CONCLUSIVO";
  expect((await prepararContextoAvaliacaoTx(tx(), input))?.itens[1].estado).toBe("CONCLUSIVO");
  input.resultados[0].valor=0;
  expect((await prepararContextoAvaliacaoTx(tx(), input))?.itens[1].estado).toBe("CONCLUSIVO");
 });
 it("sexagem inconclusiva não exige um DG avaliado", async () => {
  const config = { ...catalogo, itens: [{ codigo:"SEXO", rotulo:"Sexagem", tipo:"SEXAGEM", contextos:["GESTACAO_CONHECIDA"] }] };
  const transacao = { $executeRaw:vi.fn(), catalogoAvaliacaoReprodutiva:{findFirst:vi.fn().mockResolvedValue(config)} } as unknown as Prisma.TransactionClient;
  const input = avaliacaoSchema.parse({ chave:id,animalId:id,propriedadeId:7,data:"2026-11-01",tipoExameId:tipo,resultado:"INCONCLUSIVO",finalidade:"SEXAGEM",avaliacaoContextual:{catalogoId:id,itens:[{codigo:"SEXO",estado:"INCONCLUSIVO"}],condutas:[]} });
  expect((await prepararContextoAvaliacaoTx(transacao,input))?.itens).toEqual([expect.objectContaining({tipo:"SEXAGEM",estado:"INCONCLUSIVO"})]);
 });
 it("revisão cobre dados e necessidades sem depender da própria revisão", () => {
  const input = entrada(), primeiro = revisaoAvaliacaoContextual(input, { necessidades:[{id:"d",acao:"PRESERVAR"}] });
  expect(revisaoAvaliacaoContextual({...input,revisaoContextual:primeiro}, { necessidades:[{id:"d",acao:"PRESERVAR"}] })).toBe(primeiro);
  expect(revisaoAvaliacaoContextual(input, { necessidades:[{id:"d",acao:"RESOLVER"}] })).not.toBe(primeiro);
  expect(revisaoAvaliacaoContextual({...input, observacao:"Novo dado"}, { necessidades:[{id:"d",acao:"PRESERVAR"}] })).not.toBe(primeiro);
 });
});
