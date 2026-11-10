import { periodoFechamento } from "./DetalhesFechamento";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { PeriodoFinanceiroControl } from "@/financeiro/PeriodoFinanceiroControl";
import { DatePicker } from "@/components/DatePicker";
import { CalendarioFechamentos, intervaloMesFechamento } from "./CalendarioFechamentos";
import { getHojeISO as hojeISO } from "@/lib/hoje";
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
import { Empty } from "@/financeiro/financeiro-ui";

export function FechamentosNutricao({ loteId }: { loteId?: string }) {
  const visual = useVisualizacaoConsulta("visualFechamentos", "consultas", "tabela");
  const { params, atualizar } = useFiltrosNutricionais();
  const de = params.get("fechamentosDe") ?? "";
  const ate = params.get("fechamentosAte") ?? "";
  const filtroLote = params.get("filtroLoteId") ?? "";
  const situacao = params.get("statusFechamento");
  const status = situacao === "CONFIRMADO" || situacao === "ESTORNADO" ? situacao : "";
  const numeroPagina = Number(params.get("paginaFechamentos") ?? 1);
  const pagina = Number.isInteger(numeroPagina) && numeroPagina >= 1 && numeroPagina <= 100000 ? numeroPagina : 1;
  const lote = loteId || filtroLote || undefined;
  const lista = useConsulta(useCallback(() => de || ate
    ? listarFechamentos(lote, pagina, status || undefined, { de: de || undefined, ate: ate || undefined })
    : listarFechamentos(lote, pagina, status || undefined),
  [lote, pagina, status, de, ate]));
  const mesCalendario = params.get("mesCalendarioFechamentos") || de.slice(0, 7);
  const lotes = useConsulta(useCallback(() => loteId ? buscarLote(loteId).then(l => [l]) : listarLotes(), [loteId]));
  const edicao = useRascunhoConsulta({lote:filtroLote,status,de,ate},{lote:"",status:"",de:"",ate:""},v=>atualizar({filtroLoteId:v.lote,statusFechamento:v.status,fechamentosDe:v.de,fechamentosAte:v.ate,paginaFechamentos:""}));
  const campos: CampoConsulta[] = [
    ...(!loteId ? [{chave:"lote",ativo:!!filtroLote,limpar:()=>edicao.editar("lote",""),conteudo:<CampoFiltro rotulo="Lote"><SelectCampo aria-label="Filtrar por lote" value={edicao.rascunho.lote} onValueChange={v=>edicao.editar("lote",v)}><option value="">Todos os lotes</option>{lotes.dados?.map(l=><option key={l.id} value={l.id}>{l.nome} · {l.propriedade.nome}</option>)}</SelectCampo>{lotes.erro && <span role="alert">{lotes.erro}</span>}</CampoFiltro>}] : []),
    {chave:"datas",naBarra:true,ativo:!!de||!!ate,limpar:()=>{edicao.editar("de","");edicao.editar("ate","");},conteudo:<><CampoFiltro rotulo="Data inicial"><DatePicker aria-label="Data inicial do período" value={edicao.rascunho.de} onChange={v=>edicao.editar("de",v)}/></CampoFiltro><CampoFiltro rotulo="Data final"><DatePicker aria-label="Data final do período" value={edicao.rascunho.ate} onChange={v=>edicao.editar("ate",v)}/></CampoFiltro></>},
    {chave:"situacao",ativo:!!status,limpar:()=>edicao.editar("status",""),conteudo:<CampoFiltro rotulo="Situação"><SelectCampo aria-label="Situação do fechamento" value={edicao.rascunho.status} onValueChange={v=>edicao.editar("status",v)}><option value="">Todas as situações</option><option value="CONFIRMADO">Confirmados</option><option value="ESTORNADO">Estornados</option></SelectCampo></CampoFiltro>},
  ];
  return <>
  <Panel className="nutricao-conteudo nutricao-fechamentos">
    <BarraConsulta campos={campos} edicaoFiltros={edicao} erroFiltros={edicao.rascunho.de && edicao.rascunho.ate && edicao.rascunho.de>edicao.rascunho.ate ? "A data inicial deve ser igual ou anterior à final." : null} criterios={[...(de||ate?[{id:"datas",rotulo:`Período: ${de?formatarDataBR(de):"início"} a ${ate?formatarDataBR(ate):"hoje"}`,limpar:()=>atualizar({fechamentosDe:"",fechamentosAte:"",paginaFechamentos:""})}]:[]),...(filtroLote?[{id:"lote",rotulo:`Lote: ${lotes.dados?.find(l=>l.id===filtroLote)?.nome ?? "Selecionado"}`,limpar:()=>atualizar({filtroLoteId:"",paginaFechamentos:""})}]:[]),...(status?[{id:"status",rotulo:status==="CONFIRMADO"?"Confirmados":"Estornados",limpar:()=>atualizar({statusFechamento:"",paginaFechamentos:""})}]:[])]} resumo={<>{loteId && <span><LinkNutricional href={rotaNutricao({aba:"fechamentos",statusFechamento:status || undefined})}>Ver fechamentos de todos os lotes</LinkNutricional></span>}</>}><PeriodoFinanceiroControl allowAll inicio={de} fim={ate} label="Período dos fechamentos" onChange={v=>atualizar({fechamentosDe:v.inicio,fechamentosAte:v.fim,paginaFechamentos:""})}/></BarraConsulta>
    <div className="consulta-visual-barra"><span>{lista.dados ? `${lista.dados.total} ${lista.dados.total === 1 ? "fechamento" : "fechamentos"}` : ""}</span><AlternarVisualizacaoConsulta rotulo="Visualização dos fechamentos" {...visual}/></div>
    <div className="px-5"><EstadoConsulta erro={lista.erro} carregando={lista.carregando} recarregar={lista.carregar} estrutura="lista" label="Carregando fechamentos nutricionais…" /></div>
    {lista.dados && !lista.carregando && !lista.erro && <>{!lista.dados.itens.length ? <Empty>Nenhum fechamento encontrado neste contexto.</Empty> : <TabelaFinanceira visualizacao={visual.modo === "visual" ? "cartoes" : "tabela"} compacta filtrosColunas={filtrosDasColunas(campos,edicao)} cartaoComLinks onAbrir={f => navegarPara(rotaFechamento(f.id, loteId))} rotulo="Fechamentos de nutrição" itens={lista.dados.itens} chaveDe={(f) => f.id} colunas={[
      { chave: "periodo", titulo: "Período / situação", principal: true, larguraMinima: 210, celula: (f) => <div className="nutricao-fechamento-periodo"><LinkNutricional href={rotaFechamento(f.id, loteId)}>{periodoFechamento(f)}</LinkNutricional><SituacaoFechamento status={f.status} /></div> },
      ...(!loteId ? [{ chave: "lote", titulo: "Lote / sítio", larguraMinima: 180, celula: (f: Fechamento) => <><LinkNutricional href={rotaNutricao({ loteId: f.lote.id })}>{f.lote.nome}</LinkNutricional><p className="nutricao-secundario">{f.propriedade.nome}</p></> }] : []),
      { chave: "dieta", titulo: "Receita", larguraMinima: 200, larguraFlexivel: true, celula: (f) => <>{f.vigencia.dieta.nome}<p className="nutricao-secundario">v{f.vigencia.dieta.versao} · {f.animalDias.toLocaleString("pt-BR")} animal-dias</p></> },
      ...(lista.dados.itens.some((f) => f.verValores) ? [{ chave: "custo", titulo: "Custo conhecido", alinhamento: "direita" as const, celula: (f: Fechamento) => f.verValores ? <>{custoTexto(f.custoConhecido)}{!f.coberturaCustoCompleta && f.custoConhecido != null && <p className="nutricao-secundario">Parcial</p>}</> : "—" }] : []),
    ]} />}
      <PaginacaoNutricao pagina={pagina} total={lista.dados.total} limite={lista.dados.limite} onPagina={(p) => atualizar({ paginaFechamentos: String(p) })} nome="fechamentos" />
    </>}
  </Panel>
  <ConsultaCalendarioFechamentos
    lote={lote}
    loteId={loteId}
    status={status || undefined}
    mes={/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(mesCalendario) ? mesCalendario : null}
    onMes={mes => atualizar({ mesCalendarioFechamentos: mes })}
  />
  </>;
}

