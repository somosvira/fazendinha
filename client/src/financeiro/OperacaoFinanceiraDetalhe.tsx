import { AjudaCampo } from "@/components/Dica";
import "./operacao-detalhe.css";
import { PageHeader, TabelaFinanceira } from "./financeiro-ui";
import { podeVerValoresFinanceiros } from "./permissoes";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpDown, ChevronRight, CalendarDays, Tag, Building2, Layers, CircleAlert, Download, FilePenLine, FileText, LoaderCircle, Package, Stethoscope } from "lucide-react";
import { estornarOperacao, estornarTransacao, obterOperacao, type Compromisso, type Operacao, type TransacaoOperacao, type TransferenciaOperacao, type PontaTransferencia } from "./novo-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonOperacao } from "./CarregamentoFinanceiro";
import { DialogFinanceiro as Modal } from "./DialogFinanceiro";
import { Textarea } from "@/components/ui/textarea";
import { brl, dataBR, ErrorBox, PaginaFinanceira, STATUS, TIPO_OPERACAO } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { deCentavos, paraCentavos } from "./lib/parcelas";
import { HistoricoLiquidacoes, LinkConta } from "./HistoricoLiquidacoes";
import { codigoOperacao } from "../estoque/navegacao";
import { VinculosPecuaria } from "./VinculosPecuaria";
import { navegarPara } from "../router";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { GerenciarProcedimentosServico, podeGerenciarProcedimentosServico } from "../pecuaria/rebanho/sanidade/GerenciarProcedimentosServico";
import { ProcedimentosAtendimento } from "./ProcedimentosAtendimento";

function StatusDetalhe({ status }: { status: string }) {
  const tom = ["CONFIRMADA", "LIQUIDADO", "CONCLUIDO"].includes(status) ? "entrada" : ["PENDENTE", "PARCIAL"].includes(status) ? "pendente" : status.includes("CANCEL") || status === "REVERTIDA" ? "alerta" : "neutro";
  return <Badge variant="secondary" data-fin-tom={tom} className="fin-selo">{STATUS[status] ?? status}</Badge>;
}

/** Saldo líquido (entrada − saída) do impacto de conta no cancelamento, em centavos — sem ponto flutuante. */
function impactoLiquido(impacto: { entrada: string | null; saida: string | null }) {
  if (impacto.entrada == null || impacto.saida == null) return { centavos: 0, texto: "Valor restrito" };
  const centavos = (paraCentavos(impacto.entrada) ?? 0) - (paraCentavos(impacto.saida) ?? 0);
  return { centavos, texto: `${centavos > 0 ? "+" : centavos < 0 ? "−" : ""}${brl(deCentavos(Math.abs(centavos)))}` };
}

