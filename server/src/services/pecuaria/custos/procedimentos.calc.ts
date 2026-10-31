import { consolidarCustos, type ComponenteCusto } from "./custos.calc.js";

/** Agrupa antes de paginar: material e serviço do mesmo fato nunca se dividem entre páginas. */
export function procedimentosDosComponentes(componentes: ComponenteCusto[], verValores: boolean) {
  const grupos = new Map<string, ComponenteCusto[]>();
  for (const c of componentes) { const chave=`${c.tipoFonte}:${c.fonteId}`;const grupo=grupos.get(chave)??[];grupo.push(c);grupos.set(chave,grupo); }
  return [...grupos].map(([chave,partes])=>{
    const primeiro=partes[0]!;
    const resumir=(linhas:ComponenteCusto[])=>{const r=consolidarCustos(linhas,verValores);const situacao=!verValores?"OCULTO":!linhas.length||linhas.every(c=>c.estado==="NAO_APLICAVEL")?"NAO_APLICAVEL":linhas.every(c=>c.estado==="INCLUIDO_PACOTE")?"INCLUIDO_PACOTE":r.situacao;return {totalConhecido:r.totalConhecido,cobertura:r.cobertura,situacao};};
    return {chave,fechamentoId:primeiro.fechamentoId,tipoFonte:primeiro.tipoFonte,fonteId:primeiro.fonteId,animalId:primeiro.animalId,data:primeiro.data,descricao:primeiro.descricao,...resumir(partes),material:resumir(partes.filter(c=>c.natureza==="MATERIAL")),servico:resumir(partes.filter(c=>c.natureza==="SERVICO"))};
  }).sort((a,b)=>b.data.localeCompare(a.data)||a.chave.localeCompare(b.chave));
}
