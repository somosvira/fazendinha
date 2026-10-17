export type TipoEncerramentoGestacao="PERDA"|"PARTO"|"NAO_IDENTIFICADO";
export function desfechoGestacao(g:{id:string;encerradaEm:Date|null;tipoEncerramento?:string|null},partos:ReadonlyArray<{gestacaoId:string|null;status:string}>):"ABERTA"|TipoEncerramentoGestacao{
 if(!g.encerradaEm)return "ABERTA";
 if(partos.some(p=>p.gestacaoId===g.id&&p.status==="VALIDO"))return "PARTO";
 return g.tipoEncerramento==="PERDA"?"PERDA":"NAO_IDENTIFICADO";
}
