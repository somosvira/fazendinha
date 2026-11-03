import type { FiltrosColunas } from "@/financeiro/FiltroColunaConsulta";
// Histórico de movimentações — extraído de DetalheLote.tsx para ser reaproveitado pela aba
// "Lotes · Histórico" (visão geral, sem lote fixo). Quem chama decide os filtros: passa uma
// função `carregar(pagina)` já fechada sobre eles (mesmo padrão de `carregarAnimais` em
// DetalheLote.tsx) e muda `recarregarToken` quando os filtros mudam, para a paginação voltar
// à página 1. Uma linha desfeita continua na lista (o histórico nunca apaga nada).

import { useEffect, useState } from "react";
import { Loader } from "../../../components/Loading";
import { Button, Empty, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { RebanhoApiError } from "../api";
import type { MovimentacaoResumo } from "../types";
import { formatarDataBR } from "../lib/rotulos";
import { Paginacao } from "../ui";
import { ConfirmarDesfazerMovimentacao } from "./ConfirmarDesfazerMovimentacao";

const ITENS_POR_PAGINA = 20;

function rotuloDestino(mov: MovimentacaoResumo): string {
  return mov.destino.lote ? `${mov.destino.lote.nome} (${mov.destino.propriedade.nome})` : mov.destino.propriedade.nome;
}

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

export function HistoricoMovimentacoes({
  carregar, mostrarDirecao = false, podeLancar = true, recarregarToken, onAbrir, onMudou, paginaControlada, onPaginaChange, filtrosColunas, visualizacao = "automatica",
}: {
  /** busca a página informada (1-based) — os filtros já vêm fechados na função de quem chama */
  filtrosColunas?: FiltrosColunas;
  visualizacao?: "automatica" | "tabela";
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
  paginaControlada?: number;
  onPaginaChange?: (pagina: number) => void;
}) {
  const [paginaLocal, setPaginaLocal] = useState(1);
  const pagina = paginaControlada ?? paginaLocal;
  const setPagina = onPaginaChange ?? setPaginaLocal;
  const [itens, setItens] = useState<MovimentacaoResumo[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [desfazendoId, setDesfazendoId] = useState<string | null>(null);

  // filtros mudaram (recarregarToken) — volta para a primeira página
  useEffect(() => { if (paginaControlada == null) setPaginaLocal(1); }, [recarregarToken, paginaControlada]);

  // descarta a resposta se a página/token mudaram enquanto a busca estava em voo (mesmo padrão
  // de ListaAnimais.tsx) — sem isso, trocar de filtro rápido pode mostrar o resultado anterior
  useEffect(() => {
    let vigente = true;
    setCarregando(true); setErro(null); setItens([]);
    carregar(pagina)
      .then((resultado) => { if (vigente) { setItens(resultado.itens); setTotal(resultado.total); } })
      .catch((e) => { if (vigente) setErro(mensagemErro(e)); })
      .finally(() => { if (vigente) setCarregando(false); });
    return () => { vigente = false; };
  }, [carregar, pagina, recarregarToken]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  if (carregando && !itens.length) return <div className="p-6"><Loader label="Carregando histórico" /></div>;

  return <>
    {erro && <div role="alert" className="p-5 text-sm text-red-700">{erro}</div>}
    {itens.length ? <TabelaFinanceira visualizacao={visualizacao} filtrosColunas={filtrosColunas} rotulo="Histórico de movimentações" itens={itens} chaveDe={m=>m.id} onAbrir={onAbrir} colunas={[
      {chave:"data",titulo:"Data",larguraMinima:110,principal:true,celula:m=>formatarDataBR(m.data)},
      {chave:"animais",titulo:"Animais",larguraMinima:100,celula:m=>m.quantidade},
      {chave:"origem",titulo:"Origem",larguraMinima:180,larguraFlexivel:true,celula:m=>m.origens.length?m.origens.join("; "):"Não identificada"},
      {chave:"destino",titulo:"Destino",larguraMinima:180,celula:rotuloDestino},
      {chave:"motivo",titulo:"Motivo",larguraMinima:160,celula:m=>m.motivo??"Não informado"},
      {chave:"situacao",titulo:"Situação",larguraMinima:130,celula:m=><><Pill tone={m.desfeitaEm?"neutral":"green"}>{m.desfeitaEm?"Desfeita":"Confirmada"}</Pill>{mostrarDirecao&&m.direcao&&<span className="block mt-1 text-sm">{m.direcao==="ENTRADA"?"Entrada":"Saída"}</span>}</>},
      {chave:"acoes",titulo:"Ações",acoes:true,larguraMinima:160,celula:m=><div className="historico-movimentacoes-acoes" onClick={e=>e.stopPropagation()}>{onAbrir&&<Button secondary className="historico-movimentacoes-acao" onClick={()=>onAbrir(m)}>Ver detalhes</Button>}{podeLancar&&m.podeDesfazer&&<Button secondary className="historico-movimentacoes-acao" onClick={()=>setDesfazendoId(m.id)}>Desfazer</Button>}</div>},
    ]}/> : !erro && <Empty>Nenhuma movimentação encontrada com os filtros selecionados.</Empty>}
    {itens.length > 0 && <Paginacao paginaAtual={pagina} totalPaginas={totalPaginas} totalItens={total} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPagina} rotulo="movimentações" idSelect="pagina-historico-movimentacoes" />}

    {desfazendoId && <ConfirmarDesfazerMovimentacao
      movimentacaoId={desfazendoId}
      onFechar={() => setDesfazendoId(null)}
      onConfirmado={() => { setDesfazendoId(null); onMudou?.(); }}
    />}
  </>;
}
