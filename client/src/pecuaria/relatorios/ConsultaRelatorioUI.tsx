import type {ReactNode} from 'react';
import {CalendarDays,Download,Printer,SlidersHorizontal} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card} from '@/components/ui/card';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';

export function BarraRelatorio({children,acoes}:{children:ReactNode;acoes?:ReactNode}){
 return <div className="rel-consulta-toolbar print:hidden"><div className="rel-consulta-contexto">{children}</div>{acoes}</div>;
}
export function PeriodoRelatorio({periodo,titulo='Período e filtros',aberto,onOpenChange,children,referencia=false}:{periodo:string;titulo?:string;aberto:boolean;onOpenChange:(v:boolean)=>void;children:ReactNode;referencia?:boolean}){
 return <><Card className="rel-periodo-compacto"><CalendarDays size={19} aria-hidden/><strong>{periodo}</strong><Button variant="outline" size="sm" onClick={()=>onOpenChange(true)}><SlidersHorizontal size={15}/>{referencia?'Data e filtros':'Período e filtros'}</Button></Card><Dialog open={aberto} onOpenChange={onOpenChange}><DialogContent className="rel-detalhe-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>{children}</DialogContent></Dialog></>;
}
export type AcaoRelatorio={rotulo:string;executar:()=>void;desabilitado?:boolean;icone?:ReactNode};
export function AcoesRelatorio({imprimir,rotuloImprimir='Imprimir relatório',impressaoDesabilitada=false,acoes=[]}:{imprimir?:()=>void;rotuloImprimir?:string;impressaoDesabilitada?:boolean;acoes?:AcaoRelatorio[]}){
 return <div className="rel-acoes-icones">{imprimir&&<Button variant="outline" size="icon" aria-label={rotuloImprimir} title={rotuloImprimir} disabled={impressaoDesabilitada} onClick={imprimir}><Printer size={18}/></Button>}{acoes.length>0&&<DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Exportar e gerenciar relatório" title="Exportar e gerenciar relatório"><Download size={18}/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{acoes.map(a=><DropdownMenuItem key={a.rotulo} disabled={a.desabilitado} onSelect={a.executar}>{a.icone}{a.rotulo}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>}</div>;
}
