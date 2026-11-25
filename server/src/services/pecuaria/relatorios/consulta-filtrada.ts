import {camposFiltroRelatorio,validarFiltrosRelatorio,linhaAtendeFiltros,ErroFiltroRelatorio} from './filtros.js';
import {paginarRelatorio,type ConsultaRelatorio,type ResultadoRelatorio} from './tipos.js';
export type ConsultorRelatorio=(q:ConsultaRelatorio)=>Promise<ResultadoRelatorio|null>;
/** Refina o conjunto autorizado inteiro, com limite explícito e sem truncamento silencioso. */
export async function consultarRelatorioFiltrado(q:ConsultaRelatorio,consultores:ConsultorRelatorio[]):Promise<ResultadoRelatorio|null>{
 const filtros=validarFiltrosRelatorio(q.fonte,q.filtros,q.podeVerValores);
 const consultar:ConsultorRelatorio=async entrada=>{for(const fn of consultores){const r=await fn(entrada);if(r)return r;}return null;};
 if(!filtros.length)return consultar(q);
 const porPagina=100,limite=10000;
 const primeira=await consultar({...q,filtros:undefined,pagina:1,porPagina});
 if(!primeira)return null;
 if(primeira.total>limite)throw new ErroFiltroRelatorio('Refine o período ou a população: limite de dez mil registros para filtros; nenhum resultado foi truncado.');
 const linhas=[...primeira.linhas];
 for(let pagina=2;linhas.length<primeira.total;pagina++){
  const proxima=await consultar({...q,filtros:undefined,pagina,porPagina});
  if(!proxima||!proxima.linhas.length||proxima.total!==primeira.total)throw new ErroFiltroRelatorio('Os dados mudaram durante a consulta. Consulte novamente.');
  linhas.push(...proxima.linhas);
  if(linhas.length>limite)throw new ErroFiltroRelatorio('Refine o período: limite de dez mil registros; nenhum resultado foi truncado.');
 }
 const campos=camposFiltroRelatorio(q.fonte,q.podeVerValores);
 const resultado=paginarRelatorio(linhas.filter(l=>linhaAtendeFiltros(l,filtros,campos)),q,primeira.avisos);
 return {...resultado,consultadoEm:primeira.consultadoEm,...(primeira.resumo?{resumo:primeira.resumo,resumoEscopo:'POPULACAO' as const}:{})};
}

/**
 * Consolidado: junta as linhas de todos os sítios (cada uma com a coluna `sitio`) e pagina o conjunto.
 * O resumo de cada relatório pode conter médias, que não se somam entre sítios; por isso não é exibido.
 */
export async function consultarRelatorioConsolidado(q:Omit<ConsultaRelatorio,'propriedadeId'>,sitios:{id:number;nome:string}[],consultores:ConsultorRelatorio[]):Promise<ResultadoRelatorio|null>{
 const limite=10000,porPagina=100,linhas:ResultadoRelatorio['linhas']=[];let algum=false;const avisos=new Set<string>();
 for(const sitio of sitios){
  for(let pagina=1;;pagina++){
   const r=await consultarRelatorioFiltrado({...q,propriedadeId:sitio.id,pagina,porPagina} as ConsultaRelatorio,consultores);
   if(!r)break;algum=true;r.avisos?.forEach(a=>avisos.add(a));
   linhas.push(...r.linhas.map(l=>({...l,sitioConsulta:sitio.nome})));
   if(linhas.length>limite)throw new ErroFiltroRelatorio('Refine o período: limite de dez mil registros no consolidado; nenhum resultado foi truncado.');
   if(!r.paginado||pagina*porPagina>=r.total||!r.linhas.length)break;
  }
 }
 if(!algum)return null;
 avisos.add('Consolidado: linhas de todos os sítios; o resumo é calculado por sítio.');
 return paginarRelatorio(linhas,q as ConsultaRelatorio,[...avisos]);
}
