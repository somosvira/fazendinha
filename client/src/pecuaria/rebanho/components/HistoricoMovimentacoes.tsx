// Histórico de movimentações — extraído de DetalheLote.tsx para ser reaproveitado pela aba
// "Lotes · Histórico" (visão geral, sem lote fixo). Quem chama decide os filtros: passa uma
// função `carregar(pagina)` já fechada sobre eles (mesmo padrão de `carregarAnimais` em
// DetalheLote.tsx) e muda `recarregarToken` quando os filtros mudam, para a paginação voltar
// à página 1. Uma linha desfeita continua na lista (o histórico nunca apaga nada).

import { useCallback, useEffect, useState } from "react";
import { Loader } from "../../../components/Loading";
import { Button, Empty, Pill } from "../../../financeiro/financeiro-ui";
import { desfazerMovimentacao, RebanhoApiError } from "../api";
import type { MovimentacaoResumo } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { ModalMotivo, Paginacao } from "../ui";

const ITENS_POR_PAGINA = 20;

function rotuloDestino(mov: MovimentacaoResumo): string {
  return mov.destino.lote ? `${mov.destino.lote.nome} (${mov.destino.propriedade.nome})` : mov.destino.propriedade.nome;
}

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

export function HistoricoMovimentacoes({
  carregar, mostrarDirecao = false, podeLancar = true, recarregarToken, onAbrir, onMudou,
}: {
  /** busca a página informada (1-based) — os filtros já vêm fechados na função de quem chama */
  carregar: (pagina: number) => Promise<{ itens: MovimentacaoResumo[]; total: number }>;
  /** exibe o selo Entrada/Saída — só faz sentido quando a listagem está presa a um lote */
  mostrarDirecao?: boolean;
  podeLancar?: boolean;
  /** mudar este valor volta para a página 1 e recarrega (ex.: filtros mudaram, ou o pai quer
   *  forçar um reload depois de um desfazer disparado por fora, ex.: DetalheMovimentacao) */
  recarregarToken?: string | number;
  onAbrir?: (mov: MovimentacaoResumo) => void;
  /** chamado depois de um desfazer bem-sucedido feito por aqui — quem chama deve mudar
   *  `recarregarToken` (e recarregar dados relacionados, como o lote) para a lista atualizar */
  onMudou?: () => void;
}) {
  const [pagina, setPagina] = useState(1);
  const [itens, setItens] = useState<MovimentacaoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [desfazendo, setDesfazendo] = useState<MovimentacaoResumo | null>(null);
  const [processandoDesfazer, setProcessandoDesfazer] = useState(false);
  const [erroDesfazer, setErroDesfazer] = useState<string | null>(null);

  // filtros mudaram (recarregarToken) — volta para a primeira página
  useEffect(() => { setPagina(1); }, [recarregarToken]);

  const recarregar = useCallback(async (paginaAlvo: number) => {
    setCarregando(true); setErro(null);
    try {
      const resultado = await carregar(paginaAlvo);
      setItens(resultado.itens); setTotal(resultado.total);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setCarregando(false); }
  }, [carregar]);

  useEffect(() => { void recarregar(pagina); }, [recarregar, pagina, recarregarToken]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  const confirmarDesfazer = (motivo: string) => {
    if (!desfazendo || processandoDesfazer) return;
    setProcessandoDesfazer(true); setErroDesfazer(null);
    desfazerMovimentacao(desfazendo.id, motivo)
      .then(() => { setDesfazendo(null); onMudou?.(); })
      .catch((e) => setErroDesfazer(mensagemErro(e)))
      .finally(() => setProcessandoDesfazer(false));
  };

  if (carregando && !itens.length) return <div className="p-6"><Loader label="Carregando histórico" /></div>;

  return <>
    {erro && <div role="alert" className="p-5 text-sm text-red-700">{erro}</div>}
    {itens.length ? <div className="divide-y divide-border">
      {itens.map((mov) => <div key={mov.id} className="flex flex-wrap items-start justify-between gap-3 p-5 text-sm">
        {onAbrir
          ? <button type="button" onClick={() => onAbrir(mov)} className="min-w-0 flex-1 rounded-lg text-left hover:opacity-80">
            <ConteudoMovimentacao mov={mov} mostrarDirecao={mostrarDirecao} />
          </button>
          : <div className="min-w-0 flex-1"><ConteudoMovimentacao mov={mov} mostrarDirecao={mostrarDirecao} /></div>}
        {podeLancar && mov.podeDesfazer && <Button secondary onClick={() => { setErroDesfazer(null); setDesfazendo(mov); }}>Desfazer</Button>}
      </div>)}
    </div> : !erro && <Empty>Nenhuma movimentação registrada.</Empty>}
    {itens.length > 0 && <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="movimentações" idSelect="pagina-historico-movimentacoes" />}

    {desfazendo && <ModalMotivo
      titulo="Desfazer movimentação?"
      eyebrow={`Movimentação de ${formatarDataBR(desfazendo.data)}`}
      impacto={<p>Os {desfazendo.quantidadeTotal} animais desta movimentação voltam para a localização anterior.</p>}
      labelManter="Manter"
      labelConfirmar="Desfazer movimentação"
      confirmando={processandoDesfazer}
      erro={erroDesfazer}
      onFechar={() => setDesfazendo(null)}
      onConfirmar={confirmarDesfazer}
    />}
  </>;
}

function ConteudoMovimentacao({ mov, mostrarDirecao }: { mov: MovimentacaoResumo; mostrarDirecao: boolean }) {
  return <>
    <div className="flex flex-wrap items-center gap-2">
      {mostrarDirecao && mov.direcao && <Pill tone={mov.direcao === "ENTRADA" ? "green" : "amber"}>{mov.direcao === "ENTRADA" ? "Entrada" : "Saída"}</Pill>}
      <span className="text-ink-3">{formatarDataBR(mov.data)}</span>
      <strong>{mov.quantidade} {mov.quantidade === 1 ? "animal" : "animais"}</strong>
    </div>
    <p className="mt-2 break-words text-ink-3">{mov.origens.length ? mov.origens.join(", ") : "Origem não identificada"} → {rotuloDestino(mov)}</p>
    {mov.motivo && <p className="mt-1 break-words text-ink-3">Motivo: {mov.motivo}</p>}
    <p className="mt-1 text-xs text-ink-3">{mov.criadoPor ?? "Sistema"} · {formatarDataBR(mov.criadoEm)}</p>
    {mov.desfeitaEm && <p className="mt-1 text-xs font-medium text-red-700">Desfeita em {formatarDataBR(mov.desfeitaEm)}{mov.desfeitaMotivo ? ` · ${mov.desfeitaMotivo}` : ""}</p>}
  </>;
}
