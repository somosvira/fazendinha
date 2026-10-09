import { SecaoFinanceira } from "./SecaoFinanceira";
import { Button as ShadcnButton } from "@/components/ui/button";
import { DialogFinanceiro } from "./DialogFinanceiro";
import { SkeletonListaFinanceira } from "./CarregamentoFinanceiro";
import { SelectCampo } from "./SelectCampo";
import { Input } from "@/components/ui/input";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { periodoDoAnoAtual, periodoInicial } from "./lib/periodo";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Settings2 } from "lucide-react";
import { ExtratoGeral, FILTROS_EXTRATO_GERAL_INICIAIS, filtrarMovimentosExtratoGeral, type FiltrosExtratoGeral } from "./ExtratoGeral";
import { navegarPara, parseContaFinanceiraId } from "../router";
import type { Tab } from "../components/Shell";
import { obterConfiguracoesFinanceiras, obterExtratoConta, obterExtratoGeral, transferir, type ConfiguracoesFinanceiras, type Conta, type MovimentoConta, type MovimentoGeral } from "./novo-api";
import { brl, Button, type ColunaTabela, dataBR, Empty, ErrorBox, hoje, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, Pill, Paginacao, TabelaFinanceira } from "./financeiro-ui";
import { LinkOperacaoFinanceira } from "./LinkOperacaoFinanceira";
import { FluxoContasFinanceiras } from "./FluxoContasFinanceiras";
import { infoReversao } from "./lib/reversao";

/* Colunas do extrato. Cabeçalhos e valores ficam centralizados; dinheiro nunca
 * quebra no meio (whitespace-nowrap). */
