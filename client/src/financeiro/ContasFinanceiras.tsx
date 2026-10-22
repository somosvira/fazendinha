import { useOrdenacaoTabela } from "./OrdenarConsulta";
import "./contas-consulta.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useFiltrosTabelaLocal } from "./useFiltrosTabelaLocal";
import { filtrosDasColunas, type CampoConsulta } from "./FiltroColunaConsulta";
import { CampoFiltro } from "./PainelFiltros";
import { BuscaLista } from "@/components/BuscaLista";
import { useRascunhoConsulta } from "./useRascunhoConsulta";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { Button as ShadcnButton } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoDoAnoAtual, periodoInicial } from "./lib/periodo";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Info, Settings2, Wallet, Landmark, List, ChartNoAxesCombined } from "lucide-react";
import { ExtratoGeral, FILTROS_EXTRATO_GERAL_INICIAIS, type FiltrosExtratoGeral } from "./ExtratoGeral";
import { navegarPara, parseContaFinanceiraId } from "../router";
import type { Tab } from "../components/Shell";
import { obterConfiguracoesFinanceiras, obterExtratoConta, obterExtratoGeral, transferir, type ConfiguracoesFinanceiras, type Conta, type MovimentoConta, type MovimentoGeral } from "./novo-api";
import { brl, Button, CabecalhoTabela, type ColunaTabela, dataBR, Empty, ErrorBox, hoje, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { FluxoContasFinanceiras } from "./FluxoContasFinanceiras";
import { infoReversao } from "./lib/reversao";
import { TIPO_CONTA } from "./FormConta";

type AbaContas = "contas" | "extrato" | "analise";
function abaDaUrl(): AbaContas {
  const parametros = new URLSearchParams(window.location.search);
  const aba = parametros.get("aba");
  if (aba === "extrato" || aba === "analise" || aba === "contas") return aba;
  return parametros.has("natureza") ? "extrato" : "contas";
}
const somarSaldos = (contas: Conta[]) => contas.reduce((centavos, conta) => centavos + Math.round(Number(conta.saldoAtual) * 100), 0) / 100;

const TIPO_BANCARIO: Record<string, string> = { CORRENTE: "Conta corrente", POUPANCA: "Poupança", PAGAMENTO: "Conta de pagamento" };

/* Dinheiro alinhado à direita permanece inteiro ao comparar os movimentos. */
const COLUNAS_EXTRATO: ColunaTabela<MovimentoConta>[] = [
  { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: (m) => <span className="whitespace-nowrap text-ink-3">{dataBR(m.transacao.data)}</span> },
  { chave: "descricao", titulo: "Descrição", larguraMinima: 260, principal: true, celula: (m) => { const reversao = infoReversao(m.transacao); return <><strong className="break-words">{m.transacao.descricao || m.transacao.tipo}</strong>{m.transacao.status === "REVERTIDA" && <Pill tone="amber">Revertida</Pill>}<div className="mt-1 break-words text-xs text-ink-3">{m.transacao.formaPagamento?.replaceAll("_", " ") ?? "Movimento financeiro"}{m.transacao.parceiro ? ` · ${m.transacao.parceiro.nome}` : ""}</div>{reversao && <div className="mt-1 break-words text-xs font-medium text-[var(--fin-pendente)]">{reversao.detalhe}{reversao.operacaoId != null && reversao.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={reversao.operacaoId} numero={reversao.operacaoNumero} /></>}</div>}</>; } },
  { chave: "origem", titulo: "Origem", larguraMinima: 150, celula: (m) => m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} numero={m.transacao.operacao.numero} /> : <span className="whitespace-nowrap">Transação avulsa</span> },
  { chave: "entrada", titulo: "Entrada", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold text-[var(--fin-entrada)]">{m.direcao === "ENTRADA" ? brl(m.valor) : "—"}</span> },
  { chave: "saida", titulo: "Saída", alinhamento: "direita", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold text-[var(--fin-saida)]">{m.direcao === "SAIDA" ? brl(m.valor) : "—"}</span> },
];

export function ContasFinanceiras({ onNav }: { onNav: (tab: Tab) => void }) {
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null); const [contaId, setContaId] = useState(() => parseContaFinanceiraId(window.location.pathname)); const selecionada = config?.contas.find(c => c.id === contaId) ?? null; const [carregandoExtrato, setCarregandoExtrato] = useState(false); const [erroExtrato, setErroExtrato] = useState<string | null>(null); const [extrato, setExtrato] = useState<MovimentoConta[]>([]); const [erro, setErro] = useState<string | null>(null); const [transferindo, setTransferindo] = useState(false); const [origemId, setOrigemId] = useState(""); const [destinoId, setDestinoId] = useState(""); const [valor, setValor] = useState("");
  const [dataTransferencia, setDataTransferencia] = useState(hoje);
  const transferenciaEmCurso = useRef(false);
  const [registrandoTransferencia, setRegistrandoTransferencia] = useState(false);
  const fecharTransferencia = () => { if (!transferenciaEmCurso.current) setTransferindo(false); };
  const [aba, setAba] = useState<AbaContas>(abaDaUrl);
  const [paginaContas, setPaginaContas] = useState(1);
  const [paginaExtrato, setPaginaExtrato] = useState(1);
  const [movimentoAlvo, setMovimentoAlvo] = useState(() => window.location.hash.slice(1));
  const [buscaConta, setBuscaConta] = useState(""); const [tipoConta, setTipoConta] = useState(""); const [instituicaoConta, setInstituicaoConta] = useState(""); const [statusConta, setStatusConta] = useState("");
  const [movimentosGerais, setMovimentosGerais] = useState<MovimentoGeral[]>([]);
  const [filtrosExtratoGeral, setFiltrosExtratoGeral] = useState<FiltrosExtratoGeral>(() => ({ ...FILTROS_EXTRATO_GERAL_INICIAIS, natureza: ["recebimentos", "pagamentos"].includes(new URLSearchParams(window.location.search).get("natureza") ?? "") ? new URLSearchParams(window.location.search).get("natureza")! : undefined, ...periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }) }));
  const [periodoConta, setPeriodoConta] = useState(() => periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }));
  const [buscaExtrato,setBuscaExtrato] = useState("");
  const consultaExtrato = useFiltrosTabelaLocal<MovimentoConta>([
    {chave:"descricao", naBarra: true,rotulo:"Descrição / parceiro",tipo:"texto",obter:m=>`${m.transacao.descricao??""} ${m.transacao.parceiro?.nome??""}`},
    {chave:"valor",colunas:["entrada","saida"],rotulo:"Valor do movimento",tipo:"valor",obter:m=>m.valor,limiteSugerido:Math.max(1,...extrato.map(m=>Number(m.valor)))},
    {chave:"direcao",colunas:[],rotulo:"Direção",tipo:"opcoes",obter:m=>m.direcao,opcoes:[{valor:"ENTRADA",texto:"Entrada"},{valor:"SAIDA",texto:"Saída"}]},
  ],()=>setPaginaExtrato(1));
  const ordemExtrato = useOrdenacaoTabela<MovimentoConta>([{ chave: "data", rotulo: "Data", tipo: "data", obter: m => m.transacao.data }, { chave: "entrada", rotulo: "Entrada", tipo: "numero", obter: m => m.direcao === "ENTRADA" ? m.valor : null }, { chave: "saida", rotulo: "Saída", tipo: "numero", obter: m => m.direcao === "SAIDA" ? m.valor : null }], "ordemExtratoConta", () => setPaginaExtrato(1));
  const ordemContas = useOrdenacaoTabela<Conta>([{ chave: "nome", rotulo: "Conta", tipo: "texto", obter: c => c.nome }, { chave: "saldo", rotulo: "Saldo atual", tipo: "numero", obter: c => c.saldoAtual }, { chave: "ultima", rotulo: "Última movimentação", tipo: "data", obter: c => c.ultimaOperacao?.data }], "ordemContas", () => setPaginaContas(1));
  const extratoBase = consultaExtrato.filtrar(extrato).filter(m=>`${m.transacao.descricao??""} ${m.transacao.parceiro?.nome??""}`.toLocaleLowerCase("pt-BR").includes(buscaExtrato.toLocaleLowerCase("pt-BR"))).filter(m => (!periodoConta.inicio || m.transacao.data.slice(0, 10) >= periodoConta.inicio) && (!periodoConta.fim || m.transacao.data.slice(0, 10) <= periodoConta.fim));
  const extratoFiltrado = ordemExtrato.ordenar(extratoBase);
  const totalPaginasExtrato = Math.max(1, Math.ceil(extratoFiltrado.length / 15));
  const paginaAtualExtrato = Math.min(paginaExtrato, totalPaginasExtrato);
  useEffect(() => setPaginaContas(1), [buscaConta, tipoConta, instituicaoConta, statusConta]);
  useEffect(() => setPaginaExtrato(1), [contaId, periodoConta.inicio, periodoConta.fim]);
  useEffect(() => {
    if (carregandoExtrato) return;
    const indice = extratoFiltrado.findIndex(m => `movimento-${m.id}` === movimentoAlvo);
    if (indice >= 0) setPaginaExtrato(Math.floor(indice / 15) + 1);
  }, [extrato, carregandoExtrato, movimentoAlvo, periodoConta.inicio, periodoConta.fim]);
  const carregar = useCallback(() => { setErro(null); return obterConfiguracoesFinanceiras().then((cfg) => { setConfig(cfg); }).catch((e) => setErro(e.message)); }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const atualizar = () => { setAba(abaDaUrl()); setContaId(parseContaFinanceiraId(window.location.pathname)); setMovimentoAlvo(window.location.hash.slice(1)); const periodo = periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }); if (parseContaFinanceiraId(window.location.pathname)) setPeriodoConta(periodo); else setFiltrosExtratoGeral(atual => ({ ...atual, ...periodo, natureza: ["recebimentos", "pagamentos"].includes(new URLSearchParams(window.location.search).get("natureza") ?? "") ? new URLSearchParams(window.location.search).get("natureza")! : undefined })); }; window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const urlConta = (id: string | null, movimentoId?: string) => {
    const periodo = contaId == null ? filtrosExtratoGeral : periodoConta;
    const parametros = new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim });
    if (aba !== "contas") parametros.set("aba", aba);
    if (filtrosExtratoGeral.natureza) parametros.set("natureza", filtrosExtratoGeral.natureza);
    return `/financeiro/contas${id == null ? "" : `/${id}`}?${parametros}${movimentoId ? `#movimento-${movimentoId}` : ""}`;
  };
  const mudarAba = (valor: string) => {
    if (valor !== "contas" && valor !== "extrato" && valor !== "analise") return;
    const parametros = new URLSearchParams(window.location.search);
    parametros.set("aba", valor);
    if (filtrosExtratoGeral.natureza) parametros.set("natureza", filtrosExtratoGeral.natureza);
    else parametros.delete("natureza");
    // Conservar também o período editado, mesmo antes de abrir uma conta.
    parametros.set("inicio", filtrosExtratoGeral.inicio);
    parametros.set("fim", filtrosExtratoGeral.fim);
    navegarPara(`/financeiro/contas?${parametros}`);
  };
  const navegar = (id: string | null, movimentoId?: string) => navegarPara(urlConta(id, movimentoId));

  useEffect(() => {
    let vigente = true;
    setExtrato([]); setMovimentosGerais([]); setErroExtrato(null);
    setCarregandoExtrato(!!config && (contaId == null || !!selecionada));
    if (!config || (contaId != null && !selecionada)) return;
    const consulta = contaId == null
      ? obterExtratoGeral().then(movimentos => { if (vigente) setMovimentosGerais(movimentos); })
      : obterExtratoConta(contaId).then(movimentos => { if (vigente) setExtrato(movimentos); });
    consulta.catch(e => { if (vigente) setErroExtrato(e.message); }).finally(() => { if (vigente) setCarregandoExtrato(false); });
    return () => { vigente = false; };
  }, [config, contaId]);
  useEffect(() => {
    if (carregandoExtrato || !extrato.length) return;
    const hash = movimentoAlvo;
    if (!/^movimento-[0-9a-f-]+$/i.test(hash)) return;
    const alvo = Array.from(document.querySelectorAll<HTMLElement>(`[data-ancora="${hash}"]`)).find(el => el.getClientRects().length > 0);
    if (alvo) { alvo.scrollIntoView({ behavior: "smooth", block: "center" }); alvo.tabIndex = -1; alvo.focus({ preventScroll: true }); }
  }, [extrato, carregandoExtrato, paginaAtualExtrato, movimentoAlvo, periodoConta.inicio, periodoConta.fim]);
  const filtrosAvancados = useRascunhoConsulta({instituicao:instituicaoConta,tipo:tipoConta,status:statusConta},{instituicao:"",tipo:"",status:""},v=>{setInstituicaoConta(v.instituicao);setTipoConta(v.tipo);setStatusConta(v.status);});
  const camposContas: CampoConsulta[] = [
    {chave:"instituicao",ativo:!!instituicaoConta,limpar:()=>filtrosAvancados.editar("instituicao",""),conteudo:<CampoFiltro rotulo="Instituição"><SelectCampo aria-label="Filtrar por instituição" value={filtrosAvancados.rascunho.instituicao} onValueChange={v=>filtrosAvancados.editar("instituicao",v)}><option value="">Todas as instituições</option>{Array.from(new Set((config?.contas??[]).map(c=>c.instituicao).filter((i):i is string=>!!i))).sort().map(i=><option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></CampoFiltro>},
    {chave:"tipo",ativo:!!tipoConta,limpar:()=>filtrosAvancados.editar("tipo",""),conteudo:<CampoFiltro rotulo="Tipo de conta"><SelectCampo aria-label="Filtrar tipo de conta" value={filtrosAvancados.rascunho.tipo} onValueChange={v=>filtrosAvancados.editar("tipo",v)}><option value="">Todos os tipos</option>{Object.entries(TIPO_CONTA).map(([valor,texto])=><option key={valor} value={valor}>{texto}</option>)}</SelectCampo></CampoFiltro>},
    {chave:"situacao",colunas:[],ativo:!!statusConta,limpar:()=>filtrosAvancados.editar("status",""),conteudo:<CampoFiltro rotulo="Situação"><SelectCampo aria-label="Filtrar situação da conta" value={filtrosAvancados.rascunho.status} onValueChange={v=>filtrosAvancados.editar("status",v)}><option value="">Todas as situações</option><option value="ATIVA">Ativas</option><option value="INATIVA">Inativas</option></SelectCampo></CampoFiltro>},
  ];
  if (!config) return <PaginaSemDados titulo="Contas e extratos" descricao="Selecione uma conta para acompanhar seu saldo e consultar as movimentações." label="Carregando contas" erro={erro} onTentarNovamente={() => { void carregar(); }} />;
  const contasDoSaldo = config.contas.filter(c => c.ativo && c.incluirNoSaldoGeral);
  const saldoGeral = somarSaldos(contasDoSaldo);
  const instituicoes = Array.from(new Set(config.contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort();
  const contasBase = config.contas.filter(c => {
    const termo = buscaConta.trim().toLocaleLowerCase("pt-BR");
    const correspondeBusca = !termo || [c.nome, c.instituicao, c.identificacao].some(valor => valor?.toLocaleLowerCase("pt-BR").includes(termo));
    return correspondeBusca && (!tipoConta || c.tipo === tipoConta)
      && (!instituicaoConta || (instituicaoConta === "__sem__" ? !c.instituicao : c.instituicao === instituicaoConta))
      && (!statusConta || (statusConta === "ATIVA" ? c.ativo : !c.ativo));
  });
  const contasFiltradas = ordemContas.ordenar(contasBase);
  const totalPaginasContas = Math.max(1, Math.ceil(contasFiltradas.length / 15));
  const paginaAtualContas = Math.min(paginaContas, totalPaginasContas);
  const periodoFluxo = periodoDoAnoAtual();
  const origem = config.contas.find(c => String(c.id) === origemId && c.ativo);
  const destino = config.contas.find(c => String(c.id) === destinoId && c.ativo);
  const valorTransferencia = Number(valor);
  const transferenciaValida = !!origem && !!destino && origem.id !== destino.id && Number.isFinite(valorTransferencia) && valorTransferencia > 0 && !!dataTransferencia && dataTransferencia <= hoje();
  const impactoSaldoGeral = transferenciaValida ? Math.round(valorTransferencia * 100) * (Number(destino.incluirNoSaldoGeral) - Number(origem.incluirNoSaldoGeral)) / 100 : 0;
  const registrarTransferencia = async (e: FormEvent) => {
    e.preventDefault();
    if (transferenciaEmCurso.current || !transferenciaValida) return;
    transferenciaEmCurso.current = true;
    setRegistrandoTransferencia(true);
    setErro(null);
    try {
      await transferir({ contaOrigemId: origem.id, contaDestinoId: destino.id, valor: valorTransferencia, data: dataTransferencia, descricao: "Transferência entre contas" });
      setTransferindo(false); setOrigemId(""); setDestinoId(""); setValor(""); setDataTransferencia(hoje());
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      transferenciaEmCurso.current = false;
      setRegistrandoTransferencia(false);
    }
  };

  return <PaginaFinanceira colorida>
    {contaId != null && <nav className="fin-breadcrumb" aria-label="Caminho da página"><ol className="flex flex-wrap items-center gap-2"><li><a href="/financeiro" onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegarPara("/financeiro"); } }}>Financeiro</a></li><li className="flex items-center gap-2"><span aria-hidden="true">/</span><a href={urlConta(null)} aria-label="Voltar para contas" onClick={e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegar(null); } }}>Contas</a></li><li className="flex min-w-0 items-center gap-2" aria-current="page"><span aria-hidden="true">/</span>{selecionada?.nome ?? "Conta não encontrada"}</li></ol></nav>}
    <PageHeader eyebrow="" titulo={contaId == null ? "Contas e extratos" : selecionada?.nome ?? "Conta não encontrada"} descricao={contaId == null ? "Consulte seus saldos e acompanhe as movimentações financeiras." : "Confira o saldo, o fluxo e as movimentações desta conta."} acao={<div className="flex flex-wrap items-center gap-2">{contaId == null && <Button secondary onClick={() => onNav("cadastros")}><Settings2 aria-hidden="true" size={16} strokeWidth={1.8} /> Gerenciar contas</Button>}<Button onClick={() => setTransferindo(true)}><ArrowLeftRight aria-hidden="true" size={16} strokeWidth={1.8} /> Transferir</Button></div>} />
    <ErrorBox erro={erro} />
    {erroExtrato && <Button secondary className="mt-3" disabled={carregandoExtrato} onClick={() => { void carregar(); }}>Tentar novamente</Button>}
    {contaId == null && <>
      <section className="contas-saldo-geral" aria-label="Saldo geral atual">
        <span className="contas-saldo-icone"><Wallet size={26} aria-hidden="true" strokeWidth={1.7} /></span>
        <div className="contas-saldo-valor"><span>Saldo geral atual</span><strong className={saldoGeral < 0 ? "text-destructive" : undefined}>{brl(saldoGeral)}</strong></div>
        <div className="contas-saldo-escopo"><strong>{contasDoSaldo.length} {contasDoSaldo.length === 1 ? "conta ativa incluída" : "contas ativas incluídas"}</strong><span>Somente contas incluídas no saldo geral</span></div>
      </section>
      <Tabs className="contas-consulta" value={aba} onValueChange={mudarAba}>
        <TabsList aria-label="Consultas de contas">
          <TabsTrigger value="contas"><Landmark aria-hidden="true" />Contas</TabsTrigger>
          <TabsTrigger value="extrato"><List aria-hidden="true" />Extrato geral</TabsTrigger>
          <TabsTrigger value="analise"><ChartNoAxesCombined aria-hidden="true" />Análise</TabsTrigger>
        </TabsList>
        <TabsContent value="contas" forceMount hidden={aba !== "contas"}>
      <section aria-label="Contas">
      <Panel tom="info" className="fin-painel mt-4 overflow-hidden"><BarraConsulta ordenacao={ordemContas.controle} campos={camposContas} edicaoFiltros={filtrosAvancados} criterios={[...(instituicaoConta?[{id:"instituicao",rotulo:`Instituição: ${instituicaoConta==="__sem__"?"Sem instituição":instituicaoConta}`,limpar:()=>setInstituicaoConta("")}]:[]),...(tipoConta?[{id:"tipo",rotulo:TIPO_CONTA[tipoConta as keyof typeof TIPO_CONTA]??tipoConta,limpar:()=>setTipoConta("")}]:[]),...(statusConta?[{id:"status",rotulo:statusConta==="ATIVA"?"Ativas":"Inativas",limpar:()=>setStatusConta("")}]:[])]} onLimpar={()=>{setInstituicaoConta("");setTipoConta("");setStatusConta("");setBuscaConta("");}}><BuscaLista rotulo="Buscar conta" placeholder="Buscar por nome, instituição ou identificação" valor={buscaConta} onChange={setBuscaConta}/></BarraConsulta>{contasFiltradas.length ? <><TabelaFinanceira ordenacao={ordemContas.controle} filtrosColunas={filtrosDasColunas(camposContas,filtrosAvancados)} cartaoComLinks compacta barraRolagemSuperior onAbrir={c => navegar(c.id)} rotulo="Contas financeiras" itens={contasFiltradas.slice((paginaAtualContas - 1) * 15, paginaAtualContas * 15)} chaveDe={c => c.id} colunas={[
        { chave: "nome", titulo: "Conta", principal: true, larguraMinima: 240, celula: c => <><ShadcnButton asChild variant="link" className="h-auto justify-start whitespace-normal p-0 text-left font-semibold"><a href={urlConta(c.id)} aria-label={`Ver conta ${c.nome}`} onClick={e => { e.stopPropagation(); if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegar(c.id); } }}>{c.nome}</a></ShadcnButton>{(!c.ativo || !c.incluirNoSaldoGeral) && <div className="mt-1 text-xs text-ink-3">{!c.ativo ? "Inativa" : "Fora do saldo geral"}</div>}</> },
        { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 120, celula: c => <Pill tone="neutral">{TIPO_CONTA[c.tipo]}</Pill> },
        { chave: "instituicao", titulo: "Instituição", larguraMinima: 130, celula: c => c.instituicao || "—" },

        { chave: "ultima", titulo: "Última movimentação", larguraFlexivel: true, larguraMinima: 260, celula: c => c.ultimaOperacao ? <><div className="line-clamp-2" title={c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}>{c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}</div><div className="mt-1 text-xs text-ink-3">{dataBR(c.ultimaOperacao.data)}</div></> : "Sem movimentações" },
        { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 150, celula: c => <strong data-fin-tom={Number(c.saldoAtual) < 0 ? "alerta" : "neutro"} className="fin-valor whitespace-nowrap">{brl(c.saldoAtual)}</strong> },
      ]} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualContas} totalPaginas={totalPaginasContas} total={contasFiltradas.length} porPagina={15} rotulo="Paginação das contas" substantivo="contas" idSelect="pagina-contas" onPagina={setPaginaContas} /></> : <Empty>Nenhuma conta encontrada para os filtros selecionados.</Empty>}<div className="contas-resumo-consulta"><span>Saldo da consulta · {contasFiltradas.length} {contasFiltradas.length === 1 ? "conta" : "contas"}</span><strong>{brl(somarSaldos(contasFiltradas))}</strong></div></Panel>
      <p className="contas-ajuda">Selecione uma conta para consultar seu extrato.</p></section>
        </TabsContent>
        <TabsContent value="analise" forceMount hidden={aba !== "analise"}>
      <section className="min-w-0" aria-label="Fluxo consolidado">
        <FluxoContasFinanceiras key="consolidado" movimentos={movimentosGerais} consolidado periodo={periodoFluxo} carregando={carregandoExtrato} erro={erroExtrato} escopo="Todas as contas da fazenda; inclui contas fora do saldo geral" />
      </section>
        </TabsContent>
        <TabsContent value="extrato" forceMount hidden={aba !== "extrato"}>
      <ExtratoGeral controles={<div className="extrato-periodo text-sm font-medium"><PeriodoFinanceiroControl showIcon inicio={filtrosExtratoGeral.inicio} fim={filtrosExtratoGeral.fim} allowAll label="Período do extrato geral" onChange={periodo => setFiltrosExtratoGeral(atual => ({ ...atual, ...periodo }))} /></div>} contas={config.contas} movimentos={movimentosGerais} filtros={filtrosExtratoGeral} onChangeFiltros={setFiltrosExtratoGeral} carregando={carregandoExtrato} erro={erroExtrato} onAbrir={(m) => { setPeriodoConta({ inicio: filtrosExtratoGeral.inicio, fim: filtrosExtratoGeral.fim }); navegar(m.contaId, m.id); }} />
        </TabsContent>
      </Tabs>
    </>}
    {contaId != null && !selecionada && <Empty>Esta conta não está disponível na fazenda selecionada.</Empty>}
    {selecionada && <div className="mt-3 flex flex-wrap items-center gap-3"><PeriodoFinanceiroControl inicio={periodoConta.inicio} fim={periodoConta.fim} allowAll label="Período do extrato da conta" onChange={setPeriodoConta} /></div>}
    {selecionada && <FluxoContasFinanceiras key={selecionada.id} movimentos={extrato} periodo={periodoConta} carregando={carregandoExtrato} erro={erroExtrato} escopo={selecionada.nome} />}
    {selecionada && <Panel tom="entrada" className="fin-painel mt-4 overflow-hidden"><div className="fin-cabecalho flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="min-w-0 flex-[1_1_260px]"><h2 className="break-words text-xl font-semibold">Extrato</h2><p className="mt-1 break-words text-xs text-ink-3">Abertura em {dataBR(selecionada.dataSaldoAbertura)} com {brl(selecionada.saldoAbertura)}</p></div><div className="min-w-0"><div className="text-xs text-ink-3">Saldo atual da conta</div><div data-fin-tom={Number(selecionada.saldoAtual) < 0 ? "alerta" : "entrada"} className="fin-valor mt-1 whitespace-nowrap tabular-nums font-serif text-3xl">{brl(selecionada.saldoAtual)}</div>{!selecionada.incluirNoSaldoGeral && <p className="mt-1 text-xs text-ink-3">Não incluída no saldo geral</p>}</div><Pill tone={selecionada.ativo ? "green" : "neutral"}>{selecionada.ativo ? "Ativa" : "Inativa"}</Pill></div>
      <dl className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">{([
        ["Tipo", TIPO_CONTA[selecionada.tipo]], ["Instituição", selecionada.instituicao], ["Identificação", selecionada.identificacao], ["Tipo bancário", selecionada.tipoBancario ? TIPO_BANCARIO[selecionada.tipoBancario] ?? selecionada.tipoBancario : null], ["Agência", selecionada.agencia], ["Número da conta", selecionada.numeroConta], ["Dígito", selecionada.digito], ["Titular", selecionada.titular], ["Local", selecionada.local], ["Responsável", selecionada.responsavel], ["Incluída no saldo geral", selecionada.ativo && selecionada.incluirNoSaldoGeral ? "Sim" : "Não"], ["Observações", selecionada.observacoes],
      ] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-3">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value || "—"}</dd></div>)}</dl>
      <ErrorBox erro={erroExtrato} />
      <BarraConsulta ordenacao={ordemExtrato.controle} campos={consultaExtrato.campos} edicaoFiltros={consultaExtrato.edicao} erroFiltros={consultaExtrato.erro} criterios={consultaExtrato.criterios}><BuscaLista rotulo="Buscar movimento da conta" placeholder="Descrição ou parceiro" valor={buscaExtrato} onChange={v=>{setBuscaExtrato(v);setPaginaExtrato(1);}}/></BarraConsulta>
      {carregandoExtrato ? <SkeletonListaFinanceira label="Carregando extrato" /> : erroExtrato ? <p className="p-5">Não foi possível carregar o extrato.</p> : extratoFiltrado.length ? <><TabelaFinanceira ordenacao={ordemExtrato.controle} filtrosColunas={consultaExtrato.colunas} compacta barraRolagemSuperior rotulo={`Extrato de ${selecionada.nome}`} itens={extratoFiltrado.slice((paginaAtualExtrato - 1) * 15, paginaAtualExtrato * 15)} colunas={COLUNAS_EXTRATO} chaveDe={(m) => m.id} ancoraDe={m => `movimento-${m.id}`} classeLinha={(m) => `${window.location.hash === `#movimento-${m.id}` ? "bg-muted ring-1 ring-inset ring-primary" : ""}`} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualExtrato} totalPaginas={totalPaginasExtrato} total={extratoFiltrado.length} porPagina={15} rotulo="Paginação do extrato da conta" substantivo="movimentos" idSelect="pagina-extrato-conta" onPagina={setPaginaExtrato} /></> : <Empty>Nenhum movimento desta conta no período selecionado.</Empty>}
    </Panel>}

    {transferindo && <DialogFinanceiro icon={ArrowLeftRight} titulo="Nova transferência" eyebrow="Entre contas próprias" onClose={fecharTransferencia} rodape={<div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button secondary disabled={registrandoTransferencia} onClick={fecharTransferencia}>Cancelar</Button><Button form="form-transferencia-financeira" type="submit" carregando={registrandoTransferencia} disabled={registrandoTransferencia || !transferenciaValida}>{registrandoTransferencia ? "Registrando…" : "Registrar transferência"}</Button></div>}><form id="form-transferencia-financeira" onSubmit={registrarTransferencia} className="p-5"><ErrorBox erro={erro} /><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Conta de origem<SelectCampo required disabled={registrandoTransferencia} value={origemId} onValueChange={(valor) => { setOrigemId(valor); if (valor === destinoId) setDestinoId(""); }} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome} · {brl(c.saldoAtual)}</option>)}</SelectCampo></label><label className="text-sm font-medium">Conta de destino<SelectCampo required disabled={registrandoTransferencia} value={destinoId} onValueChange={(valor) => setDestinoId(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo && String(c.id) !== origemId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label><label className="text-sm font-medium sm:col-span-2">Valor<Input required disabled={registrandoTransferencia} min="0.01" step="0.01" type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Data da transferência<Input disabled={registrandoTransferencia} required type="date" max={hoje()} value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label></div><div className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--fin-positive-bg)] p-4 text-sm text-primary"><Info aria-hidden="true" size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" /><div><strong className="tabular-nums">{transferenciaValida ? `Impacto no saldo geral: ${brl(impactoSaldoGeral)}` : "Selecione as contas e informe o valor para revisar o impacto."}</strong><p className="mt-1 text-xs leading-5">O valor sairá da origem e entrará no destino na mesma confirmação. Somente contas incluídas no saldo geral participam desse total.</p></div></div></form></DialogFinanceiro>}
  </PaginaFinanceira>;
}
