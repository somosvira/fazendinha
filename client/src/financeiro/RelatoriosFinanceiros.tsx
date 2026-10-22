import { useFiltrosTabelaLocal } from "./useFiltrosTabelaLocal";
import { BarraConsulta } from "@/financeiro/BarraConsulta";
import { enfileirarSalvamentoRascunhoRelatorio, estadoRascunhoRelatorioAtivo, limparRascunhoRelatorioAtivo, useRascunhoRelatorioAtivo } from "./rascunhoRelatorioAtivo";
import { Input } from "@/components/ui/input";
import { normalizarBuscaFinanceira } from "./ListaCadastroFinanceiro";
import { PeriodoFinanceiroControl } from "./PeriodoFinanceiroControl";
import { isoDate } from "../components/DateRangePicker";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Download, FileText, Search } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { isNovoRelatorioFinanceiro, navegarPara, parseRelatorioFinanceiroId } from "../router";
import { descartarRascunhoRelatorioFinanceiro, listarRelatoriosFinanceiros, obterConfiguracoesFinanceiras, obterRascunhoRelatorioFinanceiro, salvarPdfRelatorioFinanceiro, type ConfiguracoesFinanceiras, type RascunhoRelatorioFinanceiro, type RelatorioFinanceiro } from "./novo-api";
import { Button, Empty, ErrorBox, PageHeader, PaginaFinanceira, PaginaSemDados, Panel, StatusPill, TabelaFinanceira, Paginacao, type ColunaTabela } from "./financeiro-ui";
import { dataCurta } from "./lib/relatorios";
import { NovoRelatorioFinanceiro } from "./NovoRelatorioFinanceiro";
import { RelatorioFinanceiroDetalhe } from "./RelatorioFinanceiroDetalhe";

type Vista = { tipo: "lista" } | { tipo: "novo" } | { tipo: "detalhe"; id: string };
const vistaDaUrl = (pathname: string): Vista => {
  if (isNovoRelatorioFinanceiro(pathname)) return { tipo: "novo" };
  const id = parseRelatorioFinanceiroId(pathname);
  return id != null ? { tipo: "detalhe", id } : { tipo: "lista" };
};
const mensagem = (falha: unknown) => falha instanceof Error ? falha.message : String(falha);
const dataHora = (valor: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(valor));
const DESCRICAO = "Central dos relatórios emitidos: cada um preserva o recorte, o autor e o PDF gerado.";