function Transferencias({ transferencias }: { transferencias: TransferenciaOperacao[] }) {
  const sitioAtivo = getPropriedadeAtiva();
  function ponta(p: PontaTransferencia, produtoId: string, unidade: string, rotulo: string) {
    const link = (id: string) => `/estoque?movimentoId=${id}${p.sitio ? `&propriedadeId=${p.sitio.id}` : ""}`;
    return <div className="space-y-2">
      <p>{rotulo}: {p.sitio?.nome ?? "Sítio não registrado"}</p>
      {sitioAtivo != null && p.sitio && p.sitio.id !== sitioAtivo && <p className="text-xs text-ink-3">Para abrir estas movimentações, selecione o sítio {p.sitio.nome} ou a visão consolidada.</p>}
      <a className="text-xs font-semibold underline" href={link(p.id)}>{p.tipo === "SAIDA" ? "Saída" : "Entrada"} #{p.seq} · {p.status === "REVERTIDO" ? "Revertida" : "Confirmada"}</a>
      {p.reversao && <p className="text-xs"><a className="font-semibold underline" href={link(p.reversao.id)}>Reversão #{p.reversao.seq} da movimentação #{p.seq}</a> · {dataBR(p.reversao.data)}</p>}
      {p.lotes.length ? <ul className="space-y-2">{p.lotes.map((lote) => <li key={lote.partidaId} className="text-xs text-ink-3"><a className="underline" href={`/estoque/produtos/${produtoId}`}>Lote do produto: {lote.nome || lote.codigo}</a> · {Number(lote.quantidade).toLocaleString("pt-BR")} {unidade} · {lote.validade ? `Validade ${dataBR(lote.validade)}` : "Validade não informada"}</li>)}</ul> : <p className="text-xs text-ink-3">Sem lotes do produto vinculados.</p>}
    </div>;
  }
  return <section className="fin-operacao-secao"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><Package aria-hidden /></span>Transferência de estoque</h2><div className="mt-4 space-y-6">{transferencias.map((t) => <div key={t.origem.id} className="space-y-3 break-words text-sm">
    <a className="font-semibold underline" href={`/estoque/produtos/${t.produtoId}`}>{t.produtoNome}</a>
    <p>{Number(t.quantidade).toLocaleString("pt-BR")} {t.unidade} transferidos</p><p>Motivo: {t.motivo ?? "Motivo não registrado"}</p>
    <div className="grid gap-4 sm:grid-cols-2">{ponta(t.origem, t.produtoId, t.unidade, "Origem")}{t.destino ? ponta(t.destino, t.produtoId, t.unidade, "Destino") : <p>Destino não identificado no histórico.</p>}</div>
  </div>)}</div></section>;
}

export function OperacaoFinanceiraDetalhe({ operacaoId, onVoltar, onAbrir, onCorrigir, podeLancar: permiteLancar = true, rotuloVoltar = "Voltar para operações", urlVoltar = "/financeiro/operacoes" }: { operacaoId: string; onVoltar: () => void; onAbrir: (id: string) => void; onCorrigir: (operacao: Operacao) => void; podeLancar?: boolean; rotuloVoltar?: string; urlVoltar?: string }) {
  const podeLancar = permiteLancar && podeVerValoresFinanceiros();
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estornando, setEstornando] = useState<TransacaoOperacao | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState("");
  const emCurso = useRef(false);
  const [salvando, setSalvando] = useState(false);
  const [compromissoAberto, setCompromissoAberto] = useState<Compromisso | null>(null);
  const [gerenciandoProcedimentos, setGerenciandoProcedimentos] = useState(false);
  const contextoOperacao = useRef({ id: operacaoId });
  if (contextoOperacao.current.id !== operacaoId) contextoOperacao.current = { id: operacaoId };
  const contexto = contextoOperacao.current;
  const leitura = useRef(0);
  const carregar = useCallback(async () => {
    if (contexto !== contextoOperacao.current) return;
    const atual = ++leitura.current;
    try { setErro(null); const dados = await obterOperacao(operacaoId); if (atual === leitura.current && contexto === contextoOperacao.current) setOperacao(dados); }
    catch (e) { if (atual === leitura.current && contexto === contextoOperacao.current) setErro(e instanceof Error ? e.message : String(e)); }
  }, [operacaoId]);
  useEffect(() => {
    setOperacao(null); setCancelando(false); setEstornando(null); setCompromissoAberto(null); setGerenciandoProcedimentos(false);
    emCurso.current = false; setSalvando(false);
    void carregar(); return () => { leitura.current++; };
  }, [carregar]);

  const breadcrumb = <nav aria-label="Navegação estrutural" className="fin-breadcrumb mb-4"><ol className="flex flex-wrap items-center gap-2 text-sm"><li><a href="/financeiro" onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); navegarPara("/financeiro"); } }}>Financeiro</a></li><li aria-hidden><ChevronRight size={14} /></li><li><a href={urlVoltar} onClick={(e) => { if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onVoltar(); } }}>{rotuloVoltar.replace(/^Voltar (para |ao |à )/, "").replace(/^./, (letra) => letra.toUpperCase())}</a></li><li aria-hidden><ChevronRight size={14} /></li><li aria-current="page">{operacao ? codigoOperacao(operacao.numero) : "Detalhe da operação"}</li></ol></nav>;

  if (!operacao) return <PaginaFinanceira colorida>{breadcrumb}{erro ? <><ErrorBox erro={erro} /><Button variant="outline" onClick={() => { void carregar(); }}>Tentar novamente</Button></> : <SkeletonOperacao />}</PaginaFinanceira>;

  const resumoCancelamento = operacao.resumoCancelamento;
  const transacoesOriginais = resumoCancelamento ? resumoCancelamento.transacoes : operacao.transacoes.filter((item) => item.tipo !== "REVERSAO" && item.status === "CONFIRMADA");
  const valorFinanceiro = transacoesOriginais.reduce((soma, item) => soma + Number(item.valorTotal), 0);
  const valorCompromissos = resumoCancelamento ? resumoCancelamento.compromissos.reduce((soma, item) => soma + Number(item.saldoExigivel), 0) : operacao.compromissos.reduce((soma, item) => soma + Number(item.saldoExigivel ?? item.saldoPendente), 0);
  const quantidadeEstoque = resumoCancelamento ? resumoCancelamento.estoque.length : operacao.movimentosEstoque.filter((item) => item.status === "CONFIRMADO" && item.reversaoDeId == null && !item.revertidoPor).length;
  const algumItemComCentroProprio = operacao.itens.some((item) => item.centroCustoId);
  const perdas = operacao.perdas ?? [];
  const transferencias = operacao.transferencias ?? [];
  const transferencia = operacao.tipo === "TRANSFERENCIA_ESTOQUE";
  const transferenciasElegiveis = transferencias.filter((t) => [t.origem, t.destino].some((p) => p && p.status === "CONFIRMADO" && !p.reversao));

  const confirmarCancelamento = async () => {
    if (emCurso.current || motivo.trim().length < 5) return;
    emCurso.current = true; setSalvando(true); setErro(null);
    try {
      await estornarOperacao(operacao.id, motivo.trim());
      if (contexto !== contextoOperacao.current) return;
      setCancelando(false); setMotivo(""); await carregar();
    }
    catch (e) { if (contexto === contextoOperacao.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (contexto === contextoOperacao.current) { emCurso.current = false; setSalvando(false); } }
  };

  const confirmarEstorno = async () => {
    if (!estornando || motivoEstorno.trim().length < 5 || emCurso.current) return;
    emCurso.current = true; setSalvando(true); setErro(null);
    try {
      await estornarTransacao(estornando.id, motivoEstorno.trim());
      if (contexto !== contextoOperacao.current) return;
      setEstornando(null); setMotivoEstorno(""); await carregar();
    } catch (e) { if (contexto === contextoOperacao.current) setErro(e instanceof Error ? e.message : String(e)); }
    finally { if (contexto === contextoOperacao.current) { emCurso.current = false; setSalvando(false); } }
  };

  return <PaginaFinanceira colorida>
    {breadcrumb}
    <ErrorBox erro={erro} />

    <div className="fin-ficha-operacao">
      <PageHeader titulo={operacao.descricao || TIPO_OPERACAO[operacao.tipo]} contexto={<div className="fin-ficha-identificacao"><span>{codigoOperacao(operacao.numero)}</span><StatusDetalhe status={operacao.status} /><time dateTime={operacao.data} className="fin-operacao-data"><CalendarDays size={15} aria-hidden /><span className="sr-only">Data da operação: </span>{dataBR(operacao.data)}</time></div>} acao={<>
        {podeLancar && operacao.status === "CONFIRMADA" && <Button variant="outline" className="fin-ficha-cancelar" onClick={() => setCancelando(true)}><CircleAlert size={16} aria-hidden />Cancelar operação</Button>}
        {podeLancar && operacao.status === "CANCELADA" && !perdas.length && !transferencia && !(operacao.correcoes?.length) && <Button onClick={() => onCorrigir(operacao)}><FilePenLine size={15} />Criar correção</Button>}
      </>}>
        {operacao.corrigeOperacao && <Button variant="ghost" onClick={() => onAbrir(operacao.corrigeOperacao!.id)} className="mt-2 h-auto whitespace-normal p-0 text-xs font-semibold text-primary">Correção da {codigoOperacao(operacao.corrigeOperacao.numero)}</Button>}
        {operacao.correcoes?.map(correcao => <Button variant="ghost" key={correcao.id} onClick={() => onAbrir(correcao.id)} className="mt-2 h-auto whitespace-normal p-0 block text-xs font-semibold text-primary">Corrigida pela {codigoOperacao(correcao.numero)}</Button>)}
      </PageHeader>
      <div className="fin-ficha-resumo">
        <dl className="fin-ficha-metadados">
          <div><dt>Tipo de operação</dt><dd><Package size={18} aria-hidden />{TIPO_OPERACAO[operacao.tipo]}</dd></div>
          <div><dt>Parceiro</dt><dd><Building2 size={18} aria-hidden />{operacao.parceiro ? <a href={`/financeiro/configuracoes?${new URLSearchParams({ aba: "parceiros", parceiro: operacao.parceiro.id })}`}>{operacao.parceiro.nome}<ChevronRight size={16} aria-hidden /></a> : "Sem parceiro"}</dd></div>
          {operacao.centroCusto?.nome && <div><dt>{algumItemComCentroProprio ? "Centro padrão" : "Centro de custo"}</dt><dd><Layers size={18} aria-hidden />{operacao.centroCusto.nome}</dd></div>}
          <div><dt>Categoria</dt><dd><Tag size={18} aria-hidden />{operacao.categoriaNome ?? "Sem categoria"}</dd></div>
          {operacao.classificacao && <div><dt>Classificação</dt><dd>{operacao.classificacao === "INVESTIMENTO" ? "Investimento" : "Custeio"}</dd></div>}
        </dl>
        <div className="fin-ficha-total"><h2>{transferencia ? "Valor do estoque transferido" : perdas.length ? "Custo da perda" : "Valor da operação"}{transferencia && <AjudaCampo rotulo="Ajuda: transferência de estoque" texto="Movimenta estoque entre sítios, conservando seu valor. Não gera pagamento nem nova despesa financeira." />}{perdas.length > 0 && <AjudaCampo rotulo="Ajuda: custo da perda" texto="Baixa física do estoque. Não gera nova despesa financeira." />}</h2><strong>{brl(operacao.valorTotal)}</strong></div>
      </div>
      {!podeVerValoresFinanceiros() && <p role="status" className="px-5 pb-4 text-sm text-muted-foreground">Valores financeiros ocultos pelo seu perfil. Quantidades, vínculos e histórico operacional continuam disponíveis.</p>}
      {operacao.status === "CANCELADA" && perdas.length > 0 && <p className="px-4 pb-3 text-xs text-ink-3">Para lançar uma nova perda, abra <a className="font-semibold underline" href="/estoque">Estoque</a> e escolha Registrar perda.</p>}

    <div className="fin-ficha-grid">
        {transferencia && <div id="estoque-operacao" tabIndex={-1} className="lg:col-span-2">{transferencias.length ? <Transferencias transferencias={transferencias} /> : <p className="p-6 text-sm text-ink-3">Transferência sem movimentos originais identificados.</p>}</div>}
        {!transferencia && (perdas.length > 0 || operacao.itens.length > 0) && <section className="fin-operacao-secao fin-ficha-itens min-w-0"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><Package aria-hidden /></span>{perdas.length ? "Perda de estoque" : "Itens da operação"}<span className="fin-ficha-contagem" aria-hidden>{perdas.length || operacao.itens.length} {(perdas.length || operacao.itens.length) === 1 ? "item" : "itens"}</span></h2><div className="fin-operacao-itens mt-3 grid gap-3">{perdas.length ? perdas.map((perda) => <div key={perda.movimentoId} className="space-y-2 break-words text-sm">
          <a className="font-semibold underline" href={`/estoque/produtos/${perda.produtoId}`}>{perda.produtoNome}</a>
          <p>{Number(perda.quantidade).toLocaleString("pt-BR")} {perda.unidade} perdidos</p>
          <p>Sítio: {perda.sitio?.nome ?? "Sítio não registrado"}</p>
          <p>Motivo: {perda.motivo ?? "Motivo não registrado"}</p>
          {perda.lotes.length ? <ul className="space-y-2">{perda.lotes.map((lote, indice) => <li key={`${lote.id}-${indice}`} className="text-xs text-ink-3">Lote do produto: {lote.nome || lote.codigo} · {Number(lote.quantidade).toLocaleString("pt-BR")} {perda.unidade} · {lote.validade ? `Validade ${dataBR(lote.validade)}` : "Validade não informada"}</li>)}</ul> : <p className="text-xs text-ink-3">Sem lotes do produto vinculados.</p>}
        </div>) : operacao.itens.length ? <>
          <TabelaFinanceira rotulo="Itens da operação" itens={operacao.itens} chaveDe={item => item.id} colunas={[
            { chave: "produto", titulo: "Produto", principal: true, larguraMinima: 240, larguraFlexivel: true, celula: item => <div><strong>{item.descricao}</strong><p className="fin-ficha-item-classificacao">{item.categoriaNome ?? "Sem categoria"} · {item.classificacao === "INVESTIMENTO" ? "Investimento" : item.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"} · {item.centroCustoNome ?? operacao.centroCusto?.nome ?? "Sem centro"}</p></div> },
            { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", larguraMinima: 110, celula: item => `${Number(item.quantidade).toLocaleString("pt-BR")} ${item.unidade}` },
            { chave: "unitario", titulo: "Valor unitário", alinhamento: "direita", larguraMinima: 130, celula: item => brl(item.valorUnitario) },
            { chave: "total", titulo: "Total", alinhamento: "direita", larguraMinima: 120, celula: item => <strong>{brl(item.valorTotal)}</strong> },
          ]} />
          <div className="fin-ficha-total-itens"><strong>Total dos itens</strong><strong>{brl(operacao.itens.every(item => item.valorTotal != null) ? deCentavos(operacao.itens.reduce((total, item) => total + (paraCentavos(item.valorTotal) ?? 0), 0)) : null)}</strong></div>
        </> : <p className="text-sm text-ink-3">Categoria: {operacao.categoriaNome ?? "Sem categoria"} · {operacao.classificacao === "INVESTIMENTO" ? "Investimento" : operacao.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"}</p>}</div></section>}
      {operacao.compromissos.length > 0 && <section id="compromissos-operacao" tabIndex={-1} className="fin-operacao-secao fin-ficha-compromissos min-w-0"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><CalendarDays aria-hidden /></span>Compromissos<span className="fin-ficha-contagem" aria-hidden>{operacao.compromissos.length}</span></h2>
        <div className="fin-ficha-parcelas">{operacao.compromissos.map(compromisso => <button type="button" key={compromisso.id} className="fin-ficha-parcela" data-situacao={compromisso.status} data-tipo={compromisso.tipo} onClick={() => setCompromissoAberto(compromisso)}>
          <span className="fin-ficha-parcela-resumo"><span><span className="fin-ficha-parcela-tipo">{compromisso.tipo === "RECEBER" ? "A receber" : "A pagar"}</span><strong className="fin-ficha-parcela-valor">{compromisso.status === "CANCELADO" ? "Cancelado" : brl(compromisso.saldoExigivel)}</strong></span><StatusDetalhe status={compromisso.status} /></span>
          <span className="fin-ficha-parcela-campo"><span>Vencimento</span><strong><CalendarDays size={16} aria-hidden />{dataBR(compromisso.dataVencimento)}</strong></span>
          <span className="fin-ficha-parcela-campo"><span>Descrição do compromisso</span><strong>{tituloCompromisso({ ...compromisso, operacao: { descricao: operacao.descricao, tipo: operacao.tipo } })}</strong></span>
          <span className="fin-ficha-parcela-acao">Ver compromisso<ArrowRight size={16} aria-hidden /></span>
        </button>)}</div>
      </section>}

      {!transferencia && operacao.movimentosEstoque.length > 0 && <section id="estoque-operacao" tabIndex={-1} className="fin-operacao-secao fin-ficha-estoque"><h2 className="flex items-center gap-3 text-base font-semibold"><span className="fin-section-icon"><Package aria-hidden /></span>Movimentos de estoque<span className="fin-ficha-contagem" aria-hidden>{operacao.movimentosEstoque.length}</span></h2>
        <div className="fin-ficha-movimentos">{operacao.movimentosEstoque.map(m => {
          const item = operacao.itens.find(i => i.produtoId === m.produtoId);
          return <a key={m.id} href={`/estoque?movimentoId=${m.id}`} className="fin-ficha-movimento"><Package size={22} aria-hidden /><span className="fin-ficha-movimento-produto"><strong>{m.tipo === "ENTRADA" ? "Entrada" : m.tipo === "SAIDA" ? "Saída" : "Ajuste"} #{m.seq}</strong><span>{Number(m.quantidade).toLocaleString("pt-BR")}{item ? ` ${item.unidade} · ${item.descricao}` : ""}</span></span><Badge variant="secondary" data-fin-tom={m.status === "CONFIRMADO" ? "entrada" : "neutro"} className="fin-selo">{m.status === "CONFIRMADO" ? "Confirmado" : m.status === "REVERTIDO" ? "Revertido" : m.status}</Badge><span className="fin-ficha-movimento-acao">Ver movimento<ArrowRight size={16} aria-hidden /></span></a>;
        })}</div>
      </section>}

      {operacao.transacoes.length > 0 && <section data-fin-tom="info" className="fin-operacao-secao min-w-0"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><ArrowUpDown aria-hidden /></span>Histórico financeiro</h2><p className="mt-1 text-xs text-ink-3">{podeLancar ? "Estorne um pagamento ou recebimento aqui para corrigir somente o dinheiro movimentado." : "Pagamentos, recebimentos e estornos vinculados a esta operação."}</p><div className="mt-3 divide-y divide-border rounded-lg border border-border">{operacao.transacoes.map(transacao => <div key={transacao.id} data-fin-tom={transacao.tipo === "REVERSAO" ? "info" : transacao.tipo === "RECEBIMENTO" ? "entrada" : "saida"} className="fin-linha flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div><strong>{transacao.tipo === "PAGAMENTO" ? "Pagamento" : transacao.tipo === "RECEBIMENTO" ? "Recebimento" : transacao.tipo === "REVERSAO" ? "Estorno" : transacao.tipo.replaceAll("_", " ")} #{transacao.seq}</strong><div className="mt-1 text-xs text-ink-3">{dataBR(transacao.data ?? operacao.data)}{transacao.formaPagamento ? ` · ${transacao.formaPagamento.replaceAll("_", " ")}` : ""}</div>{transacao.movimentos.map(movimento => <p key={movimento.id} className="mt-1 text-xs text-ink-3">{movimento.direcao === "ENTRADA" ? "Entrada" : "Saída"} em <LinkConta contaId={movimento.contaId} movimentoId={movimento.id} nome={movimento.conta.nome} /></p>)}</div><StatusDetalhe status={transacao.status} /><strong className="fin-valor">{brl(transacao.valorTotal)}</strong>{podeLancar && operacao.status === "CONFIRMADA" && transacao.status === "CONFIRMADA" && ["PAGAMENTO", "RECEBIMENTO"].includes(transacao.tipo) && <Button variant="outline" disabled={salvando} onClick={() => { setErro(null); setMotivoEstorno(""); setEstornando(transacao); }}>Estornar {transacao.tipo === "PAGAMENTO" ? "pagamento" : "recebimento"} #{transacao.seq}</Button>}</div>)}</div></section>}
      {operacao.documentos.length > 0 && <section data-fin-tom="info" className={`fin-operacao-secao min-w-0 ${operacao.documentos.length ? "" : "fin-operacao-documentos-vazios"}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><FileText aria-hidden /></span>Documentos</h2></div><strong className="text-sm">{operacao.documentos.length}</strong></div>{operacao.documentos.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{operacao.documentos.map((documento) => <a key={documento.id} href={`/api/financeiro/documentos/${documento.id}/download`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"><span className="min-w-0"><strong className="break-words">{documento.nome}</strong><span className="mt-0.5 block break-words text-xs text-ink-3">{documento.tipo.replaceAll("_", " ")}{documento.numero ? ` · ${documento.numero}` : ""}</span></span><Download aria-hidden size={16} className="shrink-0 text-ink-3" /></a>)}</div> : <p className="mt-3 text-sm text-ink-3">Nenhum documento anexado.</p>}</section>}
      {operacao.tipo === "SERVICO" && <section data-fin-tom="info" className="fin-operacao-secao min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-3 text-base font-semibold text-ink"><span className="fin-section-icon"><Stethoscope aria-hidden /></span>Procedimentos do atendimento</h2>{podeLancar && operacao.status === "CONFIRMADA" && operacao.propriedadeId && podeGerenciarProcedimentosServico() && <Button variant="outline" onClick={() => setGerenciandoProcedimentos(true)}>Gerenciar procedimentos</Button>}</div><ProcedimentosAtendimento itens={operacao.procedimentosServico ?? []} /></section>}
      {operacao.tipo !== "SERVICO" && <VinculosPecuaria operacaoId={operacao.id} />}
    </div>
    </div>
    {gerenciandoProcedimentos && operacao.propriedadeId && <GerenciarProcedimentosServico key={operacao.id} servicoId={operacao.id} propriedadeId={operacao.propriedadeId} onFechar={() => setGerenciandoProcedimentos(false)} onSalvo={async () => { const dados = await obterOperacao(operacaoId); if (contexto === contextoOperacao.current) setOperacao(dados); }} />}
    {cancelando && <Modal icon={CircleAlert} tom="alerta" titulo="Cancelar operação" eyebrow="Revisão obrigatória" onClose={() => { if (!salvando) setCancelando(false); }} className="sm:max-w-2xl"><div className="p-6"><ErrorBox erro={erro} /><p className="text-sm leading-6 text-ink-3">A operação original será preservada e marcada como cancelada. O sistema executará os efeitos inversos em uma única transação.</p><div className="mt-5 space-y-2 rounded-xl border border-destructive/25 bg-[var(--fin-danger-bg)] p-4 text-sm text-destructive">{transferencia && transferenciasElegiveis.length > 0 && <p>• Reverter {transferenciasElegiveis.length} deslocamento{transferenciasElegiveis.length === 1 ? "" : "s"} de estoque.</p>}{!transferencia && quantidadeEstoque > 0 && <p>• Reverter {quantidadeEstoque} movimento{quantidadeEstoque === 1 ? "" : "s"} de estoque.</p>}{transacoesOriginais.length > 0 && <p>• Estornar {transacoesOriginais.length} transação{transacoesOriginais.length === 1 ? "" : "ões"} financeira{transacoesOriginais.length === 1 ? "" : "s"}, totalizando {brl(valorFinanceiro)}.</p>}{(resumoCancelamento?.compromissos.length ?? operacao.compromissos.length) > 0 && <p>• Cancelar {resumoCancelamento?.compromissos.length ?? operacao.compromissos.length} compromisso(s), com saldo exigível de {brl(valorCompromissos)}.</p>}<p>• Preservar documentos, operação original e histórico de auditoria.</p></div>{resumoCancelamento && <div className="mt-4 space-y-3 rounded-xl border border-border p-4 text-sm"><strong>Efeitos elegíveis para este cancelamento</strong>{resumoCancelamento.transacoes.map((transacao) => <div key={transacao.id} className="rounded-lg bg-surface-2 p-3"><p><strong>{transacao.tipo.replaceAll("_", " ")} · {brl(transacao.valorTotal)}</strong> · {dataBR(transacao.data)}</p>{transacao.movimentos.map((movimento) => <p key={movimento.id} className="mt-1 text-xs text-ink-3">{movimento.direcaoInversa === "ENTRADA" ? "Entrada" : "Saída"} inversa em <LinkConta contaId={movimento.contaId} movimentoId={movimento.id} nome={movimento.conta.nome} /> · {brl(movimento.valor)}</p>)}</div>)}{transferencia && <Transferencias transferencias={transferenciasElegiveis} />}{!transferencia && resumoCancelamento.estoque.map((movimento) => <p key={movimento.id} className="text-xs text-ink-3">Reverter {movimento.tipo === "ENTRADA" ? "entrada" : movimento.tipo === "SAIDA" ? "saída" : "ajuste"} de {Number(movimento.quantidade).toLocaleString("pt-BR")} {movimento.unidade} de {movimento.produtoNome}.</p>)}{resumoCancelamento.compromissos.map((compromisso) => <p key={compromisso.id}>Parcela {compromisso.numeroParcela ?? compromisso.id}: pago {brl(compromisso.valorLiquidado)}, saldo a cancelar {brl(compromisso.saldoExigivel)}.</p>)}{resumoCancelamento.impactosPorConta.map((impacto) => <p key={impacto.conta.id} className="text-xs text-ink-3">{impacto.conta.nome}: impacto no saldo {impactoLiquido(impacto).texto}</p>)}</div>}<ErrorBox erro={erro} /><label className="mt-5 block text-sm font-medium">Motivo do cancelamento *<Textarea aria-label="Motivo do cancelamento" maxLength={300} disabled={salvando} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique por que esta operação precisa ser cancelada" className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-white p-3 font-normal" /></label><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={salvando} onClick={() => setCancelando(false)}>Manter operação</Button><Button variant="destructive" disabled={salvando || motivo.trim().length < 5} onClick={confirmarCancelamento} aria-busy={salvando || undefined}>{salvando && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{salvando ? "Cancelando…" : "Confirmar cancelamento"}</Button></div></div></Modal>}
    {compromissoAberto && <Modal tom="pendente" titulo="Detalhe da parcela" eyebrow="Compromisso financeiro" onClose={() => setCompromissoAberto(null)} className="sm:max-w-2xl"><div className="p-6"><HistoricoLiquidacoes compromisso={compromissoAberto} podeLancar={podeLancar} onEstornado={async () => { if (contexto !== contextoOperacao.current) return; await carregar(); if (contexto === contextoOperacao.current) setCompromissoAberto(null); }} /></div></Modal>}
    {estornando && <Modal icon={CircleAlert} tom="alerta" titulo="Estornar transação" eyebrow="Revisão financeira" onClose={() => { if (!emCurso.current) setEstornando(null); }}><div className="p-6"><ErrorBox erro={erro} /><p className="text-sm leading-6">O valor de {brl(estornando.valorTotal)} será revertido na conta. A operação, os itens e o estoque serão preservados. Se esta transação liquidou uma parcela, o saldo pendente será recalculado. O pagamento original e o estorno ficam no histórico.</p><p className="mt-3 text-xs text-ink-3">O estorno será registrado na data de hoje, que precisa estar em um período aberto.</p><label className="mt-5 block text-sm font-medium">Motivo do estorno<Textarea disabled={salvando} maxLength={300} value={motivoEstorno} onChange={e => setMotivoEstorno(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-border p-3 font-normal" /></label><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={salvando} onClick={() => setEstornando(null)}>Manter transação</Button><Button variant="destructive" disabled={salvando || motivoEstorno.trim().length < 5} onClick={() => { void confirmarEstorno(); }} aria-busy={salvando || undefined}>{salvando && <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />}{salvando ? "Estornando…" : "Confirmar estorno"}</Button></div></div></Modal>}
  </PaginaFinanceira>;
}
