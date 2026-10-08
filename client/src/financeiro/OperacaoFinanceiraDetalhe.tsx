import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FilePenLine, RotateCcw } from "lucide-react";
import { estornarOperacao, estornarTransacao, obterOperacao, type Compromisso, type Operacao, type TransacaoOperacao, type TransferenciaOperacao, type PontaTransferencia } from "./novo-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonOperacao } from "./CarregamentoFinanceiro";
import { brl, dataBR, ErrorBox, Modal, PaginaFinanceira, STATUS, TIPO_OPERACAO } from "./financeiro-ui";
import { tituloCompromisso } from "./lib/compromissos";
import { deCentavos, paraCentavos } from "./lib/parcelas";
import { HistoricoLiquidacoes, LinkConta } from "./HistoricoLiquidacoes";
import { codigoOperacao } from "../estoque/navegacao";
import { VinculosPecuaria } from "./VinculosPecuaria";
import { getPropriedadeAtiva } from "../propriedadeScope";
import { GerenciarProcedimentosServico, podeGerenciarProcedimentosServico } from "../pecuaria/rebanho/sanidade/GerenciarProcedimentosServico";
import { ProcedimentosAtendimento } from "./ProcedimentosAtendimento";

function StatusDetalhe({ status }: { status: string }) {
  const tom = ["CONFIRMADA", "LIQUIDADO", "CONCLUIDO"].includes(status) ? "entrada" : ["PENDENTE", "PARCIAL"].includes(status) ? "pendente" : status.includes("CANCEL") || status === "REVERTIDA" ? "alerta" : "neutro";
  return <Badge variant="secondary" data-fin-tom={tom} className="fin-selo">{STATUS[status] ?? status}</Badge>;
}

/** Saldo líquido (entrada − saída) do impacto de conta no cancelamento, em centavos — sem ponto flutuante. */
function impactoLiquido(impacto: { entrada: string; saida: string }) {
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
  return <section className="border-b border-border p-6"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Transferência de estoque</h2><div className="mt-4 space-y-6">{transferencias.map((t) => <div key={t.origem.id} className="space-y-3 break-words text-sm">
    <a className="font-semibold underline" href={`/estoque/produtos/${t.produtoId}`}>{t.produtoNome}</a>
    <p>{Number(t.quantidade).toLocaleString("pt-BR")} {t.unidade} transferidos</p><p>Motivo: {t.motivo ?? "Motivo não registrado"}</p>
    <div className="grid gap-4 sm:grid-cols-2">{ponta(t.origem, t.produtoId, t.unidade, "Origem")}{t.destino ? ponta(t.destino, t.produtoId, t.unidade, "Destino") : <p>Destino não identificado no histórico.</p>}</div>
  </div>)}</div></section>;
}

