import { useRascunhoConsulta } from "./useRascunhoConsulta";
import { BarraConsulta, SituacoesConsulta } from "@/financeiro/BarraConsulta";
import { Button as ShadcnButton } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoDoAnoAtual, periodoInicial } from "./lib/periodo";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Info, Settings2 } from "lucide-react";
import { ExtratoGeral, FILTROS_EXTRATO_GERAL_INICIAIS, type FiltrosExtratoGeral } from "./ExtratoGeral";
import { navegarPara, parseContaFinanceiraId } from "../router";
import type { Tab } from "../components/Shell";
import { obterConfiguracoesFinanceiras, obterExtratoConta, obterExtratoGeral, transferir, type ConfiguracoesFinanceiras, type Conta, type MovimentoConta, type MovimentoGeral } from "./novo-api";
import { brl, Button, CabecalhoTabela, type ColunaTabela, dataBR, Empty, ErrorBox, hoje, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { FluxoContasFinanceiras } from "./FluxoContasFinanceiras";
import { infoReversao } from "./lib/reversao";
import { TIPO_CONTA } from "./FormConta";

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
  const [paginaContas, setPaginaContas] = useState(1);
  const [paginaExtrato, setPaginaExtrato] = useState(1);
  const [movimentoAlvo, setMovimentoAlvo] = useState(() => window.location.hash.slice(1));
  const [buscaConta, setBuscaConta] = useState(""); const [tipoConta, setTipoConta] = useState(""); const [instituicaoConta, setInstituicaoConta] = useState(""); const [statusConta, setStatusConta] = useState("");
  const [movimentosGerais, setMovimentosGerais] = useState<MovimentoGeral[]>([]);
  const [filtrosExtratoGeral, setFiltrosExtratoGeral] = useState<FiltrosExtratoGeral>(() => ({ ...FILTROS_EXTRATO_GERAL_INICIAIS, natureza: ["recebimentos", "pagamentos"].includes(new URLSearchParams(window.location.search).get("natureza") ?? "") ? new URLSearchParams(window.location.search).get("natureza")! : undefined, ...periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }) }));
  const [periodoConta, setPeriodoConta] = useState(() => periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }));
  const extratoFiltrado = extrato.filter(m => (!periodoConta.inicio || m.transacao.data.slice(0, 10) >= periodoConta.inicio) && (!periodoConta.fim || m.transacao.data.slice(0, 10) <= periodoConta.fim));
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
  useEffect(() => { const atualizar = () => { setContaId(parseContaFinanceiraId(window.location.pathname)); setMovimentoAlvo(window.location.hash.slice(1)); const periodo = periodoInicial(periodoDoAnoAtual(), { permitirVazio: true }); if (parseContaFinanceiraId(window.location.pathname)) setPeriodoConta(periodo); else setFiltrosExtratoGeral(atual => ({ ...atual, ...periodo })); }; window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const urlConta = (id: string | null, movimentoId?: string) => {
    const periodo = contaId == null ? filtrosExtratoGeral : periodoConta;
    const parametros = new URLSearchParams({ inicio: periodo.inicio, fim: periodo.fim });
    if (filtrosExtratoGeral.natureza) parametros.set("natureza", filtrosExtratoGeral.natureza);
    return `/financeiro/contas${id == null ? "" : `/${id}`}?${parametros}${movimentoId ? `#movimento-${movimentoId}` : ""}`;
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
  const filtrosAvancados = useRascunhoConsulta({ instituicao: instituicaoConta }, { instituicao: "" }, v => setInstituicaoConta(v.instituicao));
  if (!config) return <PaginaSemDados titulo="Contas" descricao="Selecione uma conta para acompanhar seu saldo e consultar as movimentações." label="Carregando contas" erro={erro} onTentarNovamente={() => { void carregar(); }} />;
  const saldoGeral = config.contas.filter((c) => c.ativo && c.incluirNoSaldoGeral).reduce((s, c) => s + Number(c.saldoAtual), 0);
  const instituicoes = Array.from(new Set(config.contas.map(c => c.instituicao).filter((i): i is string => !!i))).sort();
  const contasFiltradas = config.contas.filter(c => {
    const termo = buscaConta.trim().toLocaleLowerCase("pt-BR");
    const correspondeBusca = !termo || [c.nome, c.instituicao, c.identificacao].some(valor => valor?.toLocaleLowerCase("pt-BR").includes(termo));
    return correspondeBusca && (!tipoConta || c.tipo === tipoConta)
      && (!instituicaoConta || (instituicaoConta === "__sem__" ? !c.instituicao : c.instituicao === instituicaoConta))
      && (!statusConta || (statusConta === "ATIVA" ? c.ativo : !c.ativo));
  });
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
    <PageHeader eyebrow="" titulo={contaId == null ? "Contas" : selecionada?.nome ?? "Conta não encontrada"} descricao={contaId == null ? "Consulte os saldos das contas e confira as movimentações no extrato." : "Confira o saldo, o fluxo e as movimentações desta conta."} extra={contaId == null && <div data-fin-tom={saldoGeral < 0 ? "alerta" : "entrada"} className="border-l-2 border-[var(--fin-cor)] pl-3"><div className="text-xs text-ink-3">Saldo atual geral · {config.contas.filter(c => c.ativo && c.incluirNoSaldoGeral).length} contas ativas incluídas</div><strong className="fin-valor tabular-nums font-serif text-2xl">{brl(saldoGeral)}</strong></div>} acao={contaId == null ? undefined : (<div className="flex flex-wrap items-center gap-2">{contaId == null && <Button secondary onClick={() => onNav("cadastros")}><Settings2 aria-hidden="true" size={16} strokeWidth={1.8} /> Gerenciar contas</Button>}<Button onClick={() => setTransferindo(true)}><ArrowLeftRight aria-hidden="true" size={16} strokeWidth={1.8} /> Transferir</Button></div>)} />
    <ErrorBox erro={erro} />
    {erroExtrato && <Button secondary className="mt-3" disabled={carregandoExtrato} onClick={() => { void carregar(); }}>Tentar novamente</Button>}
    {contaId == null && <>
      <section className="mt-3" aria-label="Contas">
      <Panel tom="info" className="fin-painel mt-4 overflow-hidden"><BarraConsulta edicaoFiltros={filtrosAvancados} adicionais={<><label className="fin-filtro-controle text-sm font-medium">Instituição<SelectCampo value={filtrosAvancados.rascunho.instituicao} onValueChange={valor => filtrosAvancados.editar("instituicao", valor)} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Todas as instituições</option>{instituicoes.map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></label>
</>} criterios={instituicaoConta ? [{id:"instituicao",rotulo:`Instituição: ${instituicaoConta === "__sem__" ? "Sem instituição" : instituicaoConta}`,limpar:()=>setInstituicaoConta("")}] : []} onLimpar={()=>{setInstituicaoConta("");setTipoConta("");setStatusConta("");setBuscaConta("");}} acao={<div className="flex flex-wrap items-center gap-2">{contaId == null && <Button secondary onClick={() => onNav("cadastros")}><Settings2 aria-hidden="true" size={16} strokeWidth={1.8} /> Gerenciar contas</Button>}<Button onClick={() => setTransferindo(true)}><ArrowLeftRight aria-hidden="true" size={16} strokeWidth={1.8} /> Transferir</Button></div>}><label className="fin-filtro-busca text-sm font-medium">Buscar conta<Input type="search" value={buscaConta} onChange={e => setBuscaConta(e.target.value)} placeholder="Nome, instituição ou identificação" className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal" /></label><label className="fin-filtro-controle text-sm font-medium">Tipo<SelectCampo value={tipoConta} onValueChange={valor => setTipoConta(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Todos os tipos</option><option value="BANCO">Banco</option><option value="CAIXA">Caixa</option><option value="APLICACAO">Aplicação</option></SelectCampo></label><SituacoesConsulta rotulo="Situação" valor={statusConta} onChange={setStatusConta} opcoes={[{valor:"",texto:"Todas"},{valor:"ATIVA",texto:"Ativas"},{valor:"INATIVA",texto:"Inativas"}]} /></BarraConsulta>{contasFiltradas.length ? <><TabelaFinanceira cartaoComLinks compacta barraRolagemSuperior onAbrir={c => navegar(c.id)} rotulo="Contas financeiras" itens={contasFiltradas.slice((paginaAtualContas - 1) * 15, paginaAtualContas * 15)} chaveDe={c => c.id} colunas={[
        { chave: "nome", titulo: "Conta", principal: true, larguraMinima: 240, celula: c => <><ShadcnButton asChild variant="link" className="h-auto justify-start whitespace-normal p-0 text-left font-semibold"><a href={urlConta(c.id)} aria-label={`Ver conta ${c.nome}`} onClick={e => { e.stopPropagation(); if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegar(c.id); } }}>{c.nome}</a></ShadcnButton>{(!c.ativo || !c.incluirNoSaldoGeral) && <div className="mt-1 text-xs text-ink-3">{!c.ativo ? "Inativa" : "Fora do saldo geral"}</div>}</> },
        { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 120, celula: c => c.tipo === "BANCO" ? "Banco" : c.tipo === "CAIXA" ? "Caixa" : "Aplicação" },
        { chave: "instituicao", titulo: "Instituição", larguraMinima: 130, celula: c => c.instituicao || "—" },
        { chave: "saldo", titulo: "Saldo atual", alinhamento: "direita", larguraMinima: 150, celula: c => <strong data-fin-tom={Number(c.saldoAtual) < 0 ? "alerta" : "entrada"} className="fin-valor whitespace-nowrap">{brl(c.saldoAtual)}</strong> },
        { chave: "ultima", titulo: "Última movimentação", larguraFlexivel: true, larguraMinima: 260, celula: c => c.ultimaOperacao ? <><div className="line-clamp-2" title={c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}>{c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}</div><div className="mt-1 text-xs text-ink-3">{dataBR(c.ultimaOperacao.data)}</div></> : "Sem movimentações" },
      ]} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualContas} totalPaginas={totalPaginasContas} total={contasFiltradas.length} porPagina={15} rotulo="Paginação das contas" substantivo="contas" idSelect="pagina-contas" onPagina={setPaginaContas} /></> : <Empty>Nenhuma conta encontrada para os filtros selecionados.</Empty>}</Panel></section>
      <section className="mt-4 min-w-0" aria-label="Fluxo consolidado">
        <FluxoContasFinanceiras key="consolidado" movimentos={movimentosGerais} consolidado periodo={periodoFluxo} carregando={carregandoExtrato} erro={erroExtrato} escopo="Todas as contas da fazenda; inclui contas fora do saldo geral" />
      </section>
      <ExtratoGeral controles={<div className="fin-filtro-periodo text-sm font-medium"><span className="mb-1 block">Período</span><PeriodoFinanceiroControl inicio={filtrosExtratoGeral.inicio} fim={filtrosExtratoGeral.fim} allowAll label="Período do extrato geral" onChange={periodo => setFiltrosExtratoGeral(atual => ({ ...atual, ...periodo }))} /></div>} contas={config.contas} movimentos={movimentosGerais} filtros={filtrosExtratoGeral} onChangeFiltros={setFiltrosExtratoGeral} carregando={carregandoExtrato} erro={erroExtrato} onAbrir={(m) => { setPeriodoConta({ inicio: filtrosExtratoGeral.inicio, fim: filtrosExtratoGeral.fim }); navegar(m.contaId, m.id); }} />
    </>}
    {contaId != null && !selecionada && <Empty>Esta conta não está disponível na fazenda selecionada.</Empty>}
    {selecionada && <div className="mt-3 flex flex-wrap items-center gap-3"><PeriodoFinanceiroControl inicio={periodoConta.inicio} fim={periodoConta.fim} allowAll label="Período do extrato da conta" onChange={setPeriodoConta} /></div>}
    {selecionada && <FluxoContasFinanceiras key={selecionada.id} movimentos={extrato} periodo={periodoConta} carregando={carregandoExtrato} erro={erroExtrato} escopo={selecionada.nome} />}
    {selecionada && <Panel tom="entrada" className="fin-painel mt-4 overflow-hidden"><div className="fin-cabecalho flex flex-wrap items-center justify-between gap-3 border-b border-border p-4"><div className="min-w-0 flex-[1_1_260px]"><h2 className="break-words text-xl font-semibold">Extrato</h2><p className="mt-1 break-words text-xs text-ink-3">Abertura em {dataBR(selecionada.dataSaldoAbertura)} com {brl(selecionada.saldoAbertura)}</p></div><div className="min-w-0"><div className="text-xs text-ink-3">Saldo atual da conta</div><div data-fin-tom={Number(selecionada.saldoAtual) < 0 ? "alerta" : "entrada"} className="fin-valor mt-1 whitespace-nowrap tabular-nums font-serif text-3xl">{brl(selecionada.saldoAtual)}</div>{!selecionada.incluirNoSaldoGeral && <p className="mt-1 text-xs text-ink-3">Não incluída no saldo geral</p>}</div><Pill tone={selecionada.ativo ? "green" : "neutral"}>{selecionada.ativo ? "Ativa" : "Inativa"}</Pill></div>
      <dl className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">{([
        ["Tipo", TIPO_CONTA[selecionada.tipo]], ["Instituição", selecionada.instituicao], ["Identificação", selecionada.identificacao], ["Tipo bancário", selecionada.tipoBancario ? TIPO_BANCARIO[selecionada.tipoBancario] ?? selecionada.tipoBancario : null], ["Agência", selecionada.agencia], ["Número da conta", selecionada.numeroConta], ["Dígito", selecionada.digito], ["Titular", selecionada.titular], ["Local", selecionada.local], ["Responsável", selecionada.responsavel], ["Incluída no saldo geral", selecionada.ativo && selecionada.incluirNoSaldoGeral ? "Sim" : "Não"], ["Observações", selecionada.observacoes],
      ] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-3">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium">{value || "—"}</dd></div>)}</dl>
      <ErrorBox erro={erroExtrato} />
      {carregandoExtrato ? <SkeletonListaFinanceira label="Carregando extrato" /> : erroExtrato ? <p className="p-5">Não foi possível carregar o extrato.</p> : extratoFiltrado.length ? <><TabelaFinanceira compacta barraRolagemSuperior rotulo={`Extrato de ${selecionada.nome}`} itens={extratoFiltrado.slice((paginaAtualExtrato - 1) * 15, paginaAtualExtrato * 15)} colunas={COLUNAS_EXTRATO} chaveDe={(m) => m.id} ancoraDe={m => `movimento-${m.id}`} classeLinha={(m) => `${window.location.hash === `#movimento-${m.id}` ? "bg-muted ring-1 ring-inset ring-primary" : ""}`} /><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualExtrato} totalPaginas={totalPaginasExtrato} total={extratoFiltrado.length} porPagina={15} rotulo="Paginação do extrato da conta" substantivo="movimentos" idSelect="pagina-extrato-conta" onPagina={setPaginaExtrato} /></> : <Empty>Nenhum movimento desta conta no período selecionado.</Empty>}
    </Panel>}

    {transferindo && <DialogFinanceiro icon={ArrowLeftRight} titulo="Nova transferência" eyebrow="Entre contas próprias" onClose={fecharTransferencia} rodape={<div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button secondary disabled={registrandoTransferencia} onClick={fecharTransferencia}>Cancelar</Button><Button form="form-transferencia-financeira" type="submit" carregando={registrandoTransferencia} disabled={registrandoTransferencia || !transferenciaValida}>{registrandoTransferencia ? "Registrando…" : "Registrar transferência"}</Button></div>}><form id="form-transferencia-financeira" onSubmit={registrarTransferencia} className="p-5"><ErrorBox erro={erro} /><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Conta de origem<SelectCampo required disabled={registrandoTransferencia} value={origemId} onValueChange={(valor) => { setOrigemId(valor); if (valor === destinoId) setDestinoId(""); }} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome} · {brl(c.saldoAtual)}</option>)}</SelectCampo></label><label className="text-sm font-medium">Conta de destino<SelectCampo required disabled={registrandoTransferencia} value={destinoId} onValueChange={(valor) => setDestinoId(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-card p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo && String(c.id) !== origemId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label><label className="text-sm font-medium sm:col-span-2">Valor<Input required disabled={registrandoTransferencia} min="0.01" step="0.01" type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Data da transferência<Input disabled={registrandoTransferencia} required type="date" max={hoje()} value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label></div><div className="mt-5 flex items-start gap-3 rounded-lg bg-[var(--fin-positive-bg)] p-4 text-sm text-primary"><Info aria-hidden="true" size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" /><div><strong className="tabular-nums">{transferenciaValida ? `Impacto no saldo geral: ${brl(impactoSaldoGeral)}` : "Selecione as contas e informe o valor para revisar o impacto."}</strong><p className="mt-1 text-xs leading-5">O valor sairá da origem e entrará no destino na mesma confirmação. Somente contas incluídas no saldo geral participam desse total.</p></div></div></form></DialogFinanceiro>}
  </PaginaFinanceira>;
}
