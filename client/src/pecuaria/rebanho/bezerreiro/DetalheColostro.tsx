import { useState, type ReactNode } from 'react';
import { navegarPara } from '../../../router';
import { Button } from '@/components/ui/button';
import { ListaColostro } from './ListaColostro';
import { formatarDataBR } from '../lib/rotulos';
import { consultarBezerreiro, consultaBezerreiro } from './api';
import { litros, numero, textoFisico } from './modelo';
import { EstadoConsulta, ModalBezerreiro, PaginacaoBezerreiro, RecuperacaoConflito, useComando, useConsultaBezerreiro, useRecuperacaoConflito } from './ui';
import type { Brix, OrigemColostro, Pagina } from './types';
export type RecursoColostro = 'origens' | 'destinacoes' | 'enriquecimentos';
export const parametrosDetalheColostro = (tipo?: RecursoColostro, id = '') => ({ origemId: tipo === 'origens' ? id : '', destinacaoId: tipo === 'destinacoes' ? id : '', enriquecimentoId: tipo === 'enriquecimentos' ? id : '' });
type Navegar = (v: Record<string,string>) => void;
function Ficha({linhas}: {linhas:[string,ReactNode][]}) {return <table className="bez-ficha"><tbody>{linhas.map(([titulo,valor])=><tr key={titulo}><th scope="row">{titulo}</th><td>{valor}</td></tr>)}</tbody></table>;}
type Dependencia = {tipo:'destinacoes'|'enriquecimentos'|'fornecimentos'|'unidades';id:string;unidadeCodigo:string|null;animalId?:string|null;brinco?:string|null};
type RegistroHistorico = {id:string;data:string;status:string;versao:number;responsavel:string|null;origemId:string|null};
type BaseRegistro = RegistroHistorico & {ocorridoEm:string|null;horarioEstimado:boolean;criadoPorId:number|null;criadoEm?:string;motivoEstorno:string|null;dependencias:Dependencia[]};
interface Destinacao extends BaseRegistro {brix:Brix|null;excecaoBrix:{motivo?:string;responsavel?:string}|null;fornecimentos:{id:string;fornecimentoId:string;criaId:string;animalId:string|null;brinco:string|null;nome:string|null;quantidadeLitros:string;ativo:boolean;criadoPelaDestinacao:boolean}[];unidades:{id:string;codigo:string;status:string;volumeLitros:string}[]}
interface Enriquecimento extends BaseRegistro {volumeFinalLitros:string;origemResultadoId:string|null;origens:{id:string;origemId:string;unidadeId:string|null;unidadeCodigo:string|null;quantidadeLitros:string;ativo:boolean}[];insumos:{id:string;produtoNome:string;partidaId:string|null;quantidade:string;unidade:string}[]}
type DetalheOrigem = OrigemColostro & {criadoPorId:number|null;criadoEm:string;historico:{destinacoes:{id:string;data:string;status:string;responsavel:string|null;destinatarios:{animalId:string|null;brinco:string|null;nome:string|null;quantidadeLitros:string;unidadeCodigo:string|null;tipo:string|null;forma:string|null}[];unidadesCongeladas:{codigo:string;volumeLitros:string}[]}[];enriquecimentos:{id:string;data:string;status:string}[]}};
const nomeRecurso = (tipo: RecursoColostro|'fornecimentos'|'unidades') => tipo === 'origens' ? 'Origem' : tipo === 'destinacoes' ? 'Destinação' : tipo === 'enriquecimentos' ? 'Enriquecimento' : tipo === 'unidades' ? 'Unidade' : 'Fornecimento';
export function HistoricoColostro({sitio,revisao,params,mudar}: {sitio:number;revisao:number;params:URLSearchParams;mudar:Navegar}) {
  return <>{(['destinacoes','enriquecimentos'] as const).map(tipo=><ListaHistorico key={tipo} tipo={tipo} sitio={sitio} revisao={revisao} params={params} mudar={mudar}/>)}</>;
}
function ListaHistorico({tipo,sitio,revisao,params,mudar}: {tipo:'destinacoes'|'enriquecimentos';sitio:number;revisao:number;params:URLSearchParams;mudar:Navegar}) {
  const parametro=tipo==='destinacoes'?'paginaDestinacoes':'paginaEnriquecimentos',pagina=Math.max(1,Number(params.get(parametro))||1);
  const consulta=useConsultaBezerreiro<Pagina<RegistroHistorico>>(`/colostro/${tipo}${consultaBezerreiro({pagina,inicio:params.get('de'),fim:params.get('ate')})}`,sitio,revisao);
  return <section className="bez-secao"><h3>{tipo==='destinacoes'?'Histórico de destinações':'Enriquecimentos registrados'}</h3><EstadoConsulta {...consulta} carregando={!consulta.dados}>{consulta.dados&&<><ListaColostro destaque="status" rotulo={tipo==='destinacoes'?'Histórico de destinações':'Enriquecimentos registrados'} itens={consulta.dados.itens} chaveDe={r=>r.id} colunas={[
    {chave:'data',titulo:'Data',principal:true,celula:r=>formatarDataBR(r.data)}, {chave:'responsavel',titulo:'Responsável',celula:r=>r.responsavel??'Não informado'}, {chave:'status',titulo:'Situação',celula:r=>r.status==='ESTORNADO'?'Estornado':'Confirmado'}, {chave:'acao',titulo:'Ação',acoes:true,celula:r=><Button variant="outline" onClick={()=>mudar(parametrosDetalheColostro(tipo,r.id))}>Detalhes / regularizar</Button>},
  ]}/>{consulta.dados.total===0&&<p className="bez-estado">Nenhum registro neste período.</p>}<PaginacaoBezerreiro pagina={pagina} total={consulta.dados.total} tamanho={consulta.dados.tamanho??30} mudar={p=>mudar({[parametro]:String(p)})}/></>}</EstadoConsulta></section>;
}
export function DetalheColostro({sitio,revisao,tipo,id,podeLancar,mudar,aoSalvar}: {sitio:number;revisao:number;tipo:RecursoColostro;id:string;podeLancar:boolean;mudar:Navegar;aoSalvar:()=>void}) {
  const consulta=useConsultaBezerreiro<DetalheOrigem|Destinacao|Enriquecimento>(`/colostro/${tipo}/${id}`,sitio,revisao),[estorno,setEstorno]=useState(false);
  const abrir=(recurso:RecursoColostro,registroId:string)=>mudar(parametrosDetalheColostro(recurso,registroId));
  const registro=consulta.dados;
  return <section className="bez-secao"><div className="bez-sectionhead"><h2>{nomeRecurso(tipo)} de colostro</h2><Button variant="outline" onClick={()=>mudar(parametrosDetalheColostro())}>Voltar à consulta</Button></div><EstadoConsulta {...consulta} carregando={!registro}>{registro&&<>
    <Ficha linhas={[['Data',formatarDataBR(registro.data)],['Situação',registro.status==='ESTORNADO'?'Estornado':'Confirmado'],['Versão',String(registro.versao)],
      ['Autoria',<span title={`Registro ${registro.id} · Autor ${registro.criadoPorId??'não informado'}`}>{registro.criadoPorId==null?'Não informada':'Registrada'}{registro.criadoEm?` · criado em ${new Date(registro.criadoEm).toLocaleString('pt-BR')}`:''}</span>],
      ...(tipo==='origens'?[]:[['Responsável',(registro as BaseRegistro).responsavel??'Não informado'],['Horário',registro.ocorridoEm?`${new Date(registro.ocorridoEm).toLocaleString('pt-BR')}${(registro as BaseRegistro).horarioEstimado?' (estimado)':''}`:'Não informado']] as [string,ReactNode][])]}/>
    {tipo==='origens'?<OrigemDetalhada origem={registro as DetalheOrigem} abrir={abrir}/>:<>
      {tipo==='destinacoes'?<DestinacaoDetalhada registro={registro as Destinacao} abrir={abrir}/>:<EnriquecimentoDetalhado registro={registro as Enriquecimento} abrir={abrir}/>}
      <Dependencias dependencias={(registro as BaseRegistro).dependencias} abrir={abrir}/>
      {(registro as BaseRegistro).motivoEstorno&&<p>Motivo do estorno: {(registro as BaseRegistro).motivoEstorno}</p>}
      {podeLancar&&registro.status==='CONFIRMADO'&&<div className="bez-form-acoes"><Button variant="outline" disabled={(registro as BaseRegistro).dependencias.length>0} onClick={()=>setEstorno(true)}>Estornar {tipo==='destinacoes'?'destinação':'enriquecimento'}</Button></div>}
      {estorno&&<EstornarRegistro key={`${sitio}:${tipo}:${id}`} sitio={sitio} tipo={tipo} inicial={registro as Destinacao|Enriquecimento} aoFechar={()=>setEstorno(false)} aoSalvar={()=>{setEstorno(false);aoSalvar();}} abrir={abrir}/>}
    </>}
  </>}</EstadoConsulta></section>;
}
function Dependencias({dependencias,abrir}: {dependencias:Dependencia[];abrir:(tipo:RecursoColostro,id:string)=>void}) {return dependencias.length>0?<section className="bez-estado" aria-label="Dependências do estorno"><p role="alert">Regularize os consumidores abaixo antes de estornar este registro. Cada estorno é confirmado separadamente.</p>{dependencias.map((d,i)=><p key={`${d.tipo}:${d.id}:${i}`}><span title={d.id}>{nomeRecurso(d.tipo)}{d.brinco?` · Cria ${d.brinco}`:''}{d.unidadeCodigo?` · Unidade ${d.unidadeCodigo}`:''}</span> {d.tipo==='fornecimentos'?(d.animalId?<Button variant="outline" onClick={()=>navegarPara(`/pecuaria/rebanho/animais/${d.animalId}#bezerreiro`)}>Ver na ficha da cria</Button>:<span>Fornecimento histórico sem animal vinculado. Concilie o cadastro antes de estornar.</span>):d.tipo==='unidades'?<span>Unidade histórica sem destinação vinculada. Concilie sua origem antes de estornar.</span>:<Button variant="outline" onClick={()=>abrir(d.tipo as RecursoColostro,d.id)}>Abrir {nomeRecurso(d.tipo).toLowerCase()}</Button>}</p>)}</section>:null;}

