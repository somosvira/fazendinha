import { Composicao } from "./CartoesLotes";
import { ResumoPesagensLote } from "./ResumoPesagensLote";
// Página do lote — resumo (efetivo, peso, GMD, idade), animais do lote (com
// movimentação individual/em massa e "trazer animais" de outros lotes),
// animais que saíram por baixa, histórico de movimentações e alterações do
// cadastro do lote, no padrão de OperacaoFinanceiraDetalhe.tsx/DetalheAnimal.tsx.
// PageHeader por pedido explícito do plano (em vez do cabeçalho bg-[#f4f2e9]
// das outras fichas).

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Calendar, TrendingUp, Users, Weight } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Loader } from "@/components/Loading";
import {
  buscarLote, buscarResumoLote, editarLote, listarAnimais, listarMovimentacoesDoLote, obterCatalogos, RebanhoApiError,
} from "../api";
import type { AnimalResumo, Catalogos, Lote, PeriodoGmd, ResumoLote as ResumoLoteDTO } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloPapelReprodutivo, rotuloSexo, rotuloTipoBaixa } from "../lib/rotulos";
import { formatarGmd, formatarKg, PERIODO_GMD_PADRAO } from "../lib/peso";
import { navegarPara } from "../../../router";
import { Button, type ColunaTabela, Empty, ErrorBox, Metric, PageHeader, PaginaFinanceira, Panel, Pill, TabelaFinanceira } from "../../../financeiro/financeiro-ui";
import { CategoriaPill, Paginacao, useAoMovimentarComToast } from "../ui";
import { mensagemDesativar } from "./ListaLotes";
import { FormLote } from "../cadastros/FormLote";
import { FormMovimentar } from "../forms/FormMovimentar";
import { SeletorAnimais } from "../components/SeletorAnimais";
import { SeletorPeriodoGmd } from "../components/SeletorPeriodoGmd";
import { HistoricoMovimentacoes } from "../components/HistoricoMovimentacoes";
import { AlteracoesCadastro } from "../components/AlteracoesCadastro";
import { DetalheMovimentacao } from "../components/DetalheMovimentacao";
import { NutricaoLote } from "../nutricao/NutricaoLote";
import { HistoricoSanitario } from "../sanidade/HistoricoSanitario";
import { linkFichaAnimal } from "../lib/navegacao";

const ITENS_POR_PAGINA = 20;
const SECOES_LOTE = [["resumo", "Resumo"], ["animais", "Animais"], ["baixas", "Baixas"], ["historico", "Movimentações"], ["sanidade", "Sanidade"], ["nutricao", "Nutrição"], ["alteracoes", "Alterações"]] as const;
type SecaoLote = typeof SECOES_LOTE[number][0];
function secaoLoteDaUrl(): SecaoLote {
  const fragmento = window.location.hash.replace("#lote-", "");
  return SECOES_LOTE.find(([id]) => id === fragmento)?.[0] ?? "animais";
}

function mensagemErro(e: unknown): string {
  return e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e);
}

type Movimentando = {
  animais: AnimalResumo[];
  /** pré-seleciona o lote atual (movimentação individual/em massa saindo deste lote) */
  usarLoteAtual?: boolean;
  /** "Trazer animais": destino fixo neste lote, sem selects */
  destinoFixo?: { propriedadeId: number; loteId: string | null; rotulo: string };
} | null;

