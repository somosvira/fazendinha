import { expect, it, vi } from 'vitest';
vi.mock('../../../db.js',()=>({prisma:{}}));
import { somarCustosBezerreiro } from './consultas.js';
const parte=(alim:string|null,san:string|null,litros='10.000')=>({alimentacao:{quantidadeLitros:litros,custoConhecido:alim,custoCompleto:null,pendencias:1,referenciaR07:alim},sanidade:{custoConhecido:san,pendencias:0},totalConhecido:alim&&san?(Number(alim)+Number(san)).toFixed(2):null,custoCompleto:null,cobertura:'PARCIAL' as const,lacunas:['Ausência de registro não comprova custo zero'],porAnimal:[{animalId:alim??'x',brinco:'1',nome:null,litrosAtribuidos:litros,custoAlimentarAtribuido:alim,custoSanitario:san,referenciaR07:alim,pendencias:1}]});
it('soma custos e litros dos sítios e une lacunas sem repetir',()=>{
 const r=somarCustosBezerreiro([parte('10.00','5.00'),parte('20.00','1.00','5.500')] as never,true);
 expect(r.alimentacao).toMatchObject({quantidadeLitros:'15.500',custoConhecido:'30.00',pendencias:2});
 expect(r.sanidade.custoConhecido).toBe('6.00');
 expect(r.totalConhecido).toBe('36.00');
 expect(r.lacunas).toHaveLength(1);
 expect(r.porAnimal).toHaveLength(2);
});
it('valor desconhecido em um sítio mantém o total desconhecido e sem permissão fica oculto',()=>{
 expect(somarCustosBezerreiro([parte('10.00','5.00'),parte(null,null)] as never,true).totalConhecido).toBeNull();
 expect(somarCustosBezerreiro([parte('10.00','5.00')] as never,false)).toMatchObject({totalConhecido:null,cobertura:'OCULTO'});
});
