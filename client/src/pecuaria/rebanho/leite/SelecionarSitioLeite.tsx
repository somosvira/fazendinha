import './selecao-sitio.css';
import {useEffect,useState} from 'react';
import {MapPin,House,ArrowRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Skeleton} from '@/components/ui/skeleton';
import {listarPropriedades,type PropriedadeDTO} from '../../../api/propriedades';
export function SelecionarSitioLeite({onSelecionar,sitiosDisponiveis}:{onSelecionar?:(id:number)=>void;sitiosDisponiveis?:PropriedadeDTO[]}) {
 const [sitios,setSitios]=useState<PropriedadeDTO[]|null>(null),[erro,setErro]=useState(''),[revisao,setRevisao]=useState(0);
 useEffect(()=>{if(sitiosDisponiveis)return;let ativo=true;setErro('');setSitios(null);void listarPropriedades().then(d=>{if(ativo)setSitios(d.filter(p=>p.ativo))}).catch(e=>{if(ativo)setErro(e instanceof Error?e.message:'Não foi possível consultar os sítios.')});return()=>{ativo=false}},[revisao,sitiosDisponiveis]);
 const lista=sitiosDisponiveis??sitios;
 return <section className="leite-selecionar-sitio" aria-label="Seleção do sítio"><span className="leite-sitio-simbolo"><MapPin size={26} aria-hidden/></span><div><h2>Em qual sítio você quer trabalhar?</h2></div>
 {erro?<div role="alert">{erro}<Button variant="outline" onClick={()=>setRevisao(v=>v+1)}>Tentar novamente</Button></div>:lista===null?<div role="status" aria-label="Carregando sítios" className="leite-sitios-escolhas"><Skeleton className="h-20 w-64"/><Skeleton className="h-20 w-64"/></div>:lista.length?<div className="leite-sitios-escolhas">{lista.map(p=><Button key={p.id} variant="outline" onClick={()=>onSelecionar?.(p.id)} disabled={!onSelecionar}><House size={20} aria-hidden/><span><strong>{p.nome}</strong><small>{p.principal?'Principal':[p.cidade,p.uf].filter(Boolean).join(' — ')||'Sítio da fazenda'}</small></span><ArrowRight size={17} aria-hidden/></Button>)}</div>:<p role="status">Nenhum sítio ativo disponível para esta conta.</p>}
 </section>;
}