const FORMAS: Record<string,string> = {BALDE:'Balde',BALDE_COM_BICO:'Balde com bico',MAE:'Mamou na mãe',MAMADEIRA:'Mamadeira',SONDA:'Sonda'};
const rotuloForma = (forma: string) => FORMAS[forma] ?? forma;
const UNIDADES: Record<string,string> = {CONGELADA:'Congelada',RETIRADA:'Retirada do banco',CONSUMIDA:'Consumida',DESCARTADA:'Descartada',ESTORNADA:'Estornada'};
const rotuloUnidade = (status: string) => UNIDADES[status] ?? status;
/** Uma linha por cria atendida; destinações estornadas não entram como recebimento vigente. */
const receptores = (origem: DetalheOrigem) => origem.historico.destinacoes.filter(d=>d.status!=='ESTORNADO').flatMap(d=>d.destinatarios.map((r,i)=>({...r,data:d.data,chave:`${d.id}:${i}`})));
const congeladas = (origem: DetalheOrigem) => origem.historico.destinacoes.filter(d=>d.status!=='ESTORNADO').flatMap(d=>d.unidadesCongeladas.map(u=>({...u,data:d.data})));
function OrigemDetalhada({origem,abrir}: {origem:DetalheOrigem;abrir:(tipo:RecursoColostro,id:string)=>void}) {return <>
  <Ficha linhas={[['Volume de origem',litros(origem.quantidadeLitros)],['Volume livre',litros(origem.livreLitros)],['Armazenamento',textoFisico(origem.origemFisica)],
    ['Brix',`${origem.brix.resultado==null?'Não aferido':`${numero(origem.brix.resultado)}%`}${origem.brix.data?` · ${formatarDataBR(origem.brix.data)}`:''}`],
    ...(origem.preparoId?[['Enriquecimento de origem',<Button variant="outline" onClick={()=>abrir('enriquecimentos',origem.preparoId!)}>Abrir enriquecimento</Button>] as [string,ReactNode]]:[])]}/>
  {receptores(origem).length>0&&<section className="bez-secao"><h3>Quem recebeu este colostro</h3><ListaColostro rotulo="Crias que receberam este colostro" itens={receptores(origem)} chaveDe={r=>r.chave} colunas={[
    {chave:'animal',titulo:'Animal',principal:true,celula:r=><><strong>{r.brinco??'Cria registrada'}</strong>{r.nome&&<span className="bez-subtexto">{r.nome}</span>}</>},
    {chave:'quantidade',titulo:'Quantidade',alinhamento:'direita',celula:r=><strong>{litros(r.quantidadeLitros)}</strong>},
    {chave:'data',titulo:'Data',celula:r=>formatarDataBR(r.data)},
    {chave:'forma',titulo:'Fornecimento',celula:r=>`${r.tipo==='DESCONGELADO'?'Descongelado':'Fresco'}${r.forma?` · ${rotuloForma(r.forma)}`:''}`},
    ...(receptores(origem).some(r=>r.unidadeCodigo)?[{chave:'unidade',titulo:'Unidade do banco',celula:(r:ReturnType<typeof receptores>[number])=>r.unidadeCodigo??'—'}]:[]),
    {chave:'acao',titulo:'Ação',acoes:true,celula:r=>r.animalId?<Button variant="outline" onClick={()=>navegarPara(`/pecuaria/rebanho/animais/${r.animalId}#bezerreiro`)}>Ver na ficha</Button>:'—'},
  ]}/></section>}
  {congeladas(origem).length>0&&<section className="bez-secao"><h3>Congelado no banco</h3><ListaColostro rotulo="Unidades congeladas desta origem" itens={congeladas(origem)} chaveDe={u=>u.codigo} colunas={[
    {chave:'codigo',titulo:'Unidade',principal:true,celula:u=><strong>{u.codigo}</strong>},
    {chave:'volume',titulo:'Volume',alinhamento:'direita',celula:u=>litros(u.volumeLitros)},
    {chave:'restante',titulo:'Remanescente',alinhamento:'direita',celula:u=>{const atual=origem.unidades.find(x=>x.codigo===u.codigo);return atual?litros(atual.saldoRestanteLitros):'—';}},
    {chave:'status',titulo:'Situação',celula:u=>{const atual=origem.unidades.find(x=>x.codigo===u.codigo);return atual?rotuloUnidade(atual.status):'—';}},
    {chave:'data',titulo:'Congelada em',celula:u=>formatarDataBR(u.data)},
  ]}/></section>}
  {origem.historico.destinacoes.length>0&&<section className="bez-secao"><h3>Destinações desta origem</h3><ListaColostro rotulo="Destinações desta origem" destaque="status" itens={origem.historico.destinacoes} chaveDe={d=>d.id} colunas={[
    {chave:'data',titulo:'Data',principal:true,celula:d=>formatarDataBR(d.data)},
    {chave:'responsavel',titulo:'Responsável',celula:d=>d.responsavel??'Não informado'},
    {chave:'status',titulo:'Situação',celula:d=>d.status==='ESTORNADO'?'Estornado':'Confirmado'},
    {chave:'acao',titulo:'Ação',acoes:true,celula:d=><Button variant="outline" onClick={()=>abrir('destinacoes',d.id)}>Abrir destinação</Button>},
  ]}/></section>}
  {origem.historico.enriquecimentos.length>0&&<section className="bez-secao"><h3>Enriquecimentos desta origem</h3><ul className="bez-registros">{origem.historico.enriquecimentos.map(r=><li key={r.id}><span>{formatarDataBR(r.data)} · {r.status==='ESTORNADO'?'Estornado':'Confirmado'}</span><Button variant="outline" onClick={()=>abrir('enriquecimentos',r.id)}>Abrir enriquecimento</Button></li>)}</ul></section>}
  {!origem.historico.destinacoes.length&&!origem.historico.enriquecimentos.length&&<p className="bez-estado">Esta origem ainda não tem destinações nem enriquecimentos.</p>}
</>;}
function DestinacaoDetalhada({registro,abrir}: {registro:Destinacao;abrir:(tipo:RecursoColostro,id:string)=>void}) {return <>
  <Ficha linhas={[['Brix aplicado',registro.brix?.resultado==null?'Não aferido':`${numero(registro.brix.resultado)}%${registro.brix?.data?` · ${formatarDataBR(registro.brix.data)}`:''}`],
    ...(registro.excecaoBrix?.motivo?[['Exceção do Brix',`${registro.excecaoBrix.motivo} · ${registro.excecaoBrix.responsavel??'Responsável não informado'}`] as [string,ReactNode]]:[]),
    ...(registro.origemId?[['Origem',<Button variant="outline" onClick={()=>abrir('origens',registro.origemId!)}>Abrir origem</Button>] as [string,ReactNode]]:[])]}/>
  <ListaColostro rotulo="Fornecimentos da destinação" itens={registro.fornecimentos} chaveDe={f=>f.id} colunas={[{chave:'cria',titulo:'Cria / fornecimento',principal:true,celula:f=><span className="bez-celula-acao"><span title={`Cria ${f.criaId} · Fornecimento ${f.fornecimentoId}`}>{f.brinco?`${f.brinco}${f.nome?` · ${f.nome}`:''}`:'Cria registrada'}</span>{f.animalId&&<Button variant="outline" onClick={()=>navegarPara(`/pecuaria/rebanho/animais/${f.animalId}#bezerreiro`)}>Ver na ficha</Button>}</span>},{chave:'volume',titulo:'Volume',celula:f=>litros(f.quantidadeLitros)},{chave:'vinculo',titulo:'Efeito do estorno',celula:f=>f.criadoPelaDestinacao?'Anula o fornecimento criado nesta destinação':'Desfaz somente o vínculo; conserva o fornecimento original'}]}/>
  {registro.unidades.length>0&&<ListaColostro rotulo="Unidades congeladas nesta destinação" itens={registro.unidades} chaveDe={u=>u.id} colunas={[{chave:'codigo',titulo:'Unidade',principal:true,celula:u=>u.codigo},{chave:'volume',titulo:'Volume',celula:u=>litros(u.volumeLitros)},{chave:'status',titulo:'Situação',celula:u=>u.status}]}/>}
</>;}
function EnriquecimentoDetalhado({registro,abrir}: {registro:Enriquecimento;abrir:(tipo:RecursoColostro,id:string)=>void}) {return <>
  <Ficha linhas={[['Volume final medido',litros(registro.volumeFinalLitros)],...(registro.origemResultadoId?[['Origem enriquecida',<Button variant="outline" onClick={()=>abrir('origens',registro.origemResultadoId!)}>Abrir origem enriquecida</Button>] as [string,ReactNode]]:[])]}/>
  <ListaColostro rotulo="Origens consumidas" itens={registro.origens} chaveDe={o=>o.id} colunas={[{chave:'origem',titulo:'Origem',principal:true,celula:o=><Button variant="outline" onClick={()=>abrir('origens',o.origemId)}>Abrir origem</Button>},{chave:'unidade',titulo:'Unidade',celula:o=>o.unidadeCodigo??o.unidadeId??'Volume livre'},{chave:'volume',titulo:'Volume consumido',celula:o=>litros(o.quantidadeLitros)}]}/>
  <ListaColostro rotulo="Insumos consumidos" itens={registro.insumos} chaveDe={i=>i.id} colunas={[{chave:'produto',titulo:'Insumo',principal:true,celula:i=>i.produtoNome},{chave:'partida',titulo:'Partida',celula:i=>i.partidaId??'Não informada'},{chave:'quantidade',titulo:'Quantidade',celula:i=>`${numero(i.quantidade)} ${i.unidade}`} ]}/>
</>;}
function EstornarRegistro({sitio,tipo,inicial,aoFechar,aoSalvar,abrir}: {sitio:number;tipo:'destinacoes'|'enriquecimentos';inicial:Destinacao|Enriquecimento;aoFechar:()=>void;aoSalvar:()=>void;abrir:(tipo:RecursoColostro,id:string)=>void}) {
  const [motivo,setMotivo]=useState(''),[adotado,setAdotado]=useState(inicial),identidade=`${tipo}:${inicial.id}`;
  const comando=useComando(sitio,aoSalvar,identidade),recuperacao=useRecuperacaoConflito(`${sitio}:${identidade}`,()=>consultarBezerreiro<Destinacao|Enriquecimento>(`/colostro/${tipo}/${inicial.id}`,sitio));
  const bloqueado=adotado.status!=='CONFIRMADO'||adotado.dependencias.length>0;
  return <ModalBezerreiro titulo={`Estornar ${nomeRecurso(tipo).toLowerCase()}`} form="estorno-registro-colostro" textoSalvar="Confirmar estorno" aoFechar={aoFechar} {...comando}><form id="estorno-registro-colostro" onSubmit={e=>{e.preventDefault();if(bloqueado||((comando.conflito||recuperacao.atual)&&!recuperacao.conferido))return;void comando.salvar(`/colostro/${tipo}/${inicial.id}/estorno`,{versaoEsperada:adotado.versao,motivo});}}>
    <RecuperacaoConflito conflito={comando.conflito} carregando={recuperacao.carregando} erro={recuperacao.erro} atualizado={!!recuperacao.atual} conferido={recuperacao.conferido} aoAtualizar={()=>void recuperacao.atualizar()} aoConferir={()=>{if(recuperacao.atual)setAdotado(recuperacao.atual);recuperacao.conferir();}}>{recuperacao.atual&&<><p>Versão {adotado.versao} → {recuperacao.atual.versao} · {recuperacao.atual.status} · {recuperacao.atual.dependencias.length} dependências.</p><Dependencias dependencias={recuperacao.atual.dependencias} abrir={abrir}/></>}</RecuperacaoConflito>
    <p>O estorno preserva o histórico e reverte apenas os efeitos deste registro. Fornecimentos apenas vinculados permanecem válidos.</p><Dependencias dependencias={adotado.dependencias} abrir={abrir}/>{adotado.status!=='CONFIRMADO'&&<p role="alert">Este registro já foi estornado. Feche para consultar o histórico atualizado.</p>}
    <label className="bez-campo">Motivo do estorno<textarea required minLength={5} maxLength={1000} value={motivo} onChange={e=>setMotivo(e.target.value)} disabled={comando.ocupado}/></label><label className="bez-check"><input type="checkbox" required disabled={comando.ocupado||bloqueado}/>Conferi os vínculos e efeitos do estorno.</label>
  </form></ModalBezerreiro>;
}
