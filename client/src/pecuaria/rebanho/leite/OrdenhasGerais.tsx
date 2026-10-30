import { createPortal } from "react-dom";
import { Milk, Clock3, ClipboardList, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ComposicaoNaturezas } from "./VisuaisConsultaLeite";
import "../telas/rotinas-aprovadas.css";
import { CartaoOrdenhaVisual } from "./VisuaisConsultaLeite";
import { situacaoOrdenha } from "./visuais-leite";
import { AlternarVisualizacaoConsulta, useVisualizacaoConsulta } from "@/components/VisualizacaoConsulta";
import { TabelaOrdenhasPorDia } from "./TabelaOrdenhasPorDia";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/DatePicker";
import { BuscaLista } from "@/components/BuscaLista";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { CampoFiltro } from "@/financeiro/PainelFiltros";
import { useRascunhoConsulta } from "@/financeiro/useRascunhoConsulta";
import { SelectCampo } from "@/financeiro/SelectCampo";
import { CabecalhoTabela, Paginacao } from "@/financeiro/financeiro-ui";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { getUsuario } from "../../../lib/auth";
import { consultarParcelas } from "./parcelas-api";
import type { ConsultaParcelas, RegistroOrdenhaConsulta } from "./parcelas-types";
import { RegistroOrdenha, chaveRascunhoOrdenha, lerRascunhoOrdenha } from "./RegistroOrdenha";
import { dataValida, formatarLitros, hojeOperacional } from "./modelo";
import { formatarDataBR } from "../lib/rotulos";
import "./leite.css";

