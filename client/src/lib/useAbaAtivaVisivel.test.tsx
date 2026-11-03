// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {act,cleanup,render} from '@testing-library/react';
import {useAbaAtivaVisivel} from './useAbaAtivaVisivel';
let quadro: FrameRequestCallback | undefined;
const rolar=vi.fn();
function Exemplo({operacional=true}:{operacional?:boolean}){
 const ref=useAbaAtivaVisivel<HTMLElement>('ultima');
 return <div {...(operacional?{'data-design-operacional':''}:{})}><nav ref={node=>{
  ref.current=node;
  if(node){node.scrollBy=rolar;node.getBoundingClientRect=()=>({left:20,right:220,width:200}) as DOMRect;const aba=node.querySelector('button')!;aba.getBoundingClientRect=()=>({left:270,right:370,width:100}) as DOMRect;}
 }}><button role="tab" aria-selected="true">Última aba</button></nav></div>;
}
afterEach(()=>{cleanup();vi.restoreAllMocks();rolar.mockReset();quadro=undefined;});
it('revela a aba selecionada fora da região visível sem rolar a página verticalmente',()=>{
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{quadro=cb;return 1;});
 const pagina=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
 render(<Exemplo/>);act(()=>quadro?.(0));
 expect(rolar).toHaveBeenCalledWith(expect.objectContaining({left:150}));
 expect(pagina).not.toHaveBeenCalled();
});
it('preserva a navegação das superfícies fora do escopo operacional',()=>{
 vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{quadro=cb;return 1;});
 render(<Exemplo operacional={false}/>);act(()=>quadro?.(0));
 expect(rolar).not.toHaveBeenCalled();
});
