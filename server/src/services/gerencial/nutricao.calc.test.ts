import { describe, expect, it } from "vitest";
import { calcularNutricao, type FechamentoAnalise, type PresencaDia } from "./nutricao.calc.js";
const d=(s:string)=>new Date(s);
const presencas: PresencaDia[]=[1,2,3].map(i=>({animalId:"a",propriedadeId:1,data:`2026-10-0${i}`,vaca:i>=2}));
const fechamento: FechamentoAnalise={id:"f",propriedadeId:1,centroCustoId:"c",centroCustoNome:"Leite",inicio:d("2026-10-01"),fim:d("2026-10-03"),animalDias:3,
  participacoes:[{id:"p",animalId:"a",dias:3,finalidade:null,intervalos:[{desde:d("2026-10-01"),ate:d("2026-10-02"),vaca:false},{desde:d("2026-10-02"),ate:d("2026-10-04"),vaca:true}]}],
  itens:[{id:"i",produtoId:"racao",unidade:"KG",quantidadeConfirmada:"3",custoConhecido:"1.00",movimentoEstoqueId:"m"}]};
describe("nutrição gerencial por presença histórica",()=>{
  it("fatias disjuntas conciliam centavos; vacas têm numerador próprio",()=>{
    const total=calcularNutricao(presencas,[fechamento],"2026-10-01","2026-10-03");
    expect(total.rebanho).toMatchObject({animalDias:3,custoConhecido:"1.00",porPeriodo:"1.00",parcial:false});
    expect(total.vacas).toMatchObject({animalDias:2,custoConhecido:"0.66",porDia:"0.3300",porPeriodo:"0.99"});
    expect([1,2,3].map(i=>calcularNutricao(presencas,[fechamento],`2026-10-0${i}`,`2026-10-0${i}`).rebanho.custoConhecido)).toEqual(["0.34","0.33","0.33"]);
  });
  it("presença sem consumo e custo desconhecido não viram zero completo",()=>{
    const r=calcularNutricao([...presencas,{animalId:"b",propriedadeId:1,data:"2026-10-01",vaca:null}],[{...fechamento,itens:[{...fechamento.itens[0],custoConhecido:null}]}],"2026-10-01","2026-10-03");
    expect(r.rebanho.parcial).toBe(true);expect(r.cobertura).toMatchObject({animalDias:4,diasAlimentados:3,diasClassificados:3,itensPendentes:1});
  });
  it("não fabrica intervalos para participação antiga divergente",()=>{
    const r=calcularNutricao(presencas,[{...fechamento,participacoes:[{...fechamento.participacoes[0],intervalos:[]}]}],"2026-10-01","2026-10-03");
    expect(r.fontes).toHaveLength(0);expect(r.lacunas).toHaveLength(1);expect(r.rebanho.porDia).toBeNull();
  });
  it("custo conhecido só de bezerro não prova custo zero das vacas",()=>{
    const p=[...presencas.map(d=>({...d,vaca:false})),{animalId:"vaca",propriedadeId:1,data:"2026-10-01",vaca:true}];
    const f={...fechamento,participacoes:[{...fechamento.participacoes[0],intervalos:[{desde:d("2026-10-01"),ate:d("2026-10-04"),vaca:false}]}]};
    const r=calcularNutricao(p,[f],"2026-10-01","2026-10-03");
    expect(r.vacas.custoConhecido).toBeNull();expect(r.vacas.porDia).toBeNull();expect(r.vacas.parcial).toBe(true);
  });
  it("zero comprovado e denominador vazio são estados distintos",()=>{
    expect(calcularNutricao(presencas,[{...fechamento,itens:[{...fechamento.itens[0],custoConhecido:"0"}]}],"2026-10-01","2026-10-03").rebanho.custoConhecido).toBe("0.00");
    expect(calcularNutricao([],[],"2026-10-01","2026-10-03").rebanho.porDia).toBeNull();
  });
});
