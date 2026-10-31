import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { ConflitoAvaliacaoSanitaria, tentarTravarAnimaisAlertasTx, tentarTravarConfiguracaoAlertaTx } from "./concorrencia.js";
function fixture(adquirido:boolean) {
  const query=vi.fn().mockResolvedValue([{adquirido}]);
  return {query,tx:{$queryRaw:query} as unknown as Prisma.TransactionClient};
}
describe("contenção sanitária sem espera",()=>{
 it("recusa lote ocupado usando a mesma chave hashtext do histórico animal",async()=>{
  const {query,tx}=fixture(false);
  await expect(tentarTravarAnimaisAlertasTx(tx,["a","a","b"])).rejects.toBeInstanceOf(ConflitoAvaliacaoSanitaria);
  expect(query.mock.calls[0][0].join("")).toContain("hashtext(k)::bigint");
  expect(query.mock.calls[0][1]).toEqual(["pec-animal:a","pec-animal:b"]);
 });
 it("não aguarda configuração que pertence a outra transação",async()=>{
  const {query,tx}=fixture(false);
  await expect(tentarTravarConfiguracaoAlertaTx(tx,"regra","r")).rejects.toMatchObject({code:"CONFLITO"});
  expect(query.mock.calls[0][0].join("")).toContain("pg_try_advisory_xact_lock");
  expect(query.mock.calls[0][1]).toBe("regra:r");
 });
 it("aceita trava reentrante ou livre sem alterar o estado",async()=>{
  const {tx}=fixture(true);
  await expect(tentarTravarAnimaisAlertasTx(tx,["a"])).resolves.toBeUndefined();
  await expect(tentarTravarConfiguracaoAlertaTx(tx,"programacao","p")).resolves.toBeUndefined();
 });
});