function recorte(r: RelatorioFinanceiro) {
  const p = r.parametros;
  const partes = [
    p.tipos?.length ? `${p.tipos.length} tipo${p.tipos.length > 1 ? "s" : ""}` : null,
    p.centroCustoIds?.length ? `${p.centroCustoIds.length} centro${p.centroCustoIds.length > 1 ? "s" : ""}` : null,
    p.categoriaIds?.length ? `${p.categoriaIds.length} categoria${p.categoriaIds.length > 1 ? "s" : ""}` : null,
    p.classificacoes?.length ? p.classificacoes.map((c) => c === "CUSTEIO" ? "custeio" : c === "INVESTIMENTO" ? "investimento" : "não classificadas").join(" + ") : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "Sem filtros";
}

export function RelatoriosFinanceiros({ podeExportar = true }: { podeExportar?: boolean }) {
  const trabalho = useRascunhoRelatorioAtivo();
  const [vista, setVista] = useState<Vista>(() => typeof window === "undefined" ? { tipo: "lista" } : vistaDaUrl(window.location.pathname));
  const [relatorios, setRelatorios] = useState<RelatorioFinanceiro[] | null>(null);
  const [cadastros, setCadastros] = useState<ConfiguracoesFinanceiras | null>(null);
  const [rascunho, setRascunho] = useState<RascunhoRelatorioFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [recente, setRecente] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [periodoEmissao, setPeriodoEmissao] = useState({ inicio: "", fim: "" });
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [confirmarNovo, setConfirmarNovo] = useState(false);
  const consultaColunas = useFiltrosTabelaLocal<RelatorioFinanceiro>([
    { chave: "nome", naBarra: true, rotulo: "Relatório", tipo: "texto", obter: r => r.nome },
    { chave: "autor", naBarra: true, rotulo: "Autor", tipo: "texto", obter: r => r.autor },
    { chave: "propriedade", rotulo: "Propriedade", tipo: "texto", obter: r => r.propriedade },
    { chave: "gerado", naBarra: true, rotulo: "Gerado em", tipo: "data", obter: r => isoDate(new Date(r.geradoEm)) },
  ], () => setPagina(1));

  const carregandoRef = useRef(false);
  const carregar = useCallback(async () => {
    if (carregandoRef.current) return;
    carregandoRef.current = true;
    setErro(null); setAtualizando(true);
    try {
      const [lista, dados, draft] = await Promise.all([
        listarRelatoriosFinanceiros(), obterConfiguracoesFinanceiras(),
        podeExportar ? obterRascunhoRelatorioFinanceiro() : Promise.resolve(null),
      ]);
      setRelatorios(lista); setCadastros(dados);
      const atual = estadoRascunhoRelatorioAtivo();
      setRascunho(atual.conhecido ? atual.rascunho : draft);
    } catch (falha) { setErro(mensagem(falha)); }
    finally { carregandoRef.current = false; setAtualizando(false); }
  }, [podeExportar]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const onPop = () => {
      const destino = vistaDaUrl(window.location.pathname);
      setVista(destino);
      if (destino.tipo === "lista") void carregar();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [carregar]);

  useEffect(() => {
    if (vista.tipo !== "lista" || erro || atualizando || !relatorios?.some(r => r.status === "PROCESSANDO")) return;
    let timer: number | undefined;
    const agendar = () => {
      window.clearTimeout(timer);
      if (document.visibilityState !== "hidden") timer = window.setTimeout(() => void carregar(), 4000);
    };
    agendar();
    document.addEventListener("visibilitychange", agendar);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", agendar); };
  }, [vista.tipo, erro, atualizando, relatorios, carregar]);

  const ir = (caminho: string, destino: Vista) => { navegarPara(caminho); setVista(destino); };
  const voltar = () => ir("/financeiro/relatorios", { tipo: "lista" });
  const abrirNovo = async (continuar: boolean) => {
    setErro(null); setAviso(null);
    if (!continuar && (rascunho || estadoRascunhoRelatorioAtivo().recuperacao)) {
      setIniciando(true);
      try { await enfileirarSalvamentoRascunhoRelatorio(descartarRascunhoRelatorioFinanceiro); limparRascunhoRelatorioAtivo(); setRascunho(null); }
      catch (falha) { setErro(mensagem(falha)); return; }
      finally { setIniciando(false); }
    }
    ir("/financeiro/relatorios/novo", { tipo: "novo" });
  };
  const pedirNovo = () => {
    if (rascunho || trabalho.recuperacao) setConfirmarNovo(true);
    else void abrirNovo(false);
  };
  const aoGerar = (relatorio: RelatorioFinanceiro, avisoDownload: string | null) => {
    setRascunho(null); setRecente(relatorio.id);
    setAviso(avisoDownload ?? `“${relatorio.nome}” foi gerado e o download do PDF começou.`);
    voltar();
  };
  const baixar = (relatorio: RelatorioFinanceiro) => salvarPdfRelatorioFinanceiro(relatorio).catch((falha) => setErro(mensagem(falha)));
  const abrir = (relatorio: RelatorioFinanceiro) => ir(`/financeiro/relatorios/${relatorio.id}`, { tipo: "detalhe", id: relatorio.id });

  if (vista.tipo === "detalhe") return <RelatorioFinanceiroDetalhe id={vista.id} podeExportar={podeExportar} onVoltar={voltar} />;
  if (vista.tipo === "novo" && podeExportar) {
    if (!cadastros) return <PaginaSemDados titulo="Novo relatório" descricao={DESCRICAO} label="Preparando relatório" erro={erro} />;
    return <NovoRelatorioFinanceiro cadastros={cadastros} rascunho={rascunho} onVoltar={voltar} onGerado={aoGerar} />;
  }
  if (!relatorios) return <><PaginaSemDados titulo="Relatórios financeiros" descricao={DESCRICAO} label="Carregando relatórios" erro={erro} />{erro && <PaginaFinanceira><Button secondary disabled={atualizando} onClick={() => void carregar()}>Tentar novamente</Button></PaginaFinanceira>}</>;

  const relatoriosFiltrados = consultaColunas.filtrar(relatorios).filter(r => { const dia = isoDate(new Date(r.geradoEm)); return normalizarBuscaFinanceira(`${r.nome} ${r.autor}`).includes(normalizarBuscaFinanceira(busca)) && (!periodoEmissao.inicio || dia >= periodoEmissao.inicio) && (!periodoEmissao.fim || dia <= periodoEmissao.fim); });
  const variasPropriedades = new Set(relatorios.map((r) => r.propriedadeId)).size > 1;
  const totalPaginas = Math.max(1, Math.ceil(relatoriosFiltrados.length / 15));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const colunas: ColunaTabela<RelatorioFinanceiro>[] = [
    { chave: "nome", titulo: "Relatório", principal: true, larguraMinima: 240, celula: (r) => <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="break-words">{r.nome}</strong>{r.status !== "CONCLUIDO" && <StatusPill status={r.status} />}{r.id === recente && <span className="text-[11px] font-semibold uppercase tracking-[.1em] text-green-800">Novo</span>}</div><div className="mt-0.5 text-xs text-ink-3">{recorte(r)}</div>{r.erro && <div className="mt-1 text-xs text-red-700">{r.erro}</div>}</div> },
    { chave: "periodo", titulo: "Período", larguraMinima: 190, celula: (r) => <span className="whitespace-nowrap">{dataCurta(r.parametros.dataInicio)} a {dataCurta(r.parametros.dataFim)}</span> },
    ...(variasPropriedades ? [{ chave: "propriedade", titulo: "Propriedade", larguraMinima: 150, celula: (r: RelatorioFinanceiro) => r.propriedade }] : []),
    { chave: "gerado", titulo: "Gerado em", larguraMinima: 140, celula: (r) => <span className="whitespace-nowrap">{dataHora(r.geradoEm)}</span> },
    { chave: "autor", titulo: "Autor", larguraMinima: 140, celula: (r) => r.autor },
    { chave: "acoes", titulo: "", alinhamento: "direita", larguraMinima: podeExportar ? 170 : 60, acoes: true, celula: (r) => <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>{podeExportar && r.status === "CONCLUIDO" && <Button secondary onClick={() => void baixar(r)}><Download size={16} strokeWidth={1.8} aria-hidden="true" /> Baixar PDF</Button>}<ChevronRight size={16} className="hidden text-ink-3 md:inline" aria-hidden="true" /></div> },
  ];
  const acoes = podeExportar ? <div className="flex flex-wrap gap-2">
    {(rascunho || trabalho.recuperacao) && <Button secondary onClick={() => void abrirNovo(true)}><FileText size={16} strokeWidth={1.8} aria-hidden="true" /> Continuar rascunho</Button>}
    <Button disabled={iniciando} onClick={pedirNovo} carregando={iniciando}>{!iniciando && <FileText size={16} strokeWidth={1.8} aria-hidden="true" />} {iniciando ? "Iniciando…" : "Novo relatório"}</Button>
  </div> : undefined;

  return <PaginaFinanceira colorida>
    <PageHeader eyebrow="" titulo="Relatórios financeiros" descricao="Consulte relatórios gerados ou prepare uma análise por período e sítio." acao={acoes} />
    <ErrorBox erro={erro} />
    {erro && <Button secondary disabled={atualizando} onClick={() => void carregar()}>Tentar novamente</Button>}
    {aviso && <div role="status" className="mt-4 rounded-lg border border-[color-mix(in_srgb,var(--pos)_30%,var(--card))] bg-[var(--fin-positive-bg)] p-4 text-sm text-[var(--pos)]">{aviso}</div>}
    <Panel className="mt-4 overflow-hidden">
      <BarraConsulta campos={consultaColunas.campos} edicaoFiltros={consultaColunas.edicao} erroFiltros={consultaColunas.erro} criterios={consultaColunas.criterios} onLimpar={consultaColunas.limpar}>
        <label className="fin-filtro-busca text-sm font-medium">Buscar relatório<span className="relative mt-1 block"><Search size={18} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" /><Input aria-label="Buscar relatório" placeholder="Nome ou autor…" value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }} className="pl-10" /></span></label>
        <div className="fin-filtro-controle"><PeriodoFinanceiroControl inicio={periodoEmissao.inicio} fim={periodoEmissao.fim} allowAll label="Período de emissão" onChange={periodo => { setPeriodoEmissao(periodo); setPagina(1); }} /></div>
      </BarraConsulta>
      {relatoriosFiltrados.length === 0
        ? <Empty>{relatorios.length ? "Nenhum relatório emitido no período selecionado." : "Nenhum relatório foi gerado ainda."}</Empty>
        : <TabelaFinanceira filtrosColunas={consultaColunas.colunas} rotulo="Relatórios gerados" colunas={colunas} compacta itens={relatoriosFiltrados.slice((paginaAtual - 1) * 15, paginaAtual * 15)} chaveDe={(r) => r.id} onAbrir={abrir} classeLinha={(r) => r.id === recente ? "bg-muted" : ""} />}
      <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} total={relatoriosFiltrados.length} porPagina={15} rotulo="Paginação de relatórios" substantivo="relatórios" idSelect="pagina-relatorios" onPagina={setPagina} />
    </Panel>
    <ConfirmDialog
      open={confirmarNovo}
      title="Criar um novo relatório?"
      message="Você já tem um rascunho de relatório em andamento. Para começar outro, o rascunho atual será apagado."
      confirmLabel="Descartar e criar"
      cancelLabel="Continuar rascunho"
      dismissLabel="Voltar à lista"
      cancelTone="safe"
      tone="danger"
      processando={iniciando}
      onCancel={() => { setConfirmarNovo(false); void abrirNovo(true); }}
      onDismiss={() => setConfirmarNovo(false)}
      onConfirm={() => { setConfirmarNovo(false); void abrirNovo(false); }}
    />
  </PaginaFinanceira>;
}
