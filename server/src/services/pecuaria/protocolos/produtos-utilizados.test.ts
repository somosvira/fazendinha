import { expect, it, vi } from "vitest";
import { agruparProdutosUtilizados, produtosUtilizadosTx, type ConsumoProduto } from "./produtos-utilizados.js";
import type { Prisma } from "@prisma/client";
const consumo:ConsumoProduto={chave:"p",nome:"Produto",unidade:"mL",quantidade:"0.1",animalId:"a",valor:"0.10",estado:"CONHECIDO"};
it("soma com precisão, distingue unidades e conta animais sem duplicar",()=>{
 const r=agruparProdutosUtilizados([consumo,{...consumo,quantidade:"0.2",valor:"0.20"},{...consumo,unidade:"UN",animalId:"b"}],true);
 expect(r).toHaveLength(2);expect(r[0]).toMatchObject({quantidade:"0.3",custo:"0.30",animais:1,atendimentos:2});
});
it("preserva desconhecidos e mascara valores financeiros",()=>{
 const entradas=[consumo,{...consumo,quantidade:null,valor:null,estado:"DESCONHECIDO"}];
 expect(agruparProdutosUtilizados(entradas,true)[0]).toMatchObject({quantidade:null,custo:"0.10",parcial:true});
 expect(agruparProdutosUtilizados(entradas,false)[0]).toMatchObject({custo:null,parcial:false});
});
it("consulta somente os fatos previamente autorizados, excluindo material não aplicável",async()=>{
 const findMany=vi.fn().mockResolvedValue([{id:"f",produtoId:"p",nomeProdutoAplicado:"Produto",dose:null,unidadeDose:"mL"}]);
 const tentativa=vi.fn();
 const tx={aplicacaoProduto:{findMany},tentativaReprodutiva:{findMany:tentativa}} as unknown as Prisma.TransactionClient;
 const r=await produtosUtilizadosTx(tx,[{fonteId:"f",tipoFonte:"APLICACAO",natureza:"MATERIAL",estado:"DESCONHECIDO",animalId:"a",valor:null},{fonteId:"ignorado",tipoFonte:"TENTATIVA",natureza:"MATERIAL",estado:"NAO_APLICAVEL",animalId:"a",valor:null}],true);
 expect(findMany.mock.calls[0][0].where).toEqual({id:{in:["f"]}});expect(tentativa).not.toHaveBeenCalled();expect(r[0]).toMatchObject({produto:"Produto",quantidade:null,custo:null});
});