export function DetalheLote({ id, podeLancar = true, onVoltar, rotuloVoltar = "Lotes" }: { id: string; podeLancar?: boolean; onVoltar: () => void; rotuloVoltar?: string }) {
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoLote>(secaoLoteDaUrl);
  useEffect(() => {
    const restaurar = () => setSecaoAtiva(secaoLoteDaUrl());
    window.addEventListener("hashchange", restaurar);
    window.addEventListener("popstate", restaurar);
    return () => { window.removeEventListener("hashchange", restaurar); window.removeEventListener("popstate", restaurar); };
  }, []);
  const [lote, setLote] = useState<Lote | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [periodoGmd, setPeriodoGmd] = useState<PeriodoGmd>(PERIODO_GMD_PADRAO);
  const [resumo, setResumo] = useState<ResumoLoteDTO | null>(null);

  const [animais, setAnimais] = useState<AnimalResumo[]>([]);
  const [totalAnimais, setTotalAnimais] = useState(0);
  const [paginaAnimais, setPaginaAnimais] = useState(1);
  const [selecionados, setSelecionados] = useState<Map<string, AnimalResumo>>(new Map());

  const [baixados, setBaixados] = useState<AnimalResumo[]>([]);
  const [totalBaixados, setTotalBaixados] = useState(0);
  const [paginaBaixados, setPaginaBaixados] = useState(1);

  /* muda a cada recarregarTudo() para o HistoricoMovimentacoes voltar à página 1 e recarregar */
  const [historicoToken, setHistoricoToken] = useState(0);
  const [movimentacaoAbertaId, setMovimentacaoAbertaId] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [confirmandoDesativar, setConfirmandoDesativar] = useState(false);
  const [processandoLote, setProcessandoLote] = useState(false);
  const [erroLote, setErroLote] = useState<string | null>(null);

  const [trazendo, setTrazendo] = useState(false);
  const [movimentando, setMovimentando] = useState<Movimentando>(null);

  /* o lote é recarregado depois de toda escrita nele (editar, desativar…) — o painel "Alterações do lote" segue junto */
  const [alteracoesToken, setAlteracoesToken] = useState(0);
  const carregarLote = useCallback(async () => { setLote(await buscarLote(id)); setAlteracoesToken((t) => t + 1); }, [id]);
  const carregarResumo = useCallback(async (periodo: PeriodoGmd) => { setResumo(await buscarResumoLote(id, { periodoDias: periodo })); }, [id]);
  const carregarAnimais = useCallback(async (pagina: number) => {
    const resultado = await listarAnimais({ loteId: id, situacao: "ATIVO", page: pagina, pageSize: ITENS_POR_PAGINA });
    setAnimais(resultado.itens); setTotalAnimais(resultado.total);
  }, [id]);
  const carregarBaixados = useCallback(async (pagina: number) => {
    const resultado = await listarAnimais({ loteId: id, situacao: "BAIXADO", page: pagina, pageSize: ITENS_POR_PAGINA });
    setBaixados(resultado.itens); setTotalBaixados(resultado.total);
  }, [id]);
  /** carregador do histórico deste lote — repassado direto ao HistoricoMovimentacoes */
  const carregarHistorico = useCallback((pagina: number) => listarMovimentacoesDoLote(id, pagina), [id]);

  const carregar = useCallback(async () => {
    try { setErro(null); await carregarLote(); }
    catch (e) { setErro(mensagemErro(e)); }
  }, [carregarLote]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);

  useEffect(() => { void carregarAnimais(paginaAnimais).catch((e) => setErro(mensagemErro(e))); }, [carregarAnimais, paginaAnimais]);
  useEffect(() => { void carregarResumo(periodoGmd).catch((e) => setErro(mensagemErro(e))); }, [carregarResumo, periodoGmd]);
  useEffect(() => { void carregarBaixados(paginaBaixados).catch((e) => setErro(mensagemErro(e))); }, [carregarBaixados, paginaBaixados]);

  /** Depois de qualquer mutação de lote/movimentação: recarrega resumo e a página 1 de "Saíram por baixa". */
  const recarregarResumoEBaixados = useCallback(async () => {
    setPaginaBaixados(1);
    await Promise.all([carregarResumo(periodoGmd), carregarBaixados(1)]);
  }, [carregarResumo, carregarBaixados, periodoGmd]);

  /** Depois de qualquer movimentação/desfazer: recarrega lote, animais, resumo, baixados e histórico (voltando à página 1). */
  const recarregarTudo = useCallback(async () => {
    setSelecionados(new Map());
    setPaginaAnimais(1);
    setHistoricoToken((t) => t + 1);
    await Promise.all([carregarLote(), carregarAnimais(1), recarregarResumoEBaixados()]);
  }, [carregarLote, carregarAnimais, recarregarResumoEBaixados]);

  const aoMovimentarComToast = useAoMovimentarComToast(recarregarTudo);
  const aoMovimentar = async (resultado: { movimentacaoId: string; movidos: number }) => {
    setMovimentando(null);
    await aoMovimentarComToast(resultado);
  };

  const alternarSelecao = (animal: AnimalResumo) => setSelecionados((atual) => { const novo = new Map(atual); if (novo.has(animal.id)) novo.delete(animal.id); else novo.set(animal.id, animal); return novo; });
  const todosDaPaginaSelecionados = animais.length > 0 && animais.every((a) => selecionados.has(a.id));
  const alternarSelecaoTodos = () => setSelecionados((atual) => {
    const novo = new Map(atual);
    if (todosDaPaginaSelecionados) animais.forEach((a) => novo.delete(a.id));
    else animais.forEach((a) => novo.set(a.id, a));
    return novo;
  });

  const executarAcaoLote = async (acao: () => Promise<unknown>, aoTerminar: () => void) => {
    if (processandoLote) return;
    setProcessandoLote(true); setErroLote(null);
    try { await acao(); await Promise.all([carregarLote(), recarregarResumoEBaixados()]); aoTerminar(); }
    catch (e) { setErroLote(mensagemErro(e)); }
    finally { setProcessandoLote(false); }
  };

  if (!lote) return <PaginaFinanceira><button onClick={onVoltar} className="rebanho-voltar"><ArrowLeft size={16} /> {rotuloVoltar}</button><PageHeader titulo="Lote" /><ErrorBox erro={erro} />{!erro && <div className="rebanho-carregamento"><Loader label="Carregando lote" /></div>}</PaginaFinanceira>;

  const totalPaginasAnimais = Math.max(1, Math.ceil(totalAnimais / ITENS_POR_PAGINA));
  const totalPaginasBaixados = Math.max(1, Math.ceil(totalBaixados / ITENS_POR_PAGINA));

  const COLUNAS_ANIMAIS: ColunaTabela<AnimalResumo>[] = [
    ...(podeLancar ? [{ chave: "selecionar", titulo: "", larguraMinima: 44, acoes: true, celula: (item: AnimalResumo) => <label className="flex items-center" onClick={(e: React.MouseEvent) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${item.brinco}`} checked={selecionados.has(item.id)} onChange={() => alternarSelecao(item)} /></label> }] as ColunaTabela<AnimalResumo>[] : []),
    { chave: "brinco", titulo: "Brinco", larguraMinima: 140, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-sm text-ink-3">{item.nome}</div>}</> },
    { chave: "categoria", titulo: "Categoria / perfil", larguraMinima: 150, celula: (item) => <><CategoriaPill categoria={item.categoria} categoriaOrigem={item.categoriaOrigem} categoriaCalculada={item.categoriaCalculada} /><div className="mt-1 text-sm text-ink-3">{rotuloSexo(item.sexo)} · {formatarIdade(item.idadeMeses)}</div></> },
    { chave: "papel", titulo: "Finalidade/Papel", larguraMinima: 140, celula: (item) => <>{rotuloAptidao(item.aptidao)}{item.papelReprodutivo && item.papelReprodutivo !== "NENHUM" ? ` · ${rotuloPapelReprodutivo(item.papelReprodutivo)}` : ""}</> },
    { chave: "peso", titulo: "Peso / GMD", larguraMinima: 160, celula: (item) => <>{item.ultimoPeso ? <>{item.ultimoPeso.kg.toLocaleString("pt-BR")} kg<div className="text-sm text-ink-3">{formatarDataBR(item.ultimoPeso.data)}</div></> : "Sem pesagem"}<div className="mt-1 text-sm text-ink-3">GMD {formatarGmd(item.gmdRecente)}</div></> },
    { chave: "noLote", titulo: "No lote desde", larguraMinima: 130, celula: (item) => formatarDataBR(item.noLocalDesde) },
    ...(podeLancar ? [{ chave: "acoes", titulo: "Ações", alinhamento: "direita" as const, larguraMinima: 96, acoes: true, celula: (item: AnimalResumo) => <div className="flex justify-end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Movimentar ${item.brinco}`} title="Movimentar" onClick={() => setMovimentando({ animais: [item], usarLoteAtual: true })}><ArrowRightLeft size={16} /></button>
    </div> }] as ColunaTabela<AnimalResumo>[] : []),
  ];

  const COLUNAS_BAIXADOS: ColunaTabela<AnimalResumo>[] = [
    { chave: "brinco", titulo: "Brinco", larguraMinima: 140, principal: true, celula: (item) => <><strong className="break-words">{item.brinco}</strong>{item.nome && <div className="mt-1 text-sm text-ink-3">{item.nome}</div>}</> },
    { chave: "baixa", titulo: "Baixa", larguraMinima: 170, celula: (item) => item.baixa ? <>{rotuloTipoBaixa(item.baixa.tipo)} <span className="text-ink-3">· {formatarDataBR(item.baixa.data)}</span></> : "—" },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 110, celula: (item) => <CategoriaPill categoria={item.categoria} categoriaOrigem={item.categoriaOrigem} categoriaCalculada={item.categoriaCalculada} /> },
  ];

  return <PaginaFinanceira>
    <nav aria-label="Navegação" className="pec-breadcrumb"><button type="button" onClick={() => navegarPara("/pecuaria/rebanho")}>Rebanho</button><span aria-hidden="true">/</span><button type="button" onClick={onVoltar}>{rotuloVoltar}</button><span aria-hidden="true">/</span><span aria-current="page">{lote.nome}</span></nav>
    <PageHeader
      eyebrow=""
      titulo={lote.nome}
      descricao={`${lote.propriedade.nome}${lote.observacao ? ` · ${lote.observacao}` : ""}`}
      acao={podeLancar ? <div className="flex flex-wrap gap-2">
        <Button secondary onClick={() => setTrazendo(true)}><ArrowRightLeft size={16} /> Trazer animais</Button>
        <Button secondary onClick={() => setEditando(true)}>Editar lote</Button>
        {lote.ativo
          ? <Button secondary onClick={() => setConfirmandoDesativar(true)}>Desativar</Button>
          : <Button secondary onClick={() => { void executarAcaoLote(() => editarLote(lote.id, { ativo: true }), () => undefined); }}>Reativar</Button>}
      </div> : undefined}
    />

    <ErrorBox erro={erro ?? erroLote} />

    <nav aria-label="Seções da ficha do lote" role="tablist" className="rebanho-abas-ficha abas-pasta">
      {SECOES_LOTE.map(([secao, rotulo]) => <a key={secao} role="tab" id={`lote-aba-${secao}`} aria-selected={secaoAtiva === secao} aria-controls={`lote-painel-${secao}`} tabIndex={secaoAtiva === secao ? 0 : -1} href={`#lote-${secao}`} onClick={evento => {
        evento.preventDefault();
        setSecaoAtiva(secao);
        const url = new URL(window.location.href);
        url.hash = `lote-${secao}`;
        if (url.hash !== window.location.hash) window.history.pushState(window.history.state, "", url.pathname + url.search + url.hash);
      }} onKeyDown={evento => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(evento.key)) return;
        evento.preventDefault();
        const abas = Array.from(evento.currentTarget.parentElement!.querySelectorAll<HTMLAnchorElement>("[role=tab]"));
        const indice = abas.indexOf(evento.currentTarget);
        const proxima = evento.key === "Home" ? 0 : evento.key === "End" ? abas.length - 1 : (indice + (evento.key === "ArrowRight" ? 1 : -1) + abas.length) % abas.length;
        abas[proxima].focus(); abas[proxima].click();
      }}>{rotulo}</a>)}
    </nav>
    <div id="lote-painel-resumo" role="tabpanel" aria-labelledby="lote-aba-resumo" hidden={secaoAtiva !== "resumo"}>
    {resumo && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <span id="lote-resumo" />
        <SeletorPeriodoGmd id="periodo-gmd-lote" valor={periodoGmd} onChange={setPeriodoGmd} />
      </div>
      <div className="pec-metricas pec-lote-metricas mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Animais ativos" valor={resumo.ativos.toLocaleString("pt-BR")} detalhe={`${resumo.porSexo.F} fêmeas · ${resumo.porSexo.M} machos`} icon={Users} />
        <Metric label="Peso médio" valor={formatarKg(resumo.peso.medioKg)} detalhe={`${formatarKg(resumo.peso.minKg)} – ${formatarKg(resumo.peso.maxKg)} · ${resumo.peso.semPeso} sem peso`} icon={Weight} />
        <Metric label="GMD do período" valor={formatarGmd(resumo.gmd.medio)} detalhe={`${resumo.gmd.comGmd} de ${resumo.ativos} animais com pesagem suficiente`} icon={TrendingUp} />
        <Metric label="Idade média" valor={resumo.idadeMediaMeses != null ? formatarIdade(resumo.idadeMediaMeses) : "—"} icon={Calendar} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2"><Panel className="p-5"><h2 className="h3 mb-3">Composição do lote</h2><Composicao resumo={resumo} /></Panel><ResumoPesagensLote resumo={resumo} /></div>
      <Panel className="mt-4 overflow-hidden"><div className="consulta-visual-barra"><h2 className="h3">Animais do lote</h2><Button secondary onClick={() => document.getElementById("lote-aba-animais")?.click()}>Ver todos</Button></div>{animais.length ? <TabelaFinanceira rotulo="Prévia dos animais do lote" itens={animais.slice(0, 3)} colunas={COLUNAS_ANIMAIS.filter(c => !["selecionar", "acoes"].includes(c.chave))} chaveDe={a => a.id} onAbrir={a => navegarPara(linkFichaAnimal(a.id))} /> : <p className="p-5 text-sm">Nenhum animal disponível nesta consulta.</p>}</Panel>
    </>}
    </div>



    <div id="lote-painel-animais" role="tabpanel" aria-labelledby="lote-aba-animais" hidden={secaoAtiva !== "animais"}>
    <Panel className="mt-6 overflow-hidden">
      <span id="lote-animais" />
      {podeLancar && animais.length > 0 && <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border p-4 text-sm">
        <label className="flex items-center gap-2 font-medium"><input type="checkbox" aria-label="Selecionar todos os animais desta página" checked={todosDaPaginaSelecionados} onChange={alternarSelecaoTodos} /> Selecionar todos</label>
        {selecionados.size > 0 && <><span className="text-ink-3">{selecionados.size} selecionado{selecionados.size === 1 ? "" : "s"}</span>
          <Button secondary onClick={() => setSelecionados(new Map())}>Limpar seleção</Button>
          <Button onClick={() => setMovimentando({ animais: [...selecionados.values()] })}>Movimentar selecionados ({selecionados.size})</Button>
        </>}
      </div>}
      {animais.length ? <>
        <TabelaFinanceira rotulo="Animais do lote" itens={animais} colunas={COLUNAS_ANIMAIS} chaveDe={(item) => item.id} onAbrir={(item) => navegarPara(linkFichaAnimal(item.id))} />
        <Paginacao paginaAtual={paginaAnimais} totalPaginas={totalPaginasAnimais} totalItens={totalAnimais} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPaginaAnimais} rotulo="animais" idSelect="pagina-animais-lote" />
      </> : <Empty>Nenhum animal ativo neste lote.</Empty>}
    </Panel>
    </div>

    <div id="lote-painel-baixas" role="tabpanel" aria-labelledby="lote-aba-baixas" hidden={secaoAtiva !== "baixas"}>
    <Panel className="mt-6 overflow-hidden">
      <span id="lote-baixas" />
      {baixados.length ? <>
        <TabelaFinanceira rotulo="Animais que saíram por baixa" itens={baixados} colunas={COLUNAS_BAIXADOS} chaveDe={(item) => item.id} onAbrir={(item) => navegarPara(linkFichaAnimal(item.id))} />
        <Paginacao paginaAtual={paginaBaixados} totalPaginas={totalPaginasBaixados} totalItens={totalBaixados} itensPorPagina={ITENS_POR_PAGINA} onPaginaChange={setPaginaBaixados} rotulo="animais baixados" idSelect="pagina-baixados-lote" />
      </> : <Empty>Nenhum animal deste lote saiu por baixa.</Empty>}
    </Panel>
    </div>

    <div id="lote-painel-historico" role="tabpanel" aria-labelledby="lote-aba-historico" hidden={secaoAtiva !== "historico"}>
    <Panel className="mt-6 overflow-hidden">
      <span id="lote-historico" />
      <HistoricoMovimentacoes
        carregar={carregarHistorico}
        mostrarDirecao
        podeLancar={podeLancar}
        recarregarToken={historicoToken}
        onAbrir={(mov) => setMovimentacaoAbertaId(mov.id)}
        onMudou={recarregarTudo}
      />
    </Panel>
    </div>

    <div id="lote-painel-alteracoes" role="tabpanel" aria-labelledby="lote-aba-alteracoes" hidden={secaoAtiva !== "alteracoes"}>
    <Panel className="mt-6 overflow-hidden">
      <span id="lote-alteracoes" />
      <AlteracoesCadastro entidade="Lote" entidadeId={lote.id} recarregarToken={alteracoesToken} />
    </Panel>
    </div>

    <div id="lote-painel-sanidade" role="tabpanel" aria-labelledby="lote-aba-sanidade" hidden={secaoAtiva !== "sanidade"}>
    <div id="lote-sanidade" style={{ scrollMarginTop: 120 }}><HistoricoSanitario loteId={lote.id} /></div>
    </div>
    <div id="lote-painel-nutricao" role="tabpanel" aria-labelledby="lote-aba-nutricao" hidden={secaoAtiva !== "nutricao"}>
    <div id="lote-nutricao" style={{ scrollMarginTop: 120 }}><NutricaoLote loteId={lote.id} propriedadeId={lote.propriedadeId} podeLancar={podeLancar && lote.ativo} /></div>
    </div>

    {editando && <FormLote lote={lote} propriedades={[]} onSalvo={async () => { setEditando(false); await Promise.all([carregarLote(), recarregarResumoEBaixados()]); }} onFechar={() => setEditando(false)} />}

    {trazendo && <SeletorAnimais
      excluirLoteId={lote.id}
      onCancelar={() => setTrazendo(false)}
      onConfirmar={(animaisSelecionados) => {
        setTrazendo(false);
        setMovimentando({ animais: animaisSelecionados, destinoFixo: { propriedadeId: lote.propriedadeId, loteId: lote.id, rotulo: `${lote.nome} · ${lote.propriedade.nome}` } });
      }}
    />}

    {movimentando && catalogos && <FormMovimentar
      animais={movimentando.animais}
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