export function OperacaoFinanceiraDetalhe({ operacaoId, onVoltar, onAbrir, onCorrigir, podeLancar = true, rotuloVoltar = "Voltar para operações" }: { operacaoId: string; onVoltar: () => void; onAbrir: (id: string) => void; onCorrigir: (operacao: Operacao) => void; podeLancar?: boolean; rotuloVoltar?: string }) {
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

  if (!operacao) return <PaginaFinanceira colorida><button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2"><ArrowLeft size={17} /> {rotuloVoltar}</button>{erro ? <><ErrorBox erro={erro} /><Button variant="outline" onClick={() => { void carregar(); }}>Tentar novamente</Button></> : <SkeletonOperacao />}</PaginaFinanceira>;

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
    <button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={17} /> {rotuloVoltar}</button>
    <ErrorBox erro={erro} />
    {transferencia && <p className="mb-4 text-sm text-ink-3">Movimenta estoque entre sítios, conservando seu valor. Não gera pagamento nem nova despesa financeira.</p>}
    <Card data-fin-tom="info" className="fin-painel gap-0 overflow-hidden py-0">
      <div className="fin-cabecalho flex flex-wrap items-start justify-between gap-4 p-4"><div className="min-w-0 flex-[1_1_280px]"><div className="flex flex-wrap items-center gap-2"><span className="eyebrow">{codigoOperacao(operacao.numero)}</span><StatusDetalhe status={operacao.status} /></div><h1 className="mt-2 break-words font-serif text-xl leading-tight">{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</h1><p className="mt-2 break-words text-xs text-ink-3">{TIPO_OPERACAO[operacao.tipo]} · {dataBR(operacao.data)} · {operacao.parceiro?.nome ?? "Sem parceiro"}{operacao.centroCusto?.nome && <> · {algumItemComCentroProprio ? "Centro padrão" : "Centro"}: {operacao.centroCusto.nome}</>}</p>{operacao.corrigeOperacao && <button onClick={() => onAbrir(operacao.corrigeOperacao!.id)} className="mt-2 text-xs font-semibold text-green-800">Correção da {codigoOperacao(operacao.corrigeOperacao.numero)}</button>}{operacao.correcoes?.map((correcao) => <button key={correcao.id} onClick={() => onAbrir(correcao.id)} className="mt-2 block text-xs font-semibold text-green-800">Corrigida pela {codigoOperacao(correcao.numero)}</button>)}</div><div className="space-y-2 lg:text-right"><h2 className="text-xs font-semibold text-ink-3">{transferencia ? "Valor do estoque transferido" : perdas.length ? "Custo da perda" : "Valor da operação"}</h2>{operacao.valorTotal != null && <div data-fin-tom={operacao.tipo === "VENDA" || operacao.tipo === "APORTE" ? "entrada" : transferencia ? "info" : "saida"} className="fin-valor font-serif text-2xl tabular-nums">{brl(operacao.valorTotal)}</div>}<div className="flex flex-wrap gap-2 lg:justify-end">{podeLancar && operacao.status === "CONFIRMADA" && <Button variant="destructive" onClick={() => setCancelando(true)}><RotateCcw size={15} /> Cancelar operação</Button>}{podeLancar && operacao.status === "CANCELADA" && !perdas.length && !transferencia && !(operacao.correcoes?.length) && <Button onClick={() => onCorrigir(operacao)}><FilePenLine size={15} /> Criar correção</Button>}</div></div></div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border bg-surface-2 px-4 py-3 text-xs">
        <span className="min-w-0 break-words"><span className="text-ink-3">Categoria: </span><strong>{operacao.categoriaNome ?? "Sem categoria"}</strong></span>
        {operacao.classificacao && <Badge variant="outline">{operacao.classificacao === "INVESTIMENTO" ? "Investimento" : "Custeio"}</Badge>}
        <span><span className="text-ink-3">Transações financeiras</span> <strong>{operacao.transacoes.length}</strong></span>
        <span><span className="text-ink-3">Compromissos futuros</span> <strong>{operacao.compromissos.length}</strong></span>
        <span><span className="text-ink-3">{transferencia ? "Deslocamentos de estoque" : "Movimentos de estoque"}</span> <strong>{transferencia ? transferencias.length : operacao.movimentosEstoque.length}</strong></span>
      </div>
      {operacao.status === "CANCELADA" && perdas.length > 0 && <p className="px-4 pb-3 text-xs text-ink-3">Para lançar uma nova perda, abra <a className="font-semibold underline" href="/estoque">Estoque</a> e escolha Registrar perda.</p>}
      <p className="border-t border-border px-4 py-2 text-xs text-ink-3">{transferencia ? "O cancelamento preserva a transferência e gera movimentos inversos em cada sítio." : perdas.length ? "Baixa física do estoque. Não gera nova despesa financeira." : "Operações confirmadas são imutáveis. Correções preservam esta operação e geram um novo registro."}</p>
    </Card>
    <div className="mt-3 grid items-start gap-3 lg:grid-cols-2">
        {transferencia && <div className="lg:col-span-2">{transferencias.length ? <Transferencias transferencias={transferencias} /> : <p className="p-6 text-sm text-ink-3">Transferência sem movimentos originais identificados.</p>}</div>}
        {!transferencia && (perdas.length > 0 || operacao.itens.length > 0) && <Card className="min-w-0 gap-0 p-4 lg:col-span-2"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">{perdas.length ? "Perda de estoque" : "Itens"}</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{perdas.length ? perdas.map((perda) => <div key={perda.movimentoId} className="space-y-2 break-words text-sm">
          <a className="font-semibold underline" href={`/estoque/produtos/${perda.produtoId}`}>{perda.produtoNome}</a>
          <p>{Number(perda.quantidade).toLocaleString("pt-BR")} {perda.unidade} perdidos</p>
          <p>Sítio: {perda.sitio?.nome ?? "Sítio não registrado"}</p>
          <p>Motivo: {perda.motivo ?? "Motivo não registrado"}</p>
          {perda.lotes.length ? <ul className="space-y-2">{perda.lotes.map((lote, indice) => <li key={`${lote.id}-${indice}`} className="text-xs text-ink-3">Lote do produto: {lote.nome || lote.codigo} · {Number(lote.quantidade).toLocaleString("pt-BR")} {perda.unidade} · {lote.validade ? `Validade ${dataBR(lote.validade)}` : "Validade não informada"}</li>)}</ul> : <p className="text-xs text-ink-3">Sem lotes do produto vinculados.</p>}
        </div>) : operacao.itens.length ? operacao.itens.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><div className="min-w-0"><strong className="break-words">{item.descricao}</strong><div className="mt-1 break-words text-xs text-ink-3">{Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade} × {brl(item.valorUnitario)}</div><div className="mt-1 text-xs text-ink-3">{item.categoriaNome ?? "Sem categoria"} · {item.classificacao === "INVESTIMENTO" ? "Investimento" : item.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"} · {item.centroCustoNome ?? operacao.centroCusto?.nome ?? "Sem centro"}</div></div><strong className="shrink-0 whitespace-nowrap">{brl(item.valorTotal)}</strong></div>) : <p className="text-sm text-ink-3">Categoria: {operacao.categoriaNome ?? "Sem categoria"} · {operacao.classificacao === "INVESTIMENTO" ? "Investimento" : operacao.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"}</p>}</div></Card>}
      {operacao.compromissos.length > 0 && <Card data-fin-tom="pendente" className="fin-painel min-w-0 gap-0 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Compromissos</h2><p className="mt-1 text-xs text-ink-3">Parcelas geradas por esta operação.</p></div><strong className="text-sm">{operacao.compromissos.length}</strong></div><div className="mt-3 divide-y divide-border rounded-lg border border-border">{operacao.compromissos.map((compromisso) => <button type="button" key={compromisso.id} onClick={() => setCompromissoAberto(compromisso)} data-fin-tom={compromisso.status === "CANCELADO" ? "neutro" : compromisso.tipo === "RECEBER" ? "entrada" : "saida"} className="fin-linha grid w-full items-center gap-2 p-3 text-left hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"><div className="min-w-0"><strong className="break-words text-sm">{tituloCompromisso({ ...compromisso, operacao: { descricao: operacao.descricao, tipo: operacao.tipo } })}</strong><div className="mt-1 text-xs text-ink-3">Vence em {dataBR(compromisso.dataVencimento)}</div></div><StatusDetalhe status={compromisso.status} /><strong className="fin-valor whitespace-nowrap sm:text-right">{compromisso.status === "CANCELADO" ? "Cancelado" : brl(compromisso.saldoExigivel)}</strong></button>)}</div></Card>}
      {operacao.transacoes.length > 0 && <Card data-fin-tom="info" className="fin-painel min-w-0 gap-0 p-4"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Histórico financeiro</h2><p className="mt-1 text-xs text-ink-3">{podeLancar ? "Estorne um pagamento ou recebimento aqui para corrigir somente o dinheiro movimentado." : "Pagamentos, recebimentos e estornos vinculados a esta operação."}</p><div className="mt-3 divide-y divide-border rounded-lg border border-border">{operacao.transacoes.map(transacao => <div key={transacao.id} data-fin-tom={transacao.tipo === "REVERSAO" ? "info" : transacao.tipo === "RECEBIMENTO" ? "entrada" : "saida"} className="fin-linha flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><div><strong>{transacao.tipo === "PAGAMENTO" ? "Pagamento" : transacao.tipo === "RECEBIMENTO" ? "Recebimento" : transacao.tipo === "REVERSAO" ? "Estorno" : transacao.tipo.replaceAll("_", " ")} #{transacao.seq}</strong><div className="mt-1 text-xs text-ink-3">{dataBR(transacao.data ?? operacao.data)}{transacao.formaPagamento ? ` · ${transacao.formaPagamento.replaceAll("_", " ")}` : ""}</div>{transacao.movimentos.map(movimento => <p key={movimento.id} className="mt-1 text-xs text-ink-3">{movimento.direcao === "ENTRADA" ? "Entrada" : "Saída"} em <LinkConta contaId={movimento.contaId} movimentoId={movimento.id} nome={movimento.conta.nome} /></p>)}</div><StatusDetalhe status={transacao.status} /><strong className="fin-valor">{brl(transacao.valorTotal)}</strong>{podeLancar && operacao.status === "CONFIRMADA" && transacao.status === "CONFIRMADA" && ["PAGAMENTO", "RECEBIMENTO"].includes(transacao.tipo) && <Button variant="outline" disabled={salvando} onClick={() => { setErro(null); setMotivoEstorno(""); setEstornando(transacao); }}>Estornar {transacao.tipo === "PAGAMENTO" ? "pagamento" : "recebimento"} #{transacao.seq}</Button>}</div>)}</div></Card>}
      <Card data-fin-tom="info" className="fin-painel min-w-0 gap-0 p-4"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Documentos</h2><p className="mt-1 text-xs text-ink-3">Arquivos vinculados à origem da operação.</p></div><strong className="text-sm">{operacao.documentos.length}</strong></div>{operacao.documentos.length ? <div className="mt-3 grid gap-2 md:grid-cols-2">{operacao.documentos.map((documento) => <a key={documento.id} href={`/api/financeiro/documentos/${documento.id}/download`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-accent"><span className="min-w-0"><strong className="break-words">{documento.nome}</strong><span className="mt-0.5 block break-words text-xs text-ink-3">{documento.tipo.replaceAll("_", " ")}{documento.numero ? ` · ${documento.numero}` : ""}</span></span><Download size={16} className="shrink-0 text-ink-3" /></a>)}</div> : <p className="mt-3 text-sm text-ink-3">Nenhum documento anexado.</p>}</Card>
      {operacao.tipo === "SERVICO" && <Card data-fin-tom="info" className="fin-painel min-w-0 gap-0 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Procedimentos do atendimento</h2>{podeLancar && operacao.status === "CONFIRMADA" && operacao.propriedadeId && podeGerenciarProcedimentosServico() && <Button variant="outline" onClick={() => setGerenciandoProcedimentos(true)}>Gerenciar procedimentos</Button>}</div><ProcedimentosAtendimento itens={operacao.procedimentosServico ?? []} /></Card>}
      {operacao.tipo !== "SERVICO" && <VinculosPecuaria compacto operacaoId={operacao.id} />}
    </div>
    {gerenciandoProcedimentos && operacao.propriedadeId && <GerenciarProcedimentosServico key={operacao.id} servicoId={operacao.id} propriedadeId={operacao.propriedadeId} onFechar={() => setGerenciandoProcedimentos(false)} onSalvo={async () => { const dados = await obterOperacao(operacaoId); if (contexto === contextoOperacao.current) setOperacao(dados); }} />}
    {cancelando && <Modal colorida tom="alerta" titulo="Cancelar operação" eyebrow="Revisão obrigatória" onClose={() => { if (!salvando) setCancelando(false); }} width="max-w-2xl"><div className="p-6"><ErrorBox erro={erro} /><p className="text-sm leading-6 text-ink-3">A operação original será preservada e marcada como cancelada. O sistema executará os efeitos inversos em uma única transação.</p><div className="mt-5 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-950">{transferencia && transferenciasElegiveis.length > 0 && <p>• Reverter {transferenciasElegiveis.length} deslocamento{transferenciasElegiveis.length === 1 ? "" : "s"} de estoque.</p>}{!transferencia && quantidadeEstoque > 0 && <p>• Reverter {quantidadeEstoque} movimento{quantidadeEstoque === 1 ? "" : "s"} de estoque.</p>}{transacoesOriginais.length > 0 && <p>• Estornar {transacoesOriginais.length} transação{transacoesOriginais.length === 1 ? "" : "ões"} financeira{transacoesOriginais.length === 1 ? "" : "s"}, totalizando {brl(valorFinanceiro)}.</p>}{(resumoCancelamento?.compromissos.length ?? operacao.compromissos.length) > 0 && <p>• Cancelar {resumoCancelamento?.compromissos.length ?? operacao.compromissos.length} compromisso(s), com saldo exigível de {brl(valorCompromissos)}.</p>}<p>• Preservar documentos, operação original e histórico de auditoria.</p></div>{resumoCancelamento && <div className="mt-4 space-y-3 rounded-xl border border-border p-4 text-sm"><strong>Efeitos elegíveis para este cancelamento</strong>{resumoCancelamento.transacoes.map((transacao) => <div key={transacao.id} className="rounded-lg bg-surface-2 p-3"><p><strong>{transacao.tipo.replaceAll("_", " ")} · {brl(transacao.valorTotal)}</strong> · {dataBR(transacao.data)}</p>{transacao.movimentos.map((movimento) => <p key={movimento.id} className="mt-1 text-xs text-ink-3">{movimento.direcaoInversa === "ENTRADA" ? "Entrada" : "Saída"} inversa em <LinkConta contaId={movimento.contaId} movimentoId={movimento.id} nome={movimento.conta.nome} /> · {brl(movimento.valor)}</p>)}</div>)}{transferencia && <Transferencias transferencias={transferenciasElegiveis} />}{!transferencia && resumoCancelamento.estoque.map((movimento) => <p key={movimento.id} className="text-xs text-ink-3">Reverter {movimento.tipo === "ENTRADA" ? "entrada" : movimento.tipo === "SAIDA" ? "saída" : "ajuste"} de {Number(movimento.quantidade).toLocaleString("pt-BR")} {movimento.unidade} de {movimento.produtoNome}.</p>)}{resumoCancelamento.compromissos.map((compromisso) => <p key={compromisso.id}>Parcela {compromisso.numeroParcela ?? compromisso.id}: pago {brl(compromisso.valorLiquidado)}, saldo a cancelar {brl(compromisso.saldoExigivel)}.</p>)}{resumoCancelamento.impactosPorConta.map((impacto) => <p key={impacto.conta.id} className="text-xs text-ink-3">{impacto.conta.nome}: impacto no saldo {impactoLiquido(impacto).texto}</p>)}</div>}<ErrorBox erro={erro} /><label className="mt-5 block text-sm font-medium">Motivo do cancelamento *<textarea aria-label="Motivo do cancelamento" maxLength={300} disabled={salvando} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique por que esta operação precisa ser cancelada" className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-white p-3 font-normal" /></label><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={salvando} onClick={() => setCancelando(false)}>Manter operação</Button><Button variant="destructive" disabled={salvando || motivo.trim().length < 5} onClick={confirmarCancelamento}>{salvando ? "Cancelando…" : "Confirmar cancelamento"}</Button></div></div></Modal>}
    {compromissoAberto && <Modal colorida tom="pendente" titulo="Detalhe da parcela" eyebrow="Compromisso financeiro" onClose={() => setCompromissoAberto(null)} width="max-w-2xl"><div className="p-6"><HistoricoLiquidacoes compromisso={compromissoAberto} podeLancar={podeLancar} onEstornado={async () => { if (contexto !== contextoOperacao.current) return; await carregar(); if (contexto === contextoOperacao.current) setCompromissoAberto(null); }} /></div></Modal>}
    {estornando && <Modal colorida tom="alerta" titulo="Estornar transação" eyebrow="Revisão financeira" onClose={() => { if (!emCurso.current) setEstornando(null); }}><div className="p-6"><ErrorBox erro={erro} /><p className="text-sm leading-6">O valor de {brl(estornando.valorTotal)} será revertido na conta. A operação, os itens e o estoque serão preservados. Se esta transação liquidou uma parcela, o saldo pendente será recalculado. O pagamento original e o estorno ficam no histórico.</p><p className="mt-3 text-xs text-ink-3">O estorno será registrado na data de hoje, que precisa estar em um período aberto.</p><label className="mt-5 block text-sm font-medium">Motivo do estorno<textarea disabled={salvando} maxLength={300} value={motivoEstorno} onChange={e => setMotivoEstorno(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-lg border border-border p-3 font-normal" /></label><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={salvando} onClick={() => setEstornando(null)}>Manter transação</Button><Button variant="destructive" disabled={salvando || motivoEstorno.trim().length < 5} onClick={() => { void confirmarEstorno(); }}>{salvando ? "Estornando…" : "Confirmar estorno"}</Button></div></div></Modal>}
  </PaginaFinanceira>;
}
