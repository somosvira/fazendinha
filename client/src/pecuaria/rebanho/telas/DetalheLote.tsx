// Página do lote — animais do lote (com movimentação individual/em massa e
// "trazer animais" de outros lotes) e histórico de movimentações, no padrão
// de OperacaoFinanceiraDetalhe.tsx/DetalheAnimal.tsx. PageHeader por pedido
// explícito do plano (em vez do cabeçalho bg-[#f4f2e9] das outras fichas).

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRightLeft } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import { useToast } from "@/components/Toast";
import {
  buscarLote, desfazerMovimentacao, editarLote, listarAnimais, listarMovimentacoesDoLote, obterCatalogos, RebanhoApiError,
} from "../api";
import type { AnimalResumo, Catalogos, Lote, PainelServidor } from "../types";
import { formatarDataBR, rotuloCategoria } from "../lib/rotulos";
import { navegarPara } from "../../../router";
import { Button, type ColunaTabela, Empty, ErrorBox, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { Paginacao } from "../ui";
import { NavRebanho } from "./NavRebanho";
import { mensagemDesativar } from "./ListaLotes";
import { FormLote } from "../cadastros/FormLote";
import { FormMovimentar } from "../forms/FormMovimentar";
import { SeletorAnimais } from "../components/SeletorAnimais";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";

const ITENS_POR_PAGINA = 20;

type Movimentando = {
  ids: string[];
  /** pré-seleciona o lote atual (movimentação individual/em massa saindo deste lote) */
  usarLoteAtual?: boolean;
  /** "Trazer animais": destino fixo neste lote, sem selects */
  destinoFixo?: { propriedadeId: number; loteId: string | null; rotulo: string };
} | null;

export function DetalheLote({ id, podeLancar = true, onVoltar }: { id: string; podeLancar?: boolean; onVoltar: () => void }) {
  const toast = useToast();
  const [lote, setLote] = useState<Lote | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [painelLote, setPainelLote] = useState<PainelServidor | null>(null);
  const [paginaAnimais, setPaginaAnimais] = useState(1);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  /* muda a cada recarregarTudo() para o HistoricoMovimentacoes voltar à página 1 e recarregar */
  const [historicoToken, setHistoricoToken] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);

  const [trazendo, setTrazendo] = useState(false);
  const [movimentando, setMovimentando] = useState<Movimentando>(null);

  const carregarLote = useCallback(async () => { setLote(await buscarLote(id)); }, [id]);
  const carregarAnimais = useCallback(async (pagina: number) => {
    const resultado = await listarAnimais({ loteId: id, situacao: "ATIVO", page: pagina, pageSize: ITENS_POR_PAGINA });
    setAnimais(resultado.itens); setTotalAnimais(resultado.total); setPainelLote(resultado.painel);
  }, [id]);
  /** carregador do histórico deste lote — repassado direto ao HistoricoMovimentacoes */
  const carregarHistorico = useCallback((pagina: number) => listarMovimentacoesDoLote(id, pagina), [id]);

  const carregar = useCallback(async () => {
    try { setErro(null); await carregarLote(); }
    catch (e) { setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
  }, [carregarLote]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);

  useEffect(() => { void carregarAnimais(paginaAnimais).catch((e) => setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e))); }, [carregarAnimais, paginaAnimais]);

  /** Depois de qualquer movimentação/desfazer: recarrega lote, animais, painel e histórico (voltando à página 1). */
  const recarregarTudo = useCallback(async () => {
    setSelecionados(new Set());
    setPaginaAnimais(1);
    setHistoricoToken((t) => t + 1);
    await Promise.all([carregarLote(), carregarAnimais(1)]);
  }, [carregarLote, carregarAnimais]);

  const aoMovimentar = async (resultado: { movimentacaoId: string; movidos: number }) => {
    setMovimentando(null);
    await recarregarTudo();
    toast.success(
      `${resultado.movidos} ${resultado.movidos === 1 ? "animal movimentado" : "animais movimentados"}`,
      undefined,
      { action: { label: "Desfazer", onClick: () => {
        void desfazerMovimentacao(resultado.movimentacaoId, "Desfeito logo após a movimentação")
          .then(() => recarregarTudo())
          .catch((e) => toast.error("Não foi possível desfazer", e instanceof Error ? e.message : String(e)));
      } } },
    );
  };

  const alternarSelecao = (idAnimal: string) => setSelecionados((atual) => { const novo = new Set(atual); if (novo.has(idAnimal)) novo.delete(idAnimal); else novo.add(idAnimal); return novo; });
  const alternarSelecaoTodos = () => setSelecionados((atual) => atual.size === animais.length ? new Set() : new Set(animais.map((a) => a.id)));

  const executarAcaoLote = async (acao: () => Promise<unknown>, aoTerminar: () => void) => {
    if (processandoLote) return;
    setProcessandoLote(true); setErroLote(null);
    try { await acao(); await carregarLote(); aoTerminar(); }
    catch (e) { setErroLote(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setProcessandoLote(false); }
  };

  if (!lote) return <div className="shell-wide pagina-carregando"><button onClick={onVoltar} className="mt-6 mb-5 inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-ink-2"><ArrowLeft size={17} /> Voltar para lotes</button><ErrorBox erro={erro} />{!erro && <Loader label="Carregando lote" full />}</div>;

  const totalPaginasAnimais = Math.max(1, Math.ceil(totalAnimais / ITENS_POR_PAGINA));

  const COLUNAS_ANIMAIS: ColunaTabela<AnimalResumo>[] = [
    ...(podeLancar ? [{ chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item: AnimalResumo) => <label className="flex items-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternarSelecao(item.id)} /></label> }] as ColunaTabela<AnimalResumo>[] : []),
    { chave: "brinco", titulo: "Brinco", larguraMinima: 140, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-xs text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <Pill>{rotuloCategoria(item.categoria)}</Pill> },
    { chave: "peso", titulo: "Último peso", larguraMinima: 130, celula: (item) => item.ultimoPeso ? <>{item.ultimoPeso.kg.toLocaleString("pt-BR")} kg<div className="text-xs text-ink-3">{formatarDataBR(item.ultimoPeso.data)}</div></> : "—" },
    ...(podeLancar ? [{ chave: "acoes", titulo: "Ações", alinhamento: "direita" as const, larguraMinima: 96, acoes: true, celula: (item: AnimalResumo) => <div className="flex justify-end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Movimentar ${item.brinco}`} title="Movimentar" onClick={() => setMovimentando({ ids: [item.id], usarLoteAtual: true })}><ArrowRightLeft size={16} /></button>
    </div> }] as ColunaTabela<AnimalResumo>[] : []),
  ];

  return <PaginaFinanceira>
    <button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={17} /> Voltar para lotes</button>
    <PageHeader
      eyebrow="Lote"
      titulo={lote.nome}
      descricao={`${lote.propriedade.nome}${lote.observacao ? ` · ${lote.observacao}` : ""}`}
      acao={podeLancar ? <div className="flex flex-wrap gap-2">
        <Button secondary onClick={() => setTrazendo(true)}><ArrowRightLeft size={16} /> Trazer animais</Button>
        <Button secondary onClick={() => setEditando(true)}>Editar lote</Button>
        {lote.ativo
          ? <Button danger onClick={() => setConfirmandoDesativar(true)}>Desativar</Button>
          : <Button secondary onClick={() => { void executarAcaoLote(() => editarLote(lote.id, { ativo: true }), () => undefined); }}>Reativar</Button>}
      </div> : undefined}
    />
    <NavRebanho ativa="lotes" />
    <ErrorBox erro={erro ?? erroLote} />

    {painelLote && <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-4 text-sm">
      <strong>{painelLote.totalAtivos} {painelLote.totalAtivos === 1 ? "animal ativo" : "animais ativos"}</strong>
      {painelLote.porCategoria.map((c) => <Pill key={c.categoria}>{rotuloCategoria(c.categoria)}: {c.total}</Pill>)}
    </div>}

    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><h2 className="font-serif text-xl">Animais no lote</h2></div>
      {podeLancar && animais.length > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-4 py-2.5 text-sm">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" aria-label="Selecionar todos os animais desta página" checked={selecionados.size > 0 && selecionados.size === animais.length} onChange={alternarSelecaoTodos} /> Selecionar todos</label>
        {selecionados.size > 0 && <><span className="text-ink-3">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span>
          <Button secondary onClick={() => setSelecionados(new Set())}>Limpar seleção</Button>
          <Button onClick={() => setMovimentando({ ids: [...selecionados] })}>Movimentar selecionados ({selecionados.size})</Button>
        </>}
      </div>}
      {animais.length ? <>
        <TabelaFinanceira rotulo="Animais do lote" itens={animais} colunas={COLUNAS_ANIMAIS} chaveDe={(item) => item.id} onAbrir={(item) => navegarPara(`/pecuaria/rebanho/animais/${item.id}`)} />
        <Paginacao paginaAtual={paginaAnimais} totalPaginas={totalPaginasAnimais} totalItens={totalAnimais} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPaginaAnimais} rotulo="animais" idSelect="pagina-animais-lote" />
      </> : <Empty>Nenhum animal ativo neste lote.</Empty>}
    </Panel>

    <Panel className="mt-6 overflow-hidden">
      <div className="border-b border-border p-5"><h2 className="font-serif text-xl">Histórico</h2></div>
      <HistoricoMovimentacoes
        carregar={carregarHistorico}
        mostrarDirecao
        podeLancar={podeLancar}
        recarregarToken={historicoToken}
        onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
        onMudou={recarregarTudo}
      />
    </Panel>

    {editando && <FormLote lote={lote} propriedades={[]} onSalvo={async () => { setEditando(false); await carregarLote(); }} onFechar={() => setEditando(false)} />}

    {trazendo && <SeletorAnimais
      excluirLoteId={lote.id}
      onCancelar={() => setTrazendo(false)}
      onConfirmar={(animaisSelecionados) => {
        setTrazendo(false);
        setMovimentando({ ids: animaisSelecionados.map((a) => a.id), destinoFixo: { propriedadeId: lote.propriedadeId, loteId: lote.id, rotulo: `${lote.nome} · ${lote.propriedade.nome}` } });
      }}
    />}

    {movimentando && catalogos && <FormMovimentar
      animalIds={movimentando.ids}
      propriedades={catalogos.propriedades}
      lotes={catalogos.lotes}
      destinoFixo={movimentando.destinoFixo}
      propriedadeInicial={movimentando.destinoFixo ? undefined : lote.propriedadeId}
      loteInicial={movimentando.destinoFixo ? undefined : (movimentando.usarLoteAtual ? lote.id : undefined)}
      onFechar={() => setMovimentando(null)}
      onSalvo={aoMovimentar}
    />}

    <ConfirmDialog
      open={confirmandoDesativar}
      title={`Desativar ${lote.nome}?`}
      message={mensagemDesativar(lote)}
      confirmLabel="Desativar"
      cancelLabel="Manter ativo"
      tone="danger"
      processando={processandoLote}
      onConfirm={() => { void executarAcaoLote(() => editarLote(lote.id, { ativo: false }), () => setConfirmandoDesativar(false)); }}
      onCancel={() => setConfirmandoDesativar(false)}
    />

    {movimentacaoAbertaId && <DetalheMovimentacao
      id={movimentacaoAbertaId}
      podeLancar={podeLancar}
      onFechar={() => setMovimentacaoAbertaId(null)}
      onMudou={recarregarTudo}
    />}
  </PaginaFinanceira>;
}
