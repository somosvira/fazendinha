import {useState,type ReactNode} from 'react';
import {CalendarDays,Check,ArrowUpRight} from 'lucide-react';
import {Card} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Badge} from '@/components/ui/badge';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {AjudaCampo} from '@/components/Dica';
import {Paginacao} from '../ui';
import type {AcompanhamentoIndicadores} from './IndicadoresAcompanhamento';
import {AlternarVisualIndicadores} from './DetalhesIndicadoresVisuais';
import {dataDocumento as data,numeroDocumento as numero} from './indicadores-documento';
type Ciclo=AcompanhamentoIndicadores['espera']['coorte'][number];
export function CiclosIndicadoresVisuais({dados:d,tabela,detalhar,nome}:{dados:AcompanhamentoIndicadores;tabela:ReactNode;detalhar:(c:Ciclo)=>ReactNode;nome:(id:string)=>string}){
 const[visual,setVisual]=useState(true),[pagina,setPagina]=useState(1),[ciclo,setCiclo]=useState<Ciclo|null>(null);const r=d.espera.resumoCoorte;const total=Math.max(1,Math.ceil(d.espera.coorte.length/6)),atual=Math.min(pagina,total);
 return <div className="indicadores-ciclos"><header className="indicadores-detalhes-toolbar"><h3>Coorte de ciclos iniciados no período</h3><AlternarVisualIndicadores visual={visual} alterar={setVisual}/></header><Card className="indicadores-coorte"><dl>{[['Ciclos no período',r.ciclos],['Com serviço',r.comServico],['Sem serviço',r.semServico],['Saídas',r.saidas],['Liberação → serviço',r.mediaDiasLiberacaoServico==null?'Não comprovado':`${numero(r.mediaDiasLiberacaoServico)} dias`]].map(([n,v])=><div key={String(n)}><dt>{n}</dt><dd>{v}</dd></div>)}</dl>{r.ciclos>0&&<div className="indicadores-coorte-barra" role="img" aria-label={`${r.comServico} ciclos com serviço e ${r.semServico} sem serviço`}><i style={{width:`${r.comServico/r.ciclos*100}%`}}/><i style={{width:`${r.semServico/r.ciclos*100}%`}}/></div>}<div className="indicadores-coorte-legenda"><span>Com serviço</span><span>Sem serviço</span><AjudaCampo rotulo="Sobre ciclos e intervalos" texto="Coorte de ciclos iniciados no período. Os intervalos são dias corridos; restrições intermediárias não são descontadas da espera. A média inclui somente intervalos comprovados."/></div></Card>
 {visual?<>{d.espera.coorte.slice((atual-1)*6,atual*6).map(l=><Card key={l.cicloId} className="indicadores-ciclo"><header><h4><CalendarDays size={18}/>{nome(l.animalId)}</h4><Badge variant="outline">{l.primeiroServico?'Com serviço':'Sem primeiro serviço'}</Badge></header><div className="indicadores-ciclo-timeline">{[['Início do ciclo',l.inicio],['Liberação',l.primeiraLiberacao?.data],['Primeiro serviço',l.primeiroServico?.data]].map(([n,v])=><div key={n} className={v?'comprovado':''}><i>{v&&<Check size={12}/>}</i><strong>{n}</strong><span>{v?data(v):'Não comprovado'}</span></div>)}</div><footer><dl><div><dt>Espera observada</dt><dd>{l.diasEsperaObservada==null?'Não comprovada':`${numero(l.diasEsperaObservada)} dias`}</dd></div><div><dt>Repetições</dt><dd>{l.repeticoes}</dd></div><div><dt>Saída</dt><dd>{data(l.saidaEm)}</dd></div></dl><Button size="sm" variant="ghost" onClick={()=>setCiclo(l)}>Ver ciclo<ArrowUpRight size={15}/></Button></footer></Card>)}{!d.espera.coorte.length&&<p>Nenhum ciclo nesta população.</p>}<Paginacao paginaAtual={atual} totalPaginas={total} totalItens={d.espera.coorte.length} itensPorPagina={6} onPaginaChange={setPagina} rotulo="ciclos" idSelect="coorte-ciclos-pagina"/></>:tabela}
 <Dialog open={!!ciclo} onOpenChange={v=>{if(!v)setCiclo(null)}}><DialogContent className="indicadores-ficha" aria-describedby={undefined}><DialogHeader><DialogTitle>{ciclo?nome(ciclo.animalId):'Ciclo'}</DialogTitle></DialogHeader>{ciclo&&detalhar(ciclo)}</DialogContent></Dialog>
 </div>
}
