import { ColetaVisual } from "./VisuaisConsultaLeite";
import { ListaConsultaLeite } from "./ListaConsultaLeite";
import { Button } from "@/components/ui/button";
import { CabecalhoTabela, Pill, Paginacao } from "../../../financeiro/financeiro-ui";
import { SelectCampo } from "../../../financeiro/SelectCampo";
import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { formatarLitros } from "./modelo";
import { BarraComercialLeite, DialogComercialLeite, lerFiltrosComerciais, preservarFiltrosComerciais } from "./ComercialConsultaLeite";
import { OperacoesComerciaisLeite } from "./OperacoesComerciaisLeite";
interface Linha { id: string; comercialId: string; data?: string; inicio: string; fim: string; parceiroNome: string; quantidadeLitros?: string; referencia: string; situacao?: string; produtoNome?: string; fechamento?: { volumeReconhecido: string; precoUnitario: string | null; valorTotal: string | null } | null }
interface Lista { itens: Linha[]; total: number; porPagina: number }
const dataPt = (v: string) => v.split("-").reverse().join("/");
export function ConsultasComerciaisLeite({ tipo, podeLancar = false }: { tipo: "coletas" | "vendas"; podeLancar?: boolean }) {
  const [filtros, setFiltros] = useState(() => lerFiltrosComerciais(tipo));
  const [pagina, setPagina] = useState(1), [dados, setDados] = useState<Lista | null>(null), [erro, setErro] = useState(""), [revisao, setRevisao] = useState(0);
  const [parceiros, setParceiros] = useState<{ id: string; nome: string }[]>([]);
  const [registrar, setRegistrar] = useState(false), [operacao, setOperacao] = useState("");
  const [paginaOperacoes, setPaginaOperacoes] = useState(1), [totalOperacoes, setTotalOperacoes] = useState(0);
  const [operacoes, setOperacoes] = useState<{ id: string; referencia: string; parceiroNome: string; status: string; inicio: string; fim: string }[]>([]);
  const sitio = getPropriedadeAtiva();
  const { de, ate, comprador, busca, situacao } = filtros;
  useEffect(() => {
    let ativa = true;
    void consultarLeite<{ parceiros: { id: string; nome: string }[] }>("/comercial/operacoes/cadastros", sitio).then(r => { if (ativa) setParceiros(r.parceiros); }).catch(() => { if (ativa) setParceiros([]); });
    return () => { ativa = false; };
  }, [sitio]);
  useEffect(() => {
    const atualizar = () => { setFiltros(lerFiltrosComerciais(tipo)); setPagina(1); };
    window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar);
  }, [tipo]);
  useEffect(() => { setRegistrar(false); setOperacao(""); }, [sitio]);
  useEffect(() => {
    let ativa = true; setDados(null); setErro("");
    if (!de || !ate || de > ate) { setErro("Informe início e fim válidos."); return; }
    preservarFiltrosComerciais(tipo, filtros);
    const q = new URLSearchParams({ de, ate, pagina: String(pagina), ...(comprador ? { parceiroId: comprador } : {}), ...(busca ? { busca } : {}), ...(situacao ? { situacao: situacao === "Preço pendente" ? "PRECO_PENDENTE" : "FECHADA" } : {}) });
    void consultarLeite<Lista>(`/comercial/consultas/${tipo}?${q}`, sitio).then(r => { if (ativa) setDados(r); }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Falha na consulta"); });
    return () => { ativa = false; };
  }, [tipo, sitio, de, ate, comprador, busca, situacao, pagina, revisao]);
  useEffect(() => {
    if (!registrar) return;
    let ativa = true; setOperacoes([]);
    void consultarLeite<{ itens: typeof operacoes; total: number }>(`/comercial/vendas-unificadas?${new URLSearchParams({ de, ate, modalidade: "PERIODO", situacao: "ABERTA", pagina: String(paginaOperacoes) })}`, sitio)
      .then(r => { if (ativa) { setOperacoes(r.itens); setTotalOperacoes(r.total); } }).catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar operações abertas."); });
    return () => { ativa = false; };
  }, [registrar, sitio, de, ate, paginaOperacoes]);
  return <section className="leite-operacoes leite-comercial-consulta" aria-label={tipo === "coletas" ? "Consulta de coletas" : "Consulta de vendas"}>
    <CabecalhoTabela titulo={tipo === "coletas" ? "Coletas físicas" : "Vendas de leite"} ajuda={tipo === "coletas" ? "Retiradas pela data real, inclusive com preço pendente." : "Acordos por comprador e período comercial."} rotuloAjuda="Sobre as consultas comerciais" acao={tipo === "coletas" && podeLancar ? <Button onClick={() => { setOperacao(""); setPaginaOperacoes(1); setRegistrar(true); }}>Registrar retirada</Button> : undefined} />
    <BarraComercialLeite filtros={filtros} parceiros={parceiros} onChange={f => { setFiltros(f); setPagina(1); }} />
    {erro ? <p role="alert">{erro} <Button variant="outline" onClick={() => setRevisao(r => r + 1)}>Tentar novamente</Button></p> : !dados ? <p role="status">Consultando {tipo}…</p> : <>
      {!dados.itens.length && <p>Nenhum registro neste recorte.</p>}
      <ListaConsultaLeite layout={tipo === "coletas" ? "linhas" : undefined} renderizarVisual={tipo === "coletas" ? r => <ColetaVisual item={r} acao={<Button variant="outline" asChild><a href={`/pecuaria/leite?leiteSecao=vendas&operacaoLeiteId=${encodeURIComponent(r.comercialId)}&operacoesDe=${r.inicio}&operacoesAte=${r.fim}`}>Abrir operação e coletas</a></Button>}/> : undefined} preferencia={tipo === "coletas" ? "coletasVisualizacao" : "vendasConsultaVisualizacao"} rotulo={tipo === "coletas" ? "Coletas pela data real" : "Vendas pelo período comercial"} itens={dados.itens} chaveDe={r => r.id} colunas={[
        { chave: "periodo", titulo: tipo === "coletas" ? "Data física" : "Período", larguraMinima: 130, celula: r => tipo === "coletas" ? r.data ? dataPt(r.data) : "Data não informada" : `${dataPt(r.inicio)} a ${dataPt(r.fim)}` },
        { chave: "referencia", titulo: "Coleta", larguraMinima: 160, celula: r => r.referencia },
        { chave: "comprador", titulo: "Comprador", principal: true, larguraMinima: 160, celula: r => <strong>{r.parceiroNome}</strong> },
        { chave: "litros", titulo: "Retirado (L)", alinhamento: "direita", larguraMinima: 110, celula: r => formatarLitros(r.quantidadeLitros !== undefined ? Number(r.quantidadeLitros) : r.fechamento ? Number(r.fechamento.volumeReconhecido) : null) },
        { chave: "situacao", titulo: "Preço", larguraMinima: 150, celula: r => <Pill tone={r.situacao === "PRECO_PENDENTE" ? "amber" : "green"}>{r.situacao === "PRECO_PENDENTE" ? "Preço pendente" : "Preço definido"}</Pill> },
        { chave: "detalhe", titulo: "Ação", larguraMinima: 180, acoes: true, celula: r => <Button variant="outline" asChild><a href={`/pecuaria/leite?leiteSecao=vendas&operacaoLeiteId=${encodeURIComponent(r.comercialId)}&operacoesDe=${r.inicio}&operacoesAte=${r.fim}`}>Abrir operação e coletas</a></Button> },
      ]} />
      <Paginacao pagina={pagina} totalPaginas={Math.max(1, Math.ceil(dados.total / dados.porPagina))} total={dados.total} porPagina={dados.porPagina} rotulo="Paginação de coletas" substantivo="coletas" idSelect="pagina-coletas-leite" onPagina={setPagina} />
    </>}
    <DialogComercialLeite titulo="Registrar retirada" aberto={registrar} onFechar={() => { setRegistrar(false); setRevisao(r => r + 1); }}>
      <p>Escolha uma operação aberta do período para registrar a coleta sem preço.</p>
      <label>Operação aberta<SelectCampo value={operacao} onValueChange={setOperacao}><option value="">Selecione</option>{operacoes.map(o => <option key={o.id} value={o.id}>{o.parceiroNome} · {o.referencia}</option>)}</SelectCampo></label>
      <Paginacao pagina={paginaOperacoes} totalPaginas={Math.max(1, Math.ceil(totalOperacoes / 20))} total={totalOperacoes} porPagina={20} rotulo="Paginação de operações abertas" substantivo="operações abertas" idSelect="pagina-operacoes-coleta" onPagina={p => { setOperacao(""); setPaginaOperacoes(p); }} />
      {!operacoes.length && <p>Nenhuma operação aberta encontrada no recorte. Amplie o período ou abra uma operação em Vendas.</p>}
      <Button variant="outline" asChild><a href={`/pecuaria/leite?leiteSecao=vendas&novaOperacaoLeite=1&operacoesDe=${de}&operacoesAte=${ate}`}>Nova operação por período</a></Button>
      {operacao && <OperacoesComerciaisLeite key={operacao} integrado operacaoId={operacao} podeLancar={podeLancar} podeFinanceiro={false} />}
    </DialogComercialLeite>
  </section>;
}
