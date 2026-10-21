import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({lista:vi.fn(),contar:vi.fn(),grupos:vi.fn(),doencas:vi.fn()}));
vi.mock("../../../db.js",()=>({prisma:{ocorrenciaSanitaria:{findMany:mocks.lista,count:mocks.contar,groupBy:mocks.grupos},doenca:{findMany:mocks.doencas}}}));
import { listarOcorrenciasPaginadas, whereOcorrencias } from "./ocorrencias.js";
import { consultaSanitariaSchema } from "./consulta.js";
beforeEach(()=>vi.clearAllMocks());
describe("panorama de ocorrências",()=>{
 it("conta o recorte inteiro sem limitar ao tamanho da página e preserva sítio e filtros nos agregados",async()=>{
  mocks.lista.mockResolvedValue([{id:"o",doenca:{id:"d",nome:"Nome atual"},doencaNomeSnapshot:"Nome histórico"}]);mocks.contar.mockResolvedValueOnce(75).mockResolvedValueOnce(60).mockResolvedValueOnce(15).mockResolvedValueOnce(0);mocks.grupos.mockResolvedValue([{doencaId:"d",doencaNomeSnapshot:"Nome histórico",_count:{_all:60}}]);mocks.doencas.mockResolvedValue([{id:"d",nome:"Nome atual"}]);
  const filtro=consultaSanitariaSchema.parse({buscaAnimal:"Aurora",de:"2026-10-01",pagina:2,porPagina:50,paginado:"true"});
  const p=await listarOcorrenciasPaginadas(undefined,7,filtro);
  expect(p.itens).toHaveLength(1);expect(p.total).toBe(75);expect(p.resumo).toEqual({abertas:60,encerradas:15,anuladas:0,porDoenca:[{id:"d",nome:"Nome histórico",quantidade:60}]});
  expect(mocks.lista.mock.calls[0][0]).toMatchObject({where:{propriedadeId:7},skip:50,take:50});
  for(const [args] of mocks.contar.mock.calls){expect(JSON.stringify(args.where)).toContain('"propriedadeId":7');expect(JSON.stringify(args.where)).toContain('"Aurora"');expect(args).not.toHaveProperty("take");}
  expect(mocks.grupos.mock.calls[0][0].where.AND[0]).toEqual(whereOcorrencias(undefined,7,filtro));
 });
 it("aplica o filtro de doença validado e não confunde anulação com encerramento",()=>{
  const id="f42259e4-3872-4a27-9be0-740418d269db";const filtro=consultaSanitariaSchema.parse({doencaId:id,situacao:"ABERTA"});
  expect(whereOcorrencias("animal",3,filtro)).toMatchObject({doencaId:id,animalId:"animal",propriedadeId:3,status:"VALIDO",fim:null});
  expect(consultaSanitariaSchema.safeParse({doencaId:"invalido"}).success).toBe(false);
 });
});