const COLUNAS_EXTRATO: ColunaTabela<MovimentoConta>[] = [
  { chave: "data", titulo: "Data", alinhamento: "centro", larguraMinima: 110, celula: (m) => <span className="whitespace-nowrap text-ink-3">{dataBR(m.transacao.data)}</span> },
  { chave: "descricao", titulo: "Descrição", alinhamento: "centro", larguraMinima: 260, principal: true, celula: (m) => { const reversao = infoReversao(m.transacao); return <><strong className="break-words">{m.transacao.descricao || m.transacao.tipo}</strong>{m.transacao.status === "REVERTIDA" && <Pill tone="amber">Revertida</Pill>}<div className="mt-1 break-words text-xs text-ink-3">{m.transacao.formaPagamento?.replaceAll("_", " ") ?? "Movimento financeiro"}{m.transacao.parceiro ? ` · ${m.transacao.parceiro.nome}` : ""}</div>{reversao && <div className="mt-1 break-words text-xs font-medium text-amber-800">{reversao.detalhe}{reversao.operacaoId != null && reversao.operacaoNumero != null && <> · <LinkOperacaoFinanceira id={reversao.operacaoId} numero={reversao.operacaoNumero} /></>}</div>}</>; } },
  { chave: "origem", titulo: "Origem", alinhamento: "centro", larguraMinima: 150, celula: (m) => m.transacao.operacao ? <LinkOperacaoFinanceira id={m.transacao.operacao.id} numero={m.transacao.operacao.numero} /> : <span className="whitespace-nowrap">Transação avulsa</span> },
  { chave: "entrada", titulo: "Entrada", alinhamento: "centro", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold text-[var(--fin-entrada)]">{m.direcao === "ENTRADA" ? brl(m.valor) : "—"}</span> },
  { chave: "saida", titulo: "Saída", alinhamento: "centro", larguraMinima: 120, celula: (m) => <span className="whitespace-nowrap font-semibold text-[var(--fin-saida)]">{m.direcao === "SAIDA" ? brl(m.valor) : "—"}</span> },
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
  const carregar = useCallback(() => obterConfiguracoesFinanceiras().then((cfg) => { setConfig(cfg);  }).catch((e) => setErro(e.message)), []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { const atualizar = () => { setContaId(parseContaFinanceiraId(window.location.pathname)); setMovimentoAlvo(window.location.hash.slice(1)); }; window.addEventListener("popstate", atualizar); return () => window.removeEventListener("popstate", atualizar); }, []);
  const navegar = (id: string | null, movimentoId?: string) => navegarPara(id == null ? "/financeiro/contas" : `/financeiro/contas/${id}?${new URLSearchParams({ inicio: filtrosExtratoGeral.inicio, fim: filtrosExtratoGeral.fim })}${movimentoId ? `#movimento-${movimentoId}` : ""}`);

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
  if (!config) return <PaginaSemDados titulo="Contas" descricao="Selecione uma conta para acompanhar seu saldo e consultar as movimentações." label="Carregando contas" erro={erro} />;
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
  const movimentosFiltradosExtratoGeral = filtrarMovimentosExtratoGeral(movimentosGerais, filtrosExtratoGeral);
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
    {contaId != null && <Button secondary onClick={() => navegar(null)}>← Voltar para contas</Button>}
    <PageHeader eyebrow="" titulo={contaId == null ? "Contas" : selecionada?.nome ?? "Conta não encontrada"} descricao={contaId == null ? "Acompanhe os saldos e abra uma conta para consultar seus dados e extrato." : "Dados da conta e histórico de movimentações."} acao={<div className="flex flex-wrap items-center gap-3">{contaId == null && <div data-fin-tom={saldoGeral < 0 ? "alerta" : "entrada"} className="pl-3"><div className="text-xs text-ink-3">Saldo geral · {config.contas.filter(c => c.ativo && c.incluirNoSaldoGeral).length} contas incluídas</div><strong className="fin-valor font-serif text-2xl">{brl(saldoGeral)}</strong></div>}{contaId == null && <Button secondary onClick={() => onNav("cadastros")}><Settings2 size={16} /> Gerenciar contas</Button>}<Button onClick={() => setTransferindo(true)}><ArrowLeftRight size={16} /> Transferir</Button></div>} />
    <ErrorBox erro={erro} />
    {contaId == null && <>
      <section className="mt-3" aria-label="Contas">
      <Panel tom="info" className="fin-painel mt-3 overflow-hidden"><div className="grid grid-cols-2 gap-3 border-b border-border p-3 xl:grid-cols-4"><label className="text-sm font-medium">Buscar conta<Input type="search" value={buscaConta} onChange={e => setBuscaConta(e.target.value)} placeholder="Nome, instituição ou identificação" className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal" /></label><label className="text-sm font-medium">Tipo<SelectCampo value={tipoConta} onValueChange={valor => setTipoConta(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Todos os tipos</option><option value="BANCO">Banco</option><option value="CAIXA">Caixa</option><option value="APLICACAO">Aplicação</option></SelectCampo></label><label className="text-sm font-medium">Instituição<SelectCampo value={instituicaoConta} onValueChange={valor => setInstituicaoConta(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Todas as instituições</option>{instituicoes.map(i => <option key={i} value={i}>{i}</option>)}<option value="__sem__">Sem instituição</option></SelectCampo></label><label className="text-sm font-medium">Situação<SelectCampo value={statusConta} onValueChange={valor => setStatusConta(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Ativas e inativas</option><option value="ATIVA">Ativas</option><option value="INATIVA">Inativas</option></SelectCampo></label></div>{contasFiltradas.length ? <><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualContas} totalPaginas={totalPaginasContas} total={contasFiltradas.length} porPagina={15} rotulo="Paginação das contas" substantivo="contas" idSelect="pagina-contas" onPagina={setPaginaContas} /><TabelaFinanceira cartaoComLinks compacta barraRolagemSuperior onAbrir={c => navegar(c.id)} rotulo="Contas financeiras" itens={contasFiltradas.slice((paginaAtualContas - 1) * 15, paginaAtualContas * 15)} chaveDe={c => c.id} colunas={[
        { chave: "nome", titulo: "Conta", principal: true, larguraMinima: 180, celula: c => <><ShadcnButton asChild variant="link" className="h-auto justify-start whitespace-normal p-0 text-left font-semibold"><a href={`/financeiro/contas/${c.id}`} aria-label={`Ver conta ${c.nome}`} onClick={e => { e.stopPropagation(); if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); navegar(c.id); } }}>{c.nome}</a></ShadcnButton>{(!c.ativo || !c.incluirNoSaldoGeral) && <div className="mt-1 text-xs text-ink-3">{!c.ativo ? "Inativa" : "Fora do saldo geral"}</div>}</> },
        { chave: "tipo", titulo: "Tipo", alinhamento: "centro", larguraMinima: 120, celula: c => c.tipo === "BANCO" ? "Banco" : c.tipo === "CAIXA" ? "Caixa" : "Aplicação" },
        { chave: "instituicao", titulo: "Instituição", alinhamento: "centro", larguraMinima: 130, celula: c => c.instituicao || "—" },
        { chave: "saldo", titulo: "Saldo atual", alinhamento: "centro", larguraMinima: 150, celula: c => <strong data-fin-tom={Number(c.saldoAtual) < 0 ? "alerta" : "entrada"} className="fin-valor whitespace-nowrap">{brl(c.saldoAtual)}</strong> },
        { chave: "ultima", titulo: "Última movimentação", larguraMinima: 180, celula: c => c.ultimaOperacao ? <><div className="line-clamp-2" title={c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}>{c.ultimaOperacao.descricao || c.ultimaOperacao.tipo.replaceAll("_", " ")}</div><div className="mt-1 text-xs text-ink-3">{dataBR(c.ultimaOperacao.data)}</div></> : "Sem movimentações" },
      ]} /></> : <Empty>Nenhuma conta encontrada para os filtros selecionados.</Empty>}</Panel></section>
      <ExtratoGeral controles={<>
        <div className="mt-3 flex flex-wrap items-center gap-3"><PeriodoFinanceiroControl inicio={filtrosExtratoGeral.inicio} fim={filtrosExtratoGeral.fim} allowAll label="Período do fluxo e extrato geral" onChange={periodo => setFiltrosExtratoGeral(atual => ({ ...atual, ...periodo }))} /><span className="text-xs text-ink-3">Período do extrato e do gráfico.</span></div>
        <div className="mt-3"><SecaoFinanceira titulo="Mostrar receitas e despesas"><FluxoContasFinanceiras key="consolidado" movimentos={movimentosFiltradosExtratoGeral} consolidado periodo={filtrosExtratoGeral} carregando={carregandoExtrato} erro={erroExtrato} escopo="Mesmo escopo do extrato geral" /></SecaoFinanceira></div>
      </>} contas={config.contas} movimentos={movimentosGerais} filtros={filtrosExtratoGeral} onChangeFiltros={setFiltrosExtratoGeral} carregando={carregandoExtrato} erro={erroExtrato} onAbrir={(m) => { setPeriodoConta({ inicio: filtrosExtratoGeral.inicio, fim: filtrosExtratoGeral.fim }); navegar(m.contaId, m.id); }} />
    </>}
    {contaId != null && !selecionada && <Empty>Esta conta não está disponível na fazenda selecionada.</Empty>}
    {selecionada && <div className="mt-3 flex flex-wrap items-center gap-3"><PeriodoFinanceiroControl inicio={periodoConta.inicio} fim={periodoConta.fim} allowAll label="Período do extrato da conta" onChange={setPeriodoConta} /><span className="text-xs text-ink-3">Um único período para o gráfico e a tabela de extrato desta conta.</span></div>}
    {selecionada && <FluxoContasFinanceiras key={selecionada.id} movimentos={extrato} periodo={periodoConta} carregando={carregandoExtrato} erro={erroExtrato} escopo={selecionada.nome} />}
    {selecionada && <Panel tom="entrada" className="fin-painel mt-3 overflow-hidden"><div className="fin-cabecalho flex flex-wrap items-center justify-between gap-3 border-b border-border p-3"><div className="min-w-0 flex-[1_1_260px]"><div className="eyebrow">Extrato da conta</div><h2 className="mt-1 break-words font-serif text-xl">{selecionada.nome}</h2><p className="mt-1 break-words text-xs text-ink-3">Abertura em {dataBR(selecionada.dataSaldoAbertura)} com {brl(selecionada.saldoAbertura)}</p></div><div className="min-w-0"><div className="text-xs text-ink-3">Saldo atual da conta</div><div data-fin-tom={Number(selecionada.saldoAtual) < 0 ? "alerta" : "entrada"} className="fin-valor mt-1 whitespace-nowrap font-serif text-3xl">{brl(selecionada.saldoAtual)}</div>{!selecionada.incluirNoSaldoGeral && <p className="mt-1 text-xs text-ink-3">Não incluída no saldo geral</p>}</div><Pill tone={selecionada.ativo ? "green" : "neutral"}>{selecionada.ativo ? "Ativa" : "Inativa"}</Pill></div>
      <dl className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-4">{([
        ["Tipo", selecionada.tipo], ["Instituição", selecionada.instituicao], ["Identificação", selecionada.identificacao], ["Tipo bancário", selecionada.tipoBancario], ["Agência", selecionada.agencia], ["Número da conta", selecionada.numeroConta], ["Dígito", selecionada.digito], ["Titular", selecionada.titular], ["Local", selecionada.local], ["Responsável", selecionada.responsavel], ["Incluída no saldo geral", selecionada.ativo && selecionada.incluirNoSaldoGeral ? "Sim" : "Não"], ["Observações", selecionada.observacoes],
      ] as const).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-ink-3">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "—"}</dd></div>)}</dl>
      <ErrorBox erro={erroExtrato} />
      {carregandoExtrato ? <SkeletonListaFinanceira label="Carregando extrato" /> : erroExtrato ? <p className="p-5">Não foi possível carregar o extrato.</p> : extratoFiltrado.length ? <><Paginacao ocultarControlesPaginaUnica pagina={paginaAtualExtrato} totalPaginas={totalPaginasExtrato} total={extratoFiltrado.length} porPagina={15} rotulo="Paginação do extrato da conta" substantivo="movimentos" idSelect="pagina-extrato-conta" onPagina={setPaginaExtrato} /><TabelaFinanceira compacta barraRolagemSuperior rotulo={`Extrato de ${selecionada.nome}`} itens={extratoFiltrado.slice((paginaAtualExtrato - 1) * 15, paginaAtualExtrato * 15)} colunas={COLUNAS_EXTRATO} chaveDe={(m) => m.id} ancoraDe={m => `movimento-${m.id}`} classeLinha={(m) => `${window.location.hash === `#movimento-${m.id}` ? "bg-amber-50 ring-1 ring-inset ring-amber-300" : ""}`} /></> : <Empty>Nenhum movimento desta conta no período selecionado.</Empty>}
    </Panel>}

    {transferindo && <DialogFinanceiro titulo="Nova transferência" eyebrow="Entre contas próprias" onClose={fecharTransferencia}><form onSubmit={registrarTransferencia} className="p-5"><ErrorBox erro={erro} /><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Conta de origem<SelectCampo required disabled={registrandoTransferencia} value={origemId} onValueChange={(valor) => { setOrigemId(valor); if (valor === destinoId) setDestinoId(""); }} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.nome} · {brl(c.saldoAtual)}</option>)}</SelectCampo></label><label className="text-sm font-medium">Conta de destino<SelectCampo required disabled={registrandoTransferencia} value={destinoId} onValueChange={(valor) => setDestinoId(valor)} className="mt-1.5 w-full rounded-lg border border-border bg-white p-2.5 font-normal"><option value="">Selecione</option>{config.contas.filter((c) => c.ativo && String(c.id) !== origemId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelectCampo></label><label className="text-sm font-medium sm:col-span-2">Valor<Input required disabled={registrandoTransferencia} min="0.01" step="0.01" type="number" value={valor} onChange={(e) => setValor(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Data da transferência<Input disabled={registrandoTransferencia} required type="date" max={hoje()} value={dataTransferencia} onChange={e => setDataTransferencia(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal" /></label></div><div className="mt-5 rounded-lg bg-surface-2 p-4 text-sm text-ink-2"><strong>{transferenciaValida ? `Impacto no saldo geral: ${brl(impactoSaldoGeral)}` : "Selecione as contas e informe o valor para revisar o impacto."}</strong><p className="mt-1 text-xs">O valor sairá da origem e entrará no destino na mesma confirmação. Somente contas incluídas no saldo geral participam desse total.</p></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button secondary disabled={registrandoTransferencia} onClick={fecharTransferencia}>Cancelar</Button><Button type="submit" disabled={registrandoTransferencia || !transferenciaValida}>{registrandoTransferencia ? "Registrando…" : "Registrar transferência"}</Button></div></form></DialogFinanceiro>}
  </PaginaFinanceira>;
}