function ConsultaCalendarioFechamentos({ lote, loteId, status, mes, onMes }: {
  lote?: string;
  loteId?: string;
  status?: Fechamento["status"];
  mes: string | null;
  onMes: (mes: string) => void;
}) {
  const consulta = useConsulta(useCallback(() => todosDoMes(lote, status, mes), [lote, status, mes]));
  const mesVisivel = mes ?? consulta.dados?.mes ?? hojeISO().slice(0, 7);

  return <section className="nutricao-calendario-fechamentos" aria-label="Calendário de fechamentos">
    <h2 className="h3">Calendário de fechamentos</h2>
    <EstadoConsulta erro={consulta.erro} carregando={consulta.carregando} recarregar={consulta.carregar} estrutura="lista" label="Carregando calendário de fechamentos…" />
    {!consulta.erro && (consulta.dados || mes) && (
      <CalendarioFechamentos
        itens={consulta.dados?.itens ?? []}
        total={consulta.dados?.total ?? 0}
        de={`${mesVisivel}-01`}
        carregando={consulta.carregando}
        onMes={periodo => onMes(periodo.de.slice(0, 7))}
        onAbrir={f => navegarPara(rotaFechamento(f.id, loteId))}
      />
    )}
  </section>;
}

/** Todos os fechamentos do mês, percorrendo as páginas; sem mês, usa o do fechamento mais recente. */
async function todosDoMes(loteId: string | undefined, status: Fechamento["status"] | undefined, mesEscolhido: string | null) {
  const mes = mesEscolhido ?? (await listarFechamentos(loteId, 1, status)).itens[0]?.fim.slice(0, 7) ?? hojeISO().slice(0, 7);
  const periodo = intervaloMesFechamento(mes);
  const primeira = await listarFechamentos(loteId, 1, status, periodo);
  const paginas = Math.min(Math.ceil(primeira.total / Math.max(1, primeira.limite)), 20);
  const demais = await Promise.all(Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => listarFechamentos(loteId, i + 2, status, periodo)));
  return { ...primeira, mes, itens: [...primeira.itens, ...demais.flatMap(p => p.itens)] };
}