const situacoes: Record<string, string> = { SEM_AFERICAO: "Sem aferição", PENDENTE_ESTOQUE: "Salva", PARCIAL_ESTOQUE: "Parcial no estoque", CONFIRMADA: "Confirmada" };
export function OrdenhasGerais({ podeLancar, acoesContainer }: { podeLancar: boolean; acoesContainer?: HTMLElement | null }) {
  const sitio = getPropriedadeAtiva();
  const visualizacao = useVisualizacaoConsulta("ordenhasVisualizacao", "leite");
  const [params, setParams] = useState(() => new URLSearchParams(location.search));
  const [lista, setLista] = useState<ConsultaParcelas | null>(null);
  const [erro, setErro] = useState("");
  const [registroOcupado, setRegistroOcupado] = useState(false);
  const origemRegistro = useRef<string | null>(null);
  const consultaRef = useRef<HTMLDivElement>(null);
  const [devolverFoco, setDevolverFoco] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { const ler = () => setParams(new URLSearchParams(location.search)); window.addEventListener("popstate", ler); return () => window.removeEventListener("popstate", ler); }, []);
  function atualizar(patch: Record<string, string | null>, adicionar = false) {
    const url = new URL(location.href);
    for (const [k, v] of Object.entries(patch)) { if (v) url.searchParams.set(k, v); else url.searchParams.delete(k); }
    if (adicionar) history.pushState(null, "", url); else history.replaceState(null, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  const modoRegistro = params.get("leiteModo") === "registro";
  const hoje = hojeOperacional();
  const inicio = dataValida(params.get("ordenhasInicio")) ? params.get("ordenhasInicio")! : hoje;
  const fim = dataValida(params.get("ordenhasFim")) ? params.get("ordenhasFim")! : hoje;
  const periodoPersonalizado = inicio !== hoje || fim !== hoje;
  const busca = params.get("ordenhasBusca") ?? "";
  const situacao = params.get("ordenhasSituacao") ?? "";
  const natureza = params.get("ordenhasNatureza") ?? "";
  const tamanhoParam = params.get("ordenhasTamanho") ?? "6";
  const porPagina = ["6", "12", "20"].includes(tamanhoParam) ? Number(tamanhoParam) : 6;
  const paginaParam = Number(params.get("paginaOrdenhas") ?? 1);
  const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
  const filtros = useRascunhoConsulta({ inicio, fim, situacao, natureza }, { inicio: hoje, fim: hoje, situacao: "", natureza: "" }, v => atualizar({ ordenhasInicio: v.inicio, ordenhasFim: v.fim, ordenhasSituacao: v.situacao, ordenhasNatureza: v.natureza, paginaOrdenhas: null }));
  useEffect(() => {
    if (sitio == null || modoRegistro) return;
    let ativo = true;
    setCarregando(true); setErro("");
    void consultarParcelas(sitio, new URLSearchParams({ inicio, fim, pagina: String(pagina), porPagina: String(porPagina), ...(busca ? { busca } : {}), ...(situacao ? { situacao } : {}), ...(natureza ? { natureza } : {}) })).then(d => { if (ativo) { const ultimaPagina = Math.max(1, Math.ceil(d.total / d.porPagina)); if (pagina > ultimaPagina) atualizar({ paginaOrdenhas: String(ultimaPagina) }); else setLista(d); } }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar as ordenhas."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [sitio, inicio, fim, pagina, porPagina, busca, situacao, natureza, revisao, modoRegistro]);
  useEffect(() => {
    if (!devolverFoco || modoRegistro || carregando) return;
    const quadro = requestAnimationFrame(() => {
      const botao = [...(document.querySelectorAll<HTMLButtonElement>("button[data-ordenha-registro]"))].find(b => b.dataset.ordenhaRegistro === origemRegistro.current);
      (botao ?? consultaRef.current)?.focus({preventScroll:true});
      setDevolverFoco(false);
    });
    return () => cancelAnimationFrame(quadro);
  }, [devolverFoco, modoRegistro, carregando, lista]);
  const chaveUltimo = `terrano:leite:ultimo-rascunho:${getUsuario()?.id ?? "transicao"}:${sitio}`;
  let ultimo = "";
  try { ultimo = sessionStorage.getItem(chaveUltimo) ?? ""; } catch { /* armazenamento indisponível */ }
  const rascunhoRetomavel = sitio != null && ultimo ? lerRascunhoOrdenha(chaveRascunhoOrdenha(sitio, ultimo)) : null;
  function novo() {
    origemRegistro.current = "novo";
    const id = crypto.randomUUID();
    try { sessionStorage.setItem(chaveUltimo, id); } catch { /* formulário permanece disponível */ }
    atualizar({ leiteModo: "registro", registroId: null, rascunhoOrdenha: id, dataOperacional: inicio === fim ? inicio : hoje, ordenha: null }, true);
  }
  function abrir(r: RegistroOrdenhaConsulta) {
    origemRegistro.current = r.id;
    const individual = r.fonteProducao === "INDIVIDUAL";
    atualizar({ leiteModo: individual ? "individual" : "registro", registroId: individual ? null : r.id, rascunhoOrdenha: null, dataOperacional: r.dataOperacional, ordenha: r.posicaoId }, true);
  }
  if (sitio == null) return <div className="leite-page"><p>Selecione um sítio para consultar e registrar ordenhas.</p></div>;
  if (modoRegistro) return <Dialog open onOpenChange={v => { if (!v && !registroOcupado) atualizar({ leiteModo: "geral", registroId: null, rascunhoOrdenha: null, dataOperacional: null, ordenha: null }); }}><DialogContent className="financeiro-colorido ordenha-registro-modal" onCloseAutoFocus={e => { e.preventDefault(); setDevolverFoco(true); }} aria-describedby="registro-ordenha-descricao" onEscapeKeyDown={e => { if (registroOcupado) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()}><DialogHeader className="sr-only"><DialogTitle>Registro de ordenha</DialogTitle><DialogDescription id="registro-ordenha-descricao">Consulta e registro das parcelas da ordenha. O rascunho local é preservado ao fechar.</DialogDescription></DialogHeader><RegistroOrdenha aoOcupadoChange={setRegistroOcupado} key={`${sitio}:${params.get("registroId") || params.get("rascunhoOrdenha") || "novo"}`} sitio={sitio} podeLancar={podeLancar} registroId={params.get("registroId") ?? ""} rascunhoId={params.get("rascunhoOrdenha") ?? "novo"} aoVoltar={() => atualizar({ leiteModo: "geral", registroId: null, rascunhoOrdenha: null, dataOperacional: null, ordenha: null })} /></DialogContent></Dialog>;
  function litrosNatureza(r: RegistroOrdenhaConsulta, n: string) { const p = r.porNatureza.find(p => p.natureza === n); return p?.litros == null ? "—" : formatarLitros(p.litros); }
  const acoesRegistro = <>{rascunhoRetomavel && (!rascunhoRetomavel.parcelas.length || rascunhoRetomavel.parcelas.some(p => !p.entradaId)) && <Button data-ordenha-registro="rascunho" variant="outline" onClick={() => { origemRegistro.current = "rascunho"; atualizar({ leiteModo: "registro", rascunhoOrdenha: ultimo, registroId: null, dataOperacional: rascunhoRetomavel.data }, true); }}>Retomar rascunho</Button>}{podeLancar && <Button data-ordenha-registro="novo" onClick={novo}><Plus size={18}/>Registrar ordenha</Button>}</>;
  return <div ref={consultaRef} tabIndex={-1} className="leite-page leite-ordenhas-consulta">
    {acoesContainer ? createPortal(<><DatePicker aria-label="Dia das ordenhas" value={inicio === fim ? inicio : ""} onChange={dia => { if (dia) atualizar({ordenhasInicio:dia,ordenhasFim:dia,paginaOrdenhas:null}); }} />{acoesRegistro}</>, acoesContainer) : <CabecalhoTabela titulo="Ordenhas" acao={acoesRegistro} />}
    <BarraConsulta acao={<AlternarVisualizacaoConsulta modo={visualizacao.modo} mudar={visualizacao.mudar} rotulo="Visualização de ordenhas registradas" />} edicaoFiltros={filtros} erroFiltros={filtros.rascunho.inicio > filtros.rascunho.fim ? "A data inicial deve ser igual ou anterior à final." : null} adicionais={<>
      <CampoFiltro rotulo="Data inicial"><DatePicker aria-label="Data inicial das ordenhas" value={filtros.rascunho.inicio} onChange={v => filtros.editar("inicio", v)} /></CampoFiltro>
      <CampoFiltro rotulo="Data final"><DatePicker aria-label="Data final das ordenhas" value={filtros.rascunho.fim} onChange={v => filtros.editar("fim", v)} /></CampoFiltro>
      <CampoFiltro rotulo="Situação"><SelectCampo aria-label="Situação da ordenha" value={filtros.rascunho.situacao} onValueChange={v => filtros.editar("situacao", v)}><option value="">Todas</option>{Object.entries(situacoes).map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}</SelectCampo></CampoFiltro>
      <CampoFiltro rotulo="Natureza"><SelectCampo aria-label="Natureza do leite" disabled={filtros.rascunho.natureza === "A_CLASSIFICAR"} value={filtros.rascunho.natureza === "A_CLASSIFICAR" ? "" : filtros.rascunho.natureza} onValueChange={v => filtros.editar("natureza", v)}><option value="">Todas</option><option value="COMERCIAL">Comercial</option><option value="NAO_COMERCIAL">Não comercial</option><option value="COLOSTRO">Colostro</option></SelectCampo></CampoFiltro>
      <label className="flex items-center gap-2"><input type="checkbox" checked={filtros.rascunho.natureza === "A_CLASSIFICAR"} onChange={e => filtros.editar("natureza", e.target.checked ? "A_CLASSIFICAR" : "")} />Somente classificação pendente</label>
    </>} criterios={[...(periodoPersonalizado && inicio !== fim ? [{ id: "periodo", rotulo: `${formatarDataBR(inicio)} a ${formatarDataBR(fim)}`, limpar: () => atualizar({ ordenhasInicio: null, ordenhasFim: null, paginaOrdenhas: null }) }] : []), ...(situacao ? [{ id: "situacao", rotulo: situacoes[situacao] ?? situacao, limpar: () => atualizar({ ordenhasSituacao: null, paginaOrdenhas: null }) }] : []), ...(natureza ? [{ id: "natureza", rotulo: natureza === "A_CLASSIFICAR" ? "Classificação pendente" : natureza === "NAO_COMERCIAL" ? "Não comercial" : natureza === "COLOSTRO" ? "Colostro" : "Comercial", limpar: () => atualizar({ ordenhasNatureza: null, paginaOrdenhas: null }) }] : [])]}>
      {!acoesContainer && <DatePicker aria-label="Dia das ordenhas" value={inicio === fim ? inicio : ""} onChange={dia => { if (dia) atualizar({ordenhasInicio:dia,ordenhasFim:dia,paginaOrdenhas:null}); }} />}
      <BuscaLista rotulo="Buscar ordenhas" placeholder="Buscar ordenhas" valor={busca} onChange={valor => atualizar({ ordenhasBusca: valor, paginaOrdenhas: null })} />
    </BarraConsulta>
    {carregando ? <p role="status" className="p-5">Carregando ordenhas…</p> : erro ? <div role="alert" className="p-5">{erro}<Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></div> : lista && <>
      <section className="ordenhas-visao-periodo" aria-label="Resumo das ordenhas"><div className="ordenhas-volume"><span><Milk size={20}/>{inicio === fim ? "Volume aferido no dia" : "Volume aferido no período"}</span><strong>{formatarLitros(lista.resumo.totalLitros)}</strong><span>{lista.resumo.sessoes - lista.resumo.semAfericao} de {lista.resumo.sessoes} ordenhas com aferição</span></div><div className="ordenhas-distribuicao"><h3>Distribuição do volume aferido</h3><ComposicaoNaturezas itens={lista.resumo.porNatureza.filter(p => p.natureza !== "A_CLASSIFICAR" || p.litros != null)}/></div></section><div className="ordenhas-pendencias"><span><Clock3 size={18}/>{lista.resumo.semAfericao} sem aferição</span><span><ClipboardList size={18}/>{lista.resumo.pendentesEstoque} {lista.resumo.pendentesEstoque === 1 ? "pendente de estoque" : "pendentes de estoque"}</span></div>
      {!lista.itens.length ? <p className="p-5">Nenhuma ordenha encontrada neste período.</p> : visualizacao.modo === "tabela" ? <TabelaOrdenhasPorDia exibirDatas={inicio !== fim} itens={lista.itens} abrir={abrir} podeLancar={podeLancar}/> : <ListaConsultaLeite layout="grade" renderizarVisual={r => <CartaoOrdenhaVisual registro={r} abrir={() => abrir(r)} podeLancar={podeLancar}/>} visualizacao={visualizacao} preferencia="ordenhasVisualizacao" tituloDe={r => r.nome} detalheDe={r => `${formatarDataBR(r.dataOperacional)} · Fonte ${r.fonteProducao === "INDIVIDUAL" ? "individual" : "geral"}`} destaque="total" rotulo="Ordenhas registradas" itens={lista.itens} chaveDe={r => r.id} onAbrir={abrir} colunas={[
        { chave: "data", titulo: "Data", principal: true, larguraMinima: 120, celula: r => formatarDataBR(r.dataOperacional) },
        { chave: "ordenha", titulo: "Ordenha", ocultarNoCartao: true, larguraMinima: 130, celula: r => r.nome },
        { chave: "comercial", titulo: "Comercial", alinhamento: "direita", larguraMinima: 120, celula: r => litrosNatureza(r, "COMERCIAL") },
        { chave: "descarte", titulo: "Não comercial", alinhamento: "direita", larguraMinima: 120, celula: r => litrosNatureza(r, "NAO_COMERCIAL") },
        { chave: "colostro", titulo: "Colostro", alinhamento: "direita", larguraMinima: 120, celula: r => litrosNatureza(r, "COLOSTRO") },
        { chave: "total", titulo: "Total", alinhamento: "direita", larguraMinima: 120, celula: r => r.litros == null ? "Não aferido" : formatarLitros(r.litros) },
        { chave: "situacao", titulo: "Situação", larguraMinima: 160, celula: r => situacaoOrdenha(r) },
        { chave: "acoes", titulo: "Ação", acoes: true, larguraMinima: 150, celula: r => <Button variant="outline" onClick={() => abrir(r)}>{r.situacao === "CONFIRMADA" || !podeLancar ? "Consultar" : "Editar registro"}</Button> },
      ]} />}
      <div className="ordenhas-paginacao"><label>Por página<SelectCampo aria-label="Ordenhas por página" value={String(porPagina)} onValueChange={v => atualizar({ ordenhasTamanho: v, paginaOrdenhas: null })}>{[6,12,20].map(t=><option key={t} value={String(t)}>{t}</option>)}</SelectCampo></label><Paginacao pagina={lista.pagina} totalPaginas={Math.max(1, Math.ceil(lista.total / lista.porPagina))} total={lista.total} porPagina={lista.porPagina} rotulo="Paginação de ordenhas" substantivo="ordenhas" idSelect="pagina-ordenhas" onPagina={p => atualizar({ paginaOrdenhas: String(p) })} /></div>
    </>}
  </div>;
}
