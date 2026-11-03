import {useEffect,useRef} from 'react';

/** Revela a seleção dentro da navegação horizontal, sem deslocar a página. */
export function useAbaAtivaVisivel<T extends HTMLElement>(ativa:string){
 const ref=useRef<T|null>(null);
 useEffect(()=>{
  const lista=ref.current;
  if(!lista||!document.querySelector('[data-design-operacional]'))return;
  let quadro=0;
  const revelar=()=>{
   const aba=lista.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
   if(!aba)return;
   const area=lista.getBoundingClientRect(),item=aba.getBoundingClientRect();
   const deslocamento=item.right>area.right?item.right-area.right:item.left<area.left?item.left-area.left:0;
   if(deslocamento&&typeof lista.scrollBy==='function')lista.scrollBy({left:deslocamento,behavior:'instant'});
  };
  const agendar=()=>{cancelAnimationFrame(quadro);quadro=requestAnimationFrame(revelar);};
  const observador=new MutationObserver(agendar);
  observador.observe(lista,{subtree:true,attributes:true,attributeFilter:['aria-selected'],childList:true});
  window.addEventListener('resize',agendar);agendar();
  return()=>{cancelAnimationFrame(quadro);observador.disconnect();window.removeEventListener('resize',agendar);};
 },[ativa]);
 return ref;
}
