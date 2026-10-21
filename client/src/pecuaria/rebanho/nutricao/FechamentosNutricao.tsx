import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { PeriodoFinanceiroControl } from "@/financeiro/PeriodoFinanceiroControl";
import { DatePicker } from "@/components/DatePicker";
import { CalendarioFechamentos } from "./CalendarioFechamentos";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { filtrosDasColunas, type CampoConsulta } from "@/financeiro/FiltroColunaConsulta";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { useCallback } from "react";
import { Panel, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { navegarPara } from "../../../router";
import { classeInput } from "../../../financeiro/PainelCadastro";
import { buscarLote, listarLotes } from "../api";
import { formatarDataBR } from "../lib/rotulos";
import { listarFechamentos, type Fechamento } from "./api";
import { useConsulta } from "./consulta";
import { custoTexto, EstadoConsulta, LinkNutricional, rotaNutricao, SituacaoFechamento } from "./componentes";
import { rotaFechamento, useFiltrosNutricionais } from "./navegacao";
import { PaginacaoNutricao } from "./PaginacaoNutricao";

export function FechamentosNutricao({ loteId }: { loteId?: string }) {
  const visual = useVisualizacaoConsulta("visualFechamentos");
  const { params, atualizar } = useFiltrosNutricionais();
  const de = params.get("fechamentosDe") ?? "";
  const ate = params.get("fechamentosAte") ?? "";
  const filtroLote = params.get("filtroLoteId") ?? "";
  const situacao = params.get("statusFechamento");
  const status = situacao === "CONFIRMADO" || situacao === "ESTORNADO" ? situacao : "";
  const numeroPagina = Number(params.get("paginaFechamentos") ?? 1);
  const pagina = Number.isInteger(numeroPagina) && numeroPagina >= 1 && numeroPagina <= 100000 ? numeroPagina : 1;
  const lista = useConsulta(useCallback(() => de || ate ? listarFechamentos(loteId || filtroLote || undefined, pagina, status || undefined, {de:de||undefined,ate:ate||undefined}) : listarFechamentos(loteId || filtroLote || undefined, pagina, status || undefined), [loteId, filtroLote, pagina, status, de, ate]));
  const lotes = useConsulta(useCallback(() => loteId ? buscarLote(loteId).then(l => [l]) : listarLotes(), [loteId]));
  const edicao = useRascunhoConsulta({lote:filtroLote,status,de,ate},{lote:"",status:"",de:"",ate:""},v=>atualizar({filtroLoteId:v.lote,statusFechamento:v.status,fechamentosDe:v.de,fechamentosAte:v.ate,paginaFechamentos:""}));
  const campos: CampoConsulta[] = [
    ...(!loteId ? [{chave:"lote",ativo:!!filtroLote,limpar:()=>edicao.editar("lote",""),conteudo:<CampoFiltro rotulo="Lote"><SelectCampo aria-label="Filtrar por lote" value={edicao.rascunho.lote} onValueChange={v=>edicao.editar("lote",v)}><option value="">Todos os lotes</option>{lotes.dados?.map(l=><option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</SelectCampo>{lotes.erro && <span role="alert">{lotes.erro}</span>}</CampoFiltro>}] : []),
    {chave:"datas",naBarra:true,ativo:!!de||!!ate,limpar:()=>{edicao.editar("de","");edicao.editar("ate","");},conteudo:<><CampoFiltro rotulo="Data inicial"><DatePicker aria-label="Data inicial do período" value={edicao.rascunho.de} onChange={v=>edicao.editar("de",v)}/></CampoFiltro><CampoFiltro rotulo="Data final"><DatePicker aria-label="Data final do período" value={edicao.rascunho.ate} onChange={v=>edicao.editar("ate",v)}/></CampoFiltro></>},
    {chave:"situacao",ativo:!!status,limpar:()=>edicao.editar("status",""),conteudo:<CampoFiltro rotulo="Situação"><SelectCampo aria-label="Situação do fechamento" value={edicao.rascunho.status} onValueChange={v=>edicao.editar("status",v)}><option value="">Todas as situações</option><option value="CONFIRMADO">Confirmados</option><option value="ESTORNADO">Estornados</option></SelectCampo></CampoFiltro>},
  ];
  return <Panel className="nutricao-conteudo nutricao-fechamentos">
    <BarraConsulta campos={campos} edicaoFiltros={edicao} erroFiltros={edicao.rascunho.de && edicao.rascunho.ate && edicao.rascunho.de>edicao.rascunho.ate ? "A data inicial deve ser igual ou anterior à final." : null} criterios={[...(de||ate?[{id:"datas",rotulo:`Período: ${de?formatarDataBR(de):"início"} a ${ate?formatarDataBR(ate):"hoje"}`,limpar:()=>atualizar({fechamentosDe:"",fechamentosAte:"",paginaFechamentos:""})}]:[]),...(filtroLote?[{id:"lote",rotulo:`Lote: ${lotes.dados?.find(l=>l.id===filtroLote)?.nome ?? "Selecionado"}`,limpar:()=>atualizar({filtroLoteId:"",paginaFechamentos:""})}]:[]),...(status?[{id:"status",rotulo:status==="CONFIRMADO"?"Confirmados":"Estornados",limpar:()=>atualizar({statusFechamento:"",paginaFechamentos:""})}]:[])]} resumo={<>{loteId && <span><LinkNutricional href={rotaNutricao({loteId})}>{lotes.dados?.[0]?.nome ?? "Lote selecionado"}</LinkNutricional> · <LinkNutricional href={rotaNutricao({aba:"fechamentos",statusFechamento:status || undefined})}>Todos os lotes</LinkNutricional></span>}{lista.dados && !lista.carregando && lista.dados.total > 0 && lista.dados.total <= lista.dados.limite && <span>{lista.dados.total} fechamentos</span>}</>}><PeriodoFinanceiroControl allowAll inicio={de} fim={ate} label="Período dos fechamentos" onChange={v=>atualizar({fechamentosDe:v.inicio,fechamentosAte:v.fim,paginaFechamentos:""})}/></BarraConsulta>
    <div className="consulta-visual-barra"><span>Períodos e consumo registrado por lote</span><AlternarVisualizacaoConsulta rotulo="Visualização dos fechamentos" visual="Calendário" {...visual}/></div>
    <div className="px-5"><EstadoConsulta erro={lista.erro} carregando={lista.carregando} recarregar={lista.carregar} estrutura="lista" label="Carregando fechamentos nutricionais…" /></div>
    {lista.dados && !lista.carregando && !lista.erro && <>{visual.modo === "visual" ? <CalendarioFechamentos itens={lista.dados.itens} total={lista.dados.total} de={de} onMes={periodo=>atualizar({fechamentosDe:periodo.de,fechamentosAte:periodo.ate,paginaFechamentos:""})} onAbrir={f=>navegarPara(rotaFechamento(f.id,loteId))}/> : !lista.dados.itens.length ? <p className="nutricao-vazio">Nenhum fechamento encontrado neste contexto.</p> : <TabelaFinanceira filtrosColunas={filtrosDasColunas(campos,edicao)} cartaoComLinks onAbrir={f => navegarPara(rotaFechamento(f.id, loteId))} rotulo="Fechamentos de nutrição" itens={lista.dados.itens} chaveDe={(f) => f.id} colunas={[
      { chave: "periodo", titulo: "Período / situação", principal: true, larguraMinima: 210, celula: (f) => <><LinkNutricional href={rotaFechamento(f.id, loteId)}>{formatarDataBR(f.inicio)} – {formatarDataBR(f.fim)}</LinkNutricional><div className="mt-2"><SituacaoFechamento status={f.status} /></div></> },
      ...(!loteId ? [{ chave: "lote", titulo: "Lote / sítio", larguraMinima: 180, celula: (f: Fechamento) => <><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>{f.lote.nome}</LinkNutricional><p className="nutricao-secundario">{f.propriedade.nome}</p></> }] : []),
      { chave: "dieta", titulo: "Receita", larguraMinima: 200, larguraFlexivel: true, celula: (f) => <>{f.vigencia.dieta.nome}<p className="nutricao-secundario">v{f.vigencia.dieta.versao} · {f.animalDias} animal-dias</p></> },
      ...(lista.dados.itens.some((f) => f.verValores) ? [{ chave: "custo", titulo: "Custo conhecido", alinhamento: "direita" as const, celula: (f: Fechamento) => f.verValores ? <>{custoTexto(f.custoConhecido)}{!f.coberturaCustoCompleta && f.custoConhecido != null && <p className="nutricao-secundario">Parcial</p>}</> : "—" }] : []),
    ]} />}
      <PaginacaoNutricao pagina={pagina} total={lista.dados.total} limite={lista.dados.limite} onPagina={(p) => atualizar({ paginaFechamentos: String(p) })} nome="fechamentos" />
    </>}
  </Panel>;
}
