import { useState } from "react";
import { ArrowLeft, Download, FilePenLine, RotateCcw } from "lucide-react";
import { estornarOperacao, useOperacaoFinanceira, type Operacao } from "./novo-api";
import { Loader } from "../components/Loading";
import { brl, Button, dataBR, ErrorBox, Modal, PaginaFinanceira, Panel, StatusPill, TIPO_OPERACAO } from "./financeiro-ui";

export function OperacaoFinanceiraDetalhe({ operacaoId, onVoltar, onAbrir, onCorrigir }: { operacaoId: number; onVoltar: () => void; onAbrir: (id: number) => void; onCorrigir: (operacao: Operacao) => void }) {
  const operacaoQuery = useOperacaoFinanceira(operacaoId);
  const operacao = operacaoQuery.data ?? null;
  const [erroEstorno, setErroEstorno] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const erro = erroEstorno ?? (operacaoQuery.error ? (operacaoQuery.error instanceof Error ? operacaoQuery.error.message : String(operacaoQuery.error)) : null);

  // `.pagina-carregando` mede exatamente uma viewport e o loader toma a sobra —
  // com PaginaFinanceira o botão e o padding somariam por fora dos 100dvh.
  if (!operacao) return <div className="shell-wide pagina-carregando"><button onClick={onVoltar} className="mt-6 mb-5 inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-ink-2"><ArrowLeft size={17} /> Voltar para operações</button><ErrorBox erro={erro} />{!erro && <Loader label="Carregando operação" full />}</div>;

  const transacoesOriginais = operacao.transacoes.filter((item) => item.tipo !== "REVERSAO");
  const valorFinanceiro = transacoesOriginais.reduce((soma, item) => soma + Number(item.valorTotal), 0);
  const valorCompromissos = operacao.compromissos.reduce((soma, item) => soma + Number(item.saldoPendente), 0);
  const quantidadeEstoque = operacao.movimentosEstoque.filter((item) => !["REVERTIDO", "CANCELADO"].includes(item.status)).length;

  const confirmarCancelamento = async () => {
    setSalvando(true); setErroEstorno(null);
    // Esta tela só abre com id real (nunca navegável a partir de uma operação
    // ainda otimista — ver guard em OperacoesFinanceiras.tsx).
    try { await estornarOperacao(operacao.id as number, motivo.trim()); setCancelando(false); setMotivo(""); await operacaoQuery.refetch(); }
    catch (e) { setErroEstorno(e instanceof Error ? e.message : String(e)); }
    finally { setSalvando(false); }
  };

  return <PaginaFinanceira>
    <button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={17} /> Voltar para operações</button>
    <ErrorBox erro={erro} />
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border bg-[#f4f2e9] p-6"><div className="min-w-0 flex-[1_1_280px]"><div className="flex flex-wrap items-center gap-2"><span className="eyebrow">OP-{String(operacao.id).padStart(4, "0")}</span><StatusPill status={operacao.status} /></div><h1 className="mt-2 break-words font-serif text-[clamp(22px,5vw,30px)] leading-tight">{operacao.descricao || TIPO_OPERACAO[operacao.tipo]}</h1><p className="mt-2 break-words text-sm text-ink-3">{TIPO_OPERACAO[operacao.tipo]} · {dataBR(operacao.data)} · {operacao.parceiro?.nome ?? "Sem parceiro"}</p>{operacao.corrigeOperacao && <button onClick={() => onAbrir(operacao.corrigeOperacao!.id)} className="mt-2 text-xs font-semibold text-green-800">Correção da OP-{String(operacao.corrigeOperacao.id).padStart(4, "0")}</button>}{operacao.correcoes?.map((correcao) => <button key={correcao.id} onClick={() => onAbrir(correcao.id)} className="mt-2 block text-xs font-semibold text-green-800">Corrigida pela OP-{String(correcao.id).padStart(4, "0")}</button>)}</div><div className="flex flex-wrap gap-2">{operacao.status === "CONFIRMADA" && <Button danger onClick={() => setCancelando(true)}><RotateCcw size={15} /> Cancelar operação</Button>}{operacao.status === "CANCELADA" && !(operacao.correcoes?.length) && <Button onClick={() => onCorrigir(operacao)}><FilePenLine size={15} /> Criar correção</Button>}</div></div>
      <div className="grid lg:grid-cols-3">
        <section className="min-w-0 border-b border-border p-6 lg:border-b-0 lg:border-r"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Itens</h2><div className="mt-4 space-y-4">{operacao.itens.length ? operacao.itens.map((item) => <div key={item.id} className="flex justify-between gap-3 text-sm"><div className="min-w-0"><strong className="break-words">{item.descricao}</strong><div className="mt-1 break-words text-xs text-ink-3">{Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade} × {brl(item.valorUnitario)}</div></div><strong className="shrink-0 whitespace-nowrap">{brl(item.valorTotal)}</strong></div>) : <p className="text-sm text-ink-3">Operação sem itens.</p>}</div></section>
        <section className="min-w-0 border-b border-border p-6 lg:border-b-0 lg:border-r"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Efeitos gerados</h2><div className="mt-4 space-y-4 text-sm"><div className="flex justify-between gap-3"><span className="min-w-0 break-words">Transações financeiras</span><strong>{transacoesOriginais.length}</strong></div><div className="flex justify-between gap-3"><span className="min-w-0 break-words">Compromissos futuros</span><strong>{operacao.compromissos.length}</strong></div><div className="flex justify-between gap-3"><span className="min-w-0 break-words">Movimentos de estoque</span><strong>{operacao.movimentosEstoque.length}</strong></div></div></section>
        <section className="min-w-0 p-6"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Valor da operação</h2><div className="mt-3 break-words font-serif text-[clamp(24px,6vw,30px)]">{brl(operacao.valorTotal)}</div><p className="mt-3 text-xs leading-5 text-ink-3">Operações confirmadas são imutáveis. Correções preservam esta operação e geram um novo registro.</p></section>
      </div>
      <section className="border-t border-border p-6"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Documentos</h2><p className="mt-1 text-xs text-ink-3">Arquivos vinculados à origem da operação.</p></div><strong className="text-sm">{operacao.documentos.length}</strong></div>{operacao.documentos.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{operacao.documentos.map((documento) => <a key={documento.id} href={`/api/financeiro/documentos/${documento.id}/download`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm hover:bg-[#faf9f4]"><span className="min-w-0"><strong className="break-words">{documento.nome}</strong><span className="mt-0.5 block break-words text-xs text-ink-3">{documento.tipo.replaceAll("_", " ")}{documento.numero ? ` · ${documento.numero}` : ""}</span></span><Download size={16} className="shrink-0 text-ink-3" /></a>)}</div> : <p className="mt-4 text-sm text-ink-3">Nenhum documento anexado.</p>}</section>
    </Panel>
    {cancelando && <Modal titulo="Cancelar operação" eyebrow="Revisão obrigatória" onClose={() => setCancelando(false)} width="max-w-2xl"><div className="p-6"><p className="text-sm leading-6 text-ink-3">A operação original será preservada e marcada como cancelada. O sistema executará os efeitos inversos em uma única transação.</p><div className="mt-5 space-y-2 rounded-xl border border-red-200 bg-red-50/60 p-4 text-sm text-red-950">{quantidadeEstoque > 0 && <p>• Reverter {quantidadeEstoque} movimento{quantidadeEstoque === 1 ? "" : "s"} de estoque.</p>}{transacoesOriginais.length > 0 && <p>• Estornar {transacoesOriginais.length} transação{transacoesOriginais.length === 1 ? "" : "ões"} financeira{transacoesOriginais.length === 1 ? "" : "s"}, totalizando {brl(valorFinanceiro)}.</p>}{operacao.compromissos.length > 0 && <p>• Cancelar {operacao.compromissos.length} compromisso{operacao.compromissos.length === 1 ? "" : "s"}, com saldo pendente de {brl(valorCompromissos)}.</p>}<p>• Preservar documentos, operação original e histórico de auditoria.</p></div><label className="mt-5 block text-sm font-medium">Motivo do cancelamento *<textarea aria-label="Motivo do cancelamento" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique por que esta operação precisa ser cancelada" className="mt-1.5 min-h-24 w-full rounded-lg border border-border bg-white p-3 font-normal" /></label><div className="mt-5 flex justify-end gap-2"><Button secondary onClick={() => setCancelando(false)}>Manter operação</Button><Button danger disabled={salvando || motivo.trim().length < 5} onClick={confirmarCancelamento}>{salvando ? "Cancelando…" : "Confirmar cancelamento"}</Button></div></div></Modal>}
  </PaginaFinanceira>;
}
