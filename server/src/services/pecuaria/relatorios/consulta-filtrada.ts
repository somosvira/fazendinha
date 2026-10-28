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
