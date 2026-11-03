import { useEffect, useState } from "react";
import { ShieldCheck, MoreHorizontal, Plus } from "lucide-react";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "../../../components/VisualizacaoConsulta";
import { Button, ErrorBox, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { Paginacao } from "../ui";
import { type CadastroProtocoloMeta } from "./cadastros-api";
import { DetalheModeloProtocolo, intervaloProcedimento } from "./DetalheModeloProtocolo";
import { Button as BotaoMenu } from "../../../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import "./CatalogoModelosProtocolos.css";

type Props = {
  tipo: CadastroProtocoloMeta["tipo"]; protocolos: CadastroProtocoloMeta[]; total: number; pagina: number;
  carregando: boolean; erro: string | null; ocupado: boolean; podeLancar: boolean;
  busca: string; situacao: string; onBusca: (busca: string) => void; onSituacao: (situacao: string) => void;
  onPagina: (pagina: number) => void; onRecarregar: () => void; onNovo: () => void;
  onNovaVersao: (p: CadastroProtocoloMeta) => void; onConcluir: (p: CadastroProtocoloMeta) => void; onInativar: (p: CadastroProtocoloMeta) => void;
};
const finalidades = { SANITARIO: "Sanitário", PRE_SINCRONIZACAO: "Pré-sincronização / preparação", IATF: "IATF", TETF: "TETF" };
function resumoEstrutura(p: CadastroProtocoloMeta) {
  const partes: string[] = [];
  if (p.totalMomentos) partes.push(`${p.totalMomentos} ${p.totalMomentos===1?"etapa":"etapas"}`);
  if (p.totalAcoesSemEtapa) partes.push(`${p.totalAcoesSemEtapa} ${p.totalAcoesSemEtapa===1?"procedimento individual":"procedimentos individuais"}`);
  return partes.join(" · ") || `${p.totalEtapas} ${p.totalEtapas===1?"procedimento":"procedimentos"}`;
}
function SituacaoModelo({ p }: { p: CadastroProtocoloMeta }) {
  return <>{!p.ativo && <span className="modelo-situacao">Inativo</span>}{!p.publicado && !p.publicadoEm && <span className="modelo-situacao modelo-situacao-aviso">Cadastro não concluído</span>}</>;
}
export function CatalogoModelosProtocolos(props: Props) {
  const { tipo, protocolos, total, pagina, carregando, erro, ocupado, podeLancar } = props;
  const visual = useVisualizacaoConsulta("visualCadastroProtocolos",tipo);
  const [detalhe,setDetalhe] = useState<CadastroProtocoloMeta | null>(null);
  useEffect(()=>{setDetalhe(null);},[tipo]);
  const titulo = tipo === "SANITARIO" ? "Protocolos sanitários" : "Protocolos reprodutivos";
  const bloqueado = ocupado || carregando;
  const acoes = (p: CadastroProtocoloMeta) => <>
    <Button secondary disabled={carregando} onClick={()=>setDetalhe(p)} aria-label={`Ver detalhes de ${p.nome} v${p.versao}`}>Ver detalhes</Button>
    {podeLancar && <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BotaoMenu type="button" variant="ghost" size="icon" className="modelo-mais-acoes" disabled={bloqueado} aria-label={`Mais ações de ${p.nome} v${p.versao}`}><MoreHorizontal size={18} aria-hidden="true"/></BotaoMenu>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="modelo-menu-acoes">
        {!p.publicado && !p.publicadoEm && !p.utilizada && p.ativo && <DropdownMenuItem disabled={bloqueado} onSelect={()=>props.onConcluir(p)} aria-label={`Concluir cadastro de ${p.nome} v${p.versao}`}>Concluir cadastro</DropdownMenuItem>}
        <DropdownMenuItem disabled={bloqueado} onSelect={()=>props.onNovaVersao(p)} aria-label={`Nova versão de ${p.nome} v${p.versao}`}>Nova versão</DropdownMenuItem>
        {p.ativo && <DropdownMenuItem disabled={bloqueado} onSelect={()=>props.onInativar(p)} aria-label={`Inativar ${p.nome} v${p.versao}`} className="text-destructive focus:text-destructive">Inativar</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>}
  </>;
  return <section className="catalogo-modelos" aria-label={titulo} aria-busy={carregando}>
    <header className="catalogo-modelos-cabecalho"><div><h1>{titulo}</h1></div>{podeLancar && <Button disabled={bloqueado} onClick={props.onNovo}><Plus size={18} aria-hidden="true" />Novo protocolo</Button>}</header>
    <div className="catalogo-modelos-barra"><label className="catalogo-modelos-busca">Buscar protocolos<input className={classeInput} type="search" placeholder="Nome ou descrição" value={props.busca} onChange={e=>props.onBusca(e.target.value)}/></label>
      <label className="catalogo-modelos-inativos"><input type="checkbox" checked={props.situacao === "TODAS" || props.situacao === "INATIVA"} onChange={e=>props.onSituacao(e.target.checked?"TODAS":"ATIVA")}/>Mostrar inativos</label>
      <AlternarVisualizacaoConsulta {...visual} rotulo="Visualização dos protocolos"/>
    </div>
    {!["TODAS","ATIVA"].includes(props.situacao) && <div className="catalogo-modelos-filtro-anterior"><span>Filtro do link anterior: {props.situacao === "INATIVA" ? "somente inativos" : props.situacao === "RASCUNHO" ? "cadastros não concluídos" : "cadastros concluídos ativos"}</span><Button secondary onClick={()=>props.onSituacao("ATIVA")}>Remover filtro</Button></div>}
    <div className="catalogo-modelos-estado"><ErrorBox erro={erro}/>{erro && <Button secondary disabled={carregando} onClick={props.onRecarregar}>Tentar novamente</Button>}
      {carregando ? <p role="status">{protocolos.length ? "Atualizando protocolos… Os dados confirmados continuam visíveis." : "Carregando protocolos…"}</p> : <p role="status">{total} {total===1?"protocolo":"protocolos"}{props.situacao==="TODAS"?" · incluindo inativos":props.situacao==="INATIVA"?" inativos":" ativos"}{erro && " · última consulta confirmada"}</p>}
    </div>
    {carregando && !protocolos.length ? <div className="catalogo-modelos-esqueleto" aria-hidden="true"><div/><div/></div> : visual.modo === "visual" ? <div className="catalogo-modelos-cartoes">{protocolos.map(p=>{
      const restantes = Math.max(0,(p.totalMomentos??0)+(p.totalAcoesSemEtapa??0)-(p.previaEstrutura?.length??0));
      return <article key={p.id} className="modelo-cartao"><header className="modelo-identidade"><span className="modelo-emblema"><ShieldCheck size={24} aria-hidden="true" /></span><div><h3>{p.nome}</h3>{tipo !== "SANITARIO" && <p>{p.finalidade ? finalidades[p.finalidade] : "Finalidade não informada"}</p>}</div><SituacaoModelo p={p}/></header>
        <dl className="modelo-fatos"><div><dt>Versão</dt><dd>{p.versao}</dd></div><div><dt>Estrutura</dt><dd>{resumoEstrutura(p)}</dd></div></dl>
        {!!p.previaEstrutura?.length && <ol className="modelo-previa" aria-label={`Etapas e procedimentos de ${p.nome}`}>{p.previaEstrutura?.map(e=><li key={e.id}>{!e.agrupada && e.intervalo!=null && <span>{intervaloProcedimento(e.intervalo,e.unidade??"DIAS")}</span>}<strong>{e.nome}</strong>{e.agrupada && <small>{e.totalProcedimentos} {e.totalProcedimentos===1?"procedimento":"procedimentos"}</small>}</li>)}</ol>}
        {restantes>0 && <p className="modelo-previa-mais">+ {restantes} {restantes===1?"item em":"itens em"} Ver detalhes</p>}
        <footer>{acoes(p)}</footer>
      </article>;
    })}</div> : <TabelaFinanceira<CadastroProtocoloMeta> rotulo={titulo} visualizacao="tabela" compacta itens={protocolos} chaveDe={p=>p.id} colunas={[
      {chave:"nome",titulo:"Protocolo",principal:true,larguraMinima:220,celula:p=><strong className="modelo-nome">{p.nome}</strong>},
      {chave:"situacao",titulo:"Situação",larguraMinima:190,celula:p=><div className="modelo-situacoes"><SituacaoModelo p={p}/>{p.ativo && (p.publicado || p.publicadoEm) && <span className="modelo-situacao">Ativo</span>}</div>},
      ...(tipo === "SANITARIO" ? [] : [{chave:"finalidade",titulo:"Finalidade",larguraMinima:140,celula:(p:CadastroProtocoloMeta)=>p.finalidade ? finalidades[p.finalidade] : "Não informada"}]),
      {chave:"versao",titulo:"Versão",alinhamento:"centro",larguraMinima:70,celula:p=>p.versao},
      {chave:"estrutura",titulo:"Estrutura",larguraMinima:160,celula:resumoEstrutura},
      {chave:"acoes",titulo:"Ações",acoes:true,alinhamento:"direita",larguraMinima:160,celula:p=><div className="modelo-acoes-tabela">{acoes(p)}</div>},
    ]}/>}
    {!carregando && !erro && !protocolos.length && <div className="catalogo-modelos-vazio"><strong>Nenhum protocolo encontrado.</strong><p>Revise a busca ou inclua os protocolos inativos.</p></div>}
    {total>10 && <Paginacao paginaAtual={pagina} totalPaginas={Math.ceil(total/10)} totalItens={total} itensPorPagina={10} onPaginaChange={props.onPagina} rotulo="protocolos" idSelect={`catalogo-modelos-${tipo}`}/>}
    {detalhe && <DetalheModeloProtocolo key={`${tipo}:${detalhe.id}:${detalhe.atualizadoEm}`} origem={detalhe} onClose={()=>setDetalhe(null)}/>}
  </section>;
}
