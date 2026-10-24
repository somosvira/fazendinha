import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({raw:vi.fn(),buscar:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({$queryRaw:mocks.raw,demandaAcompanhamentoReprodutivo:{findMany:mocks.buscar}})}}));
import { listarAcompanhamentosPaginados, sqlDemandaPendenteTarefa } from "./acompanhamento.js";
import { consultaAcompanhamentoSchema } from "./acompanhamento.schemas.js";
const id="b0000000-0000-4000-8000-000000000001";
const referencia=new Date("2026-10-10T00:00:00Z");
beforeEach(()=>vi.resetAllMocks());
describe("acompanhamentos paginados",()=>{
 it("limita a dez, recupera última página e calcula resumo fora da página",async()=>{
  mocks.raw.mockResolvedValueOnce([{total:21n}]).mockResolvedValueOnce([{total:21n,pendentes:11n,resolvidas:8n,encerradas:2n,semData:1n}]).mockResolvedValueOnce([{id}]);
  mocks.buscar.mockResolvedValue([{id,animalId:"animal",estado:"PENDENTE",finalidade:"DIAGNOSTICO",origemAdocao:"PROTOCOLO",dataReferencia:referencia,previstaPara:null,exameOrigemId:"exame",exameOrigem:{id:"exame",animalId:"animal",status:"VALIDO",realizacao:"REALIZADO",data:referencia}}]);
  const resposta=await listarAcompanhamentosPaginados(7,{data:"2026-10-20",pagina:99,estado:"PENDENTE"});
  expect(resposta).toMatchObject({total:21,pagina:3,porPagina:10,resumo:{total:21,pendentes:11,resolvidas:8,encerradas:2,semData:1}});
  expect(resposta.itens).toHaveLength(1);
  expect(mocks.buscar).toHaveBeenCalledWith(expect.objectContaining({where:{id:{in:[id]}}}));
  const consulta=mocks.raw.mock.calls[2][0];
  expect(consulta.text).toContain('NULLS LAST');
  expect(consulta.values.slice(-2)).toEqual([10,20]);
  expect(consulta.text).toContain('"LocalizacaoAnimal"');
 });
 it("mantém origem inválida pendente na projeção e nos filtros SQL",async()=>{
  mocks.raw.mockResolvedValueOnce([{total:1n}]).mockResolvedValueOnce([{total:1n,pendentes:1n,resolvidas:0n,encerradas:0n,semData:1n}]).mockResolvedValueOnce([{id}]);
  mocks.buscar.mockResolvedValue([{id,animalId:"animal",estado:"RESOLVIDA",finalidade:"DIAGNOSTICO",origemAdocao:"PROTOCOLO",dataReferencia:referencia,previstaPara:null,exameOrigemId:"exame",exameResolucaoId:"conclusao",exameOrigem:{id:"exame",animalId:"animal",status:"ANULADO",realizacao:"REALIZADO",data:referencia}}]);
  const resposta=await listarAcompanhamentosPaginados(7,{data:"2026-10-20",estado:"PENDENTE"});
  expect(resposta.itens[0]).toMatchObject({estado:"PENDENTE",exameResolucaoId:null,pendencias:["EXAME_ORIGEM_INVALIDO"]});
  expect(mocks.raw.mock.calls[0][0].text).toContain("AS estado");
  expect(mocks.raw.mock.calls[0][0].values).toContain("PENDENTE");
 });
 it("rejeita páginas acima de dez e preserva consulta de uma linha",()=>{
  expect(consultaAcompanhamentoSchema.safeParse({porPagina:11}).success).toBe(false);
  expect(consultaAcompanhamentoSchema.parse({porPagina:1})).toMatchObject({pagina:1,porPagina:1});
  expect(sqlDemandaPendenteTarefa().text).toContain("COLETA_REGISTRADA");
 });
});
