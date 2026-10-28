import { CartaoVendaVisual } from "./VisuaisConsultaLeite";
import { AjudaCampo } from "@/components/Dica";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela, Paginacao, Pill } from "../../../financeiro/financeiro-ui";
import { obterConfiguracoesFinanceiras, type ConfiguracoesFinanceiras } from "../../../financeiro/novo-api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { OperacoesComerciaisLeite } from "./OperacoesComerciaisLeite";
import { ComercialLeite } from "./ComercialLeite";
import { HistoricoVendasLeite } from "./HistoricoVendasLeite";
import { NovaVendaAvulsaLeite } from "./NovaVendaAvulsaLeite";
import { consultarLeite } from "./operacoes-api";
import { formatarLitros } from "./modelo";
import { BarraComercialLeite, DialogComercialLeite, lerFiltrosComerciais, preservarFiltrosComerciais } from "./ComercialConsultaLeite";
interface VendaUnificada { id: string; modalidade: "PERIODO" | "AVULSA"; comercialId: string | null; operacaoId: string | null; referencia: string; inicio: string; fim: string; data: string; parceiroId: string | null; parceiroNome: string | null; quantidadeLitros: string; valorTotal: string | null; situacao: string; versaoComercial: number | null }
interface Consulta { propriedadeId: number; itens: VendaUnificada[]; total: number; pagina: number; porPagina: number; resumo: { totalLitros: string; valorTotal: string | null; vendas: number; precoPendente: number } }
const situacoes: Record<string,string> = { ABERTA: "Aberta", FECHADA: "Fechada", CONFIRMADA: "Confirmada", CANCELADA: "Cancelada" };
const dataPt = (v: string) => v.split("-").reverse().join("/");
export function VendasLeite({ podeLancar, podeFinanceiro }: { podeLancar: boolean; podeFinanceiro: boolean }) {
  const sitio = getPropriedadeAtiva();
  const [filtros, setFiltros] = useState(() => lerFiltrosComerciais("vendas")), [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0);
  const [dados, setDados] = useState<Consulta | null>(null), [erro, setErro] = useState("");
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null), [cadastros, setCadastros] = useState<{ parceiros: { id: string; nome: string }[]; produtos: { id: string; nome: string }[] }>({ parceiros: [], produtos: [] });
  const [selecionada, setSelecionada] = useState<string | null>(() => new URLSearchParams(location.search).get("operacaoLeiteId"));
  const [nova, setNova] = useState(() => new URLSearchParams(location.search).get("novaOperacaoLeite") === "1"), [avulsa, setAvulsa] = useState(false), [historico, setHistorico] = useState<VendaUnificada | null>(null), [documentos, setDocumentos] = useState(() => { const q = new URLSearchParams(location.search); return q.get("leiteSecao") === "comercial" || q.get("vendasVisao") === "documentos"; }), [aviso, setAviso] = useState("");
  const { de, ate, comprador, busca, situacao, modalidade } = filtros;
  const ultimoSitio = useRef(sitio);
  useEffect(() => {
    const sync = () => { const q = new URLSearchParams(location.search); setFiltros(lerFiltrosComerciais("vendas")); setSelecionada(q.get("operacaoLeiteId")); setNova(q.get("novaOperacaoLeite") === "1"); setDocumentos(q.get("leiteSecao") === "comercial" || q.get("vendasVisao") === "documentos"); setPagina(1); };
    window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => { setAvulsa(false); setHistorico(null); setConfig(null); if (ultimoSitio.current !== sitio) { ultimoSitio.current = sitio; fecharDetalhe(); setDocumentos(false); } }, [sitio]);
  useEffect(() => {
    let ativa = true;
    void consultarLeite<typeof cadastros>("/comercial/operacoes/cadastros", sitio).then(r => { if (ativa) setCadastros(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Cadastros indisponíveis."); });
    if (podeFinanceiro) void obterConfiguracoesFinanceiras().then(r => { if (ativa) setConfig(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Cadastros financeiros indisponíveis."); });
    return () => { ativa = false; };
  }, [sitio, podeFinanceiro]);
  useEffect(() => {
    let ativa = true; setDados(null); setErro("");
    if (!de || !ate || de > ate) { setErro("Informe um período válido."); return; }
    preservarFiltrosComerciais("vendas", filtros);
    const status = Object.entries(situacoes).find(([, nome]) => nome === situacao)?.[0];
    const q = new URLSearchParams({ de, ate, pagina: String(pagina), ...(comprador ? { parceiroId: comprador } : {}), ...(busca ? { busca } : {}), ...(status ? { situacao: status } : {}), ...(modalidade ? { modalidade: modalidade === "periodo" ? "PERIODO" : "AVULSA" } : {}) });
    void consultarLeite<Consulta>(`/comercial/vendas-unificadas?${q}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar as vendas."); });
    return () => { ativa = false; };
  }, [de, ate, comprador, busca, situacao, modalidade, pagina, sitio, revisao]);
  function fecharDetalhe() { setSelecionada(null); setNova(false); const url = new URL(location.href); url.searchParams.delete("operacaoLeiteId"); url.searchParams.delete("novaOperacaoLeite"); history.replaceState(null, "", url); }
  function abrir(v: VendaUnificada) { if (v.comercialId) { setSelecionada(v.comercialId); const url = new URL(location.href); url.searchParams.set("operacaoLeiteId", v.comercialId); history.replaceState(null,"",url); } else setHistorico(v); }
  return <section className="leite-operacoes leite-comercial-consulta" aria-label="Vendas do leite">
    <CabecalhoTabela titulo="Vendas de leite" ajuda="Operações por período e vendas avulsas." rotuloAjuda="Sobre vendas de leite" acao={<><Button variant="outline" onClick={() => setDocumentos(true)}>Entregas e demonstrativos</Button>{podeLancar && <Button variant="outline" onClick={() => setNova(true)}>Nova operação por período</Button>}{podeLancar && podeFinanceiro && <Button onClick={() => setAvulsa(true)}>Venda avulsa</Button>}</>} />
    <BarraComercialLeite vendas filtros={filtros} parceiros={cadastros.parceiros} onChange={f => { setFiltros(f); setPagina(1); }} />
    {aviso && <p role="status">{aviso}</p>}
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando vendas…</p> : <>
      {!dados.itens.length && <p>Nenhuma venda encontrada neste recorte.</p>}
      <dl className="leite-consulta-resumo"><div><dt>Operações no recorte</dt><dd>{dados.resumo.vendas}</dd></div><div><dt>Volume do recorte<AjudaCampo rotulo="Sobre o volume comercial do recorte" texto="Soma retornada pelo servidor: volume físico de operações abertas/avulsas e volume reconhecido dos fechamentos, considerando o período integral dos acordos. Não é produção dos dias filtrados."/></dt><dd>{formatarLitros(Number(dados.resumo.totalLitros))}</dd></div><div><dt>Preço pendente</dt><dd>{dados.resumo.precoPendente}</dd></div><div><dt>Total comercial conhecido<AjudaCampo rotulo="Sobre valores conhecidos" texto="Valores conhecidos no recorte; operações com preço pendente não recebem valor zero presumido. Não equivale a dinheiro recebido."/></dt><dd>{!podeFinanceiro ? "Restrito" : dados.resumo.valorTotal === null ? "A apurar" : Number(dados.resumo.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div></dl>
      <ListaConsultaLeite layout="grade" renderizarVisual={v => <CartaoVendaVisual item={v} podeVerValores={podeFinanceiro} acao={<Button variant="outline" onClick={() => abrir(v)}>Abrir operação</Button>}/>} preferencia="vendasLeiteVisualizacao" rotulo="Vendas por período e avulsas" itens={dados.itens} chaveDe={v => `${v.modalidade}:${v.id}`} colunas={[
        { chave: "referencia", titulo: "Operação", principal: true, larguraMinima: 160, celula: v => <strong>{v.referencia}</strong> },
        { chave: "comprador", titulo: "Comprador", larguraMinima: 150, celula: v => v.parceiroNome ?? "Não informado" },
        { chave: "periodo", titulo: "Período", larguraMinima: 185, celula: v => v.modalidade === "AVULSA" ? dataPt(v.data) : `${dataPt(v.inicio)} a ${dataPt(v.fim)}` },
        { chave: "modalidade", titulo: "Modalidade", larguraMinima: 115, celula: v => v.modalidade === "PERIODO" ? "Por período" : "Avulsa" },
        { chave: "litros", titulo: "Volume", alinhamento: "direita", celula: v => formatarLitros(Number(v.quantidadeLitros)) },
        { chave: "valor", titulo: "Total comercial", alinhamento: "direita", celula: v => !podeFinanceiro ? "Restrito" : v.valorTotal === null ? "Preço pendente" : Number(v.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
        { chave: "situacao", titulo: "Situação", larguraMinima: 130, celula: v => <Pill tone={v.situacao === "ABERTA" ? "amber" : v.situacao === "CANCELADA" ? "red" : "green"}>{situacoes[v.situacao] ?? v.situacao}</Pill> },
        { chave: "acao", titulo: "Ação", acoes: true, larguraMinima: 150, celula: v => <Button variant="outline" onClick={() => abrir(v)}>Abrir operação</Button> },
      ]} />
      <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} total={dados.total} porPagina={dados.porPagina} rotulo="Paginação de vendas" substantivo="vendas" idSelect="pagina-vendas-leite" onPagina={setPagina} />
    </>}
    <DialogComercialLeite titulo={nova ? "Nova operação por período" : "Detalhe da operação"} aberto={!!selecionada || nova} onFechar={fecharDetalhe}>
      <OperacoesComerciaisLeite key={nova ? "nova" : selecionada!} integrado operacaoId={selecionada} iniciarNova={nova} podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} onMudou={id => { setRevisao(r => r + 1); setSelecionada(id); setNova(false); const url = new URL(location.href); url.searchParams.delete("novaOperacaoLeite"); if (id) url.searchParams.set("operacaoLeiteId", id); history.replaceState(null,"",url); }} />
    </DialogComercialLeite>
    <DialogComercialLeite titulo="Venda avulsa" aberto={avulsa && podeFinanceiro && podeLancar} onFechar={() => setAvulsa(false)}>
      {config ? <NovaVendaAvulsaLeite sitio={dados?.propriedadeId ?? sitio} config={config} produtos={cadastros.produtos} onCancelar={() => setAvulsa(false)} onSalvar={() => { setAvulsa(false); setRevisao(r => r + 1); setAviso("Retirada e venda registradas. Acompanhe o recebimento no Financeiro."); }} /> : <p role="status">Carregando cadastros financeiros…</p>}
    </DialogComercialLeite>
    <DialogComercialLeite titulo={historico?.referencia ?? "Venda avulsa"} aberto={!!historico} onFechar={() => setHistorico(null)}>
      {historico && <><dl className="leite-comercial-fatos"><div><dt>Comprador</dt><dd>{historico.parceiroNome ?? "Não informado"}</dd></div><div><dt>Data</dt><dd>{dataPt(historico.data)}</dd></div><div><dt>Retirado</dt><dd>{formatarLitros(Number(historico.quantidadeLitros))}</dd></div><div><dt>Situação</dt><dd>{situacoes[historico.situacao] ?? historico.situacao}</dd></div></dl>
        {podeFinanceiro ? <HistoricoVendasLeite produtoId="" data={historico.data} de={historico.data} propriedadeId={dados?.propriedadeId ?? sitio} config={config} podeLancar={podeLancar} revisao={revisao} onMudou={() => { setHistorico(null); setRevisao(r => r + 1); setAviso("Correção comercial confirmada. Os litros e a saída física única foram preservados."); }} operacaoInicial={historico.operacaoId ?? undefined} /> : <p>Valores e correções comerciais exigem acesso ao Financeiro.</p>}</>}
    </DialogComercialLeite>
    <DialogComercialLeite titulo="Entregas e demonstrativos" aberto={documentos} onFechar={() => { setDocumentos(false); const url = new URL(location.href); url.searchParams.delete("vendasVisao"); url.searchParams.set("leiteSecao", "vendas"); history.replaceState(null,"",url); }}><ComercialLeite podeLancar={podeLancar} podeFinanceiro={podeFinanceiro} /></DialogComercialLeite>
  </section>;
}
