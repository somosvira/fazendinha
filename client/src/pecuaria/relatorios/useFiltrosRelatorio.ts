import {useEffect,useState} from 'react';
import type {FonteId} from './catalogo';
import {lerConfigUrl,normalizarConfigFiltros,type ConfigFiltrosRelatorio} from './filtros-templates';
export function useFiltrosRelatorio(fonte:FonteId,propriedadeId:number){
 const chave=`${fonte}:${propriedadeId}`;
 const [estado,setEstado]=useState(()=>({chave,config:lerConfigUrl(fonte)}));
 useEffect(()=>{setEstado({chave,config:lerConfigUrl(fonte)});const sync=()=>setEstado({chave,config:lerConfigUrl(fonte)});window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync)},[chave]);
 const config=estado.chave===chave?estado.config:lerConfigUrl(fonte);
 function aplicar(valor:ConfigFiltrosRelatorio){const config=normalizarConfigFiltros(valor,fonte);if(!config)return;setEstado({chave,config});const url=new URL(window.location.href);if(Object.keys(config).length){url.searchParams.set('filtroFonte',fonte);url.searchParams.set('filtrosRelatorio',JSON.stringify(config))}else{url.searchParams.delete('filtroFonte');url.searchParams.delete('filtrosRelatorio')}window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash)}
 return {config,aplicar};
}
