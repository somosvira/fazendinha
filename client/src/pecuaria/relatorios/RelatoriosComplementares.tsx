import {PainelFiltrosRelatorio} from './PainelFiltrosRelatorio';
import {useFiltrosRelatorio} from './useFiltrosRelatorio';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Checkbox} from '@/components/ui/checkbox';
import {Skeleton} from '@/components/ui/skeleton';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {AjudaCampo} from '@/components/Dica';
import {Columns3,Download,FileText,LayoutGrid,List,Search} from 'lucide-react';
import {getHojeISO,formatBRDateISO} from '@/lib/hoje';
import {usePeriodoConsulta} from '../rebanho/reproducao/periodo-consulta';
import {dateFromIso} from '@/components/DateRangePicker';
import {fontesAcompanhamento,criteriosAcompanhamento,type FonteAcompanhamento} from './acompanhamento';
import {csvPersonalizado,formatarCelula} from './catalogo';
import {consultarFonte,type ResultadoBuilder,type OpcoesAcompanhamento} from './fontes';
import './complementares.css';

type Props={propriedadeId:number;fonte:FonteAcompanhamento;selecionar:(fonte:FonteAcompanhamento)=>void;personalizar:()=>void;podeExportar:boolean};
export function RelatoriosComplementares({propriedadeId,fonte,selecionar,personalizar,podeExportar}:Props){
 const periodoUrl=usePeriodoConsulta('indicadores');
 const inicioRef=useRef<HTMLInputElement>(null);
 const [inicio,setInicio]=useState(periodoUrl.inicio),[fim,setFim]=useState(periodoUrl.fim);
 const filtros=useFiltrosRelatorio(fonte,propriedadeId);
 const [consulta,setConsulta]=useState(()=>({inicio:periodoUrl.inicio,fim:periodoUrl.fim,opcoes:{} as OpcoesAcompanhamento}));
 const [dados,setDados]=useState<(ResultadoBuilder&{chave:string})|null>(null),[erro,setErro]=useState(''),[ocupado,setOcupado]=useState(true),[revisao,setRevisao]=useState(0);
 const [modo,setModo]=useState<'tabela'|'cartoes'>('tabela'),[busca,setBusca]=useState(''),[pagina,setPagina]=useState(1),[dialogo,setDialogo]=useState(false);
 const [selecao,setSelecao]=useState<{fonte:FonteAcompanhamento;ids:string[]}|null>(null);
 const opcoes={...consulta.opcoes,...filtros.config};
 const comFiltros=Object.keys(filtros.config).length>0;
 const assinatura=JSON.stringify([propriedadeId,fonte,consulta,opcoes,comFiltros?pagina:1]);
 const definicao=fontesAcompanhamento[fonte];
 const campos=selecao?.fonte===fonte?selecao.ids:definicao.padrao;
 const selecionados=definicao.campos.filter(c=>campos.includes(c.id));
 const resultado=dados?.chave===assinatura?dados:null;
 useEffect(()=>{setInicio(periodoUrl.inicio);setFim(periodoUrl.fim);setConsulta(v=>v.inicio===periodoUrl.inicio&&v.fim===periodoUrl.fim?v:{...v,inicio:periodoUrl.inicio,fim:periodoUrl.fim});setPagina(1)},[periodoUrl.inicio,periodoUrl.fim]);
 useEffect(()=>{let ativo=true;setOcupado(true);setErro('');setDados(null);void consultarFonte(fonte,propriedadeId,consulta.inicio,consulta.fim,comFiltros?pagina:1,opcoes).then(r=>{if(ativo)setDados({...r,chave:assinatura})}).catch(e=>{if(ativo)setErro(e instanceof Error?e.message:'Não foi possível consultar o relatório.')}).finally(()=>{if(ativo)setOcupado(false)});return()=>{ativo=false}},[assinatura,revisao]);
 useEffect(()=>{setBusca('');setPagina(1);setDialogo(false)},[fonte,propriedadeId]);
 const linhas=(resultado?.linhas??[]).filter(l=>String(l.animal??'').toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')));
 const paginado=resultado?.paginado??false;
 const totalPaginas=Math.max(1,Math.ceil((paginado?resultado?.total??0:linhas.length)/12)),paginaAtual=Math.min(pagina,totalPaginas),exibidas=paginado?linhas:linhas.slice((paginaAtual-1)*12,paginaAtual*12);
 const exportavel=!!resultado&&!!campos.length&&!ocupado&&!erro;
 function baixar(){if(!podeExportar||!exportavel)return;const url=URL.createObjectURL(new Blob([csvPersonalizado(selecionados,linhas)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`${fonte}-${consulta.inicio}-${consulta.fim}${paginado?`-pagina-${paginaAtual}`:''}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 const mostrar=(id:string,valor:typeof exibidas[number][string],unidade?:string)=>id==='animal'&&typeof valor==='string'?valor:formatarCelula(valor,unidade);
 return <div className="rel-complementares"><nav aria-label="Relatórios reprodutivos"><h2>Relatórios prontos</h2>{(Object.keys(fontesAcompanhamento) as FonteAcompanhamento[]).map(id=><Button key={id} variant={id===fonte?'secondary':'ghost'} aria-current={id===fonte?'page':undefined} onClick={()=>selecionar(id)}><FileText size={16}/><span>{fontesAcompanhamento[id].nome}</span></Button>)}<Button variant="outline" className="rel-abrir-builder" onClick={personalizar}><Columns3 size={16}/>Abrir no builder</Button></nav>
 <section className="rel-superficie rel-complementar-resultado" aria-label={definicao.nome}><header className="rel-resultado-topo"><h2>{definicao.nome}<AjudaCampo rotulo={`Critérios de ${definicao.nome}`} texto={criteriosAcompanhamento[fonte]}/></h2><div className="rel-toolbar"><PainelFiltrosRelatorio key={`${fonte}:${propriedadeId}`} fonte={fonte} propriedadeId={propriedadeId} fim={consulta.fim} valor={filtros.config} onAplicar={config=>{setPagina(1);setBusca('');filtros.aplicar(config)}}/><Button variant="outline" size="sm" onClick={()=>setDialogo(true)}><Columns3 size={16}/>Personalizar campos</Button>{podeExportar&&<Button variant="outline" size="sm" disabled={!exportavel} onClick={baixar}><Download size={15}/>{paginado?'Exportar página CSV':'Exportar CSV'}</Button>}</div></header>
 <form className="rel-complementar-periodo" onSubmit={e=>{e.preventDefault();periodoUrl.alterar({start:dateFromIso(inicio),end:dateFromIso(fim)});setConsulta({inicio,fim,opcoes:{}});setPagina(1);setRevisao(v=>v+1)}}><label>Início<Input ref={inicioRef} type="date" required max={fim} value={inicio} onChange={e=>setInicio(e.target.value)}/></label><label>Fim<Input type="date" required min={inicio} max={getHojeISO()} value={fim} onChange={e=>setFim(e.target.value)}/></label><Button type="submit" size="sm" disabled={ocupado}>Consultar período</Button><span className="rel-periodo-aplicado">{formatBRDateISO(consulta.inicio)} a {formatBRDateISO(consulta.fim)}<AjudaCampo rotulo="Critérios aplicados à consulta" texto={`Sítio ${propriedadeId}; corte em ${formatBRDateISO(opcoes.corte??consulta.fim)}. ${fonte==='iep'?(opcoes.iepModo==='TODOS_PARTOS'?'Todos os partos.':'Vivos e natimortos.'):fonte==='perdas'?(opcoes.janelaPerdaDias?`Janela de ${opcoes.janelaPerdaDias} dias.`:'Sem janela; somente contagens.'):criteriosAcompanhamento[fonte]}`}/></span></form>
 {ocupado||(!resultado&&!erro)?<div className="rel-complementar-estado" role="status" aria-label="Carregando relatório"><Skeleton className="h-16 w-full"/>{[1,2,3].map(n=><Skeleton key={n} className="h-10 w-full"/>)}</div>:erro?<div className="rel-complementar-estado" role="alert"><p>{erro}</p><Button variant="outline" onClick={()=>setRevisao(v=>v+1)}>Tentar novamente</Button></div>:<>
 {resultado?.resumoEscopo==='POPULACAO'&&<div className="rel-resumo-populacao">Resumo da população<AjudaCampo rotulo="Sobre o resumo da população" texto="Considera o período e os filtros de população do motor. Critérios dos registros refinam a lista abaixo, sem recalcular taxas ou transformar lacunas em zero."/></div>}<dl className="rel-complementar-resumo">{resultado?.resumo?.map(m=><div key={m.nome}><dt>{m.nome}</dt><dd>{formatarCelula(m.valor,m.unidade)}</dd></div>)}</dl>
 {!!resultado?.avisos?.length&&<div className="rel-complementar-avisos"><AjudaCampo rotulo="Pendências e cobertura da consulta" texto={resultado.avisos.join(' ')}/>Cobertura parcial</div>}
 <div className="rel-leitura"><label className="rel-complementar-busca"><Search size={16}/><Input aria-label={paginado?'Buscar nesta página':'Buscar animal ou brinco'} placeholder={paginado?'Buscar nesta página':'Buscar animal ou brinco'} value={busca} onChange={e=>{setBusca(e.target.value);setPagina(1)}}/></label><div className="rel-modo"><Button size="sm" aria-pressed={modo==='cartoes'} variant={modo==='cartoes'?'default':'ghost'} onClick={()=>setModo('cartoes')}><LayoutGrid size={15}/>Cartões</Button><Button size="sm" aria-pressed={modo==='tabela'} variant={modo==='tabela'?'default':'ghost'} onClick={()=>setModo('tabela')}><List size={15}/>Tabela</Button></div></div>
 {!campos.length?<div className="rel-complementar-estado">Selecione ao menos uma variável.</div>:!linhas.length?<div className="rel-complementar-estado"><h3>Nenhum registro neste recorte</h3><Button variant="outline" size="sm" onClick={()=>busca?setBusca(''):inicioRef.current?.focus()}>{busca?'Limpar busca':'Ajustar período'}</Button></div>:modo==='tabela'?<Table containerLabel={definicao.nome}><TableHeader><TableRow>{selecionados.map(c=><TableHead key={c.id}>{c.nome}{c.unidade&&` (${c.unidade})`}<AjudaCampo rotulo={`Sobre ${c.nome}`} texto={c.ajuda}/></TableHead>)}</TableRow></TableHeader><TableBody>{exibidas.map(l=><TableRow key={String(l.id)}>{selecionados.map(c=><TableCell key={c.id}>{mostrar(c.id,l[c.id],c.unidade)}</TableCell>)}</TableRow>)}</TableBody></Table>:<div className="rel-complementar-cartoes">{exibidas.map(l=><article key={String(l.id)}><dl>{selecionados.map(c=><div key={c.id}><dt>{c.nome}</dt><dd>{mostrar(c.id,l[c.id],c.unidade)}</dd></div>)}</dl></article>)}</div>}
 <footer className="rel-rodape"><span>{linhas.length} registros{paginado?` nesta página · ${resultado?.total??0} na consulta`:''}{busca?` de ${resultado?.total??0}`:''}<AjudaCampo rotulo="Sobre o resumo" texto="Os indicadores correspondem ao período completo consultado. A busca filtra os registros exibidos e exportados, sem recalcular os indicadores."/></span><span>{definicao.linha}</span>{totalPaginas>1&&<div><Button size="sm" variant="outline" disabled={paginaAtual<=1} onClick={()=>setPagina(paginaAtual-1)}>Anterior</Button><span>Página {paginaAtual} de {totalPaginas}</span><Button size="sm" variant="outline" disabled={paginaAtual>=totalPaginas} onClick={()=>setPagina(paginaAtual+1)}>Próxima</Button></div>}</footer></>}
 </section><Dialog open={dialogo} onOpenChange={setDialogo}><DialogContent className="rel-detalhe-dialog" aria-describedby={undefined}><DialogHeader><DialogTitle>Variáveis de {definicao.nome}</DialogTitle></DialogHeader><div className="rel-complementar-campos">{definicao.campos.map(c=><label key={c.id}><Checkbox checked={campos.includes(c.id)} onCheckedChange={v=>setSelecao({fonte,ids:v?[...campos,c.id]:campos.filter(id=>id!==c.id)})}/><span>{c.nome}{c.unidade&&` (${c.unidade})`}</span><AjudaCampo rotulo={`Ajuda de ${c.nome}`} texto={c.ajuda}/></label>)}</div><Button onClick={()=>setDialogo(false)}>Concluir seleção</Button></DialogContent></Dialog></div>;
}
