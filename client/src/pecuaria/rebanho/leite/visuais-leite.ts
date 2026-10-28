export const rotulosOrdenha: Record<string, string> = {
  SEM_AFERICAO: 'Sem aferição', PENDENTE_ESTOQUE: 'Salva', PARCIAL_ESTOQUE: 'Parcial no estoque', CONFIRMADA: 'Confirmada',
};
export function situacaoOrdenha(r: { situacao: string; porNatureza: { natureza: string; litros: number | null }[] }) {
  if (r.situacao === 'SEM_AFERICAO') return rotulosOrdenha.SEM_AFERICAO;
  return r.porNatureza.some(n => n.natureza === 'A_CLASSIFICAR') ? 'Classificação pendente' : rotulosOrdenha[r.situacao] ?? r.situacao;
}
export const naturezasVisuais = [
  { natureza: 'COMERCIAL', nome: 'Comercial', cor: 'comercial' },
  { natureza: 'NAO_COMERCIAL', nome: 'Não comercial', cor: 'nao-comercial' },
  { natureza: 'COLOSTRO', nome: 'Colostro', cor: 'colostro' },
  { natureza: 'A_CLASSIFICAR', nome: 'A classificar', cor: 'pendente' },
];
export function segmentosNatureza(itens: { natureza: string; litros: number | null }[]) {
  const conhecidos = itens.filter((p): p is {natureza:string;litros:number} => p.litros !== null && Number.isFinite(p.litros) && p.litros > 0);
  const total = conhecidos.reduce((s,p)=>s+p.litros,0);
  return conhecidos.map(p=>({...p,percentual:p.litros/total*100,...naturezasVisuais.find(n=>n.natureza===p.natureza)}));
}
export function pontosSerieQualidade<T extends {serie:string; amostraId:string; dataAmostra:string;valor:string|number|boolean;tipo?:string}>(linhas:T[],serie:string) {
  return linhas.filter(r=>r.serie===serie).flatMap(r=>{
    const valor=typeof r.valor==='number'?r.valor:r.tipo==='NUMERO'&&typeof r.valor==='string'&&/^-?\d+(?:\.\d+)?$/.test(r.valor)?Number(r.valor):null;
    return valor===null||!Number.isFinite(valor)?[]:[{...r,valor}];
  }).sort((a,b)=>a.dataAmostra.localeCompare(b.dataAmostra)||a.amostraId.localeCompare(b.amostraId));
}
